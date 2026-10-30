export default function PatientRoster({
  patients,
  totalCount,
  search,
  onSearchChange,
  selectedPatientId,
  onSelect,
  loading,
  error
}) {
  return (
    <div className="card border-0 shadow-sm custom-card h-100">
      <div className="card-header bg-white border-bottom p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="fw-bold mb-0 text-dark">
            <i className="bi bi-people-fill text-teal me-2"></i>Patient Roster
          </h6>
          <span className="badge bg-primary rounded-pill small">
            {totalCount} Patients
          </span>
        </div>
        <div className="input-group input-group-sm">
          <span className="input-group-text bg-light border-end-0">
            <i className="bi bi-search"></i>
          </span>
          <input
            type="search"
            className="form-control border-start-0 bg-light"
            placeholder="Search by name or email..."
            aria-label="Search patients"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      <div className="card-body p-3 overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm text-teal"></span> Loading
            patients...
          </div>
        ) : error ? (
          <div className="alert alert-danger py-2">{error}</div>
        ) : patients.length === 0 ? (
          <p className="text-muted text-center py-4">
            {totalCount === 0
              ? 'No patients registered in the system yet.'
              : 'No patients match your search.'}
          </p>
        ) : (
          patients.map((patient) => {
            const isSelected = patient.id === selectedPatientId;
            const adherenceBadgeClass =
              patient.adherenceRate >= 80
                ? 'bg-success'
                : patient.adherenceRate >= 50
                  ? 'bg-warning'
                  : 'bg-secondary';

            return (
              <div
                key={patient.id}
                className={`patient-select-item ${isSelected ? 'active' : ''} mb-2`}
                onClick={() => onSelect(patient.id)}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-0 fw-bold">{patient.name}</h6>
                    <small className="text-muted">
                      {patient.gender || 'Patient'}{' '}
                      {patient.age ? `• ${patient.age}y` : ''}{' '}
                      {patient.bloodGroup ? `• ${patient.bloodGroup}` : ''}
                    </small>
                  </div>
                  <div className="text-end">
                    <span className="badge bg-primary-subtle text-primary border">
                      {patient.reportCount} Reports
                    </span>
                    <div className="mt-1">
                      <span
                        className={`badge ${adherenceBadgeClass} small`}
                        title="Care Plan Adherence"
                      >
                        {patient.adherenceRate}% Adherence
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
