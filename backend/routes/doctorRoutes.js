const express = require('express');
const router = express.Router();
const {
  getDoctorPatients,
  getAllDoctors,
  selectDoctor
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/auth');

// Doctor views all patients
router.get('/patients', protect, authorize('doctor'), getDoctorPatients);

// Patient gets list of all doctors
router.get('/all', protect, getAllDoctors);

// Patient assigns a doctor
router.post('/select-doctor', protect, authorize('patient'), selectDoctor);

module.exports = router;
