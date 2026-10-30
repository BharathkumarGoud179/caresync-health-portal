const Task = require('../models/Task');
const User = require('../models/User');
const { hasDoctorAccess } = require('../utils/accessControl');

// Helper to get start and end of a given date (default today)
const getDateBounds = (dateStr) => {
  const target = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);

  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// @desc    Get tasks for logged-in patient with adherence stats
// @route   GET /api/tasks/my-tasks
exports.getMyTasks = async (req, res) => {
  try {
    const { date, status, type } = req.query;

    let query = { patient: req.user.id };

    if (date) {
      const { start, end } = getDateBounds(date);
      query.targetDate = { $gte: start, $lte: end };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (type && type !== 'all') {
      query.taskType = type;
    }

    const tasks = await Task.find(query)
      .populate('doctor', 'name specialization hospital')
      .sort({ status: 1, createdAt: -1 });

    // Calculate adherence statistics
    const totalCount = await Task.countDocuments({ patient: req.user.id });
    const doneCount = await Task.countDocuments({ patient: req.user.id, status: 'done' });
    const todoCount = await Task.countDocuments({ patient: req.user.id, status: 'todo' });
    const adherenceRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    res.status(200).json({
      success: true,
      count: tasks.length,
      stats: {
        total: totalCount,
        done: doneCount,
        todo: todoCount,
        adherenceRate: adherenceRate
      },
      tasks
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle or update task status ('done' or 'todo')
// @route   PATCH /api/tasks/:id/toggle
exports.toggleTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, patientFeedback } = req.body; // status: 'done' | 'todo' | 'skipped'

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.'
      });
    }

    // Verify patient owns this task
    if (task.patient.toString() !== req.user.id && req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this task.'
      });
    }

    // If status is provided, use it; otherwise toggle between 'done' and 'todo'
    if (status) {
      task.status = status;
    } else {
      task.status = task.status === 'done' ? 'todo' : 'done';
    }

    if (task.status === 'done') {
      task.completedAt = new Date();
    } else {
      task.completedAt = null;
    }

    if (patientFeedback !== undefined) {
      task.patientFeedback = patientFeedback;
    }

    await task.save();

    // Recalculate adherence for patient
    const totalCount = await Task.countDocuments({ patient: task.patient });
    const doneCount = await Task.countDocuments({ patient: task.patient, status: 'done' });
    const adherenceRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    res.status(200).json({
      success: true,
      message: `Task marked as ${task.status === 'done' ? 'Done' : 'To Do'}!`,
      task,
      adherenceRate
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get patient tasks for doctor review
// @route   GET /api/tasks/patient/:patientId
exports.getPatientTasksForDoctor = async (req, res) => {
  try {
    const { patientId } = req.params;

    const hasAccess = await hasDoctorAccess(patientId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have approved access to view tasks for this patient.'
      });
    }

    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.'
      });
    }

    const tasks = await Task.find({ patient: patientId }).sort({ createdAt: -1 });

    const totalCount = tasks.length;
    const doneCount = tasks.filter((t) => t.status === 'done').length;
    const todoCount = tasks.filter((t) => t.status === 'todo').length;
    const adherenceRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    res.status(200).json({
      success: true,
      patientName: patient.name,
      stats: {
        total: totalCount,
        done: doneCount,
        todo: todoCount,
        adherenceRate
      },
      tasks
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Doctor directly adds a specific task/precaution for patient
// @route   POST /api/tasks/create-task
exports.createDirectTask = async (req, res) => {
  try {
    const { patientId, title, description, taskType, timing } = req.body;

    if (!patientId || !title) {
      return res.status(400).json({
        success: false,
        message: 'Please provide patient ID and task title.'
      });
    }

    const task = await Task.create({
      patient: patientId,
      doctor: req.user.id,
      taskType: taskType || 'Precaution',
      title,
      description: description || '',
      timing: timing || 'Throughout the day',
      status: 'todo',
      targetDate: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Task successfully assigned to patient.',
      task
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
