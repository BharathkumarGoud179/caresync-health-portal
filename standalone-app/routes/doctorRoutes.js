const express = require('express');
const router = express.Router();
const {
  getDoctorPatients,
  getPendingRequests,
  respondToRequest,
  sendConnectionRequest,
  getMyConnection,
  getAllDoctors
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/auth');

// Doctor gets ONLY approved/connected patients
router.get('/patients', protect, authorize('doctor'), getDoctorPatients);

// Doctor views pending invitation requests
router.get('/requests/pending', protect, authorize('doctor'), getPendingRequests);

// Doctor responds (accept/reject) to patient request
router.post('/requests/:id/respond', protect, authorize('doctor'), respondToRequest);

// Patient sends invitation to doctor
router.post('/send-request', protect, authorize('patient'), sendConnectionRequest);

// Patient checks their active/pending connection
router.get('/my-connection', protect, authorize('patient'), getMyConnection);

// Patient gets list of all doctors
router.get('/all', protect, getAllDoctors);

module.exports = router;
