const express = require('express');
const router = express.Router();
const ConnectionRequest = require('../models/ConnectionRequest');
const AccessAuditLog = require('../models/AccessAuditLog');
const Report = require('../models/Report');
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { hasDoctorAccess, getDoctorAccessDetails } = require('../utils/accessControl');
const { logAccessAudit } = require('../utils/auditLogger');
const { sendNotification } = require('../utils/notificationHelper');
const { generateConsultationSummaryPdf } = require('../utils/consultationSummaryPdf');

// All routes require authentication
router.use(protect);

// @desc    Update sharing permissions for a doctor (granular reports, time limit)
// @route   PUT /api/sharing/permissions/:doctorId
// @access  Patient only
router.put('/permissions/:doctorId', authorize('patient'), async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { shareScope, allowedReportIds, durationHours } = req.body;

    let connection = await ConnectionRequest.findOne({
      patient: req.user.id,
      doctor: doctorId
    });

    if (!connection) {
      return res.status(404).json({ success: false, message: 'No connection record found for this doctor.' });
    }

    if (shareScope) {
      connection.shareScope = shareScope === 'selected' ? 'selected' : 'all';
    }

    if (Array.isArray(allowedReportIds)) {
      connection.allowedReportIds = allowedReportIds;
    }

    // Handle time-limited expiration
    if (durationHours && Number(durationHours) > 0) {
      const expiresAt = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
      connection.expiresAt = expiresAt;
    } else if (durationHours === null || durationHours === 0) {
      connection.expiresAt = null; // Permanent until manual revoke
    }

    // Reset revoke flags if previously revoked
    if (connection.status === 'revoked') {
      connection.status = 'accepted';
      connection.revokedAt = null;
      connection.revokedReason = '';
    }

    await connection.save();

    // Log in audit trail
    await logAccessAudit({
      patient: req.user.id,
      doctor: doctorId,
      action: 'grant_permission',
      req,
      metadata: {
        shareScope: connection.shareScope,
        allowedReportsCount: (connection.allowedReportIds || []).length,
        expiresAt: connection.expiresAt
      }
    });

    // Notify doctor
    const io = req.app.get('io');
    await sendNotification({
      recipient: doctorId,
      sender: req.user.id,
      type: 'system',
      title: 'Sharing Permissions Updated',
      message: `${req.user.name} updated your medical record sharing permissions (${connection.shareScope === 'all' ? 'All Records' : `${(connection.allowedReportIds || []).length} Selected Report(s)`}).`,
      link: '/doctor',
      io
    });

    res.status(200).json({
      success: true,
      message: 'Sharing permissions updated successfully.',
      connection
    });
  } catch (error) {
    console.error('Update sharing permissions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Revoke doctor's access to medical vault immediately
// @route   POST /api/sharing/revoke/:doctorId
// @access  Patient only
router.post('/revoke/:doctorId', authorize('patient'), async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { reason } = req.body;

    const connection = await ConnectionRequest.findOne({
      patient: req.user.id,
      doctor: doctorId
    });

    if (!connection) {
      return res.status(404).json({ success: false, message: 'No connection record found for this doctor.' });
    }

    connection.status = 'revoked';
    connection.revokedAt = new Date();
    connection.revokedReason = reason || 'Patient revoked access.';
    await connection.save();

    // Log in audit trail
    await logAccessAudit({
      patient: req.user.id,
      doctor: doctorId,
      action: 'revoke_access',
      req,
      metadata: { reason: connection.revokedReason }
    });

    // Notify doctor
    const io = req.app.get('io');
    await sendNotification({
      recipient: doctorId,
      sender: req.user.id,
      type: 'invite_rejected',
      title: 'Vault Access Revoked',
      message: `${req.user.name} has revoked your access to their medical records.`,
      link: '/doctor',
      io
    });

    res.status(200).json({
      success: true,
      message: 'Doctor access has been revoked successfully. Your medical records are now hidden from this doctor.',
      connection
    });
  } catch (error) {
    console.error('Revoke access error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get patient's access audit logs (history of who viewed/downloaded what)
// @route   GET /api/sharing/audit-logs
// @access  Patient or Doctor
router.get('/audit-logs', async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'patient') {
      query.patient = req.user.id;
    } else if (req.user.role === 'doctor') {
      query.doctor = req.user.id;
    }

    const logs = await AccessAuditLog.find(query)
      .populate('doctor', 'name specialization hospital email')
      .populate('patient', 'name email')
      .populate('report', 'title category')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get sharing settings & active permissions for patient's doctors
// @route   GET /api/sharing/settings
// @access  Patient only
router.get('/settings', authorize('patient'), async (req, res) => {
  try {
    const connections = await ConnectionRequest.find({ patient: req.user.id })
      .populate('doctor', 'name specialization hospital email phone')
      .populate('allowedReportIds', 'title category reportDate')
      .sort({ updatedAt: -1 });

    const patientReports = await Report.find({ patient: req.user.id })
      .select('title category reportDate')
      .sort({ reportDate: -1 });

    res.status(200).json({
      success: true,
      connections,
      allReports: patientReports
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Generate & download a read-only Medical Consultation Brief PDF
// @route   GET /api/sharing/consultation-summary-pdf
// @access  Patient or Authorized Doctor
router.get('/consultation-summary-pdf', async (req, res) => {
  try {
    let patientId = req.user.id;
    let doctorId = null;

    if (req.user.role === 'doctor') {
      patientId = req.query.patientId;
      doctorId = req.user.id;

      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId is required for doctor generation.' });
      }

      // Check access permission
      const hasAccess = await hasDoctorAccess(patientId, doctorId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access Denied: You do not have approved access for this patient.' });
      }
    } else {
      doctorId = req.query.doctorId || null;
    }

    const patient = await User.findById(patientId);
    let doctor = null;
    if (doctorId) {
      doctor = await User.findById(doctorId);
    }

    // Determine which reports to include (full or filtered by permission)
    let reportsQuery = { patient: patientId };
    if (req.user.role === 'doctor') {
      const conn = await ConnectionRequest.findOne({ patient: patientId, doctor: doctorId, status: 'accepted' });
      if (conn && conn.shareScope === 'selected') {
        reportsQuery._id = { $in: conn.allowedReportIds || [] };
      }
    }

    const reports = await Report.find(reportsQuery).sort({ reportDate: -1 }).limit(10);
    const prescriptions = await Prescription.find({ patient: patientId }).populate('doctor', 'name specialization').sort({ createdAt: -1 }).limit(5);

    // Log the summary view/download in audit trail
    if (req.user.role === 'doctor') {
      await logAccessAudit({
        patient: patientId,
        doctor: doctorId,
        action: 'consultation_summary_view',
        req,
        metadata: { reportsCount: reports.length, prescriptionsCount: prescriptions.length }
      });
    }

    const filename = `CareSync-Consultation-Summary-${patient.name.replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    generateConsultationSummaryPdf({
      patient,
      doctor,
      reports,
      prescriptions,
      generatedBy: req.user
    }, res);
  } catch (error) {
    console.error('Consultation summary PDF error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
