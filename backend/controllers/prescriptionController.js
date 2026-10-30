const Prescription = require('../models/Prescription');
const Task = require('../models/Task');
const User = require('../models/User');
const {
  sendValidationError,
  validatePrescription,
  isObjectId
} = require('../utils/validation');

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// Convert one prescribed medicine into one task per selected time of day.
const buildMedicationTasks = (medication, baseTask) => {
  const timings = [];
  if (medication.timeOfDay.morning) timings.push('Morning');
  if (medication.timeOfDay.afternoon) timings.push('Afternoon');
  if (medication.timeOfDay.night) timings.push('Night');

  if (timings.length === 0) {
    return [
      {
        ...baseTask,
        taskType: 'Medication',
        title: `Take ${medication.medicineName} (${medication.dosage})`,
        description: `${medication.instruction} (${medication.frequency}).`,
        timing: 'Throughout the day'
      }
    ];
  }

  return timings.map((timing) => ({
    ...baseTask,
    taskType: 'Medication',
    title: `Take ${medication.medicineName} (${medication.dosage})`,
    description: `${medication.instruction} - ${timing} dosage.`,
    timing
  }));
};

// @desc    Create a new Prescription & Precautions (Doctor) and generate daily care tasks
// @route   POST /api/prescriptions
exports.createPrescription = async (req, res, next) => {
  try {
    const { errors, value } = validatePrescription(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const patient = await User.findOne({ _id: value.patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Selected patient not found.'
      });
    }

    // Link doctor to patient if not already assigned
    if (!patient.assignedDoctor) {
      patient.assignedDoctor = req.user.id;
      await patient.save();
    }

    const prescription = await Prescription.create({
      patient: value.patientId,
      doctor: req.user.id,
      diagnosis: value.diagnosis,
      clinicalNotes: value.clinicalNotes,
      medications: value.medications,
      precautions: value.precautions,
      followUpDate: value.followUpDate
    });

    const baseTask = {
      patient: value.patientId,
      doctor: req.user.id,
      prescription: prescription._id,
      targetDate: startOfToday(),
      status: 'todo'
    };

    const generatedTasks = [];

    value.medications.forEach((medication) => {
      generatedTasks.push(...buildMedicationTasks(medication, baseTask));
    });

    value.precautions.forEach((precaution) => {
      generatedTasks.push({
        ...baseTask,
        taskType: precaution.category === 'Monitoring / Vitals' ? 'Vital Check' : 'Precaution',
        title: precaution.title,
        description: precaution.description || 'Precaution advised by doctor during consultation.',
        timing: 'Throughout the day'
      });
    });

    if (generatedTasks.length > 0) {
      try {
        await Task.insertMany(generatedTasks);
      } catch (error) {
        // Keep the prescription and its tasks consistent if task creation fails.
        await prescription.deleteOne();
        throw error;
      }
    }

    res.status(201).json({
      success: true,
      message: 'Prescription & Care Plan created! Actionable daily tasks have been assigned to the patient.',
      prescription,
      tasksGeneratedCount: generatedTasks.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get prescriptions for the logged-in patient
// @route   GET /api/prescriptions/my-prescriptions
exports.getMyPrescriptions = async (req, res, next) => {
  try {
    const prescriptions = await Prescription.find({ patient: req.user.id })
      .populate('doctor', 'name specialization hospital email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      prescriptions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get prescriptions of a patient for doctor review
// @route   GET /api/prescriptions/patient/:patientId
exports.getPatientPrescriptionsForDoctor = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    if (!isObjectId(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const patient = await User.findOne({ _id: patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const prescriptions = await Prescription.find({ patient: patientId })
      .populate('doctor', 'name specialization hospital')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      prescriptions
    });
  } catch (error) {
    next(error);
  }
};
