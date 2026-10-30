const User = require('../models/User');
const Report = require('../models/Report');
const Task = require('../models/Task');
const Prescription = require('../models/Prescription');
const { isObjectId } = require('../utils/validation');

// @desc    Get all patients for the doctor dashboard
// @route   GET /api/doctors/patients
exports.getDoctorPatients = async (req, res, next) => {
  try {
    const patients = await User.find({ role: 'patient' })
      .select('name email phone age gender bloodGroup allergies createdAt')
      .sort({ createdAt: -1 });

    if (patients.length === 0) {
      return res.status(200).json({ success: true, count: 0, patients: [] });
    }

    const patientIds = patients.map((patient) => patient._id);

    // Group related records in three queries instead of querying per patient.
    const [reportCounts, taskStats, latestDiagnoses] = await Promise.all([
      Report.aggregate([
        { $match: { patient: { $in: patientIds } } },
        { $group: { _id: '$patient', count: { $sum: 1 } } }
      ]),
      Task.aggregate([
        { $match: { patient: { $in: patientIds } } },
        {
          $group: {
            _id: '$patient',
            total: { $sum: 1 },
            done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }
          }
        }
      ]),
      Prescription.aggregate([
        { $match: { patient: { $in: patientIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$patient', diagnosis: { $first: '$diagnosis' } } }
      ])
    ]);

    const reportCountMap = new Map(reportCounts.map((row) => [row._id.toString(), row.count]));
    const taskStatsMap = new Map(taskStats.map((row) => [row._id.toString(), row]));
    const diagnosisMap = new Map(
      latestDiagnoses.map((row) => [row._id.toString(), row.diagnosis])
    );

    const enrichedPatients = patients.map((patient) => {
      const id = patient._id.toString();
      const stats = taskStatsMap.get(id) || { total: 0, done: 0 };
      const adherenceRate =
        stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

      return {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        allergies: patient.allergies,
        reportCount: reportCountMap.get(id) || 0,
        totalTasks: stats.total,
        doneTasks: stats.done,
        adherenceRate,
        latestDiagnosis: diagnosisMap.get(id) || 'No active consultation'
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedPatients.length,
      patients: enrichedPatients
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get list of all doctors (for patient selection)
// @route   GET /api/doctors/all
exports.getAllDoctors = async (req, res, next) => {
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
    next(error);
  }
};

// @desc    Patient assigns a doctor
// @route   POST /api/doctors/select-doctor
exports.selectDoctor = async (req, res, next) => {
  try {
    const { doctorId } = req.body || {};

    if (!isObjectId(doctorId)) {
      return res.status(400).json({ success: false, message: 'Please select a valid doctor.' });
    }

    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const patient = await User.findOne({ _id: req.user.id, role: 'patient' });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient account not found.' });
    }

    patient.assignedDoctor = doctor._id;
    await patient.save();

    res.status(200).json({
      success: true,
      message: `Successfully connected with ${doctor.name}.`,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        specialization: doctor.specialization,
        hospital: doctor.hospital
      }
    });
  } catch (error) {
    next(error);
  }
};
