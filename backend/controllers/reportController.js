const Report = require('../models/Report');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const {
  sendValidationError,
  validateReport,
  isObjectId,
  asString
} = require('../utils/validation');

const removeUploadedFile = async (file) => {
  if (!file || !file.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Could not remove uploaded file:', error.message);
    }
  }
};

// @desc    Upload a new medical report (Patient)
// @route   POST /api/reports/upload
exports.uploadReport = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select a file to upload (PDF, JPG, PNG, WEBP).'
      });
    }

    const { errors, value } = validateReport(req.body);
    if (errors.length > 0) {
      await removeUploadedFile(req.file);
      return sendValidationError(res, errors);
    }

    const report = await Report.create({
      patient: req.user.id,
      title: value.title || req.file.originalname,
      category: value.category,
      reportDate: value.reportDate,
      labOrHospital: value.labOrHospital,
      notes: value.notes,
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
    // If saving the metadata failed, do not leave an orphaned file on disk.
    await removeUploadedFile(req.file);
    next(error);
  }
};

// @desc    Get all reports for the logged-in patient
// @route   GET /api/reports/my-reports
exports.getMyReports = async (req, res, next) => {
  try {
    const category = asString(req.query.category);
    const search = asString(req.query.search);
    const query = { patient: req.user.id };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      // Escape user input so a search term cannot become a regex injection.
      const safeSearch = search.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.title = { $regex: safeSearch, $options: 'i' };
    }

    const reports = await Report.find(query).sort({ reportDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reports of a specific patient (for Doctor)
// @route   GET /api/reports/patient/:patientId
exports.getPatientReportsForDoctor = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    if (!isObjectId(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const patient = await User.findOne({ _id: patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found.'
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
    next(error);
  }
};

// @desc    Delete a medical report (Patient only)
// @route   DELETE /api/reports/:id
exports.deleteReport = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid report ID.' });
    }

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found.'
      });
    }

    // Verify ownership
    if (report.patient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this report.'
      });
    }

    // Delete file from disk if it exists
    const fullPath = path.join(__dirname, '..', 'public', report.filePath);
    try {
      await fs.promises.unlink(fullPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Could not delete file from disk:', error.message);
      }
    }

    await report.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};
