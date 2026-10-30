const AccessAuditLog = require('../models/AccessAuditLog');

/**
 * Logs an access audit event for patient-doctor data interactions
 * @param {Object} params
 * @param {string} params.patient - Patient ID
 * @param {string} params.doctor - Doctor ID
 * @param {string} params.action - Event action type
 * @param {string} [params.report] - Specific report ID if applicable
 * @param {string} [params.reportTitle] - Human readable report title
 * @param {Object} [params.req] - Express request for IP & User Agent
 * @param {Object} [params.metadata] - Extra context
 */
async function logAccessAudit({ patient, doctor, action, report = null, reportTitle = '', req = null, metadata = {} }) {
  try {
    let ipAddress = '127.0.0.1';
    let userAgent = '';

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
      userAgent = req.headers['user-agent'] || '';
    }

    await AccessAuditLog.create({
      patient,
      doctor,
      action,
      report,
      reportTitle,
      ipAddress,
      userAgent,
      metadata
    });
  } catch (err) {
    console.error('Failed to write access audit log:', err.message);
  }
}

module.exports = {
  logAccessAudit
};
