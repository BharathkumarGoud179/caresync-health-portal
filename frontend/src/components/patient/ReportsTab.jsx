import { assetUrl } from '../../api/client.js';
import { formatDate, formatFileSize } from '../../utils/format.js';

const CATEGORIES = [
  { value: 'All', label: 'All' },
  { value: 'Blood Test', label: 'Blood Tests' },
  { value: 'Radiology / X-Ray / Scan', label: 'Radiology & X-Ray' },
  { value: 'Prescription', label: 'Prescriptions' },
  { value: 'Discharge Summary', label: 'Discharge Summary' },
  { value: 'Pathology', label: 'Pathology' },
  { value: 'Cardiology / ECG', label: 'ECG & Cardiology' },
  { value: 'Other', label: 'Other' }
];

const CATEGORY_BADGES = {
  'Blood Test': 'badge-lab',
  'Radiology / X-Ray / Scan': 'badge-radiology',
  Prescription: 'badge-prescription',
  'Discharge Summary': 'badge-discharge',
  Pathology: 'badge-pathology'
};

export default function ReportsTab({
  reports,
  loading,
  error,
  filter,
  onFilterChange,
  onDelete,
  onOpenUpload
}) {
  const visibleReports =
    filter === 'All' ? reports : reports.filter((report) => report.category === filter);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 className="fw-bold mb-1">
            <i className="bi bi-collection me-2 text-teal"></i>Medical Records Timeline
          </h5>
          <p className="text-muted small mb-0">
            Past &amp; present lab results, scans, and doctor slips for your clinical reviews.
          </p>
        </div>
        <button
          className="btn btn-teal text-white shadow-sm"
          style={{ backgroundColor: '#0f766e' }}
          onClick={onOpenUpload}
        >
          <i className="bi bi-cloud-arrow-up me-1"></i>Upload New Report
        </button>
      </div>

      <div className="d-flex flex-wrap gap-1 mb-3">
        {CATEGORIES.map((category) => (
          <button
            key={category.value}
            className={`btn btn-sm btn-outline-dark report-filter-btn ${
              filter === category.value ? 'active' : ''
            }`}
            onClick={() => onFilterChange(category.value)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
          <p className="text-muted mt-2">Loading your medical records...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-5 bg-white rounded-3 border">
          <i className="bi bi-file-earmark-medical display-4 text-muted"></i>
          <h6 className="mt-3 text-secondary">No medical records uploaded yet</h6>
          <p className="text-muted small">
            Upload your past and present blood tests, scans, or prescriptions so your doctor
            can review them.
          </p>
          <button className="btn btn-teal btn-sm" onClick={onOpenUpload}>
            <i className="bi bi-cloud-arrow-up me-1"></i>Upload Your First Report
          </button>
        </div>
      ) : (
        visibleReports.map((report) => {
          const filePath = report.filePath || '#';
          const isPdf = /\.pdf$/i.test(filePath);
          const icon = isPdf
            ? 'bi-file-earmark-pdf text-danger'
            : 'bi-file-earmark-image text-primary';
          const badgeClass = CATEGORY_BADGES[report.category] || 'bg-light text-dark';

          return (
            <div key={report._id} className="report-card mb-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="d-flex gap-3">
                  <div className="fs-2">
                    <i className={`bi ${icon}`}></i>
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0 fw-bold">{report.title}</h6>
                      <span className={`report-badge ${badgeClass}`}>{report.category}</span>
                    </div>
                    <p className="text-muted small mb-1 mt-1">
                      <i className="bi bi-calendar3 me-1"></i>
                      <strong>Test Date:</strong> {formatDate(report.reportDate)}
                      <span className="mx-2">•</span>
                      <i className="bi bi-building me-1"></i>
                      {report.labOrHospital || 'Clinic'}
                    </p>
                    {report.notes ? (
                      <p className="small text-secondary mb-1 bg-light p-2 rounded">
                        <em>Notes:</em> {report.notes}
                      </p>
                    ) : null}
                    <small className="text-muted">
                      Uploaded on {formatDate(report.createdAt)} (
                      {formatFileSize(report.fileSize)})
                    </small>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <a
                    href={assetUrl(filePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-primary"
                    title="View Document"
                  >
                    <i className="bi bi-box-arrow-up-right me-1"></i>View
                  </a>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => onDelete(report._id)}
                    title="Delete"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
