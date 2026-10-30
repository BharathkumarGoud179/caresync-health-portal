import { useState } from 'react';

const INITIAL_TASKS = [
  {
    id: 'sim-medication',
    done: true,
    title: 'Take Amlodipine 5mg (1 Tablet)',
    badgeText: 'Medication',
    badgeClass: 'bg-primary-subtle text-primary border',
    icon: 'bi-capsule',
    detail: 'After breakfast • Morning dose',
    ariaLabel: 'Toggle medication task'
  },
  {
    id: 'sim-vitals',
    done: true,
    title: 'Daily Morning Blood Pressure Log',
    badgeText: 'Vital Check',
    badgeClass: 'bg-danger-subtle text-danger border',
    icon: 'bi-activity',
    detail: 'Resting sitting BP: 124/80 mmHg',
    ariaLabel: 'Toggle blood pressure task'
  },
  {
    id: 'sim-diet',
    done: false,
    title: 'Strict Low-Sodium Diet (Under 2g Salt)',
    badgeText: 'Precaution',
    badgeClass: 'bg-warning-subtle text-warning border',
    icon: 'bi-shield-check',
    detail: 'Avoid processed canned foods and extra salt',
    ariaLabel: 'Toggle diet task'
  }
];

export default function Simulator() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  // The original page starts with a hard-coded 66% badge, then recalculates
  // with Math.round() on every click. Keep that initial value for parity.
  const [pct, setPct] = useState(66);

  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;

  const toggleTask = (id) => {
    const nextTasks = tasks.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task
    );
    const nextDone = nextTasks.filter((task) => task.done).length;
    const nextPct = Math.round((nextDone / nextTasks.length) * 100);

    setTasks(nextTasks);
    setPct(nextPct);
  };

  const barClass = pct >= 80 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger';

  return (
    <section className="py-5 bg-white" id="interactive-simulator">
      <div className="container py-3">
        <div className="text-center max-w-700 mx-auto mb-4">
          <span className="hero-badge mb-2">
            <i className="bi bi-hand-index-thumb"></i>Interactive Feature Preview
          </span>
          <h2 className="fw-bold">Experience the Care Compliance Loop</h2>
          <p className="text-muted">
            See how a doctor&apos;s care plan transforms into an actionable daily checklist for
            the patient.
          </p>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="simulator-box">
              <div className="simulator-header d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-check2-circle me-2"></i>Patient&apos;s Daily Care Checklist
                  </h5>
                  <small className="opacity-75">
                    Click the checkboxes below to mark tasks as done and watch your adherence
                    climb!
                  </small>
                </div>
                <div className="text-end">
                  <span className="badge bg-white text-teal fw-bold fs-6">{pct}%</span>
                </div>
              </div>

              <div className="p-4 bg-light">
                <div className="mb-3">
                  <div className="d-flex justify-content-between small fw-bold text-muted mb-1">
                    <span>Treatment Adherence</span>
                    <span>
                      {done} of {total} Completed
                    </span>
                  </div>
                  <div className="progress" style={{ height: 12, borderRadius: 6 }}>
                    <div
                      className={`progress-bar ${barClass}`}
                      style={{ width: `${pct}%`, transition: 'width 0.3s ease' }}
                    ></div>
                  </div>
                </div>

                <div className="d-flex flex-column gap-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`task-item ${task.done ? 'done' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label={task.ariaLabel}
                      onClick={() => toggleTask(task.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleTask(task.id);
                        }
                      }}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <button
                          className={`btn ${
                            task.done ? 'btn-success' : 'btn-outline-secondary'
                          } task-checkbox-btn`}
                          type="button"
                          tabIndex={-1}
                        >
                          <i className={`bi ${task.done ? 'bi-check-lg fw-bold' : 'bi-circle'}`}></i>
                        </button>
                        <div>
                          <span className="fw-bold task-title">{task.title}</span>
                          <span className={`badge ${task.badgeClass} small ms-2`}>
                            <i className={`bi ${task.icon} me-1`}></i>
                            {task.badgeText}
                          </span>
                          <small className="text-muted d-block">{task.detail}</small>
                        </div>
                      </div>
                      <span className={`badge ${task.done ? 'bg-success' : 'bg-secondary'}`}>
                        {task.done ? 'Done' : 'To Do Yet'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-center mt-3 text-muted small">
                  <i className="bi bi-info-circle me-1"></i>This interactive loop feeds directly
                  to your Doctor&apos;s dashboard to track clinical recovery.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
