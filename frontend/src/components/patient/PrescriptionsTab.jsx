import { formatDate } from '../../utils/format.js';

export default function PrescriptionsTab({ prescriptions, loading, error }) {
  return (
    <>
      <div className="mb-3">
        <h5 className="fw-bold mb-1">
          <i className="bi bi-clipboard2-pulse me-2 text-teal"></i>Prescriptions &amp;
          Consultations
        </h5>
        <p className="text-muted small mb-0">
          Clinical advice, medicine dosages, and lifestyle guidance provided by your doctor.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <span className="spinner-border spinner-border-sm text-teal"></span> Loading
          prescriptions...
        </div>
      ) : error ? (
        <div className="alert alert-danger py-2">{error}</div>
      ) : prescriptions.length === 0 ? (
        <p className="text-muted text-center py-3">
          No prescriptions recorded yet. Your doctor will issue prescriptions and precautions
          after evaluating your reports.
        </p>
      ) : (
        prescriptions.map((prescription) => {
          const medications = Array.isArray(prescription.medications)
            ? prescription.medications
            : [];
          const precautions = Array.isArray(prescription.precautions)
            ? prescription.precautions
            : [];

          return (
            <div key={prescription._id} className="card p-3 mb-3 border shadow-sm">
              <div className="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2">
                <div>
                  <h6 className="fw-bold text-teal mb-0">
                    <i className="bi bi-file-earmark-medical me-2"></i>Diagnosis:{' '}
                    {prescription.diagnosis}
                  </h6>
                  <small className="text-muted">
                    Prescribed by{' '}
                    <strong>
                      {prescription.doctor ? prescription.doctor.name : 'Doctor'}
                    </strong>{' '}
                    ({prescription.doctor ? prescription.doctor.specialization : ''}) on{' '}
                    {formatDate(prescription.createdAt)}
                  </small>
                </div>
                <span className="badge bg-success">{prescription.status}</span>
              </div>

              {prescription.clinicalNotes ? (
                <p className="small text-secondary mb-3">
                  <strong>Doctor Notes:</strong> {prescription.clinicalNotes}
                </p>
              ) : null}

              <h6 className="small fw-bold text-dark text-uppercase mb-2">
                <i className="bi bi-capsule me-1"></i>Prescribed Medicines:
              </h6>
              {medications.length > 0 ? (
                <div className="table-responsive mb-3">
                  <table className="table table-sm table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Medicine</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Schedule</th>
                        <th>Instruction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medications.map((medication, index) => {
                        const timeOfDay = medication.timeOfDay || {};
                        return (
                          <tr key={`${prescription._id}-med-${index}`}>
                            <td className="fw-bold">{medication.medicineName}</td>
                            <td>{medication.dosage}</td>
                            <td>{medication.frequency}</td>
                            <td>
                              {timeOfDay.morning ? (
                                <span className="timing-tag bg-warning-subtle">Morning</span>
                              ) : null}
                              {timeOfDay.afternoon ? (
                                <span className="timing-tag bg-info-subtle">Afternoon</span>
                              ) : null}
                              {timeOfDay.night ? (
                                <span className="timing-tag bg-dark-subtle">Night</span>
                              ) : null}
                            </td>
                            <td>
                              <span className="badge bg-light text-dark border">
                                {medication.instruction}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted small mb-3">
                  No medicines prescribed in this consultation.
                </p>
              )}

              {precautions.length > 0 ? (
                <>
                  <h6 className="small fw-bold text-danger text-uppercase mb-2">
                    <i className="bi bi-shield-exclamation me-1"></i>Precautions &amp;
                    Lifestyle Rules:
                  </h6>
                  <ul className="list-group list-group-flush small">
                    {precautions.map((precaution, index) => (
                      <li
                        key={`${prescription._id}-prec-${index}`}
                        className="list-group-item d-flex justify-content-between align-items-center px-0"
                      >
                        <div>
                          <strong className="text-dark">{precaution.title}</strong>
                          <p className="text-muted mb-0">{precaution.description || ''}</p>
                        </div>
                        <span className="badge bg-warning text-dark">
                          {precaution.category}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })
      )}
    </>
  );
}
