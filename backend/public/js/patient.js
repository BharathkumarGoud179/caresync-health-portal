// Patient Dashboard Controller (Reports Vault, Task Checklist, Prescriptions)

let currentUser = null;
let allReports = [];
let allTasks = [];
let currentTaskFilter = 'all';

const ALLOWED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];
const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

// Guard against a submit before the async auth check has finished.
const uploadFormElement = document.getElementById('upload-report-form');
if (uploadFormElement) {
  uploadFormElement.addEventListener('submit', (event) => {
    if (uploadFormElement.dataset.ready !== 'true') {
      event.preventDefault();
      showToast('Please wait for your dashboard to finish loading.', 'info');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth('patient');
  if (!currentUser) return;

  renderPatientHeader();
  loadDoctorAssignment();
  initializeReportDate();
  loadReports();
  loadTasks();
  loadPrescriptions();
  setupEventListeners();
});

// Render user profile header
function renderPatientHeader() {
  document.getElementById('patient-name-display').textContent = currentUser.name;
  document.getElementById('patient-blood-group').textContent =
    currentUser.bloodGroup || 'Not specified';
  document.getElementById('patient-age-gender').textContent =
    `${currentUser.age ? currentUser.age + ' yrs' : ''} ${
      currentUser.gender ? '• ' + currentUser.gender : ''
    }`.trim() || 'Details pending';
  document.getElementById('patient-allergies').textContent =
    currentUser.allergies || 'None reported';
}

// Check doctor assigned
async function loadDoctorAssignment() {
  const doctorBox = document.getElementById('assigned-doctor-info');
  const doctor = currentUser.assignedDoctor;

  if (doctor && typeof doctor === 'object' && doctor.name) {
    doctorBox.innerHTML = `
      <div class="d-flex align-items-center justify-content-between">
        <div>
          <h6 class="mb-0 fw-bold text-teal"><i class="bi bi-hospital me-2"></i>${escapeHtml(doctor.name)}</h6>
          <small class="text-muted">${escapeHtml(doctor.specialization || 'Consultant')} • ${escapeHtml(doctor.hospital || 'Care Clinic')}</small>
        </div>
        <button class="btn btn-sm btn-outline-secondary" onclick="openDoctorSelectModal()">Change</button>
      </div>
    `;
  } else {
    doctorBox.innerHTML = `
      <div class="d-flex align-items-center justify-content-between">
        <div>
          <span class="text-muted"><i class="bi bi-info-circle me-1"></i>No primary doctor linked yet.</span>
        </div>
        <button class="btn btn-sm btn-teal" onclick="openDoctorSelectModal()">Connect with Doctor</button>
      </div>
    `;
  }
}

// Open modal to select doctor
window.openDoctorSelectModal = async function () {
  const modalElem = bootstrap.Modal.getOrCreateInstance(
    document.getElementById('selectDoctorModal')
  );
  const listContainer = document.getElementById('doctors-list-container');
  listContainer.innerHTML =
    '<div class="text-center py-4"><span class="spinner-border text-teal"></span></div>';
  modalElem.show();

  try {
    const res = await apiFetch('/doctors/all');
    const data = await readJson(res);

    if (data.success && Array.isArray(data.doctors) && data.doctors.length > 0) {
      listContainer.innerHTML = data.doctors
        .map(
          (doc) => `
        <div class="card p-3 mb-2 border">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-1">${escapeHtml(doc.name)}</h6>
              <p class="small text-muted mb-0">${escapeHtml(doc.specialization || 'Consultant')} • ${escapeHtml(doc.hospital || 'Hospital')}</p>
            </div>
            <button class="btn btn-sm btn-primary" onclick="assignDoctor('${doc._id}')">Select</button>
          </div>
        </div>
      `
        )
        .join('');
    } else {
      listContainer.innerHTML =
        '<p class="text-muted text-center py-3">No doctors registered yet.</p>';
    }
  } catch (error) {
    listContainer.innerHTML =
      '<p class="text-danger text-center">Failed to load doctor list.</p>';
  }
};

window.assignDoctor = async function (doctorId) {
  try {
    const res = await apiFetch('/doctors/select-doctor', {
      method: 'POST',
      body: JSON.stringify({ doctorId })
    });
    const data = await readJson(res);

    if (data.success) {
      showToast(data.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('selectDoctorModal')).hide();
      currentUser.assignedDoctor = data.doctor;
      setCurrentUser(currentUser);
      loadDoctorAssignment();
    } else {
      showToast(data.message || 'Failed to select doctor.', 'danger');
    }
  } catch (error) {
    showToast(error.message || 'Failed to select doctor.', 'danger');
  }
};

// ==========================================
// 1. MEDICAL REPORTS VAULT
// ==========================================
async function loadReports() {
  const container = document.getElementById('reports-timeline-container');
  const countBadge = document.getElementById('reports-count-badge');
  container.innerHTML =
    '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="text-muted mt-2">Loading your medical records...</p></div>';

  try {
    const res = await apiFetch('/reports/my-reports');
    const data = await readJson(res);

    if (data.success) {
      allReports = Array.isArray(data.reports) ? data.reports : [];
      if (countBadge) countBadge.textContent = `${allReports.length} records`;
      renderReportsList(allReports);
    } else {
      container.innerHTML = `<div class="alert alert-danger">${escapeHtml(
        data.message || 'Error loading reports.'
      )}</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger">${escapeHtml(
      error.message || 'Error loading reports.'
    )}</div>`;
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
    Prescription: 'badge-prescription',
    'Discharge Summary': 'badge-discharge',
    Pathology: 'badge-pathology'
  };

  container.innerHTML = reports
    .map((report) => {
      const badgeClass = categoryBadges[report.category] || 'bg-light text-dark';
      const filePath = report.filePath || '#';
      const isPdf = /\.pdf$/i.test(filePath);
      const icon = isPdf
        ? 'bi-file-earmark-pdf text-danger'
        : 'bi-file-earmark-image text-primary';

      return `
      <div class="report-card mb-3">
        <div class="d-flex justify-content-between align-items-start">
          <div class="d-flex gap-3">
            <div class="fs-2"><i class="bi ${icon}"></i></div>
            <div>
              <div class="d-flex align-items-center gap-2">
                <h6 class="mb-0 fw-bold">${escapeHtml(report.title)}</h6>
                <span class="report-badge ${badgeClass}">${escapeHtml(report.category)}</span>
              </div>
              <p class="text-muted small mb-1 mt-1">
                <i class="bi bi-calendar3 me-1"></i><strong>Test Date:</strong> ${formatDate(report.reportDate)}
                <span class="mx-2">•</span>
                <i class="bi bi-building me-1"></i>${escapeHtml(report.labOrHospital || 'Clinic')}
              </p>
              ${
                report.notes
                  ? `<p class="small text-secondary mb-1 bg-light p-2 rounded"><em>Notes:</em> ${escapeHtml(report.notes)}</p>`
                  : ''
              }
              <small class="text-muted">Uploaded on ${formatDate(report.createdAt)} (${formatFileSize(report.fileSize)})</small>
            </div>
          </div>
          <div class="d-flex gap-2">
            <a href="${escapeHtml(filePath)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary" title="View Document">
              <i class="bi bi-box-arrow-up-right me-1"></i>View
            </a>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteReport('${report._id}')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

// Delete report
window.deleteReport = async function (id) {
  if (!confirm('Are you sure you want to delete this medical report?')) return;

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

// Filter reports
window.filterReports = function (category) {
  document.querySelectorAll('.report-filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === category);
  });
  if (category === 'All') {
    renderReportsList(allReports);
  } else {
    renderReportsList(allReports.filter((report) => report.category === category));
  }
};

// ==========================================
// 2. ACTIONABLE CARE TASKS & PRECAUTIONS CHECKLIST
// ==========================================
async function loadTasks() {
  const container = document.getElementById('tasks-list-container');
  container.innerHTML =
    '<div class="text-center py-4"><span class="spinner-border spinner-border-sm text-teal"></span> Loading care plan...</div>';

  try {
    const res = await apiFetch('/tasks/my-tasks');
    const data = await readJson(res);

    if (data.success) {
      allTasks = Array.isArray(data.tasks) ? data.tasks : [];
      updateComplianceStats(data.stats);
      renderTasksList();
    } else {
      container.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(
        data.message || 'Failed to load care plan tasks.'
      )}</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(
      error.message || 'Failed to load care plan tasks.'
    )}</div>`;
  }
}

function updateComplianceStats(stats) {
  if (!stats) return;

  const rate = Number(stats.adherenceRate) || 0;
  const rateElem = document.getElementById('adherence-rate-text');
  const barElem = document.getElementById('adherence-progress-bar');
  const countDoneElem = document.getElementById('tasks-done-count');
  const countTotalElem = document.getElementById('tasks-total-count');

  if (rateElem) rateElem.textContent = `${rate}%`;
  if (barElem) {
    barElem.style.width = `${rate}%`;
    barElem.className = `progress-bar ${
      rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-danger'
    }`;
  }
  if (countDoneElem) countDoneElem.textContent = stats.done || 0;
  if (countTotalElem) countTotalElem.textContent = stats.total || 0;
}

function renderTasksList() {
  const container = document.getElementById('tasks-list-container');
  let tasksToDisplay = allTasks;

  if (currentTaskFilter === 'todo') {
    tasksToDisplay = allTasks.filter((task) => task.status === 'todo');
  } else if (currentTaskFilter === 'done') {
    tasksToDisplay = allTasks.filter((task) => task.status === 'done');
  }

  if (tasksToDisplay.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted bg-white rounded border">
        <i class="bi bi-check2-circle fs-3 text-success"></i>
        <p class="mb-0 mt-2">${
          currentTaskFilter === 'todo'
            ? 'No pending tasks! Great job maintaining your care routine.'
            : 'No tasks in this category.'
        }</p>
      </div>
    `;
    return;
  }

  const typeIcons = {
    Medication: 'bi-capsule text-primary',
    Precaution: 'bi-shield-check text-warning',
    'Vital Check': 'bi-activity text-danger',
    'Lifestyle & Diet': 'bi-heart-pulse text-success'
  };

  container.innerHTML = tasksToDisplay
    .map((task) => {
      const isDone = task.status === 'done';
      const isSkipped = task.status === 'skipped';
      const statusBadge = isDone
        ? '<span class="badge bg-success small">Done</span>'
        : isSkipped
          ? '<span class="badge bg-warning text-dark small">Skipped</span>'
          : '<span class="badge bg-secondary small">To Do</span>';

      return `
      <div class="task-item ${isDone ? 'done' : ''}" id="task-${task._id}">
        <div class="d-flex align-items-start gap-3">
          <button class="btn btn-outline-${isDone ? 'success' : 'secondary'} task-checkbox-btn" onclick="toggleTask('${task._id}', '${isDone ? 'todo' : 'done'}')" aria-label="${isDone ? 'Mark as to do' : 'Mark as done'}">
            <i class="bi ${isDone ? 'bi-check-lg fw-bold' : 'bi-circle'}"></i>
          </button>
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="fw-bold task-title">${escapeHtml(task.title)}</span>
              ${statusBadge}
              <span class="badge bg-light text-dark border small"><i class="bi ${typeIcons[task.taskType] || 'bi-bookmark'} me-1"></i>${escapeHtml(task.taskType)}</span>
            </div>
            ${task.description ? `<p class="small text-muted mb-1 mt-1">${escapeHtml(task.description)}</p>` : ''}
            <div class="d-flex gap-3 small text-muted mt-1 flex-wrap">
              <span><i class="bi bi-clock me-1"></i>${escapeHtml(task.timing || 'Anytime')}</span>
              ${task.doctor ? `<span><i class="bi bi-person-check me-1"></i>Prescribed by ${escapeHtml(task.doctor.name)}</span>` : ''}
              ${isDone && task.completedAt ? `<span class="text-success"><i class="bi bi-check-all me-1"></i>Completed ${formatRelativeTime(task.completedAt)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="d-flex flex-column align-items-end">
          <button class="btn btn-sm ${isDone ? 'btn-outline-secondary' : 'btn-success'}" onclick="toggleTask('${task._id}', '${isDone ? 'todo' : 'done'}')">
            ${isDone ? '<i class="bi bi-arrow-counterclockwise me-1"></i>Mark To Do' : '<i class="bi bi-check2 me-1"></i>Mark Done'}
          </button>
        </div>
      </div>
    `;
    })
    .join('');
}

// Toggle Task Status (Done / To Do)
window.toggleTask = async function (id, newStatus) {
  try {
    const res = await apiFetch(`/tasks/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    const data = await readJson(res);

    if (data.success) {
      showToast(data.message, newStatus === 'done' ? 'success' : 'info');

      const target = allTasks.find((task) => task._id === id);
      if (target) {
        target.status = newStatus;
        target.completedAt = newStatus === 'done' ? new Date() : null;
      }

      const totalCount = allTasks.length;
      const doneCount = allTasks.filter((task) => task.status === 'done').length;
      const todoCount = allTasks.filter((task) => task.status === 'todo').length;
      const adherenceRate =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      updateComplianceStats({
        total: totalCount,
        done: doneCount,
        todo: todoCount,
        adherenceRate
      });
      renderTasksList();
    } else {
      showToast(data.message || 'Failed to update task status.', 'danger');
    }
  } catch (error) {
    showToast(error.message || 'Failed to update task status.', 'danger');
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
    const res = await apiFetch('/prescriptions/my-prescriptions');
    const data = await readJson(res);

    if (data.success && Array.isArray(data.prescriptions) && data.prescriptions.length > 0) {
      container.innerHTML = data.prescriptions
        .map((prescription) => {
          const medications = Array.isArray(prescription.medications)
            ? prescription.medications
            : [];
          const precautions = Array.isArray(prescription.precautions)
            ? prescription.precautions
            : [];

          return `
        <div class="card p-3 mb-3 border shadow-sm">
          <div class="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2">
            <div>
              <h6 class="fw-bold text-teal mb-0"><i class="bi bi-file-earmark-medical me-2"></i>Diagnosis: ${escapeHtml(prescription.diagnosis)}</h6>
              <small class="text-muted">Prescribed by <strong>${escapeHtml(prescription.doctor ? prescription.doctor.name : 'Doctor')}</strong> (${escapeHtml(prescription.doctor ? prescription.doctor.specialization : '')}) on ${formatDate(prescription.createdAt)}</small>
            </div>
            <span class="badge bg-success">${escapeHtml(prescription.status)}</span>
          </div>

          ${
            prescription.clinicalNotes
              ? `<p class="small text-secondary mb-3"><strong>Doctor Notes:</strong> ${escapeHtml(prescription.clinicalNotes)}</p>`
              : ''
          }

          <h6 class="small fw-bold text-dark text-uppercase mb-2"><i class="bi bi-capsule me-1"></i>Prescribed Medicines:</h6>
          ${
            medications.length > 0
              ? `
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
                ${medications
                  .map((med) => {
                    const timeOfDay = med.timeOfDay || {};
                    return `
                  <tr>
                    <td class="fw-bold">${escapeHtml(med.medicineName)}</td>
                    <td>${escapeHtml(med.dosage)}</td>
                    <td>${escapeHtml(med.frequency)}</td>
                    <td>
                      ${timeOfDay.morning ? '<span class="timing-tag bg-warning-subtle">Morning</span>' : ''}
                      ${timeOfDay.afternoon ? '<span class="timing-tag bg-info-subtle">Afternoon</span>' : ''}
                      ${timeOfDay.night ? '<span class="timing-tag bg-dark-subtle">Night</span>' : ''}
                    </td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(med.instruction)}</span></td>
                  </tr>
                `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>`
              : '<p class="text-muted small mb-3">No medicines prescribed in this consultation.</p>'
          }

          ${
            precautions.length > 0
              ? `
            <h6 class="small fw-bold text-danger text-uppercase mb-2"><i class="bi bi-shield-exclamation me-1"></i>Precautions & Lifestyle Rules:</h6>
            <ul class="list-group list-group-flush small">
              ${precautions
                .map(
                  (precaution) => `
                <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                  <div>
                    <strong class="text-dark">${escapeHtml(precaution.title)}</strong>
                    <p class="text-muted mb-0">${escapeHtml(precaution.description || '')}</p>
                  </div>
                  <span class="badge bg-warning text-dark">${escapeHtml(precaution.category)}</span>
                </li>
              `
                )
                .join('')}
            </ul>
          `
              : ''
          }
        </div>
      `;
        })
        .join('');
    } else {
      container.innerHTML =
        '<p class="text-muted text-center py-3">No prescriptions recorded yet. Your doctor will issue prescriptions and precautions after evaluating your reports.</p>';
    }
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(
      error.message || 'Error loading prescriptions.'
    )}</div>`;
  }
}

// ==========================================
// 4. UPLOAD FORM & FILE HELPERS
// ==========================================
function initializeReportDate() {
  const dateInput = document.getElementById('report-date');
  if (!dateInput) return;

  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  dateInput.max = localToday;
  if (!dateInput.value) dateInput.value = localToday;
}

function isAllowedUpload(file) {
  const extension = `.${file.name.split('.').pop().toLowerCase()}`;
  return (
    ALLOWED_UPLOAD_TYPES.includes(file.type) &&
    ALLOWED_UPLOAD_EXTENSIONS.includes(extension)
  );
}

function showUploadError(message) {
  const errorBox = document.getElementById('upload-report-error');
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('d-none');
}

function clearUploadError() {
  const errorBox = document.getElementById('upload-report-error');
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.classList.add('d-none');
}

function resetUploadForm() {
  const form = document.getElementById('upload-report-form');
  if (!form) return;

  form.reset();
  clearFormErrors(form);
  clearUploadError();

  const fileInput = document.getElementById('report-file');
  if (fileInput) fileInput.value = '';

  const fileNameDisplay = document.getElementById('selected-file-name');
  if (fileNameDisplay) fileNameDisplay.innerHTML = '';

  initializeReportDate();
}

function validateUploadForm() {
  const form = document.getElementById('upload-report-form');
  const titleInput = document.getElementById('report-title');
  const dateInput = document.getElementById('report-date');
  const fileInput = document.getElementById('report-file');

  clearFormErrors(form);
  clearUploadError();

  let valid = true;
  const fail = (input, message) => {
    setFieldError(input, message);
    valid = false;
  };

  const title = titleInput.value.trim();
  if (title.length < 2 || title.length > 120) {
    fail(titleInput, 'Report title must be between 2 and 120 characters.');
  }

  const dateValue = dateInput.value;
  if (!dateValue) {
    fail(dateInput, 'Please select the report date.');
  } else {
    const selected = new Date(`${dateValue}T00:00:00`);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (Number.isNaN(selected.getTime())) {
      fail(dateInput, 'Please select a valid report date.');
    } else if (selected > endOfToday) {
      fail(dateInput, 'Report date cannot be in the future.');
    }
  }

  if (!fileInput.files || fileInput.files.length === 0) {
    showUploadError('Please choose a PDF or image file to upload.');
    valid = false;
  } else {
    const file = fileInput.files[0];
    if (!isAllowedUpload(file)) {
      showUploadError('Only PDF, JPG, PNG, and WEBP files are allowed.');
      valid = false;
    } else if (file.size > MAX_UPLOAD_SIZE) {
      showUploadError('File is too large. The maximum allowed size is 15 MB.');
      valid = false;
    }
  }

  return valid;
}

function updateFileName() {
  const fileInput = document.getElementById('report-file');
  const fileNameDisplay = document.getElementById('selected-file-name');
  if (!fileInput || !fileNameDisplay) return;

  if (fileInput.files.length === 0) {
    fileNameDisplay.innerHTML = '';
    return;
  }

  const file = fileInput.files[0];
  const isValid = isAllowedUpload(file) && file.size <= MAX_UPLOAD_SIZE;
  const badgeClass = isValid ? 'bg-teal' : 'bg-danger';

  fileNameDisplay.innerHTML = `<span class="badge ${badgeClass} p-2"><i class="bi ${isValid ? 'bi-file-earmark-check' : 'bi-exclamation-triangle'} me-1"></i>${escapeHtml(file.name)} (${formatFileSize(file.size)})</span>`;

  if (!isValid) {
    showUploadError(
      isAllowedUpload(file)
        ? 'File is too large. The maximum allowed size is 15 MB.'
        : 'Only PDF, JPG, PNG, and WEBP files are allowed.'
    );
  } else {
    clearUploadError();
  }
}

function setupEventListeners() {
  // Drag and drop file upload
  const dropZone = document.getElementById('report-drop-zone');
  const fileInput = document.getElementById('report-file');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
      }
    });
    dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropZone.classList.remove('dragover');
      if (event.dataTransfer.files.length > 0) {
        fileInput.files = event.dataTransfer.files;
        updateFileName();
      }
    });

    fileInput.addEventListener('change', updateFileName);
  }

  const uploadForm = document.getElementById('upload-report-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!validateUploadForm()) {
        showToast('Please fix the highlighted fields.', 'warning');
        return;
      }

      const submitBtn = uploadForm.querySelector('button[type="submit"]');
      const restoreButton = setButtonLoading(submitBtn, 'Uploading...');

      try {
        const res = await apiFetch('/reports/upload', {
          method: 'POST',
          body: new FormData(uploadForm)
        });
        const data = await readJson(res);

        if (data.success) {
          showToast('Medical report uploaded successfully!', 'success');
          bootstrap.Modal.getInstance(document.getElementById('uploadReportModal')).hide();
          resetUploadForm();
          loadReports();
        } else {
          showToast(data.message || 'Upload failed.', 'danger');
          if (Array.isArray(data.errors)) {
            data.errors.forEach(({ field, message }) => {
              const map = {
                title: 'report-title',
                reportDate: 'report-date',
                category: 'report-category',
                labOrHospital: 'report-lab',
                notes: 'report-notes'
              };
              const input = document.getElementById(map[field]);
              if (input) setFieldError(input, message);
            });
          }
        }
      } catch (error) {
        showToast(error.message || 'Failed to upload file.', 'danger');
      } finally {
        restoreButton();
      }
    });

    uploadForm.dataset.ready = 'true';
  }

  const uploadModal = document.getElementById('uploadReportModal');
  if (uploadModal) {
    uploadModal.addEventListener('hidden.bs.modal', resetUploadForm);
  }
}
