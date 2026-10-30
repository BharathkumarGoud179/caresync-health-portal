const User = require('../models/User');
const Report = require('../models/Report');
const Task = require('../models/Task');
const Prescription = require('../models/Prescription');
const ConnectionRequest = require('../models/ConnectionRequest');
const { sendNotification } = require('../utils/notificationHelper');

// @desc    Get ONLY accepted patients for the logged-in doctor
// @route   GET /api/doctors/patients
exports.getDoctorPatients = async (req, res) => {
  try {
    // 1. Strict Access Control: Find accepted connections for this doctor
    const acceptedConnections = await ConnectionRequest.find({
      doctor: req.user.id,
      status: 'accepted'
    });

    const acceptedPatientIds = acceptedConnections.map((c) => c.patient);

    // 2. Fetch only approved patients
    const patients = await User.find({
      _id: { $in: acceptedPatientIds },
      role: 'patient'
    }).select('-password').sort({ name: 1 });

    // 3. Enrich with count of reports and adherence stats
    const enrichedPatients = await Promise.all(
      patients.map(async (patient) => {
        const reportCount = await Report.countDocuments({ patient: patient._id });
        const latestPrescription = await Prescription.findOne({ patient: patient._id }).sort({ createdAt: -1 });
        const totalTasks = await Task.countDocuments({ patient: patient._id });
        const doneTasks = await Task.countDocuments({ patient: patient._id, status: 'done' });
        const adherenceRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        return {
          id: patient._id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          age: patient.age,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
          allergies: patient.allergies,
          reportCount,
          totalTasks,
          doneTasks,
          adherenceRate,
          latestDiagnosis: latestPrescription ? latestPrescription.diagnosis : 'No active care plan'
        };
      })
    );

    res.status(200).json({
      success: true,
      count: enrichedPatients.length,
      patients: enrichedPatients
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get pending patient invitation requests for the logged-in doctor
// @route   GET /api/doctors/requests/pending
exports.getPendingRequests = async (req, res) => {
  try {
    const pending = await ConnectionRequest.find({
      doctor: req.user.id,
      status: 'pending'
    }).populate('patient', 'name email phone age gender bloodGroup allergies createdAt').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pending.length,
      requests: pending
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Doctor accepts or rejects a patient request
// @route   POST /api/doctors/requests/:id/respond
exports.respondToRequest = async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    const request = await ConnectionRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Invitation request not found.' });
    }

    if (request.doctor.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to respond to this request.' });
    }

    if (action === 'accept') {
      request.status = 'accepted';
      request.respondedAt = new Date();
      await request.save();

      // Assign doctor to patient's primary profile
      await User.findByIdAndUpdate(request.patient, { assignedDoctor: req.user.id });

      // Send real-time notification to patient
      const io = req.app.get('io');
      await sendNotification({
        recipient: request.patient,
        sender: req.user.id,
        type: 'invite_accepted',
        title: 'Connection Request Accepted',
        message: `Dr. ${req.user.name} accepted your invitation! Your medical vault is now securely linked.`,
        link: '/patient',
        metadata: { doctorId: req.user.id },
        io
      });

      return res.status(200).json({
        success: true,
        message: 'Patient invitation accepted! You now have access to their medical records and care plan.',
        status: 'accepted'
      });
    } else if (action === 'reject') {
      request.status = 'rejected';
      request.respondedAt = new Date();
      await request.save();

      const io = req.app.get('io');
      await sendNotification({
        recipient: request.patient,
        sender: req.user.id,
        type: 'invite_rejected',
        title: 'Connection Update',
        message: `Dr. ${req.user.name} was unable to accept your connection request at this time.`,
        link: '/patient',
        metadata: { doctorId: req.user.id },
        io
      });

      return res.status(200).json({
        success: true,
        message: 'Patient invitation request declined.',
        status: 'rejected'
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be accept or reject.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Patient sends an invitation request to a doctor
// @route   POST /api/doctors/send-request
exports.sendConnectionRequest = async (req, res) => {
  try {
    const { doctorId, message } = req.body;

    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    // Check existing request
    let request = await ConnectionRequest.findOne({
      patient: req.user.id,
      doctor: doctorId
    });

    if (request) {
      if (request.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: `You are already connected with ${doctor.name}.`
        });
      }
      if (request.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: `An invitation request to ${doctor.name} is already pending approval.`
        });
      }
      // If previously rejected, allow re-requesting
      request.status = 'pending';
      request.message = message || 'Re-requesting connection for medical consultation.';
      request.respondedAt = null;
      await request.save();
    } else {
      request = await ConnectionRequest.create({
        patient: req.user.id,
        doctor: doctorId,
        message: message || 'Requesting clinical consultation and sharing medical vault.',
        status: 'pending'
      });
    }

    // Send real-time notification to doctor
    const io = req.app.get('io');
    await sendNotification({
      recipient: doctorId,
      sender: req.user.id,
      type: 'invite_received',
      title: 'New Patient Invitation',
      message: `${req.user.name} sent you a connection invitation to review their health vault.`,
      link: '/doctor',
      metadata: { requestId: request._id },
      io
    });

    res.status(200).json({
      success: true,
      message: `Invitation sent to ${doctor.name}! Your records will be shared once the doctor accepts your request.`,
      request
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Patient checks their connection status (pending or approved)
// @route   GET /api/doctors/my-connection
exports.getMyConnection = async (req, res) => {
  try {
    const connection = await ConnectionRequest.findOne({
      patient: req.user.id,
      status: { $in: ['accepted', 'pending'] }
    }).populate('doctor', 'name specialization hospital email phone').sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      connection
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get list of all doctors for patient selection
// @route   GET /api/doctors/all
exports.getAllDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' })
      .select('name specialization hospital licenseNumber experienceYears email phone')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: doctors.length,
      doctors
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
