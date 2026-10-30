// Common Utility Functions for CareSync Portal

const API_BASE = '/api';

// Retrieve auth token
function getToken() {
  return localStorage.getItem('caresync_token') || getCookie('token');
}

// Set auth token
function setToken(token) {
  localStorage.setItem('caresync_token', token);
}

// Clear token & logout
function logout() {
  localStorage.removeItem('caresync_token');
  localStorage.removeItem('caresync_user');
  fetch(`${API_BASE}/auth/logout`)
    .finally(() => {
      window.location.href = '/';
    });
}

// Helper to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Store user data
function setCurrentUser(user) {
  localStorage.setItem('caresync_user', JSON.stringify(user));
}

// Get user data
function getCurrentUser() {
  const user = localStorage.getItem('caresync_user');
  return user ? JSON.parse(user) : null;
}

// Toast notification helper
function showToast(message, type = 'primary') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const bgClasses = {
    success: 'text-bg-success',
    danger: 'text-bg-danger',
    warning: 'text-bg-warning',
    info: 'text-bg-info',
    primary: 'text-bg-primary'
  };

  const toastId = 'toast-' + Date.now();
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center ${bgClasses[type] || 'text-bg-dark'} border-0 mb-2 shadow" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  const toastElement = document.getElementById(toastId);
  const bsToast = new bootstrap.Toast(toastElement, { delay: 3500 });
  bsToast.show();

  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

// Format Date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format relative time
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return formatDate(dateStr);
}

// Guard: Ensure user is authenticated and check role
async function checkAuth(requiredRole) {
  const token = getToken();
  if (!token) {
    window.location.href = '/';
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!data.success || !data.user) {
      logout();
      return null;
    }

    setCurrentUser(data.user);

    if (requiredRole && data.user.role !== requiredRole) {
      if (data.user.role === 'patient') {
        window.location.href = '/patient';
      } else if (data.user.role === 'doctor') {
        window.location.href = '/doctor';
      }
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Auth verification failed:', error);
    logout();
    return null;
  }
}

// ==========================================
// 4. NOTIFICATIONS SYSTEM
// ==========================================
async function loadUnreadNotificationCount() {
  const badge = document.getElementById('notificationBadge');
  if (!badge) return;

  try {
    const res = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      if (data.count > 0) {
        badge.textContent = data.count > 99 ? '99+' : data.count;
        badge.classList.remove('d-none');
      } else {
        badge.classList.add('d-none');
      }
    }
  } catch (err) {
    console.warn('Failed to fetch unread notification count:', err.message);
  }
}

