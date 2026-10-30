import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, readJson } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useRequireRole } from '../hooks/useRequireRole.js';
import PageLoader from '../components/PageLoader.jsx';
import DoctorAssignment from '../components/patient/DoctorAssignment.jsx';
import TasksTab from '../components/patient/TasksTab.jsx';
import ReportsTab from '../components/patient/ReportsTab.jsx';
import PrescriptionsTab from '../components/patient/PrescriptionsTab.jsx';
import UploadReportModal from '../components/patient/UploadReportModal.jsx';
import SelectDoctorModal from '../components/patient/SelectDoctorModal.jsx';

const EMPTY_STATS = { total: 0, done: 0, todo: 0, skipped: 0, adherenceRate: 0 };

export default function PatientDashboard() {
  const { user, checking } = useRequireRole('patient');
  const { setUser, logout } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('tasks');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [reportFilter, setReportFilter] = useState('All');

  const [tasks, setTasks] = useState([]);
  const [taskStats, setTaskStats] = useState(EMPTY_STATS);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');

  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(true);
  const [prescriptionsError, setPrescriptionsError] = useState('');

  useEffect(() => {
    document.title = 'Patient Portal | CareSync';
  }, []);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError('');
    try {
      const res = await apiFetch('/reports/my-reports');
      const data = await readJson(res);
      if (data.success) {
        setReports(Array.isArray(data.reports) ? data.reports : []);
      } else {
        setReportsError(data.message || 'Error loading reports.');
      }
    } catch (error) {
      setReportsError(error.message || 'Error loading reports.');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError('');
    try {
      const res = await apiFetch('/tasks/my-tasks');
      const data = await readJson(res);
      if (data.success) {
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
        if (data.stats) setTaskStats(data.stats);
      } else {
        setTasksError(data.message || 'Failed to load care plan tasks.');
      }
    } catch (error) {
      setTasksError(error.message || 'Failed to load care plan tasks.');
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadPrescriptions = useCallback(async () => {
    setPrescriptionsLoading(true);
    setPrescriptionsError('');
    try {
      const res = await apiFetch('/prescriptions/my-prescriptions');
      const data = await readJson(res);
      if (data.success) {
        setPrescriptions(Array.isArray(data.prescriptions) ? data.prescriptions : []);
      } else {
        setPrescriptionsError(data.message || 'Error loading prescriptions.');
      }
    } catch (error) {
      setPrescriptionsError(error.message || 'Error loading prescriptions.');
    } finally {
      setPrescriptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadReports();
    loadTasks();
    loadPrescriptions();
  }, [user, loadReports, loadTasks, loadPrescriptions]);

  const handleToggleTask = async (id, newStatus) => {
    try {
      const res = await apiFetch(`/tasks/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      const data = await readJson(res);

      if (data.success) {
        showToast(data.message, newStatus === 'done' ? 'success' : 'info');

        const updatedTasks = tasks.map((task) =>
          task._id === id
            ? {
                ...task,
                status: newStatus,
                completedAt: newStatus === 'done' ? new Date() : null
              }
            : task
        );
        const totalCount = updatedTasks.length;
        const doneCount = updatedTasks.filter((task) => task.status === 'done').length;
        const todoCount = updatedTasks.filter((task) => task.status === 'todo').length;
        const skippedCount = updatedTasks.filter((task) => task.status === 'skipped').length;
        const adherenceRate =
          totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

        setTasks(updatedTasks);
        setTaskStats({
          total: totalCount,
          done: doneCount,
          todo: todoCount,
          skipped: skippedCount,
          adherenceRate
        });
      } else {
        showToast(data.message || 'Failed to update task status.', 'danger');
      }
    } catch (error) {
      showToast(error.message || 'Failed to update task status.', 'danger');
    }
  };

  const handleDeleteReport = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medical report?')) return;

    try {
      const res = await apiFetch(`/reports/${id}`, { method: 'DELETE' });
      const data = await readJson(res);

      if (data.success) {
        showToast('Report deleted.', 'info');
        loadReports();
      } else {
        showToast(data.message || 'Failed to delete report.', 'danger');
      }
    } catch (error) {
      showToast(error.message || 'Failed to delete report.', 'danger');
    }
  };

  const handleDoctorAssigned = (doctor) => {
    setUser({ ...user, assignedDoctor: doctor });
  };

  if (checking || !user) {
    return <PageLoader label="Checking your session..." />;
  }

  const ageGender =
    `${user.age ? `${user.age} yrs` : ''} ${
      user.gender ? `• ${user.gender}` : ''
    }`.trim() || 'Details pending';

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom sticky-top shadow-sm py-2">
        <div className="container">
          <Link className="navbar-brand" to="/patient">
            <img src="/img/logo.svg" alt="CareSync Logo" height="38" />
            <span
              className="badge bg-teal-subtle text-teal fs-6 fw-normal ms-2"
              style={{ backgroundColor: '#ccfbf1', color: '#0f766e' }}
            >
              Patient Portal
            </span>
          </Link>

          <div className="d-flex align-items-center gap-3">
            <div className="text-end d-none d-md-block">
              <span className="fw-bold d-block small">{user.name}</span>
              <span className="badge bg-light text-muted border">Patient</span>
            </div>
            <button className="btn btn-outline-danger btn-sm" onClick={logout}>
              <i className="bi bi-box-arrow-right me-1"></i>Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="container py-4">
        <div className="card p-3 custom-card mb-4 border-0 shadow-sm">
          <div className="row align-items-center g-3">
            <div className="col-md-7">
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon bg-primary text-white fs-3">
                  <i className="bi bi-person-fill"></i>
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h5 className="fw-bold mb-0">Health Profile</h5>
                    <span className="badge bg-danger-subtle text-danger">
                      {user.bloodGroup || 'Not specified'}
                    </span>
                  </div>
                  <p className="text-muted small mb-0 mt-1">{ageGender}</p>
                  <small className="text-secondary">
                    <strong className="text-dark">Allergies:</strong>{' '}
                    <span>{user.allergies || 'None reported'}</span>
                  </small>
                </div>
              </div>
            </div>

            <div className="col-md-5">
              <DoctorAssignment
                user={user}
                onChange={() => setDoctorModalOpen(true)}
              />
            </div>
          </div>
        </div>

        <ul
          className="nav nav-pills nav-fill mb-4 bg-white p-2 rounded-3 border shadow-sm"
          role="tablist"
        >
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link fw-semibold ${activeTab === 'tasks' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'tasks'}
              onClick={() => setActiveTab('tasks')}
            >
              <i className="bi bi-check2-circle me-1"></i>Care Tasks &amp; Precautions
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link fw-semibold ${activeTab === 'reports' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'reports'}
              onClick={() => setActiveTab('reports')}
            >
              <i className="bi bi-file-earmark-medical me-1"></i>Medical Reports Vault
              <span className="badge bg-teal-subtle text-teal ms-1">
                {reports.length} records
              </span>
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link fw-semibold ${activeTab === 'prescriptions' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'prescriptions'}
              onClick={() => setActiveTab('prescriptions')}
            >
              <i className="bi bi-prescription me-1"></i>Doctor&apos;s Care Plans
            </button>
          </li>
        </ul>

        <div className="tab-content">
          {activeTab === 'tasks' ? (
            <TasksTab
              tasks={tasks}
              stats={taskStats}
              loading={tasksLoading}
              error={tasksError}
              filter={taskFilter}
              onFilterChange={setTaskFilter}
              onToggle={handleToggleTask}
            />
          ) : null}

          {activeTab === 'reports' ? (
            <ReportsTab
              reports={reports}
              loading={reportsLoading}
              error={reportsError}
              filter={reportFilter}
              onFilterChange={setReportFilter}
              onDelete={handleDeleteReport}
              onOpenUpload={() => setUploadOpen(true)}
            />
          ) : null}

          {activeTab === 'prescriptions' ? (
            <PrescriptionsTab
              prescriptions={prescriptions}
              loading={prescriptionsLoading}
              error={prescriptionsError}
            />
          ) : null}
        </div>
      </main>

      <UploadReportModal
        show={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={loadReports}
      />

      <SelectDoctorModal
        show={doctorModalOpen}
        onClose={() => setDoctorModalOpen(false)}
        onAssigned={handleDoctorAssigned}
      />
    </>
  );
}
