import { formatRelativeTime } from '../../utils/format.js';

const TYPE_ICONS = {
  Medication: 'bi-capsule text-primary',
  Precaution: 'bi-shield-check text-warning',
  'Vital Check': 'bi-activity text-danger',
  'Lifestyle & Diet': 'bi-heart-pulse text-success'
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To Do Yet' },
  { value: 'done', label: 'Done' }
];

export default function TasksTab({
  tasks,
  stats,
  loading,
  error,
  filter,
  onFilterChange,
  onToggle
}) {
  const adherenceRate = Number(stats.adherenceRate) || 0;
  const progressClass =
    adherenceRate >= 80 ? 'bg-success' : adherenceRate >= 50 ? 'bg-warning' : 'bg-danger';

  const visibleTasks =
    filter === 'todo'
      ? tasks.filter((task) => task.status === 'todo')
      : filter === 'done'
        ? tasks.filter((task) => task.status === 'done')
        : tasks;

  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-success-subtle text-success">
              <i className="bi bi-activity"></i>
            </div>
            <div>
              <small className="text-muted text-uppercase fw-semibold">
                Treatment Adherence
              </small>
              <h3 className="fw-bold mb-0 text-success">{adherenceRate}%</h3>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-primary-subtle text-primary">
              <i className="bi bi-check-all"></i>
            </div>
            <div>
              <small className="text-muted text-uppercase fw-semibold">Tasks Completed</small>
              <h3 className="fw-bold mb-0 text-primary">{stats.done || 0}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-warning-subtle text-warning">
              <i className="bi bi-hourglass-split"></i>
            </div>
            <div>
              <small className="text-muted text-uppercase fw-semibold">Total Assigned</small>
              <h3 className="fw-bold mb-0 text-dark">{stats.total || 0}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-3 custom-card mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="fw-bold text-dark">
            <i className="bi bi-trophy text-warning me-2"></i>Overall Adherence Progress
          </span>
          <small className="text-muted">Keep this green to aid rapid recovery</small>
        </div>
        <div className="compliance-progress mb-1">
          <div
            className={`progress-bar ${progressClass}`}
            role="progressbar"
            style={{ width: `${adherenceRate}%` }}
          ></div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold text-dark mb-0">
          <i className="bi bi-list-task me-2 text-teal"></i>Your Assigned Care Routine
        </h5>
        <div className="btn-group btn-group-sm" role="group">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              className={`btn btn-outline-secondary task-filter-btn ${
                filter === item.value ? 'active' : ''
              }`}
              onClick={() => onFilterChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <span className="spinner-border spinner-border-sm text-teal"></span> Loading care
          plan...
        </div>
      ) : error ? (
        <div className="alert alert-danger py-2">{error}</div>
      ) : visibleTasks.length === 0 ? (
        <div className="text-center py-4 text-muted bg-white rounded border">
          <i className="bi bi-check2-circle fs-3 text-success"></i>
          <p className="mb-0 mt-2">
            {filter === 'todo'
              ? 'No pending tasks! Great job maintaining your care routine.'
              : 'No tasks in this category.'}
          </p>
        </div>
      ) : (
        visibleTasks.map((task) => {
          const isDone = task.status === 'done';
          const isSkipped = task.status === 'skipped';

          return (
            <div key={task._id} className={`task-item ${isDone ? 'done' : ''}`}>
              <div className="d-flex align-items-start gap-3">
                <button
                  className={`btn btn-outline-${isDone ? 'success' : 'secondary'} task-checkbox-btn`}
                  onClick={() => onToggle(task._id, isDone ? 'todo' : 'done')}
                  aria-label={isDone ? 'Mark as to do' : 'Mark as done'}
                >
                  <i className={`bi ${isDone ? 'bi-check-lg fw-bold' : 'bi-circle'}`}></i>
                </button>
                <div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="fw-bold task-title">{task.title}</span>
                    {isDone ? (
                      <span className="badge bg-success small">Done</span>
                    ) : isSkipped ? (
                      <span className="badge bg-warning text-dark small">Skipped</span>
                    ) : (
                      <span className="badge bg-secondary small">To Do</span>
                    )}
                    <span className="badge bg-light text-dark border small">
                      <i
                        className={`bi ${TYPE_ICONS[task.taskType] || 'bi-bookmark'} me-1`}
                      ></i>
                      {task.taskType}
                    </span>
                  </div>
                  {task.description ? (
                    <p className="small text-muted mb-1 mt-1">{task.description}</p>
                  ) : null}
                  <div className="d-flex gap-3 small text-muted mt-1 flex-wrap">
                    <span>
                      <i className="bi bi-clock me-1"></i>
                      {task.timing || 'Anytime'}
                    </span>
                    {task.doctor ? (
                      <span>
                        <i className="bi bi-person-check me-1"></i>Prescribed by{' '}
                        {task.doctor.name}
                      </span>
                    ) : null}
                    {isDone && task.completedAt ? (
                      <span className="text-success">
                        <i className="bi bi-check-all me-1"></i>Completed{' '}
                        {formatRelativeTime(task.completedAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="d-flex flex-column align-items-end">
                <button
                  className={`btn btn-sm ${isDone ? 'btn-outline-secondary' : 'btn-success'}`}
                  onClick={() => onToggle(task._id, isDone ? 'todo' : 'done')}
                >
                  {isDone ? (
                    <>
                      <i className="bi bi-arrow-counterclockwise me-1"></i>Mark To Do
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2 me-1"></i>Mark Done
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
