import { formatDate, formatRelativeTime } from '../../utils/format.js';

const EMPTY_STATS = { total: 0, done: 0, todo: 0, skipped: 0, adherenceRate: 0 };

export default function ComplianceTab({
  stats = EMPTY_STATS,
  tasks,
  loading,
  error,
  prescriptions,
  prescriptionsLoading,
  prescriptionsError
}) {
  const rateClass =
    stats.adherenceRate >= 80
      ? 'text-success'
      : stats.adherenceRate >= 50
        ? 'text-warning'
        : 'text-danger';
  const barClass =
    stats.adherenceRate >= 80
      ? 'bg-success'
      : stats.adherenceRate >= 50
        ? 'bg-warning'
        : 'bg-primary';

  return (
    <>
      {loading ? (
        <div className="text-center py-3">
          <span className="spinner-border spinner-border-sm text-teal"></span> Calculating
          compliance metrics...
        </div>
      ) : error ? (
        <div className="alert alert-danger py-2">{error}</div>
      ) : (
        <div className="card p-3 mb-3 border bg-white">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold mb-0 text-teal">
              <i className="bi bi-activity me-1"></i>Care Plan Adherence Tracker
            </h6>
            <h4 className={`mb-0 fw-bold ${rateClass}`}>{stats.adherenceRate}%</h4>
          </div>
          <div className="progress mb-2" style={{ height: 10 }}>
            <div
              className={`progress-bar ${barClass}`}
              style={{ width: `${stats.adherenceRate}%` }}
            ></div>
          </div>
          <div className="d-flex justify-content-between small text-muted mb-3">
            <span>
              <strong>{stats.done}</strong> of <strong>{stats.total}</strong> instructions
              completed
            </span>
            <span>{stats.todo} tasks pending</span>
          </div>
          <h6 className="small fw-bold text-uppercase text-secondary mb-2">
            Actionable Tasks &amp; Precautions:
          </h6>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {tasks.length === 0 ? (
              <p className="text-muted small mb-0">
                No active care tasks or precautions assigned yet.
              </p>
            ) : (
              tasks.map((task) => {
                const isDone = task.status === 'done';
                const isSkipped = task.status === 'skipped';

                return (
                  <div
                    key={task._id}
                    className="d-flex justify-content-between align-items-center py-1 border-bottom small"
                  >
                    <div>
                      <span
                        className={
                          isDone ? 'text-decoration-line-through text-success' : 'fw-bold'
                        }
                      >
                        {task.title}
                      </span>
                      <span className="badge bg-light text-dark border ms-1">
                        {task.taskType}
                      </span>
                      <span className="text-muted ms-1">({task.timing})</span>
                    </div>
                    <div>
                      {isDone ? (
                        <span className="badge bg-success">
                          <i className="bi bi-check me-1"></i>Done (
                          {formatRelativeTime(task.completedAt)})
                        </span>
                      ) : isSkipped ? (
                        <span className="badge bg-warning text-dark">Skipped</span>
                      ) : (
                        <span className="badge bg-secondary">To Do Yet</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="card p-3 custom-card mt-3">
        <h6 className="fw-bold text-dark mb-2">
          <i className="bi bi-clock-history me-1"></i>Past Prescriptions for this Patient:
        </h6>
        {prescriptionsLoading ? (
          <div className="text-center py-3">
            <span className="spinner-border spinner-border-sm text-teal"></span> Loading
            history...
          </div>
        ) : prescriptionsError ? (
          <p className="text-danger small">{prescriptionsError}</p>
        ) : prescriptions.length === 0 ? (
          <p className="text-muted small">No past prescriptions on record.</p>
        ) : (
          prescriptions.map((prescription) => {
            const medicationCount = Array.isArray(prescription.medications)
              ? prescription.medications.length
              : 0;
            const precautionCount = Array.isArray(prescription.precautions)
              ? prescription.precautions.length
              : 0;

            return (
              <div key={prescription._id} className="card p-2 mb-2 border-0 bg-light">
                <div className="d-flex justify-content-between">
                  <strong className="text-dark small">{prescription.diagnosis}</strong>
                  <small className="text-muted">{formatDate(prescription.createdAt)}</small>
                </div>
                <small className="text-muted">
                  {medicationCount} medicines • {precautionCount} precautions
                </small>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
