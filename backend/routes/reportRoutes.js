const express = require('express');
const router = express.Router();
const {
  uploadReport,
  getMyReports,
  getPatientReportsForDoctor,
  deleteReport,
  analyzeReportAI,
  getReportById
} = require('../controllers/reportController');
const { protect, authorize, uploadReport: uploadMiddleware } = require('../middleware/auth');

// Patient uploads report
router.post('/upload', protect, authorize('patient'), uploadMiddleware.single('file'), uploadReport);

// Patient gets own reports
router.get('/my-reports', protect, authorize('patient'), getMyReports);

// Doctor views a patient's reports
router.get('/patient/:patientId', protect, authorize('doctor'), getPatientReportsForDoctor);

// AI-powered medical lab report analysis
router.post('/:id/analyze-ai', protect, analyzeReportAI);

// Get single report with AI analysis details
router.get('/:id', protect, getReportById);

// Patient deletes report
router.delete('/:id', protect, deleteReport);

module.exports = router;
