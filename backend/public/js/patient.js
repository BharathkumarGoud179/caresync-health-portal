// Patient Dashboard Controller (Reports Vault, Task Checklist, Prescriptions)

let currentUser = null;
let allReports = [];
let allTasks = [];
let currentTaskFilter = 'all';
let connectedDoctor = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth('patient');
  if (!currentUser) return;

  // Initialize Socket.io connection for real-time messaging & WebRTC calling
  if (typeof initSocket === 'function') {
    initSocket(currentUser.id || currentUser._id);
  }

  renderPatientHeader();
  loadDoctorAssignment();
  loadReports();
  loadTasks();
  loadPrescriptions();
  setupEventListeners();
});

// Render user profile header
function renderPatientHeader() {
  document.getElementById('patient-name-display').textContent = currentUser.name;
  document.getElementById('patient-blood-group').textContent = currentUser.bloodGroup || 'Not specified';
  document.getElementById('patient-age-gender').textContent = 
    `${currentUser.age ? currentUser.age + ' yrs' : ''} ${currentUser.gender ? '• ' + currentUser.gender : ''}`.trim() || 'Details pending';
  document.getElementById('patient-allergies').textContent = currentUser.allergies || 'None reported';
}

// Check doctor assigned
// Check doctor connection status & pending requests
async function loadDoctorAssignment() {
  const doctorBox = document.getElementById('assigned-doctor-info');
  doctorBox.innerHTML = '<span class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Checking doctor status...</span>';

  try {
    const res = await fetch('/api/doctors/my-connection', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();

    if (data.success && data.connection) {
      const conn = data.connection;
      const doc = conn.doctor;

      if (conn.status === 'accepted') {
        connectedDoctor = doc;
        doctorBox.innerHTML = `
          <div>
            <div class="d-flex align-items-center justify-content-between mb-1">
              <div>
                <span class="badge bg-success-subtle text-success border border-success-subtle small me-1">
                  <i class="bi bi-shield-check me-1"></i>Approved & Connected
                </span>
                <h6 class="mb-0 fw-bold text-dark mt-1">${doc.name}</h6>
                <small class="text-muted">${doc.specialization || 'Physician'} • ${doc.hospital || 'Care Clinic'}</small>
              </div>
              <button class="btn btn-sm btn-outline-secondary" onclick="openDoctorSelectModal()" title="Change Doctor">
                <i class="bi bi-arrow-repeat"></i>
              </button>
            </div>
            <!-- Communication Bar -->
            <div class="d-flex gap-2 mt-2 pt-2 border-top">
              <button class="btn btn-sm btn-teal text-white flex-grow-1" onclick="openChatWithDoctor()">
                <i class="bi bi-chat-dots-fill me-1"></i>Chat
              </button>
              <button class="btn btn-sm btn-outline-primary" onclick="startVoiceCallWithDoctor()" title="Voice Call">
                <i class="bi bi-telephone-fill"></i> Voice
              </button>
              <button class="btn btn-sm btn-outline-success" onclick="startVideoCallWithDoctor()" title="Video Call">
                <i class="bi bi-camera-video-fill"></i> Video
              </button>
            </div>
          </div>
        `;
      } else if (conn.status === 'pending') {
        connectedDoctor = null;
        doctorBox.innerHTML = `
          <div>
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <span class="badge bg-warning-subtle text-warning border border-warning-subtle small">
                  <i class="bi bi-hourglass-split me-1"></i>Invitation Pending Doctor Acceptance
                </span>
                <h6 class="mb-0 fw-bold text-dark mt-1">${doc.name}</h6>
                <small class="text-muted">${doc.specialization} • ${doc.hospital || 'Hospital'}</small>
              </div>
              <button class="btn btn-sm btn-outline-secondary" onclick="openDoctorSelectModal()">Change</button>
            </div>
            <div class="alert alert-warning py-1 px-2 mb-0 mt-2 small" style="font-size: 0.775rem;">
              <i class="bi bi-lock-fill me-1"></i><strong>Privacy Protected:</strong> Your medical reports are hidden from this doctor until they accept your request.
            </div>
          </div>
        `;
      }
    } else {
      connectedDoctor = null;
      doctorBox.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
          <div>
            <span class="text-muted small"><i class="bi bi-info-circle me-1"></i>No doctor connected yet.</span>
            <small class="d-block text-secondary">Send an invitation to grant medical access.</small>
          </div>
          <button class="btn btn-sm btn-teal" onclick="openDoctorSelectModal()">
            <i class="bi bi-person-plus me-1"></i>Find Doctor
          </button>
        </div>
      `;
    }
  } catch (err) {
    doctorBox.innerHTML = '<span class="text-danger small">Failed to load connection status.</span>';
  }
}

// Open modal to select doctor and send invitation request
window.openDoctorSelectModal = async function () {
  const modalElem = new bootstrap.Modal(document.getElementById('selectDoctorModal'));
  const listContainer = document.getElementById('doctors-list-container');
  listContainer.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-teal"></span> Loading physicians...</div>';
  modalElem.show();

  try {
    const res = await fetch('/api/doctors/all', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success && data.doctors.length > 0) {
      listContainer.innerHTML = data.doctors.map((doc) => `
        <div class="card p-3 mb-2 border">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-1">${doc.name}</h6>
              <p class="small text-muted mb-0">${doc.specialization} • ${doc.hospital || 'Hospital'}</p>
              <small class="text-secondary">${doc.experienceYears ? doc.experienceYears + ' yrs experience' : ''}</small>
            </div>
            <button class="btn btn-sm btn-teal" onclick="sendDoctorInvitation('${doc._id}', '${escapeHtml(doc.name)}')">
              <i class="bi bi-send me-1"></i>Send Request
            </button>
          </div>
        </div>
      `).join('');
    } else {
      listContainer.innerHTML = '<p class="text-muted text-center py-3">No verified doctors found.</p>';
    }
  } catch (err) {
    listContainer.innerHTML = '<p class="text-danger text-center">Failed to load doctor list.</p>';
  }
};

// Send invitation request to doctor
window.sendDoctorInvitation = async function (doctorId, doctorName) {
  try {
    const res = await fetch('/api/doctors/send-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        doctorId,
        message: 'Requesting clinical consultation and granting medical vault access.'
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('selectDoctorModal')).hide();
      loadDoctorAssignment();
    } else {
      showToast(data.message || 'Request failed.', 'warning');
    }
  } catch (err) {
    showToast('Failed to send invitation request.', 'danger');
  }
};

// Patient Chat & Calling triggers
window.openChatWithDoctor = function () {
  if (!connectedDoctor) {
    showToast('You must have an approved connected doctor to chat.', 'warning');
    return;
  }
  openChat(connectedDoctor._id || connectedDoctor.id, connectedDoctor.name, connectedDoctor.specialization);
};

window.startVoiceCallWithDoctor = function () {
  if (!connectedDoctor) {
    showToast('You must have an approved connected doctor to call.', 'warning');
    return;
  }
  startCall(connectedDoctor._id || connectedDoctor.id, connectedDoctor.name, 'audio');
};

window.startVideoCallWithDoctor = function () {
  if (!connectedDoctor) {
    showToast('You must have an approved connected doctor to call.', 'warning');
    return;
  }
  startCall(connectedDoctor._id || connectedDoctor.id, connectedDoctor.name, 'video');
};

// ==========================================
// 1. MEDICAL REPORTS VAULT
// ==========================================
async function loadReports() {
  const container = document.getElementById('reports-timeline-container');
  const countBadge = document.getElementById('reports-count-badge');
  container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="text-muted mt-2">Loading your medical records...</p></div>';

  try {
    const res = await fetch('/api/reports/my-reports', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      allReports = data.reports;
      if (countBadge) countBadge.textContent = `${allReports.length} records`;
      renderReportsList(allReports);
    }
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger">Error loading reports.</div>';
  }
}

function renderReportsList(reports) {
  const container = document.getElementById('reports-timeline-container');
  if (!reports || reports.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 bg-white rounded-3 border">
        <i class="bi bi-file-earmark-medical display-4 text-muted"></i>
        <h6 class="mt-3 text-secondary">No medical records uploaded yet</h6>
        <p class="text-muted small">Upload your past and present blood tests, scans, or prescriptions so your doctor can review them.</p>
        <button class="btn btn-teal btn-sm" data-bs-toggle="modal" data-bs-target="#uploadReportModal">
          <i class="bi bi-cloud-arrow-up me-1"></i>Upload Your First Report
        </button>
      </div>
    `;
    return;
  }

  const categoryBadges = {
    'Blood Test': 'badge-lab',
    'Radiology / X-Ray / Scan': 'badge-radiology',
    'Prescription': 'badge-prescription',
    'Discharge Summary': 'badge-discharge',
    'Pathology': 'badge-pathology'
  };

  container.innerHTML = reports.map((r) => {
    const badgeClass = categoryBadges[r.category] || 'bg-light text-dark';
    const isPdf = r.filePath.toLowerCase().endsWith('.pdf');
    const icon = isPdf ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-image text-primary';

    return `
      <div class="report-card mb-3">
        <div class="d-flex justify-content-between align-items-start">
          <div class="d-flex gap-3">
            <div class="fs-2"><i class="bi ${icon}"></i></div>
            <div>
              <div class="d-flex align-items-center gap-2">
                <h6 class="mb-0 fw-bold">${escapeHtml(r.title)}</h6>
                <span class="report-badge ${badgeClass}">${r.category}</span>
              </div>
              <p class="text-muted small mb-1 mt-1">
                <i class="bi bi-calendar3 me-1"></i><strong>Test Date:</strong> ${formatDate(r.reportDate)} 
                <span class="mx-2">•</span> 
                <i class="bi bi-building me-1"></i>${escapeHtml(r.labOrHospital || 'Clinic')}
              </p>
              ${r.notes ? `<p class="small text-secondary mb-1 bg-light p-2 rounded"><em>Notes:</em> ${escapeHtml(r.notes)}</p>` : ''}
              <small class="text-muted">Uploaded on ${formatDate(r.createdAt)} (${formatFileSize(r.fileSize)})</small>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <button class="btn btn-sm btn-outline-teal shadow-xs" onclick="openAiAnalysisModal('${r._id}')" title="AI Health Intelligence">
              <i class="bi bi-robot me-1 text-teal"></i>AI Analysis ${r.aiAnalysis && r.aiAnalysis.status === 'completed' ? `<span class="badge bg-teal ms-1">${r.aiAnalysis.overallRiskScore}</span>` : ''}
            </button>
            <a href="${r.filePath}" target="_blank" class="btn btn-sm btn-outline-primary" title="View Document">
              <i class="bi bi-box-arrow-up-right me-1"></i>View
            </a>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteReport('${r._id}')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Handle Report Upload Form
const uploadForm = document.getElementById('upload-report-form');
if (uploadForm) {
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    const fileInput = document.getElementById('report-file');

    if (!fileInput.files || fileInput.files.length === 0) {
      showToast('Please choose a file to upload.', 'warning');
      return;
    }

    const formData = new FormData(uploadForm);
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';

    try {
      const res = await fetch('/api/reports/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast('Medical report uploaded successfully!', 'success');
        uploadForm.reset();
        bootstrap.Modal.getInstance(document.getElementById('uploadReportModal')).hide();
        loadReports();
      } else {
        showToast(data.message || 'Upload failed.', 'danger');
      }
    } catch (err) {
      showToast('Failed to upload file.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i>Upload Report';
    }
  });
}

// Delete report
window.deleteReport = async function (id) {
  if (!confirm('Are you sure you want to delete this medical report?')) return;
  try {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Report deleted.', 'info');
      loadReports();
    }
  } catch (err) {
    showToast('Failed to delete report.', 'danger');
  }
};

// Filter reports
window.filterReports = function (category) {
  document.querySelectorAll('.report-filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === category);
  });
  if (category === 'All') {
    renderReportsList(allReports);
  } else {
    const filtered = allReports.filter((r) => r.category === category);
    renderReportsList(filtered);
  }
};

// ==========================================
// 2. ACTIONABLE CARE TASKS & PRECAUTIONS CHECKLIST
// ==========================================
async function loadTasks() {
  const container = document.getElementById('tasks-list-container');
  container.innerHTML = '<div class="text-center py-4"><span class="spinner-border spinner-border-sm text-teal"></span> Loading care plan...</div>';

  try {
    const res = await fetch('/api/tasks/my-tasks', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      allTasks = data.tasks;
      updateComplianceStats(data.stats);
      renderTasksList();
    }
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger py-2">Failed to load care plan tasks.</div>';
  }
}

function updateComplianceStats(stats) {
  if (!stats) return;
  const rateElem = document.getElementById('adherence-rate-text');
  const barElem = document.getElementById('adherence-progress-bar');
  const countDoneElem = document.getElementById('tasks-done-count');
  const countTotalElem = document.getElementById('tasks-total-count');

  if (rateElem) rateElem.textContent = `${stats.adherenceRate}%`;
  if (barElem) {
    barElem.style.width = `${stats.adherenceRate}%`;
    barElem.className = `progress-bar ${stats.adherenceRate >= 80 ? 'bg-success' : stats.adherenceRate >= 50 ? 'bg-warning' : 'bg-primary'}`;
  }
  if (countDoneElem) countDoneElem.textContent = stats.done;
  if (countTotalElem) countTotalElem.textContent = stats.total;
}

function renderTasksList() {
  const container = document.getElementById('tasks-list-container');
  let tasksToDisplay = allTasks;

  if (currentTaskFilter === 'todo') {
    tasksToDisplay = allTasks.filter((t) => t.status === 'todo');
  } else if (currentTaskFilter === 'done') {
    tasksToDisplay = allTasks.filter((t) => t.status === 'done');
  }

  if (tasksToDisplay.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted bg-white rounded border">
        <i class="bi bi-check2-circle fs-3 text-success"></i>
        <p class="mb-0 mt-2">${currentTaskFilter === 'todo' ? 'No pending tasks! Great job maintaining your care routine.' : 'No tasks in this category.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasksToDisplay.map((t) => {
    const isDone = t.status === 'done';
    const typeIcons = {
      'Medication': 'bi-capsule text-primary',
      'Precaution': 'bi-shield-check text-warning',
      'Vital Check': 'bi-activity text-danger',
      'Lifestyle & Diet': 'bi-heart-pulse text-success'
    };

    return `
      <div class="task-item ${isDone ? 'done' : ''}" id="task-${t._id}">
        <div class="d-flex align-items-start gap-3">
          <button class="btn btn-outline-${isDone ? 'success' : 'secondary'} task-checkbox-btn" onclick="toggleTask('${t._id}', '${isDone ? 'todo' : 'done'}')">
            <i class="bi ${isDone ? 'bi-check-lg fw-bold' : 'bi-circle'}"></i>
          </button>
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="fw-bold task-title">${escapeHtml(t.title)}</span>
              <span class="badge ${isDone ? 'bg-success' : 'bg-secondary'} small">${isDone ? 'Done' : 'To Do'}</span>
              <span class="badge bg-light text-dark border small"><i class="bi ${typeIcons[t.taskType] || 'bi-bookmark'} me-1"></i>${t.taskType}</span>
            </div>
            ${t.description ? `<p class="small text-muted mb-1 mt-1">${escapeHtml(t.description)}</p>` : ''}
            <div class="d-flex gap-3 small text-muted mt-1">
              <span><i class="bi bi-clock me-1"></i>${t.timing || 'Anytime'}</span>
              ${t.doctor ? `<span><i class="bi bi-person-check me-1"></i>Prescribed by ${t.doctor.name}</span>` : ''}
              ${isDone && t.completedAt ? `<span class="text-success"><i class="bi bi-check-all me-1"></i>Completed ${formatRelativeTime(t.completedAt)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="d-flex flex-column align-items-end">
          <button class="btn btn-sm ${isDone ? 'btn-outline-secondary' : 'btn-success'}" onclick="toggleTask('${t._id}', '${isDone ? 'todo' : 'done'}')">
            ${isDone ? '<i class="bi bi-arrow-counterclockwise me-1"></i>Mark To Do' : '<i class="bi bi-check2 me-1"></i>Mark Done'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Toggle Task Status (Done / To Do)
window.toggleTask = async function (id, newStatus) {
  try {
    const res = await fetch(`/api/tasks/${id}/toggle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, newStatus === 'done' ? 'success' : 'info');
      // Update local task
      const target = allTasks.find((t) => t._id === id);
      if (target) {
        target.status = newStatus;
        target.completedAt = newStatus === 'done' ? new Date() : null;
      }
      // Refresh stats
      const totalCount = allTasks.length;
      const doneCount = allTasks.filter((t) => t.status === 'done').length;
      const todoCount = totalCount - doneCount;
      const adherenceRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
      updateComplianceStats({ total: totalCount, done: doneCount, todo: todoCount, adherenceRate });
      renderTasksList();
    }
  } catch (err) {
    showToast('Failed to update task status.', 'danger');
  }
};

window.filterTasks = function (filter) {
  currentTaskFilter = filter;
  document.querySelectorAll('.task-filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
  });
  renderTasksList();
};

// ==========================================
// 3. DOCTOR PRESCRIPTIONS & CLINICAL ADVICE
// ==========================================
async function loadPrescriptions() {
  const container = document.getElementById('prescriptions-container');
  try {
    const res = await fetch('/api/prescriptions/my-prescriptions', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success && data.prescriptions.length > 0) {
      container.innerHTML = data.prescriptions.map((p) => `
        <div class="card p-3 mb-3 border shadow-sm">
          <div class="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2">
            <div>
              <h6 class="fw-bold text-teal mb-0"><i class="bi bi-file-earmark-medical me-2"></i>Diagnosis: ${escapeHtml(p.diagnosis)}</h6>
              <small class="text-muted">Prescribed by <strong>${p.doctor ? p.doctor.name : 'Doctor'}</strong> (${p.doctor ? p.doctor.specialization : ''}) on ${formatDate(p.createdAt)}</small>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-success">${p.status}</span>
              <button class="btn btn-sm btn-outline-primary" onclick="downloadPrescriptionPdf('${p._id}')" title="Download Official PDF">
                <i class="bi bi-file-earmark-pdf me-1"></i>Download PDF
              </button>
            </div>
          </div>

          ${p.clinicalNotes ? `<p class="small text-secondary mb-3"><strong>Doctor Notes:</strong> ${escapeHtml(p.clinicalNotes)}</p>` : ''}

          <!-- Medications List -->
          <h6 class="small fw-bold text-dark text-uppercase mb-2"><i class="bi bi-capsule me-1"></i>Prescribed Medicines:</h6>
          <div class="table-responsive mb-3">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Schedule</th>
                  <th>Instruction</th>
                </tr>
              </thead>
              <tbody>
                ${p.medications.map((m) => `
                  <tr>
                    <td class="fw-bold">${escapeHtml(m.medicineName)}</td>
                    <td>${escapeHtml(m.dosage)}</td>
                    <td>${escapeHtml(m.frequency)}</td>
                    <td>
                      ${m.timeOfDay.morning ? '<span class="timing-tag bg-warning-subtle">Morning</span>' : ''}
                      ${m.timeOfDay.afternoon ? '<span class="timing-tag bg-info-subtle">Afternoon</span>' : ''}
                      ${m.timeOfDay.night ? '<span class="timing-tag bg-dark-subtle">Night</span>' : ''}
                    </td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(m.instruction)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Precautions & Instructions -->
          ${p.precautions && p.precautions.length > 0 ? `
            <h6 class="small fw-bold text-danger text-uppercase mb-2"><i class="bi bi-shield-exclamation me-1"></i>Precautions & Lifestyle Rules:</h6>
            <ul class="list-group list-group-flush small">
              ${p.precautions.map((pr) => `
                <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                  <div>
                    <strong class="text-dark">${escapeHtml(pr.title)}</strong>
                    <p class="text-muted mb-0">${escapeHtml(pr.description || '')}</p>
                  </div>
                  <span class="badge bg-warning text-dark">${pr.category}</span>
                </li>
              `).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p class="text-muted text-center py-3">No prescriptions recorded yet. Your doctor will issue prescriptions and precautions after evaluating your reports.</p>';
    }
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger py-2">Error loading prescriptions.</div>';
  }
}

function setupEventListeners() {
  // Drag and drop file upload
  const dropZone = document.getElementById('report-drop-zone');
  const fileInput = document.getElementById('report-file');
  const fileNameDisplay = document.getElementById('selected-file-name');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        updateFileName();
      }
    });

    fileInput.addEventListener('change', updateFileName);

    function updateFileName() {
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileNameDisplay.innerHTML = `<span class="badge bg-teal p-2"><i class="bi bi-file-earmark-check me-1"></i>${escapeHtml(file.name)} (${formatFileSize(file.size)})</span>`;
      }
    }
  }
}

// Helpers
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ==========================================
// 4. AI LONGITUDINAL BIOMARKER TRENDS
// ==========================================
window.loadBiomarkerTrends = async function () {
  const container = document.getElementById('trends-view-container');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-5 bg-white rounded border">
      <div class="spinner-border text-primary mb-2"></div>
      <p class="text-muted small mb-0">Correlating longitudinal biomarkers across your medical timeline...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/reports/analytics/changes', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await res.json();

    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to analyze trends.');
    }

    const data = result.data;

    if (data.status === 'insufficient_data') {
      container.innerHTML = `
        <div class="card p-4 text-center border-0 shadow-sm bg-white">
          <i class="bi bi-graph-up text-secondary display-5 mb-2"></i>
          <h6 class="fw-bold text-dark">Need at least 2 diagnostic reports</h6>
          <p class="text-muted small mb-3">Upload your past and current lab tests (such as Complete Blood Count, Lipid Panels, or Blood Glucose) to see automated trend tracking and health trajectory analysis.</p>
          <div>
            <button class="btn btn-teal text-white btn-sm" data-bs-toggle="modal" data-bs-target="#uploadReportModal">
              <i class="bi bi-cloud-arrow-up me-1"></i>Upload Another Report
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Render Trajectory Card & Metrics
    const trajBadgeColors = {
      Improving: 'bg-success text-white',
      Deteriorating: 'bg-danger text-white',
      'Attention Needed': 'bg-warning text-dark',
      Stable: 'bg-primary text-white'
    };

    const trajBadge = trajBadgeColors[data.overallTrajectory] || 'bg-secondary text-white';

    container.innerHTML = `
      <!-- Executive Trajectory Card -->
      <div class="card border-0 shadow-sm mb-4 overflow-hidden">
        <div class="card-body p-4 bg-white">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3 pb-3 border-bottom">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-primary-subtle text-primary rounded-circle fs-3" style="width: 54px; height: 54px;">
                <i class="bi bi-heart-pulse-fill"></i>
              </div>
              <div>
                <div class="d-flex align-items-center gap-2">
                  <h5 class="fw-bold mb-0 text-dark">Overall Health Trajectory:</h5>
                  <span class="badge ${trajBadge} fs-6 px-3 py-2 rounded-pill">${data.overallTrajectory}</span>
                </div>
                <small class="text-muted">Analyzed ${data.reportsComparedCount} diagnostic reports spanning ${data.timespanDays} days (${data.firstReportDate} to ${data.latestReportDate})</small>
              </div>
            </div>
            <div class="d-flex gap-2">
              <span class="badge bg-success-subtle text-success border border-success-subtle p-2">
                <i class="bi bi-arrow-up-right me-1"></i>${data.improvingCount} Improving
              </span>
              <span class="badge bg-danger-subtle text-danger border border-danger-subtle p-2">
                <i class="bi bi-arrow-down-right me-1"></i>${data.worseningCount} Worsening
              </span>
              <span class="badge bg-light text-secondary border p-2">
                <i class="bi bi-dash me-1"></i>${data.stableCount} Stable
              </span>
            </div>
          </div>

          <p class="text-dark mb-0" style="line-height: 1.6;">${escapeHtml(data.summary)}</p>

          ${data.criticalAlerts && data.criticalAlerts.length > 0 ? `
            <div class="alert alert-warning py-2 px-3 mt-3 mb-0 small border-warning">
              <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>
              <strong>Clinical Alerts:</strong> ${data.criticalAlerts.map(a => escapeHtml(a)).join(' | ')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Biomarker Comparison Table -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white border-bottom p-3">
          <h6 class="fw-bold mb-0 text-dark"><i class="bi bi-bar-chart-line text-teal me-2"></i>Longitudinal Biomarker Comparison Matrix</h6>
        </div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light small text-uppercase">
              <tr>
                <th>Biomarker</th>
                <th>Baseline (${data.firstReportDate})</th>
                <th>Latest (${data.latestReportDate})</th>
                <th>Trajectory Change</th>
                <th>Clinical Interpretation</th>
              </tr>
            </thead>
            <tbody class="small">
              ${data.trends.map((t) => {
                const isImprove = t.trendType === 'improving';
                const isWorse = t.trendType === 'worsening';
                const badgeClass = isImprove ? 'bg-success text-white' : isWorse ? 'bg-danger text-white' : 'bg-light text-secondary border';
                const icon = t.direction === 'up' ? 'bi-arrow-up' : t.direction === 'down' ? 'bi-arrow-down' : 'bi-dash';
                const sign = t.absoluteChange > 0 ? '+' : '';

                return `
                  <tr>
                    <td>
                      <strong class="text-dark d-block">${escapeHtml(t.name)}</strong>
                      <small class="text-muted">${t.readingsCount} historical tests</small>
                    </td>
                    <td>
                      <span class="badge bg-light text-dark border">${escapeHtml(t.baselineValue)} ${escapeHtml(t.unit)}</span>
                    </td>
                    <td>
                      <span class="badge bg-light text-dark border fw-bold">${escapeHtml(t.latestValue)} ${escapeHtml(t.unit)}</span>
                    </td>
                    <td>
                      <span class="badge ${badgeClass} px-2 py-1">
                        <i class="bi ${icon} me-1"></i>${sign}${t.percentChange}% (${sign}${t.absoluteChange} ${escapeHtml(t.unit)})
                      </span>
                    </td>
                    <td style="max-width: 320px;">
                      <span class="text-muted" style="font-size: 0.8rem;">${escapeHtml(t.clinicalInterpretation)}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger py-3">Failed to load biomarker trends: ${escapeHtml(err.message)}</div>`;
  }
};

// ==========================================
// 5. PATIENT DATA SHARING & AUDIT LOGS
// ==========================================
let patientSharingData = null;

window.loadSharingSettings = async function () {
  const doctorsContainer = document.getElementById('sharing-doctors-list');
  const auditContainer = document.getElementById('sharing-audit-logs-list');

  if (doctorsContainer) doctorsContainer.innerHTML = '<div class="text-center py-3 text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Loading...</div>';
  if (auditContainer) auditContainer.innerHTML = '<div class="text-center py-3 text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Loading...</div>';

  try {
    // 1. Fetch sharing settings
    const [settingsRes, auditRes] = await Promise.all([
      fetch('/api/sharing/settings', { headers: { 'Authorization': `Bearer ${getToken()}` } }),
      fetch('/api/sharing/audit-logs', { headers: { 'Authorization': `Bearer ${getToken()}` } })
    ]);

    const settingsData = await settingsRes.json();
    const auditData = await auditRes.json();

    if (settingsData.success) {
      patientSharingData = settingsData;
      renderDoctorPermissions(settingsData.connections || []);
    }

    if (auditData.success) {
      renderAuditLogs(auditData.logs || []);
    }
  } catch (err) {
    if (doctorsContainer) doctorsContainer.innerHTML = '<div class="alert alert-danger py-2 small">Error loading sharing settings.</div>';
    if (auditContainer) auditContainer.innerHTML = '<div class="alert alert-danger py-2 small">Error loading audit logs.</div>';
  }
};

function renderDoctorPermissions(connections) {
  const container = document.getElementById('sharing-doctors-list');
  if (!container) return;

  if (connections.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted small">
        <i class="bi bi-shield-x d-block fs-3 mb-2 text-secondary opacity-50"></i>
        No active doctor connections. Send an invitation from the top card to grant clinical access.
      </div>
    `;
    return;
  }

  container.innerHTML = connections.map((conn) => {
    const doc = conn.doctor || {};
    const isRevoked = conn.status === 'revoked';
    const isExpired = conn.expiresAt && new Date(conn.expiresAt) < new Date();
    const isActive = conn.status === 'accepted' && !isRevoked && !isExpired;

    let statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle">Active Full Access</span>';
    if (isRevoked) {
      statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Access Revoked</span>';
    } else if (isExpired) {
      statusBadge = '<span class="badge bg-warning-subtle text-warning border border-warning-subtle">Permission Expired</span>';
    } else if (conn.shareScope === 'selected') {
      statusBadge = `<span class="badge bg-info-subtle text-info border border-info-subtle">${(conn.allowedReportIds || []).length} Reports Allowed</span>`;
    }

    return `
      <div class="p-3 border rounded-3 mb-3 bg-light">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="fw-bold mb-1 text-dark">${escapeHtml(doc.name || 'Doctor')}</h6>
            <small class="text-muted d-block">${escapeHtml(doc.specialization || 'Consultant')} • ${escapeHtml(doc.hospital || 'Hospital')}</small>
            <div class="mt-2 d-flex flex-wrap gap-2 align-items-center">
              ${statusBadge}
              ${conn.expiresAt ? `<small class="text-muted"><i class="bi bi-hourglass-split me-1"></i>Expires: ${formatDate(conn.expiresAt)}</small>` : '<small class="text-muted"><i class="bi bi-infinity me-1"></i>Permanent</small>'}
            </div>
          </div>
          <button class="btn btn-outline-dark btn-sm" onclick="openDoctorSharingModal('${doc._id}', '${escapeHtml(doc.name)}')">
            <i class="bi bi-gear-fill me-1"></i>Configure
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderAuditLogs(logs) {
  const container = document.getElementById('sharing-audit-logs-list');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = '<div class="text-center py-4 text-muted small">No access history recorded yet. Every doctor view or download is logged here.</div>';
    return;
  }

  const actionIcons = {
    view_vault: 'bi-eye-fill text-primary',
    view_report: 'bi-file-earmark-medical-fill text-teal',
    download_report: 'bi-download text-success',
    consultation_summary_view: 'bi-file-pdf-fill text-danger',
    grant_permission: 'bi-shield-check text-info',
    revoke_access: 'bi-x-octagon-fill text-danger'
  };

  const actionLabels = {
    view_vault: 'Inspected Patient Health Vault',
    view_report: 'Viewed Document',
    download_report: 'Downloaded Document File',
    consultation_summary_view: 'Downloaded Consultation Summary Brief',
    grant_permission: 'Sharing Permissions Updated',
    revoke_access: 'Vault Access Revoked'
  };

  container.innerHTML = logs.map((l) => {
    const icon = actionIcons[l.action] || 'bi-activity text-secondary';
    const label = actionLabels[l.action] || l.action;
    const docName = l.doctor?.name ? `Dr. ${l.doctor.name.replace(/^Dr\.\s*/i, '')}` : 'Doctor';

    return `
      <div class="p-2 border-bottom small d-flex gap-2 align-items-start">
        <i class="bi ${icon} fs-5 mt-1"></i>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center">
            <strong class="text-dark">${label}</strong>
            <small class="text-muted" style="font-size: 0.725rem;">${formatRelativeTime(l.createdAt)}</small>
          </div>
          <p class="mb-0 text-muted" style="font-size: 0.75rem;">
            By <strong>${escapeHtml(docName)}</strong> ${l.reportTitle ? `• <em>${escapeHtml(l.reportTitle)}</em>` : ''}
          </p>
        </div>
      </div>
    `;
  }).join('');
}

window.openDoctorSharingModal = function (doctorId, doctorName) {
  const modalElem = document.getElementById('doctorSharingModal');
  if (!modalElem || !patientSharingData) return;

  document.getElementById('sharing-doctor-id').value = doctorId;
  document.getElementById('sharing-modal-doc-info').textContent = doctorName;

  const conn = (patientSharingData.connections || []).find(c => c.doctor?._id === doctorId);
  const reports = patientSharingData.allReports || [];

  const scope = conn ? conn.shareScope : 'all';
  if (scope === 'selected') {
    document.getElementById('scopeSelected').checked = true;
    toggleReportCheckboxes(true);
  } else {
    document.getElementById('scopeAll').checked = true;
    toggleReportCheckboxes(false);
  }

  // Populate checkboxes
  const allowedIds = new Set((conn?.allowedReportIds || []).map(r => (r._id || r).toString()));
  const container = document.getElementById('sharing-reports-checkboxes');
  container.innerHTML = reports.map((r) => `
    <div class="form-check mb-1">
      <input class="form-check-input report-share-checkbox" type="checkbox" value="${r._id}" id="chk-${r._id}" ${allowedIds.has(r._id.toString()) ? 'checked' : ''}>
      <label class="form-check-label small" for="chk-${r._id}">
        <strong>${escapeHtml(r.title)}</strong> <span class="badge bg-light text-muted border">${r.category}</span> (${formatDate(r.reportDate)})
      </label>
    </div>
  `).join('');

  const bsModal = bootstrap.Modal.getOrCreateInstance(modalElem);
  bsModal.show();
};

window.toggleReportCheckboxes = function (show) {
  const container = document.getElementById('granular-reports-container');
  if (show) container.classList.remove('d-none');
  else container.classList.add('d-none');
};

window.saveDoctorSharingPermissions = async function () {
  const doctorId = document.getElementById('sharing-doctor-id').value;
  const shareScope = document.querySelector('input[name="shareScope"]:checked').value;
  const durationHours = parseInt(document.getElementById('sharing-duration').value, 10);

  const selectedReportIds = [];
  if (shareScope === 'selected') {
    document.querySelectorAll('.report-share-checkbox:checked').forEach((cb) => {
      selectedReportIds.push(cb.value);
    });
    if (selectedReportIds.length === 0) {
      showToast('Please select at least 1 report, or choose Full Medical Vault.', 'warning');
      return;
    }
  }

  try {
    const res = await fetch(`/api/sharing/permissions/${doctorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        shareScope,
        allowedReportIds: selectedReportIds,
        durationHours
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Sharing permissions updated successfully!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('doctorSharingModal')).hide();
      loadSharingSettings();
    } else {
      showToast(data.message || 'Failed to update permissions.', 'danger');
    }
  } catch (err) {
    showToast('Network error updating permissions.', 'danger');
  }
};

window.triggerRevokeFromModal = async function () {
  const doctorId = document.getElementById('sharing-doctor-id').value;
  if (!confirm('Are you sure you want to completely revoke this doctor\'s access to your medical vault?')) return;

  try {
    const res = await fetch(`/api/sharing/revoke/${doctorId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ reason: 'Revoked by patient from privacy controls.' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Doctor access revoked successfully.', 'info');
      bootstrap.Modal.getInstance(document.getElementById('doctorSharingModal')).hide();
      loadSharingSettings();
      checkPatientDoctorStatus();
    } else {
      showToast(data.message, 'danger');
    }
  } catch (err) {
    showToast('Failed to revoke access.', 'danger');
  }
};

