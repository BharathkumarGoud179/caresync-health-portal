const ConnectionRequest = require('../models/ConnectionRequest');

/**
 * Checks if a doctor has an active, non-expired, non-revoked permission to view a patient's data
 * @param {string} patientId
 * @param {string} doctorId
 * @param {string} [reportId] - Optional report ID to verify granular permissions
 * @returns {Promise<{ allowed: boolean, reason?: string, connection?: any }>}
 */
const hasDoctorAccess = async (patientId, doctorId, reportId = null) => {
  const connection = await ConnectionRequest.findOne({
    patient: patientId,
    doctor: doctorId,
    status: 'accepted'
  });

  if (!connection) {
    return false;
  }

  // 1. Check if access was revoked
  if (connection.status === 'revoked' || connection.revokedAt) {
    return false;
  }

  // 2. Check time-limited expiration
  if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
    return false;
  }

  // 3. If a specific reportId is supplied and shareScope is 'selected', verify report whitelist
  if (reportId && connection.shareScope === 'selected') {
    const isReportAllowed = (connection.allowedReportIds || []).some(
      (id) => id.toString() === reportId.toString()
    );
    if (!isReportAllowed) {
      return false;
    }
  }

  return true;
};

/**
 * Returns connection permission details for a patient-doctor pair
 */
const getDoctorAccessDetails = async (patientId, doctorId) => {
  const connection = await ConnectionRequest.findOne({
    patient: patientId,
    doctor: doctorId
  }).populate('allowedReportIds', 'title category reportDate');

  if (!connection) return null;

  const isExpired = connection.expiresAt && new Date(connection.expiresAt) < new Date();
  const isRevoked = connection.status === 'revoked';
  const isActive = connection.status === 'accepted' && !isExpired && !isRevoked;

  return {
    connection,
    isActive,
    isExpired,
    isRevoked,
    shareScope: connection.shareScope,
    allowedReportIds: connection.allowedReportIds || [],
    expiresAt: connection.expiresAt
  };
};

module.exports = {
  hasDoctorAccess,
  getDoctorAccessDetails
};
