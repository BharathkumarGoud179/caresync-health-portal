const Task = require('../models/Task');
const User = require('../models/User');
const {
  sendValidationError,
  validateDirectTask,
  validateTaskStatus,
  isObjectId,
  asString,
  TASK_STATUSES,
  TASK_TYPES
} = require('../utils/validation');

// Helper to get start and end of a given date (default today)
const getDateBounds = (dateStr) => {
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;

  const start = new Date(target);
  start.setHours(0, 0, 0, 0);

  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// @desc    Get tasks for logged-in patient with adherence stats
// @route   GET /api/tasks/my-tasks
exports.getMyTasks = async (req, res, next) => {
  try {
    const date = asString(req.query.date);
    const status = asString(req.query.status);
    const type = asString(req.query.type);

    if (status && status !== 'all' && !validateTaskStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid task status filter.' });
    }
    if (type && type !== 'all' && !TASK_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid task type filter.' });
    }

    const query = { patient: req.user.id };

    if (date) {
      const bounds = getDateBounds(date);
      if (!bounds) {
        return res.status(400).json({ success: false, message: 'Invalid date filter.' });
      }
      query.targetDate = { $gte: bounds.start, $lte: bounds.end };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (type && type !== 'all') {
      query.taskType = type;
    }

    // Descending status puts "todo" before "skipped" and "done".
    const tasks = await Task.find(query)
      .populate('doctor', 'name specialization hospital')
      .sort({ status: -1, createdAt: -1 });

    // Adherence is calculated over all of the patient's tasks, not just the
    // currently filtered list, so the score stays stable while filtering.
    const [totalCount, doneCount, todoCount, skippedCount] = await Promise.all([
      Task.countDocuments({ patient: req.user.id }),
      Task.countDocuments({ patient: req.user.id, status: 'done' }),
      Task.countDocuments({ patient: req.user.id, status: 'todo' }),
      Task.countDocuments({ patient: req.user.id, status: 'skipped' })
    ]);
    const adherenceRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    res.status(200).json({
      success: true,
      count: tasks.length,
      stats: {
        total: totalCount,
        done: doneCount,
        todo: todoCount,
        skipped: skippedCount,
        adherenceRate
      },
      tasks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle or update task status ('done' or 'todo')
// @route   PATCH /api/tasks/:id/toggle
exports.toggleTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, patientFeedback } = req.body || {};

    if (!isObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid task ID.' });
    }
    if (status !== undefined && !validateTaskStatus(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${TASK_STATUSES.join(', ')}.`
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.'
      });
    }

    // Only the patient who owns the task may change it. Doctors have a
    // read-only compliance view.
    if (task.patient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this task.'
      });
    }

    task.status = status || (task.status === 'done' ? 'todo' : 'done');
    task.completedAt = task.status === 'done' ? new Date() : null;

    if (patientFeedback !== undefined) {
      task.patientFeedback = asString(patientFeedback).slice(0, 500);
    }

    await task.save();

    // Recalculate adherence for patient
    const [totalCount, doneCount] = await Promise.all([
      Task.countDocuments({ patient: task.patient }),
      Task.countDocuments({ patient: task.patient, status: 'done' })
    ]);
    const adherenceRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const statusLabel =
      task.status === 'done' ? 'Done' : task.status === 'skipped' ? 'Skipped' : 'To Do';

    res.status(200).json({
      success: true,
      message: `Task marked as ${statusLabel}.`,
      task,
      adherenceRate
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get patient tasks for doctor review
// @route   GET /api/tasks/patient/:patientId
exports.getPatientTasksForDoctor = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    if (!isObjectId(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const patient = await User.findOne({ _id: patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.'
      });
    }

    const tasks = await Task.find({ patient: patientId }).sort({ createdAt: -1 });

    const totalCount = tasks.length;
    const doneCount = tasks.filter((task) => task.status === 'done').length;
    const todoCount = tasks.filter((task) => task.status === 'todo').length;
    const skippedCount = tasks.filter((task) => task.status === 'skipped').length;
    const adherenceRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    res.status(200).json({
      success: true,
      patientName: patient.name,
      stats: {
        total: totalCount,
        done: doneCount,
        todo: todoCount,
        skipped: skippedCount,
        adherenceRate
      },
      tasks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Doctor directly adds a specific task/precaution for patient
// @route   POST /api/tasks/create-task
exports.createDirectTask = async (req, res, next) => {
  try {
    const { errors, value } = validateDirectTask(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const patient = await User.findOne({ _id: value.patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Selected patient not found.' });
    }

    const task = await Task.create({
      patient: value.patientId,
      doctor: req.user.id,
      taskType: value.taskType,
      title: value.title,
      description: value.description,
      timing: value.timing,
      status: 'todo',
      targetDate: startOfToday()
    });

    res.status(201).json({
      success: true,
      message: 'Task successfully assigned to patient.',
      task
    });
  } catch (error) {
    next(error);
  }
};
