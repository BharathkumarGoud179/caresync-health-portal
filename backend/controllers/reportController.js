const Report = require('../models/Report');
const User = require('../models/User');
const ConnectionRequest = require('../models/ConnectionRequest');
const { hasDoctorAccess } = require('../utils/accessControl');
const { sendNotification } = require('../utils/notificationHelper');
const { analyzeMedicalReport } = require('../utils/aiLabAnalyzer');
const { detectChangesBetweenReports } = require('../utils/aiReportChangeDetector');
const { logAccessAudit } = require('../utils/auditLogger');
const fs = require('fs');
const path = require('path');

// @desc    Upload a new medical report (Patient)
// @route   POST /api/reports/upload
exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select a file to upload (PDF, JPG, PNG).'
      });
    }

    const { title, category, reportDate, labOrHospital, notes } = req.body;

    const report = await Report.create({
      patient: req.user.id,
      title: title || req.file.originalname,
      category: category || 'Blood Test',
      reportDate: reportDate ? new Date(reportDate) : new Date(),
      labOrHospital: labOrHospital || 'General Clinic',
      notes: notes || '',
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
      fileType: req.file.mimetype,
      fileSize: req.file.size
    });

    res.status(201).json({
      success: true,
      message: 'Medical report uploaded successfully!',
      report
    });
  } catch (error) {
    console.error('Upload report error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error occurred while saving the report.'
    });
  }
};

// @desc    Get all reports for the logged-in patient
// @route   GET /api/reports/my-reports
exports.getMyReports = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = { patient: req.user.id };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const reports = await Report.find(query).sort({ reportDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reports of a specific patient (for Doctor)
// @route   GET /api/reports/patient/:patientId
exports.getPatientReportsForDoctor = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found.'
      });
    }

    // Strict Privacy Access Check & Granular Sharing Filtering
    const hasAccess = await hasDoctorAccess(patientId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: You do not have approved, active access to this patient's medical records. Patient may have revoked access or permission has expired."
      });
    }

    // Check if patient set granular permissions (selective report sharing)
    const connection = await ConnectionRequest.findOne({ patient: patientId, doctor: req.user.id, status: 'accepted' });
    let reportsQuery = { patient: patientId };

    if (connection && connection.shareScope === 'selected') {
      reportsQuery._id = { $in: connection.allowedReportIds || [] };
    }

    const reports = await Report.find(reportsQuery).sort({
      reportDate: -1,
      createdAt: -1
    });

    // Record access event in Immutable Audit Trail
    await logAccessAudit({
      patient: patientId,
      doctor: req.user.id,
      action: 'view_vault',
      req,
      metadata: { reportsReturnedCount: reports.length, shareScope: connection ? connection.shareScope : 'all' }
    });

    res.status(200).json({
      success: true,
      count: reports.length,
      patient: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        age: patient.age,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        allergies: patient.allergies,
        phone: patient.phone
      },
      reports
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a medical report (Patient only)
// @route   DELETE /api/reports/:id
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found.'
      });
    }

    // Verify ownership
    if (report.patient.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this report.'
      });
    }

    // Delete file from disk if exists
    const fullPath = path.join(__dirname, '..', 'public', report.filePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.warn('Could not delete file from disk:', err.message);
      }
    }

    await report.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Perform AI-Powered Medical Lab Analysis on a report
// @route   POST /api/reports/:id/analyze-ai
exports.analyzeReportAI = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    // Access check: User must be patient owner or authorized doctor
    if (req.user.role === 'patient') {
      if (report.patient.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied to this report.' });
      }
    } else if (req.user.role === 'doctor') {
      const hasAccess = await hasDoctorAccess(report.patient, req.user.id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied: not authorized for this patient.' });
      }
    }

    // Run AI lab analysis
    const analysis = await analyzeMedicalReport(report);
    report.aiAnalysis = analysis;
    await report.save();

    // Trigger in-app notification
    const io = req.app.get('io');
    await sendNotification({
      recipient: report.patient,
      sender: req.user.id,
      type: 'ai_analysis_ready',
      title: 'AI Lab Analysis Completed',
      message: `AI analysis ready for "${report.title}". Overall risk status: ${analysis.overallRiskScore}.`,
      link: '/patient',
      metadata: { reportId: report._id, riskScore: analysis.overallRiskScore },
      io
    });

    res.status(200).json({
      success: true,
      message: 'AI medical analysis completed successfully!',
      aiAnalysis: report.aiAnalysis
    });
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single report with its AI analysis details
// @route   GET /api/reports/:id
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate('patient', 'name age gender bloodGroup');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    // Access check
    if (req.user.role === 'patient') {
      if (report.patient._id.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    } else if (req.user.role === 'doctor') {
      const hasAccess = await hasDoctorAccess(report.patient._id, req.user.id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied: not authorized for this patient.' });
      }
    }

    res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Download / view a report file with access audit logging
// @route   GET /api/reports/:id/view-file
exports.viewOrDownloadReportFile = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    if (req.user.role === 'patient') {
      if (report.patient.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    } else if (req.user.role === 'doctor') {
      const hasAccess = await hasDoctorAccess(report.patient, req.user.id, report._id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied: doctor does not have permission for this document.' });
      }

      // Log access audit event (view/download document)
      const actionType = req.query.download === 'true' ? 'download_report' : 'view_report';
      await logAccessAudit({
        patient: report.patient,
        doctor: req.user.id,
        action: actionType,
        report: report._id,
        reportTitle: report.title,
        req
      });
    }

    const fullPath = path.join(__dirname, '..', 'public', report.filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'Physical file not found on server.' });
    }

    if (req.query.download === 'true') {
      return res.download(fullPath, report.originalName || report.fileName);
    } else {
      return res.sendFile(fullPath);
    }
  } catch (error) {
    console.error('View report file error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    AI Longitudinal Change Detector: Compare biomarkers across multiple patient reports
// @route   GET /api/reports/analytics/changes
// @route   GET /api/reports/analytics/changes/:patientId
exports.detectReportChanges = async (req, res) => {
  try {
    let patientId = req.user.id;

    if (req.user.role === 'doctor') {
      patientId = req.params.patientId || req.query.patientId;
      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId is required for doctor trend analysis.' });
      }

      const hasAccess = await hasDoctorAccess(patientId, req.user.id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied: not authorized for this patient.' });
      }
    }

    // Retrieve patient reports (respecting sharing scope if doctor)
    let reportsQuery = { patient: patientId };
    if (req.user.role === 'doctor') {
      const conn = await ConnectionRequest.findOne({ patient: patientId, doctor: req.user.id, status: 'accepted' });
      if (conn && conn.shareScope === 'selected') {
        reportsQuery._id = { $in: conn.allowedReportIds || [] };
      }
    }

    const reports = await Report.find(reportsQuery).sort({ reportDate: 1 });

    if (reports.length < 2) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'insufficient_data',
          message: 'At least 2 reports are required to analyze changes and trends over time.',
          reportsCount: reports.length,
          trends: []
        }
      });
    }

    // Run AI change detection
    const changeAnalysis = await detectChangesBetweenReports(reports);

    res.status(200).json({
      success: true,
      data: changeAnalysis
    });
  } catch (error) {
    console.error('Detect report changes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


