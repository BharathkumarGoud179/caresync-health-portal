export default function DoctorAssignment({ user, onChange }) {
  const doctor = user.assignedDoctor;

  return (
    <div className="p-2 rounded bg-light border">
      {doctor && typeof doctor === 'object' && doctor.name ? (
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <h6 className="mb-0 fw-bold text-teal">
              <i className="bi bi-hospital me-2"></i>
              {doctor.name}
            </h6>
            <small className="text-muted">
              {doctor.specialization || 'Consultant'} • {doctor.hospital || 'Care Clinic'}
            </small>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onChange}>
            Change
          </button>
        </div>
      ) : (
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <span className="text-muted">
              <i className="bi bi-info-circle me-1"></i>No primary doctor linked yet.
            </span>
          </div>
          <button className="btn btn-sm btn-teal" onClick={onChange}>
            Connect with Doctor
          </button>
        </div>
      )}
    </div>
  );
}
