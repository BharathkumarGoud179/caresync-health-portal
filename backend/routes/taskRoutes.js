const express = require('express');
const router = express.Router();
const {
  getMyTasks,
  toggleTaskStatus,
  getPatientTasksForDoctor,
  createDirectTask
} = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/auth');

// Patient fetches their care tasks & compliance stats
router.get('/my-tasks', protect, authorize('patient'), getMyTasks);

// Patient toggles task status (Done / To Do Yet)
router.patch('/:id/toggle', protect, authorize('patient'), toggleTaskStatus);

// Doctor checks compliance and tasks of a patient
router.get('/patient/:patientId', protect, authorize('doctor'), getPatientTasksForDoctor);

// Doctor adds a direct task/precaution for patient
router.post('/create-task', protect, authorize('doctor'), createDirectTask);

module.exports = router;
