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
      enum: ['pending', 'accepted', 'rejected', 'revoked'],
      default: 'pending'
    },
    message: {
      type: String,
      default: 'Requesting access to share medical vault and receive care plan.'
    },
    respondedAt: {
      type: Date
    },
    // Patient-Controlled Sharing Controls
    shareScope: {
      type: String,
      enum: ['all', 'selected'],
      default: 'all' // 'all' = full vault, 'selected' = only allowedReportIds
    },
    allowedReportIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report'
      }
    ],
    expiresAt: {
      type: Date,
      default: null // null = permanent until revoked; Date = time-limited access
    },
    revokedAt: {
      type: Date,
      default: null
    },
    revokedReason: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Compound index
connectionRequestSchema.index({ patient: 1, doctor: 1 }, { unique: true });

module.exports = mongoose.model('ConnectionRequest', connectionRequestSchema);
