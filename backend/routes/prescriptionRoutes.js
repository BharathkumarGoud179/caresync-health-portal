const express = require('express');
const router = express.Router();
const {
  createPrescription,
  getMyPrescriptions,
  getPatientPrescriptionsForDoctor
} = require('../controllers/prescriptionController');
const { protect, authorize } = require('../middleware/auth');

// Doctor creates a prescription and generates care tasks
router.post('/', protect, authorize('doctor'), createPrescription);

// Patient gets their own prescriptions
router.get('/my-prescriptions', protect, authorize('patient'), getMyPrescriptions);

// Doctor reviews prescriptions for a patient
router.get('/patient/:patientId', protect, authorize('doctor'), getPatientPrescriptionsForDoctor);

module.exports = router;
