const ConnectionRequest = require('../models/ConnectionRequest');

/**
 * Checks if a doctor has an accepted connection with a patient
 * @param {string} patientId
 * @param {string} doctorId
 * @returns {Promise<boolean>}
 */
const hasDoctorAccess = async (patientId, doctorId) => {
  const connection = await ConnectionRequest.findOne({
    patient: patientId,
    doctor: doctorId,
    status: 'accepted'
  });
  return !!connection;
};

module.exports = {
  hasDoctorAccess
};
