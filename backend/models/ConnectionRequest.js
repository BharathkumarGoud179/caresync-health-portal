const mongoose = require('mongoose');

const connectionRequestSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    message: {
      type: String,
      default: 'Requesting access to share medical vault and receive care plan.'
    },
    respondedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Unique index: one active request per patient-doctor pair
connectionRequestSchema.index({ patient: 1, doctor: 1 }, { unique: true });

module.exports = mongoose.model('ConnectionRequest', connectionRequestSchema);
