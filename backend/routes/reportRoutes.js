const express = require('express');
const router = express.Router();
const {
  uploadReport,
  getMyReports,
  getPatientReportsForDoctor,
  deleteReport
} = require('../controllers/reportController');
const { protect, authorize, uploadReport: uploadMiddleware } = require('../middleware/auth');

// Patient uploads report
router.post('/upload', protect, authorize('patient'), uploadMiddleware.single('file'), uploadReport);

// Patient gets own reports
router.get('/my-reports', protect, authorize('patient'), getMyReports);

// Doctor views a patient's reports
router.get('/patient/:patientId', protect, authorize('doctor'), getPatientReportsForDoctor);

// Patient deletes report
router.delete('/:id', protect, authorize('patient'), deleteReport);

module.exports = router;
