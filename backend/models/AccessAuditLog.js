const mongoose = require('mongoose');

const accessAuditLogSchema = new mongoose.Schema(
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
    action: {
      type: String,
      enum: ['view_vault', 'view_report', 'download_report', 'download_rx_pdf', 'consultation_summary_view', 'revoke_access', 'grant_permission'],
      required: true
    },
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null
    },
    reportTitle: {
      type: String,
      default: ''
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1'
    },
    userAgent: {
      type: String,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

accessAuditLogSchema.index({ patient: 1, createdAt: -1 });
accessAuditLogSchema.index({ doctor: 1, createdAt: -1 });

module.exports = mongoose.model('AccessAuditLog', accessAuditLogSchema);
