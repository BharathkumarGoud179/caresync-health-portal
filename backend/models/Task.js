const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription'
    },
    taskType: {
      type: String,
      enum: ['Medication', 'Precaution', 'Vital Check', 'Lifestyle & Diet'],
      default: 'Precaution'
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [160, 'Task title must be 160 characters or fewer']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Task description must be 500 characters or fewer']
    },
    timing: {
      type: String,
      enum: ['Morning', 'Afternoon', 'Evening', 'Night', 'Throughout the day', 'Anytime'],
      default: 'Anytime'
    },
    targetDate: {
      type: Date,
      default: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      }
    },
    status: {
      type: String,
      enum: ['todo', 'done', 'skipped'],
      default: 'todo'
    },
    completedAt: {
      type: Date
    },
    patientFeedback: {
      type: String,
      trim: true,
      maxlength: [500, 'Feedback must be 500 characters or fewer']
    }
  },
  {
    timestamps: true
  }
);

taskSchema.index({ patient: 1, targetDate: -1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
