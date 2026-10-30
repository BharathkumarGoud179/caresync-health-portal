const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      trim: true
    },
    isCallLog: {
      type: Boolean,
      default: false
    },
    callType: {
      type: String,
      enum: ['audio', 'video', 'none'],
      default: 'none'
    },
    callDuration: {
      type: Number, // in seconds
      default: 0
    },
    callStatus: {
      type: String,
      enum: ['completed', 'missed', 'declined', 'none'],
      default: 'none'
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
