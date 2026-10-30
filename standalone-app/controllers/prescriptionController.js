const Prescription = require('../models/Prescription');
const Task = require('../models/Task');
const User = require('../models/User');
const { hasDoctorAccess } = require('../utils/accessControl');
const { sendNotification } = require('../utils/notificationHelper');
const { generatePrescriptionPdf } = require('../utils/prescriptionPdf');

// @desc    Create a new Prescription & Precautions (Doctor) and generate daily care tasks
// @route   POST /api/prescriptions
exports.createPrescription = async (req, res) => {
  try {
    const { patientId, diagnosis, clinicalNotes, medications, precautions, followUpDate } = req.body;

    if (!patientId || !diagnosis) {
      return res.status(400).json({
        success: false,
        message: 'Please provide patient ID and diagnosis.'
      });
    }

    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Selected patient not found.'
      });
    }

    // Access control check
    const hasAccess = await hasDoctorAccess(patientId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have approved access to prescribe to this patient.'
      });
    }

    // Link doctor to patient if not already assigned
    if (!patient.assignedDoctor) {
      patient.assignedDoctor = req.user.id;
      await patient.save();
    }

    // Create prescription
    const prescription = await Prescription.create({
      patient: patientId,
      doctor: req.user.id,
      diagnosis,
      clinicalNotes,
      medications: medications || [],
      precautions: precautions || [],
      followUpDate: followUpDate || null
    });

    // Auto-generate actionable Care Tasks for the patient
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const generatedTasks = [];

    // 1. Generate tasks for Medications
    if (Array.isArray(medications)) {
      medications.forEach((med) => {
        // Morning dose
        if (med.timeOfDay && med.timeOfDay.morning) {
          generatedTasks.push({
            patient: patientId,
            doctor: req.user.id,
            prescription: prescription._id,
            taskType: 'Medication',
            title: `Take ${med.medicineName} (${med.dosage})`,
            description: `${med.instruction || 'After food'} - Morning dosage.`,
            timing: 'Morning',
            targetDate: today,
            status: 'todo'
          });
        }
        // Afternoon dose
        if (med.timeOfDay && med.timeOfDay.afternoon) {
          generatedTasks.push({
            patient: patientId,
            doctor: req.user.id,
            prescription: prescription._id,
            taskType: 'Medication',
            title: `Take ${med.medicineName} (${med.dosage})`,
            description: `${med.instruction || 'After food'} - Afternoon dosage.`,
            timing: 'Afternoon',
            targetDate: today,
            status: 'todo'
          });
        }
        // Night dose
        if (med.timeOfDay && med.timeOfDay.night) {
          generatedTasks.push({
            patient: patientId,
            doctor: req.user.id,
            prescription: prescription._id,
            taskType: 'Medication',
            title: `Take ${med.medicineName} (${med.dosage})`,
            description: `${med.instruction || 'After food'} - Night dosage.`,
            timing: 'Night',
            targetDate: today,
            status: 'todo'
          });
        }
        // Default if no specific timing check selected
        if (!med.timeOfDay || (!med.timeOfDay.morning && !med.timeOfDay.afternoon && !med.timeOfDay.night)) {
          generatedTasks.push({
            patient: patientId,
            doctor: req.user.id,
            prescription: prescription._id,
            taskType: 'Medication',
            title: `Take ${med.medicineName} (${med.dosage})`,
            description: `${med.instruction || 'Follow doctor directions'} (${med.frequency || 'Daily'}).`,
            timing: 'Throughout the day',
            targetDate: today,
            status: 'todo'
          });
        }
      });
    }

    // 2. Generate tasks for Precautions & Lifestyle recommendations
    if (Array.isArray(precautions)) {
      precautions.forEach((prec) => {
        generatedTasks.push({
          patient: patientId,
          doctor: req.user.id,
          prescription: prescription._id,
          taskType: prec.category === 'Monitoring / Vitals' ? 'Vital Check' : 'Precaution',
          title: prec.title,
          description: prec.description || 'Precaution advised by doctor during consultation.',
          timing: 'Throughout the day',
          targetDate: today,
          status: 'todo'
        });
      });
    }

    // Insert all generated tasks into database
    if (generatedTasks.length > 0) {
      await Task.insertMany(generatedTasks);
    }

    // Send real-time notification to patient
    const io = req.app.get('io');
    await sendNotification({
      recipient: patientId,
      sender: req.user.id,
      type: 'new_prescription',
      title: 'New Prescription Issued',
      message: `Dr. ${req.user.name} issued a new care plan for "${diagnosis}". Your daily checklist has been updated.`,
      link: '/patient',
      metadata: { prescriptionId: prescription._id },
      io
    });

    res.status(201).json({
      success: true,
      message: 'Prescription & Care Plan created! Actionable daily tasks have been assigned to the patient.',
      prescription,
      tasksGeneratedCount: generatedTasks.length
    });
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error occurred while creating prescription.'
    });
  }
};

// @desc    Get prescriptions for the logged-in patient
// @route   GET /api/prescriptions/my-prescriptions
exports.getMyPrescriptions = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get prescriptions of a patient for doctor review
// @route   GET /api/prescriptions/patient/:patientId
exports.getPatientPrescriptionsForDoctor = async (req, res) => {
  try {
    const hasAccess = await hasDoctorAccess(req.params.patientId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have approved access to view prescriptions for this patient.'
      });
    }

    const prescriptions = await Prescription.find({ patient: req.params.patientId })
      .populate('doctor', 'name specialization hospital')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      prescriptions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Download Prescription as formatted PDF document
// @route   GET /api/prescriptions/:id/pdf
exports.downloadPrescriptionPdf = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('doctor', 'name specialization hospital email phone')
      .populate('patient', 'name email phone age gender bloodGroup allergies');

    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found.' });
    }

    // Access control: User must be the patient or the prescribing/approved doctor
    if (req.user.role === 'patient') {
      if (prescription.patient._id.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied to this prescription.' });
      }
    } else if (req.user.role === 'doctor') {
      const hasAccess = await hasDoctorAccess(prescription.patient._id, req.user.id);
      if (!hasAccess && prescription.doctor._id.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied: not authorized for this patient.' });
      }
    }

    const filename = `CareSync-Prescription-${prescription._id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    generatePrescriptionPdf(prescription, res);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