async function loadNotificationsList() {
  const container = document.getElementById('notifications-list');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-3 text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Loading...</div>';

  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      if (!data.data || data.data.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-muted small"><i class="bi bi-bell-slash d-block fs-3 mb-1 text-secondary opacity-50"></i>No notifications yet</div>';
        return;
      }

      const iconMap = {
        invite_received: 'bi-person-plus-fill text-warning',
        invite_accepted: 'bi-check-circle-fill text-success',
        invite_rejected: 'bi-x-circle-fill text-danger',
        new_prescription: 'bi-file-earmark-medical-fill text-primary',
        new_report: 'bi-file-earmark-arrow-up-fill text-info',
        ai_analysis_ready: 'bi-robot text-teal',
        task_reminder: 'bi-alarm-fill text-warning',
        chat_message: 'bi-chat-dots-fill text-teal',
        system: 'bi-info-circle-fill text-secondary'
      };

      container.innerHTML = data.data.map((n) => {
        const iconClass = iconMap[n.type] || 'bi-bell-fill text-primary';
        const unreadClass = !n.read ? 'bg-light fw-bold border-start border-3 border-primary' : '';
        return `
          <div class="p-3 border-bottom notification-item ${unreadClass}" style="cursor: pointer;" onclick="markNotificationSingleRead('${n._id}', '${n.link || ''}')">
            <div class="d-flex gap-2">
              <i class="bi ${iconClass} fs-5 mt-1"></i>
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center">
                  <h6 class="mb-0 small fw-bold text-dark">${escapeHtml(n.title)}</h6>
                  <small class="text-muted" style="font-size: 0.7rem;">${formatRelativeTime(n.createdAt)}</small>
                </div>
                <p class="mb-0 text-muted small mt-1" style="font-size: 0.775rem;">${escapeHtml(n.message)}</p>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = '<div class="text-center py-3 text-danger small">Failed to load notifications</div>';
  }
}

async function markAllNotificationsRead() {
  try {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      const badge = document.getElementById('notificationBadge');
      if (badge) badge.classList.add('d-none');
      loadNotificationsList();
      showToast('All notifications marked as read', 'info');
    }
  } catch (err) {
    console.error('Failed to mark all as read:', err);
  }
}

async function markNotificationSingleRead(id, link) {
  try {
    await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    loadUnreadNotificationCount();
    if (link) {
      if (link.startsWith('#')) {
        const tabTrigger = document.querySelector(`[data-bs-target="${link}"]`);
        if (tabTrigger) bootstrap.Tab.getOrCreateInstance(tabTrigger).show();
      } else if (link.startsWith('/')) {
        if (window.location.pathname !== link) {
          window.location.href = link;
        }
      }
    }
  } catch (err) {
    console.error('Failed to mark read:', err);
  }
}

// Hook notification bell dropdown toggle
document.addEventListener('DOMContentLoaded', () => {
  const notifDropdown = document.getElementById('notificationDropdown');
  if (notifDropdown) {
    notifDropdown.addEventListener('show.bs.dropdown', () => {
      loadNotificationsList();
    });
    loadUnreadNotificationCount();
  }
});

// ==========================================
// 5. PRESCRIPTION PDF EXPORT
// ==========================================
window.downloadPrescriptionPdf = async function (prescriptionId) {
  try {
    showToast('Preparing clinical prescription PDF...', 'info');
    const token = getToken();

    const response = await fetch(`${API_BASE}/prescriptions/${prescriptionId}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Server error generating PDF.');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `CareSync-Prescription-${prescriptionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);

    showToast('Prescription PDF downloaded successfully!', 'success');
  } catch (error) {
    console.error('Prescription download failed:', error);
    showToast('Failed to download PDF: ' + error.message, 'danger');
  }
};

// ==========================================
// 6. AI-POWERED LAB REPORT ANALYSIS MODAL
// ==========================================
window.openAiAnalysisModal = async function (reportId) {
  let modalElem = document.getElementById('aiAnalysisModal');
  if (!modalElem) {
    createAiAnalysisModalHtml();
    modalElem = document.getElementById('aiAnalysisModal');
  }

  const bsModal = bootstrap.Modal.getOrCreateInstance(modalElem);
  const modalBody = document.getElementById('ai-modal-body');
  const modalTitle = document.getElementById('ai-modal-report-title');
  const modalSubtitle = document.getElementById('ai-modal-subtitle');

  modalTitle.textContent = 'CareSync Clinical Intelligence';
  modalSubtitle.textContent = 'Analyzing medical indicators...';
  modalBody.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-grow text-primary mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
      <h5 class="fw-bold text-dark">AI Diagnostic Pipeline Active</h5>
      <p class="text-muted small mb-0">Correlating laboratory biomarkers, physiological ranges, and clinical guidelines...</p>
    </div>
  `;
  bsModal.show();

  try {
    // 1. Fetch report details
    let res = await fetch(`${API_BASE}/reports/${reportId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    let data = await res.json();

    if (!data.success || !data.report) {
      throw new Error(data.message || 'Could not fetch report details.');
    }

    let report = data.report;

    // 2. If AI analysis is not completed yet, trigger it now
    if (!report.aiAnalysis || report.aiAnalysis.status !== 'completed') {
      modalSubtitle.textContent = 'Generating comprehensive biomarker review...';
      const aiRes = await fetch(`${API_BASE}/reports/${reportId}/analyze-ai`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const aiData = await aiRes.json();
      if (!aiData.success || !aiData.aiAnalysis) {
        throw new Error(aiData.message || 'AI analysis could not be completed.');
      }
      report.aiAnalysis = aiData.aiAnalysis;
    }

    // 3. Render structured analysis into modal
    renderAiAnalysisContent(report);
  } catch (err) {
    modalBody.innerHTML = `
      <div class="alert alert-danger py-4 text-center">
        <i class="bi bi-exclamation-triangle-fill fs-2 mb-2 d-block"></i>
        <h6 class="fw-bold mb-1">AI Lab Analysis Failed</h6>
        <p class="small mb-3">${escapeHtml(err.message)}</p>
        <button class="btn btn-outline-danger btn-sm" onclick="openAiAnalysisModal('${reportId}')">
          <i class="bi bi-arrow-repeat me-1"></i>Try Again
        </button>
      </div>
    `;
  }
};

function renderAiAnalysisContent(report) {
  const analysis = report.aiAnalysis;
  const modalTitle = document.getElementById('ai-modal-report-title');
  const modalSubtitle = document.getElementById('ai-modal-subtitle');
  const modalBody = document.getElementById('ai-modal-body');

  modalTitle.textContent = report.title;
  modalSubtitle.textContent = `${report.category} • Tested at ${report.labOrHospital || 'Clinic'} on ${formatDate(report.reportDate)}`;

  const riskColors = {
    Low: { bg: 'bg-success', text: 'text-success', border: 'border-success-subtle', icon: 'bi-shield-check' },
    Moderate: { bg: 'bg-warning text-dark', text: 'text-warning', border: 'border-warning-subtle', icon: 'bi-exclamation-circle' },
    High: { bg: 'bg-danger', text: 'text-danger', border: 'border-danger-subtle', icon: 'bi-exclamation-triangle-fill' },
    Critical: { bg: 'bg-dark', text: 'text-danger', border: 'border-dark', icon: 'bi-radioactive' }
  };

  const risk = riskColors[analysis.overallRiskScore] || riskColors.Low;

  const statusBadges = {
    Normal: '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check2 me-1"></i>Normal</span>',
    Attention: '<span class="badge bg-warning-subtle text-warning border border-warning-subtle"><i class="bi bi-eye me-1"></i>Borderline</span>',
    High: '<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="bi bi-arrow-up me-1"></i>Elevated</span>',
    Low: '<span class="badge bg-info-subtle text-info border border-info-subtle"><i class="bi bi-arrow-down me-1"></i>Below Normal</span>',
    Critical: '<span class="badge bg-danger text-white"><i class="bi bi-exclamation-octagon-fill me-1"></i>Critical</span>'
  };

  modalBody.innerHTML = `
    <!-- Top Risk Gauge Banner -->
    <div class="card border-0 shadow-sm mb-3 overflow-hidden">
      <div class="card-body p-3 d-flex flex-wrap align-items-center justify-content-between gap-3 bg-white">
        <div class="d-flex align-items-center gap-3">
          <div class="stat-icon ${risk.bg} text-white rounded-3 fs-3" style="width: 50px; height: 50px;">
            <i class="bi ${risk.icon}"></i>
          </div>
          <div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge ${risk.bg} fs-6">${analysis.overallRiskScore} Risk Profile</span>
              <span class="badge bg-light text-muted border">Confidence: ${analysis.confidenceScore || 96}%</span>
            </div>
            <small class="text-muted d-block mt-1">Evaluated via CareSync Clinical Heuristic & Gemini AI Engine</small>
          </div>
        </div>
        <button class="btn btn-sm btn-outline-secondary" onclick="reRunAiAnalysis('${report._id}')" title="Re-analyze">
          <i class="bi bi-arrow-repeat me-1"></i>Re-Evaluate
        </button>
      </div>
    </div>

    <!-- Executive Patient-Friendly Summary -->
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body p-3 bg-white">
        <h6 class="fw-bold text-primary mb-2"><i class="bi bi-chat-quote-fill me-2"></i>Executive Plain-Language Summary</h6>
        <p class="mb-0 text-dark" style="line-height: 1.6;">${escapeHtml(analysis.summary)}</p>
      </div>
    </div>

    <!-- Key Biomarkers Table -->
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-header bg-white border-bottom p-3">
        <h6 class="fw-bold mb-0 text-dark"><i class="bi bi-activity text-teal me-2"></i>Identified Biomarkers & Reference Ranges</h6>
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light small text-uppercase">
            <tr>
              <th>Biomarker / Test</th>
              <th>Reported Value</th>
              <th>Healthy Reference Range</th>
              <th>Evaluation</th>
            </tr>
          </thead>
          <tbody class="small">
            ${analysis.keyBiomarkers.map((b) => `
              <tr>
                <td>
                  <strong class="text-dark d-block">${escapeHtml(b.name)}</strong>
                  <span class="text-muted" style="font-size: 0.75rem;">${escapeHtml(b.explanation || '')}</span>
                </td>
                <td><strong class="fs-6">${escapeHtml(b.value)}</strong> <span class="text-muted">${escapeHtml(b.unit || '')}</span></td>
                <td><span class="text-secondary">${escapeHtml(b.referenceRange || 'Standard')}</span></td>
                <td>${statusBadges[b.status] || b.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Clinical Insights & Recommendations Grid -->
    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <div class="card border-0 shadow-sm h-100 bg-white">
          <div class="card-body p-3">
            <h6 class="fw-bold text-teal mb-2"><i class="bi bi-lightbulb-fill me-2"></i>Clinical Insights</h6>
            <ul class="list-unstyled mb-0 small">
              ${(analysis.clinicalInsights || []).map((ci) => `
                <li class="mb-2 d-flex gap-2">
                  <i class="bi bi-arrow-right-circle text-teal mt-1"></i>
                  <span>${escapeHtml(ci)}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="card border-0 shadow-sm h-100 bg-white">
          <div class="card-body p-3">
            <h6 class="fw-bold text-success mb-2"><i class="bi bi-heart-pulse-fill me-2"></i>Lifestyle & Diet Modifications</h6>
            <ul class="list-unstyled mb-0 small">
              ${(analysis.lifestyleRecommendations || []).map((lr) => `
                <li class="mb-2 d-flex gap-2">
                  <i class="bi bi-check-circle text-success mt-1"></i>
                  <span>${escapeHtml(lr)}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Questions for Doctor -->
    <div class="card border-0 shadow-sm bg-white">
      <div class="card-body p-3">
        <h6 class="fw-bold text-dark mb-2"><i class="bi bi-question-circle-fill text-warning me-2"></i>Recommended Questions for Your Doctor</h6>
        <div class="list-group list-group-flush small">
          ${(analysis.questionsForDoctor || []).map((q) => `
            <div class="list-group-item px-0 py-2 border-0 d-flex gap-2 text-dark">
              <span class="badge bg-warning-subtle text-dark border">Q</span>
              <span>${escapeHtml(q)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

window.reRunAiAnalysis = async function (reportId) {
  const modalBody = document.getElementById('ai-modal-body');
  modalBody.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-teal mb-3" style="width: 3rem; height: 3rem;"></div>
      <h6 class="fw-bold">Re-evaluating lab biomarkers...</h6>
    </div>
  `;

  try {
    const aiRes = await fetch(`${API_BASE}/reports/${reportId}/analyze-ai`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const aiData = await aiRes.json();
    if (aiData.success && aiData.aiAnalysis) {
      const res = await fetch(`${API_BASE}/reports/${reportId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      renderAiAnalysisContent(data.report);
      showToast('AI analysis re-evaluated successfully!', 'success');
    }
  } catch (err) {
    showToast('Failed to re-evaluate: ' + err.message, 'danger');
  }
};

function createAiAnalysisModalHtml() {
  const modalHtml = `
    <div class="modal fade" id="aiAnalysisModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div class="modal-header bg-gradient text-white p-3" style="background: linear-gradient(135deg, #1e40af, #0d9488);">
            <div class="d-flex align-items-center gap-2">
              <div class="stat-icon bg-white text-primary rounded-circle" style="width: 38px; height: 38px; font-size: 1.2rem;">
                <i class="bi bi-robot"></i>
              </div>
              <div>
                <h6 class="modal-title fw-bold mb-0 text-white" id="ai-modal-report-title">CareSync AI Lab Intelligence</h6>
                <small class="text-white-50" id="ai-modal-subtitle">Biomarker evaluation & clinical insights</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-3 bg-light" id="ai-modal-body"></div>
          <div class="modal-footer bg-white border-top justify-content-between py-2 px-3">
            <small class="text-muted"><i class="bi bi-shield-check text-success me-1"></i>Verified Clinical Engine • For Diagnostic Assistance</small>
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

