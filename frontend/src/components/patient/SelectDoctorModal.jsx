import { useEffect, useState } from 'react';
import Modal from '../Modal.jsx';
import { apiFetch, readJson } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function SelectDoctorModal({ show, onClose, onAssigned }) {
  const { showToast } = useToast();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) return undefined;

    let active = true;
    setLoading(true);
    setError('');

    const load = async () => {
      try {
        const res = await apiFetch('/doctors/all');
        const data = await readJson(res);
        if (!active) return;

        if (data.success && Array.isArray(data.doctors)) {
          setDoctors(data.doctors);
        } else {
          setError('Failed to load doctor list.');
        }
      } catch (err) {
        if (active) setError('Failed to load doctor list.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [show]);

  const assignDoctor = async (doctorId) => {
    try {
      const res = await apiFetch('/doctors/select-doctor', {
        method: 'POST',
        body: JSON.stringify({ doctorId })
      });
      const data = await readJson(res);

      if (data.success) {
        showToast(data.message, 'success');
        onAssigned(data.doctor);
        onClose();
      } else {
        showToast(data.message || 'Failed to select doctor.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Failed to select doctor.', 'danger');
    }
  };

  return (
    <Modal show={show} onClose={onClose} labelledBy="selectDoctorModalLabel">
      <div className="modal-header border-bottom">
        <h5 className="modal-title fw-bold" id="selectDoctorModalLabel">
          <i className="bi bi-hospital me-2 text-teal"></i>Select Your Primary Doctor
        </h5>
        <button
          type="button"
          className="btn-close"
          onClick={onClose}
          aria-label="Close"
        ></button>
      </div>
      <div className="modal-body p-3">
        <p className="small text-muted mb-3">
          Choose a verified doctor to give them access to review your medical reports and issue
          care plans.
        </p>
        <div>
          {loading ? (
            <div className="text-center py-4">
              <span className="spinner-border text-teal"></span>
            </div>
          ) : error ? (
            <p className="text-danger text-center">{error}</p>
          ) : doctors.length === 0 ? (
            <p className="text-muted text-center py-3">No doctors registered yet.</p>
          ) : (
            doctors.map((doctor) => (
              <div key={doctor._id} className="card p-3 mb-2 border">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="fw-bold mb-1">{doctor.name}</h6>
                    <p className="small text-muted mb-0">
                      {doctor.specialization || 'Consultant'} •{' '}
                      {doctor.hospital || 'Hospital'}
                    </p>
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => assignDoctor(doctor._id)}
                  >
                    Select
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
