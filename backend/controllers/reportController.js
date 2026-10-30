const Report = require('../models/Report');
const User = require('../models/User');
const { hasDoctorAccess } = require('../utils/accessControl');
const { sendNotification } = require('../utils/notificationHelper');
const { analyzeMedicalReport } = require('../utils/aiLabAnalyzer');
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

    // Strict Privacy Access Check
    const hasAccess = await hasDoctorAccess(patientId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: You do not have approved access to this patient's medical records. Patient must send an invitation and it must be accepted."
      });
    }

    const reports = await Report.find({ patient: patientId }).sort({
      reportDate: -1,
      createdAt: -1
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

