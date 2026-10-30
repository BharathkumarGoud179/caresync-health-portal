const mongoose = require('mongoose');

const medicationItemSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: true,
    trim: true
  },
  dosage: {
    type: String,
    required: true,
    default: '1 Tablet'
  },
  frequency: {
    type: String,
    enum: ['Once daily', 'Twice daily', 'Thrice daily', 'Four times daily', 'As needed (SOS)'],
    default: 'Once daily'
  },
  timeOfDay: {
    morning: { type: Boolean, default: false },
    afternoon: { type: Boolean, default: false },
    night: { type: Boolean, default: false }
  },
  instruction: {
    type: String,
    enum: ['After food', 'Before food', 'With food', 'At bedtime', 'Empty stomach'],
    default: 'After food'
  },
  durationDays: {
    type: Number,
    default: 7
  }
});

const precautionItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['Diet', 'Physical Activity', 'Monitoring / Vitals', 'Hydration', 'General Hygiene', 'Other'],
    default: 'General Hygiene'
  }
});

const prescriptionSchema = new mongoose.Schema(
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
    diagnosis: {
      type: String,
      required: [true, 'Please provide a diagnosis or consultation reason'],
      trim: true
    },
    clinicalNotes: {
      type: String,
      trim: true
    },
    medications: [medicationItemSchema],
    precautions: [precautionItemSchema],
    followUpDate: Date,
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Discontinued'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

prescriptionSchema.index({ patient: 1, createdAt: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
