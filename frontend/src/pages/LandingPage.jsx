import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Simulator from '../components/landing/Simulator.jsx';
import LoginModal from '../components/landing/LoginModal.jsx';
import RegisterModal from '../components/landing/RegisterModal.jsx';
import { API_BASE, clearSession, getToken, readJson, setToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { showToast } = useToast();
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => {
    document.title =
      'CareSync | Modern Patient-Doctor Health Vault & Care Compliance';
  }, []);

  // Verify a stored token before showing the landing page.
  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    let active = true;

    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await readJson(res);
        if (!active) return;

        if (res.ok && data.success && data.user) {
          setUser(data.user);
          navigate(data.user.role === 'doctor' ? '/doctor' : '/patient', { replace: true });
        } else {
          clearSession();
        }
      } catch (error) {
        // Leave the visitor on the landing page if the check fails.
      }
    };

    check();

    return () => {
      active = false;
    };
  }, [navigate, setUser]);

  const completeAuth = (data, message, delay = 800, role = null) => {
    setToken(data.token);
    setUser(data.user);
    showToast(message, 'success');
    window.setTimeout(() => {
      const targetRole = role || data.user.role;
      navigate(targetRole === 'doctor' ? '/doctor' : '/patient');
    }, delay);
  };


  return (
    <>
      <div className="bg-gradient-teal text-white py-2 px-3 text-center small fw-semibold">
        <i className="bi bi-shield-check me-1"></i>CareSync 2.0 is live • Smart medical reports
        vault &amp; interactive patient care compliance
      </div>

      <nav className="navbar navbar-expand-lg navbar-light sticky-top shadow-sm py-2">
        <div className="container">
          <Link className="navbar-brand" to="/">
            <img src="/img/logo.svg" alt="CareSync Logo" height="42" />
          </Link>

          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-outline-teal px-3 py-2"
              onClick={() => setLoginOpen(true)}
            >
              <i className="bi bi-box-arrow-in-right me-1"></i>Sign In
            </button>
            <button
              className="btn btn-teal px-3 py-2"
              onClick={() => setRegisterOpen(true)}
            >
              <i className="bi bi-person-plus me-1"></i>Get Started
            </button>
          </div>
        </div>
      </nav>

      <header className="hero-wrapper py-5 border-bottom">
        <div className="container py-lg-4">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <div className="hero-badge mb-3">
                <i className="bi bi-heart-pulse-fill text-danger"></i>
                <span>Connected Healthcare Platform</span>
              </div>

              <h1 className="display-4 hero-title text-dark mb-3">
                Every Medical Report.
                <br />
                Every Doctor&apos;s Advice.
                <br />
                <span className="text-gradient-teal">Always in Perfect Sync.</span>
              </h1>

              <p className="lead text-muted mb-4 fs-6">
                Patients upload their past and present medical records in one secure vault.
                Doctors review the complete timeline, prescribe medicines, and set daily
                precautions. Patients check them off in real time — closing the healthcare
                compliance loop.
              </p>


              <div className="d-flex flex-wrap gap-3">
                <button
                  className="btn btn-teal btn-lg px-4 py-2"
                  onClick={() => setRegisterOpen(true)}
                >
                  <i className="bi bi-person-plus me-1"></i>Create Free Account
                </button>
                <a
                  href="#interactive-simulator"
                  className="btn btn-outline-secondary btn-lg px-4 py-2"
                >
                  <i className="bi bi-play-circle me-1"></i>Try Live Simulator
                </a>
              </div>

              <div className="d-flex gap-4 mt-4 pt-3 border-top text-muted small">
                <div>
                  <i className="bi bi-shield-lock-fill text-success me-1"></i>256-Bit Encrypted
                  Vault
                </div>
                <div>
                  <i className="bi bi-activity text-teal me-1"></i>Real-Time Compliance
                </div>
                <div>
                  <i className="bi bi-phone text-primary me-1"></i>Mobile Responsive
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="image-overlap-wrapper">
                <div className="floating-pill" style={{ top: 15, left: -15 }}>
                  <span className="badge bg-success p-1 rounded-circle">
                    <i className="bi bi-check text-white"></i>
                  </span>
                  <span>Amlodipine 5mg • Done at 9:00 AM</span>
                </div>

                <div
                  className="floating-pill"
                  style={{ bottom: 25, right: 10, animationDelay: '2s' }}
                >
                  <i className="bi bi-file-earmark-medical text-teal fs-5"></i>
                  <span>CBC &amp; Lipid Profile Uploaded</span>
                </div>

                <div className="shadow-lg rounded-4 overflow-hidden border">
                  <img
                    src="/img/hero-illustration.svg"
                    alt="CareSync Dashboard Illustration"
                    className="img-fluid w-100"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Simulator />

      <section className="py-5 bg-light border-top">
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="hero-badge mb-2">
              <i className="bi bi-stars"></i>End-to-End Workflow
            </span>
            <h2 className="fw-bold">How CareSync Transforms Healthcare</h2>
            <p className="text-muted">
              A unified platform connecting patients, diagnostic reports, and medical advice.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-4">
              <div className="feature-card">
                <div
                  className="stat-icon bg-teal-subtle text-teal mb-3"
                  style={{ backgroundColor: '#ccfbf1', color: '#0f766e' }}
                >
                  <i className="bi bi-file-earmark-medical"></i>
                </div>
                <h5 className="fw-bold mb-2">1. Medical Reports Vault</h5>
                <p className="text-muted small">
                  Never lose paper slips again. Upload past and present blood tests, X-rays,
                  MRI scans, and discharge summaries in PDF or JPG format with date and lab
                  tags.
                </p>
                <ul className="list-unstyled small text-secondary mb-0">
                  <li>
                    <i className="bi bi-check2 text-success me-1"></i>Chronological timeline
                    ordering
                  </li>
                  <li>
                    <i className="bi bi-check2 text-success me-1"></i>Categorized by lab,
                    radiology, or ECG
                  </li>
                  <li>
                    <i className="bi bi-check2 text-success me-1"></i>Instant full-screen
                    document inspection
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-md-4">
              <div className="feature-card">
                <div className="stat-icon bg-primary-subtle text-primary mb-3">
                  <i className="bi bi-prescription2"></i>
                </div>
                <h5 className="fw-bold mb-2">2. Clinical Care Plan Builder</h5>
                <p className="text-muted small">
                  Doctors evaluate uploaded records, formulate diagnoses, and prescribe
                  medications with dosage, frequency, and mandatory lifestyle precautions.
                </p>
                <ul className="list-unstyled small text-secondary mb-0">
                  <li>
                    <i className="bi bi-check2 text-success me-1"></i>Multi-drug prescription
                    rows
                  </li>
                  <li>
                    <i className="bi bi-check2 text-success me-1"></i>Dietary and physical
                    activity rules
                  </li>
                  <li>
                    <i className="bi bi-check2 text-success me-1"></i>Follow-up consultation
                    calendar
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-md-4">
              <div className="feature-card">
                <div className="stat-icon bg-success-subtle text-success mb-3">
                  <i className="bi bi-clipboard2-check"></i>
                </div>
                <h5 className="fw-bold mb-2">3. Interactive Task Adherence</h5>
                <p className="text-muted small">
                  Doctor instructions automatically generate an interactive daily task
                  checklist. Patients mark items as &quot;Done&quot; or &quot;To Do Yet&quot;,
                  updating compliance in real time.
                </p>
                <ul className="list-unstyled small text-secondary mb-0">
                  <li>
                    <i className="bi bi-check2 text-success me-1"></i>Real-time adherence
                    percentage meter
                  </li>
                  <li>
                    <i className="bi bi-check2 text-success me-1"></i>Morning, afternoon, and
                    night alerts
                  </li>
                  <li>
                    <i className="bi bi-check2 text-success me-1"></i>Doctor monitoring
                    dashboard
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white border-top py-4">
        <div className="container">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <img src="/img/logo.svg" alt="CareSync" height="32" />
              <span className="text-muted small">
                © 2026 CareSync Health Platform. All rights reserved.
              </span>
            </div>
            <div className="d-flex gap-3 small text-muted">
              <span>
                <i className="bi bi-shield-check text-success me-1"></i>HIPAA &amp; GDPR
                Standards
              </span>
              <span>•</span>
              <span>MongoDB Atlas Connected</span>
            </div>
          </div>
        </div>
      </footer>

      <LoginModal
        show={loginOpen}
        onClose={() => setLoginOpen(false)}
        onAuthenticated={completeAuth}
      />

      <RegisterModal
        show={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onAuthenticated={completeAuth}
      />
    </>
  );
}
