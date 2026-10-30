const express = require('express');
const router = express.Router();
const {
  uploadReport,
  getMyReports,
  getPatientReportsForDoctor,
  deleteReport,
  analyzeReportAI,
  getReportById,
  viewOrDownloadReportFile,
  detectReportChanges
} = require('../controllers/reportController');
const { protect, authorize, uploadReport: uploadMiddleware } = require('../middleware/auth');

// Patient uploads report
router.post('/upload', protect, authorize('patient'), uploadMiddleware.single('file'), uploadReport);

// Patient gets own reports
router.get('/my-reports', protect, authorize('patient'), getMyReports);

// AI Longitudinal Change Detection: Analyze biomarker trends across reports
router.get('/analytics/changes', protect, detectReportChanges);
router.get('/analytics/changes/:patientId', protect, authorize('doctor'), detectReportChanges);

// Doctor views a patient's reports (subject to granular access permissions)
router.get('/patient/:patientId', protect, authorize('doctor'), getPatientReportsForDoctor);

// Secure report file view / download with audit logging
router.get('/:id/view-file', protect, viewOrDownloadReportFile);

// AI-powered medical lab report analysis for an individual report
router.post('/:id/analyze-ai', protect, analyzeReportAI);

// Get single report with AI analysis details
router.get('/:id', protect, getReportById);

// Patient deletes report
router.delete('/:id', protect, deleteReport);

module.exports = router;
