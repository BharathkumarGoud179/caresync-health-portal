import { assetUrl } from '../../api/client.js';
import { formatDate } from '../../utils/format.js';

export default function DoctorReportsTab({ reports, loading, error }) {
  return (
    <div className="card p-3 custom-card mb-3">
      <h6 className="fw-bold mb-1 text-teal">
        <i className="bi bi-collection me-2"></i>Patient&apos;s Medical Record History
      </h6>
      <p className="text-muted small mb-3">
        Inspect chronological blood tests, scans, and past prescriptions to form an accurate
        diagnosis.
      </p>

      {loading ? (
        <div className="text-center py-4">
          <span className="spinner-border spinner-border-sm text-primary"></span> Loading
          reports...
        </div>
      ) : error ? (
        <div className="alert alert-danger py-2">{error}</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-4 text-muted bg-light rounded">
          <i className="bi bi-folder2-open fs-3"></i>
          <p className="mb-0 mt-2">No medical reports uploaded by this patient yet.</p>
        </div>
      ) : (
        reports.map((report) => {
          const filePath = report.filePath || '#';
          const isPdf = /\.pdf$/i.test(filePath);
          const icon = isPdf
            ? 'bi-file-earmark-pdf text-danger'
            : 'bi-file-earmark-image text-primary';

          return (
            <div key={report._id} className="card p-3 mb-2 border shadow-sm">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <i className={`bi ${icon} fs-2`}></i>
                  <div>
                    <h6 className="mb-0 fw-bold">{report.title}</h6>
                    <small className="text-muted">
                      <span className="badge bg-light text-dark border">
                        {report.category}
                      </span>
                      <span className="ms-2">
                        Test Date: <strong>{formatDate(report.reportDate)}</strong>
                      </span>
                      <span className="ms-2">• Lab: {report.labOrHospital || 'Clinic'}</span>
                    </small>
                    {report.notes ? (
                      <p className="small text-secondary mb-0 mt-1">
                        <em>Patient notes:</em> {report.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
                <a
                  href={assetUrl(filePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline-primary"
                >
                  <i className="bi bi-box-arrow-up-right me-1"></i>Inspect Document
                </a>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
