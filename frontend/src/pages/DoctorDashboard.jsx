import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, readJson } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRequireRole } from '../hooks/useRequireRole.js';
import PageLoader from '../components/PageLoader.jsx';
import PatientRoster from '../components/doctor/PatientRoster.jsx';
import DoctorReportsTab from '../components/doctor/DoctorReportsTab.jsx';
import CarePlanForm from '../components/doctor/CarePlanForm.jsx';
import ComplianceTab from '../components/doctor/ComplianceTab.jsx';

const EMPTY_STATS = { total: 0, done: 0, todo: 0, skipped: 0, adherenceRate: 0 };

export default function DoctorDashboard() {
  const { user, checking } = useRequireRole('doctor');
  const { logout } = useAuth();

  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [activeTab, setActiveTab] = useState('reports');

  const [patientReports, setPatientReports] = useState([]);
  const [patientReportsLoading, setPatientReportsLoading] = useState(false);
  const [patientReportsError, setPatientReportsError] = useState('');

  const [complianceStats, setComplianceStats] = useState(EMPTY_STATS);
  const [complianceTasks, setComplianceTasks] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState('');

  const [patientPrescriptions, setPatientPrescriptions] = useState([]);
  const [patientPrescriptionsLoading, setPatientPrescriptionsLoading] = useState(false);
  const [patientPrescriptionsError, setPatientPrescriptionsError] = useState('');

  const selectedPatientIdRef = useRef(null);

  useEffect(() => {
    document.title = 'Doctor Workspace | CareSync';
  }, []);

  const loadPatientReports = useCallback(async (patientId) => {
    setPatientReportsLoading(true);
    setPatientReportsError('');
    try {
      const res = await apiFetch(`/reports/patient/${patientId}`);
      const data = await readJson(res);
      if (data.success) {
        setPatientReports(Array.isArray(data.reports) ? data.reports : []);
      } else {
        setPatientReportsError(data.message || 'Error loading patient reports.');
      }
    } catch (error) {
      setPatientReportsError(error.message || 'Error loading patient reports.');
    } finally {
      setPatientReportsLoading(false);
    }
  }, []);

  const loadPatientCompliance = useCallback(async (patientId) => {
    setComplianceLoading(true);
    setComplianceError('');
    try {
      const res = await apiFetch(`/tasks/patient/${patientId}`);
      const data = await readJson(res);
      if (data.success) {
        setComplianceStats(data.stats || EMPTY_STATS);
        setComplianceTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } else {
        setComplianceError(data.message || 'Error checking compliance.');
      }
    } catch (error) {
      setComplianceError(error.message || 'Error checking compliance.');
    } finally {
      setComplianceLoading(false);
    }
  }, []);

  const loadPatientPrescriptions = useCallback(async (patientId) => {
    setPatientPrescriptionsLoading(true);
    setPatientPrescriptionsError('');
    try {
      const res = await apiFetch(`/prescriptions/patient/${patientId}`);
      const data = await readJson(res);
      if (data.success) {
        setPatientPrescriptions(
          Array.isArray(data.prescriptions) ? data.prescriptions : []
        );
      } else {
        setPatientPrescriptionsError(data.message || 'Failed to load history.');
      }
    } catch (error) {
      setPatientPrescriptionsError(error.message || 'Failed to load history.');
    } finally {
      setPatientPrescriptionsLoading(false);
    }
  }, []);

  const selectPatient = useCallback(
    (patientId) => {
      selectedPatientIdRef.current = patientId;
      setSelectedPatientId(patientId);
      loadPatientReports(patientId);
      loadPatientCompliance(patientId);
      loadPatientPrescriptions(patientId);
    },
    [loadPatientReports, loadPatientCompliance, loadPatientPrescriptions]
  );

  const loadPatients = useCallback(async () => {
    setPatientsLoading(true);
    setPatientsError('');
    try {
      const res = await apiFetch('/doctors/patients');
      const data = await readJson(res);

      if (data.success) {
        const list = Array.isArray(data.patients) ? data.patients : [];
        setPatients(list);

        if (list.length > 0 && !selectedPatientIdRef.current) {
          selectPatient(list[0].id);
        }
      } else {
        setPatientsError(data.message || 'Failed to load patients.');
      }
    } catch (error) {
      setPatientsError(error.message || 'Failed to load patients.');
    } finally {
      setPatientsLoading(false);
    }
  }, [selectPatient]);

  useEffect(() => {
    if (!user) return;
    loadPatients();
  }, [user, loadPatients]);

  const handleIssued = (patientId) => {
    selectPatient(patientId);
    loadPatients();
  };

  if (checking || !user) {
    return <PageLoader label="Checking your session..." />;
  }

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);

  const searchText = search.toLowerCase();
  const visiblePatients = patients.filter(
    (patient) =>
      String(patient.name || '').toLowerCase().includes(searchText) ||
      String(patient.email || '').toLowerCase().includes(searchText)
  );

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom sticky-top shadow-sm py-2">
        <div className="container-fluid px-4">
          <Link className="navbar-brand" to="/doctor">
            <img src="/img/logo.svg" alt="CareSync Logo" height="38" />
            <span
              className="badge bg-teal-subtle text-teal fs-6 fw-normal ms-2"
              style={{ backgroundColor: '#ccfbf1', color: '#0f766e' }}
            >
              Clinical Doctor Workspace
            </span>
          </Link>

          <div className="d-flex align-items-center gap-3">
            <div className="text-end d-none d-md-block">
              <span className="fw-bold d-block small">{user.name}</span>
              <small className="text-muted">
                {user.specialization || 'Consultant Physician'}
              </small>
            </div>
            <button className="btn btn-outline-danger btn-sm" onClick={logout}>
              <i className="bi bi-box-arrow-right me-1"></i>Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid px-4 py-4">
        <div className="row g-4">
          <div className="col-lg-4 col-xl-3">
            <PatientRoster
              patients={visiblePatients}
              totalCount={patients.length}
              search={search}
              onSearchChange={setSearch}
              selectedPatientId={selectedPatientId}
              onSelect={selectPatient}
              loading={patientsLoading}
              error={patientsError}
            />
          </div>

          <div className="col-lg-8 col-xl-9">
            <div className="card p-3 custom-card mb-4 border-0 shadow-sm bg-white">
              <div className="row align-items-center g-3">
                <div className="col-md-8">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="stat-icon bg-teal-subtle text-teal fs-3"
                      style={{ backgroundColor: '#ccfbf1', color: '#0f766e' }}
                    >
                      <i className="bi bi-person-badge"></i>
                    </div>
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <h5 className="fw-bold mb-0">
                          {selectedPatient ? selectedPatient.name : 'Select a Patient'}
                        </h5>
                        <span className="badge bg-danger-subtle text-danger">
                          {selectedPatient ? selectedPatient.bloodGroup || 'N/A' : '-'}
                        </span>
                      </div>
                      <p className="small text-muted mb-0 mt-1">
                        <span>
                          {selectedPatient
                            ? selectedPatient.email
                            : 'email@example.com'}
                        </span>{' '}
                        •{' '}
                        <span>
                          {selectedPatient
                            ? selectedPatient.phone || 'Not provided'
                            : 'Phone'}
                        </span>{' '}
                        •{' '}
                        <span>
                          {selectedPatient
                            ? selectedPatient.age
                              ? `${selectedPatient.age} years`
                              : 'N/A'
                            : 'Age'}
                        </span>{' '}
                        •{' '}
                        <span>
                          {selectedPatient
                            ? selectedPatient.gender || 'N/A'
                            : 'Gender'}
                        </span>
                      </p>
                      <small className="text-secondary">
                        <strong className="text-danger">Known Allergies:</strong>{' '}
                        <span>
                          {selectedPatient
                            ? selectedPatient.allergies || 'None reported'
                            : 'None'}
                        </span>
                      </small>
                    </div>
                  </div>
                </div>

                <div className="col-md-4 text-md-end">
                  <span className="badge bg-light text-dark border p-2">
                    <i className="bi bi-hospital me-1 text-teal"></i>
                    <span>{user.hospital || 'Care Clinic'}</span>
                  </span>
                </div>
              </div>
            </div>

            <ul className="nav nav-tabs mb-3" role="tablist">
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link fw-semibold ${
                    activeTab === 'reports' ? 'active' : ''
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'reports'}
                  onClick={() => setActiveTab('reports')}
                >
                  <i className="bi bi-file-earmark-medical me-1"></i>Patient Reports Vault
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link fw-semibold ${
                    activeTab === 'prescribe' ? 'active' : ''
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'prescribe'}
                  onClick={() => setActiveTab('prescribe')}
                >
                  <i className="bi bi-prescription2 me-1"></i>Prescription &amp; Precaution
                  Builder
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link fw-semibold ${
                    activeTab === 'compliance' ? 'active' : ''
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'compliance'}
                  onClick={() => setActiveTab('compliance')}
                >
                  <i className="bi bi-activity me-1"></i>Compliance &amp; Adherence Tracker
                </button>
              </li>
            </ul>

            <div className="tab-content">
              {activeTab === 'reports' ? (
                <DoctorReportsTab
                  reports={patientReports}
                  loading={patientReportsLoading}
                  error={patientReportsError}
                />
              ) : null}

              {activeTab === 'prescribe' ? (
                // Remount per patient so a draft cannot be submitted to a
                // different patient after switching in the roster.
                <CarePlanForm
                  key={selectedPatientId || 'no-patient'}
                  patientId={selectedPatientId}
                  onIssued={handleIssued}
                />
              ) : null}

              {activeTab === 'compliance' ? (
                <ComplianceTab
                  stats={complianceStats}
                  tasks={complianceTasks}
                  loading={complianceLoading}
                  error={complianceError}
                  prescriptions={patientPrescriptions}
                  prescriptionsLoading={patientPrescriptionsLoading}
                  prescriptionsError={patientPrescriptionsError}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
