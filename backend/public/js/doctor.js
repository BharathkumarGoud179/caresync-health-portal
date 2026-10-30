// Doctor Dashboard Controller (Patient Roster, Report Inspector, Care Plan Builder, Compliance Tracker)

let currentDoctor = null;
let allPatients = [];
let selectedPatientId = null;
let medicationCount = 0;
let precautionCount = 0;

const localDateString = (date = new Date()) => {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
};

// Guard against a submit before the async auth check has finished. Without
// this, a fast click would perform the browser's native GET submission.
const carePlanForm = document.getElementById('care-plan-form');
if (carePlanForm) {
  carePlanForm.addEventListener('submit', (event) => {
    if (carePlanForm.dataset.ready !== 'true') {
      event.preventDefault();
      showToast('Please wait for the workspace to finish loading.', 'info');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  currentDoctor = await checkAuth('doctor');
  if (!currentDoctor) return;

  renderDoctorHeader();
  initializeFollowUpDate();
  loadPatientsList();
  setupPrescriptionForm();
});

function renderDoctorHeader() {
  document.getElementById('doctor-name-display').textContent = currentDoctor.name;
  document.getElementById('doctor-specialization-display').textContent =
    currentDoctor.specialization || 'Consultant Physician';
  document.getElementById('doctor-hospital-display').textContent =
    currentDoctor.hospital || 'Care Clinic';
}

// ==========================================
// 1. PATIENTS ROSTER
// ==========================================
async function loadPatientsList() {
  const container = document.getElementById('patients-list-container');
  container.innerHTML =
    '<div class="text-center py-4"><span class="spinner-border spinner-border-sm text-teal"></span> Loading patients...</div>';

  try {
    const res = await apiFetch('/doctors/patients');
    const data = await readJson(res);

    if (data.success) {
      allPatients = Array.isArray(data.patients) ? data.patients : [];
      document.getElementById('total-patients-badge').textContent = `${allPatients.length} Patients`;
      renderPatientsRoster(allPatients);

      // Auto select first patient if available
      if (allPatients.length > 0 && !selectedPatientId) {
        selectPatient(allPatients[0].id);
      }
    } else {
      container.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(
        data.message || 'Failed to load patients.'
      )}</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(
      error.message || 'Failed to load patients.'
    )}</div>`;
  }
}

function renderPatientsRoster(patients) {
  const container = document.getElementById('patients-list-container');
  if (!patients || patients.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center py-4">No patients registered in the system yet.</p>';
    return;
  }

  container.innerHTML = patients
    .map((patient) => {
      const isSelected = patient.id === selectedPatientId;
      const adherenceBadgeClass =
        patient.adherenceRate >= 80
          ? 'bg-success'
          : patient.adherenceRate >= 50
            ? 'bg-warning'
            : 'bg-secondary';

      return `
      <div class="patient-select-item ${isSelected ? 'active' : ''} mb-2" onclick="selectPatient('${patient.id}')">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h6 class="mb-0 fw-bold">${escapeHtml(patient.name)}</h6>
            <small class="text-muted">${escapeHtml(patient.gender || 'Patient')} ${patient.age ? '• ' + patient.age + 'y' : ''} ${patient.bloodGroup ? '• ' + escapeHtml(patient.bloodGroup) : ''}</small>
          </div>
          <div class="text-end">
            <span class="badge bg-primary-subtle text-primary border">${patient.reportCount} Reports</span>
            <div class="mt-1">
              <span class="badge ${adherenceBadgeClass} small" title="Care Plan Adherence">${patient.adherenceRate}% Adherence</span>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

// Select a patient and load their 360 Workspace
window.selectPatient = async function (patientId) {
  const target = allPatients.find((patient) => patient.id === patientId);
  if (!target) return;

  selectedPatientId = patientId;
  renderPatientsRoster(allPatients); // update active class

  // Populate patient info card
  document.getElementById('workspace-patient-name').textContent = target.name;
  document.getElementById('workspace-patient-email').textContent = target.email;
  document.getElementById('workspace-patient-phone').textContent = target.phone || 'Not provided';
  document.getElementById('workspace-patient-age').textContent = target.age
    ? `${target.age} years`
    : 'N/A';
  document.getElementById('workspace-patient-gender').textContent = target.gender || 'N/A';
  document.getElementById('workspace-patient-blood').textContent = target.bloodGroup || 'N/A';
  document.getElementById('workspace-patient-allergies').textContent =
    target.allergies || 'None reported';

  // Set patient ID in hidden input of prescription form
  document.getElementById('presc-patient-id').value = patientId;

  // Load Patient's Reports
  loadPatientReports(patientId);

  // Load Patient's Compliance & Tasks
  loadPatientTasksAndCompliance(patientId);

  // Load Prescriptions history
  loadPatientPrescriptions(patientId);
};

// ==========================================
// 2. PATIENT REPORTS INSPECTION
// ==========================================
async function loadPatientReports(patientId) {
  const container = document.getElementById('patient-reports-container');
  container.innerHTML =
    '<div class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary"></span> Loading reports...</div>';

  try {
    const res = await apiFetch(`/reports/patient/${patientId}`);
    const data = await readJson(res);

    if (data.success) {
      if (!Array.isArray(data.reports) || data.reports.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4 text-muted bg-light rounded">
            <i class="bi bi-folder2-open fs-3"></i>
            <p class="mb-0 mt-2">No medical reports uploaded by this patient yet.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.reports
        .map((report) => {
          const filePath = report.filePath || '#';
          const isPdf = /\.pdf$/i.test(filePath);
          const icon = isPdf
            ? 'bi-file-earmark-pdf text-danger'
            : 'bi-file-earmark-image text-primary';

          return `
          <div class="card p-3 mb-2 border shadow-sm">
            <div class="d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center gap-3">
                <i class="bi ${icon} fs-2"></i>
                <div>
                  <h6 class="mb-0 fw-bold">${escapeHtml(report.title)}</h6>
                  <small class="text-muted">
                    <span class="badge bg-light text-dark border">${escapeHtml(report.category)}</span>
                    <span class="ms-2">Test Date: <strong>${formatDate(report.reportDate)}</strong></span>
                    <span class="ms-2">• Lab: ${escapeHtml(report.labOrHospital || 'Clinic')}</span>
                  </small>
                  ${report.notes ? `<p class="small text-secondary mb-0 mt-1"><em>Patient notes:</em> ${escapeHtml(report.notes)}</p>` : ''}
                </div>
              </div>
              <a href="${escapeHtml(filePath)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">
                <i class="bi bi-box-arrow-up-right me-1"></i>Inspect Document
              </a>
            </div>
          </div>
        `;
        })
        .join('');
    } else {
      container.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(
        data.message || 'Error loading patient reports.'
      )}</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(
      error.message || 'Error loading patient reports.'
    )}</div>`;
  }
}

// ==========================================
// 3. PATIENT COMPLIANCE & TASK ADHERENCE
// ==========================================
async function loadPatientTasksAndCompliance(patientId) {
  const container = document.getElementById('patient-compliance-container');
  container.innerHTML =
    '<div class="text-center py-3"><span class="spinner-border spinner-border-sm text-teal"></span> Calculating compliance metrics...</div>';

  try {
    const res = await apiFetch(`/tasks/patient/${patientId}`);
    const data = await readJson(res);

    if (data.success) {
      const stats = data.stats || { total: 0, done: 0, todo: 0, adherenceRate: 0 };
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];

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

      let tasksHtml = '';
      if (tasks.length === 0) {
        tasksHtml =
          '<p class="text-muted small mb-0">No active care tasks or precautions assigned yet.</p>';
      } else {
        tasksHtml = tasks
          .map((task) => {
            const isDone = task.status === 'done';
            const isSkipped = task.status === 'skipped';
            return `
            <div class="d-flex justify-content-between align-items-center py-1 border-bottom small">
              <div>
                <span class="${isDone ? 'text-decoration-line-through text-success' : 'fw-bold'}">${escapeHtml(task.title)}</span>
                <span class="badge bg-light text-dark border ms-1">${escapeHtml(task.taskType)}</span>
                <span class="text-muted ms-1">(${escapeHtml(task.timing)})</span>
              </div>
              <div>
                ${
                  isDone
                    ? `<span class="badge bg-success"><i class="bi bi-check me-1"></i>Done (${formatRelativeTime(task.completedAt)})</span>`
                    : isSkipped
                      ? '<span class="badge bg-warning text-dark">Skipped</span>'
                      : '<span class="badge bg-secondary">To Do Yet</span>'
                }
              </div>
            </div>
          `;
          })
          .join('');
      }

      container.innerHTML = `
        <div class="card p-3 mb-3 border bg-white">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="fw-bold mb-0 text-teal"><i class="bi bi-activity me-1"></i>Care Plan Adherence Tracker</h6>
            <h4 class="mb-0 fw-bold ${rateClass}">${stats.adherenceRate}%</h4>
          </div>
          <div class="progress mb-2" style="height: 10px;">
            <div class="progress-bar ${barClass}" style="width: ${stats.adherenceRate}%"></div>
          </div>
          <div class="d-flex justify-content-between small text-muted mb-3">
            <span><strong>${stats.done}</strong> of <strong>${stats.total}</strong> instructions completed</span>
            <span>${stats.todo} tasks pending</span>
          </div>
          <h6 class="small fw-bold text-uppercase text-secondary mb-2">Actionable Tasks & Precautions:</h6>
          <div style="max-height: 220px; overflow-y: auto;">
            ${tasksHtml}
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(
        data.message || 'Error checking compliance.'
      )}</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(
      error.message || 'Error checking compliance.'
    )}</div>`;
  }
}

// Load previous prescriptions
async function loadPatientPrescriptions(patientId) {
  const container = document.getElementById('patient-prescriptions-history');

  try {
    const res = await apiFetch(`/prescriptions/patient/${patientId}`);
    const data = await readJson(res);

    if (data.success && Array.isArray(data.prescriptions) && data.prescriptions.length > 0) {
      container.innerHTML = data.prescriptions
        .map((prescription) => {
          const medicationCountForPrescription = Array.isArray(prescription.medications)
            ? prescription.medications.length
            : 0;
          const precautionCountForPrescription = Array.isArray(prescription.precautions)
            ? prescription.precautions.length
            : 0;

          return `
        <div class="card p-2 mb-2 border-0 bg-light">
          <div class="d-flex justify-content-between">
            <strong class="text-dark small">${escapeHtml(prescription.diagnosis)}</strong>
            <small class="text-muted">${formatDate(prescription.createdAt)}</small>
          </div>
          <small class="text-muted">${medicationCountForPrescription} medicines • ${precautionCountForPrescription} precautions</small>
        </div>
      `;
        })
        .join('');
    } else {
      container.innerHTML = '<p class="text-muted small">No past prescriptions on record.</p>';
    }
  } catch (error) {
    container.innerHTML = `<p class="text-danger small">${escapeHtml(
      error.message || 'Failed to load history.'
    )}</p>`;
  }
}

// ==========================================
// 4. PRESCRIPTION & PRECAUTIONS BUILDER
// ==========================================
function initializeFollowUpDate() {
  const input = document.getElementById('presc-followup');
  if (input) input.min = localDateString();
}

function showCarePlanError(message) {
  const errorBox = document.getElementById('care-plan-error');
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('d-none');
}

function clearCarePlanError() {
  const errorBox = document.getElementById('care-plan-error');
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.classList.add('d-none');
}

function collectMedications() {
  const medications = [];
  document.querySelectorAll('.medication-row').forEach((row) => {
    const name = row.querySelector('.med-name').value.trim();
    if (!name) return;

    medications.push({
      medicineName: name,
      dosage: row.querySelector('.med-dosage').value.trim() || '1 Tablet',
      frequency: row.querySelector('.med-frequency').value,
      instruction: row.querySelector('.med-instruction').value,
      timeOfDay: {
        morning: row.querySelector('.med-time-morning').checked,
        afternoon: row.querySelector('.med-time-afternoon').checked,
        night: row.querySelector('.med-time-night').checked
      }
    });
  });
  return medications;
}

function collectPrecautions() {
  const precautions = [];
  document.querySelectorAll('.precaution-row').forEach((row) => {
    const title = row.querySelector('.prec-title').value.trim();
    if (!title) return;

    precautions.push({
      title,
      category: row.querySelector('.prec-category').value,
      description: row.querySelector('.prec-desc').value.trim()
    });
  });
  return precautions;
}

function validateCarePlanForm() {
  const form = document.getElementById('care-plan-form');
  const diagnosisInput = document.getElementById('presc-diagnosis');
  const followUpInput = document.getElementById('presc-followup');

  clearFormErrors(form);
  clearCarePlanError();

  let valid = true;
  const fail = (input, message) => {
    setFieldError(input, message);
    valid = false;
  };

  const diagnosis = diagnosisInput.value.trim();
  if (diagnosis.length < 2 || diagnosis.length > 200) {
    fail(diagnosisInput, 'Diagnosis must be between 2 and 200 characters.');
  }

  if (followUpInput.value) {
    const selected = new Date(`${followUpInput.value}T00:00:00`);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (Number.isNaN(selected.getTime())) {
      fail(followUpInput, 'Please select a valid follow-up date.');
    } else if (selected < startOfToday) {
      fail(followUpInput, 'Follow-up date cannot be in the past.');
    }
  }

  const medications = collectMedications();
  const precautions = collectPrecautions();
  if (medications.length === 0 && precautions.length === 0) {
    showCarePlanError('Add at least one medication or precaution to the care plan.');
    valid = false;
  }

  return valid;
}

function setupPrescriptionForm() {
  const addMedBtn = document.getElementById('add-medicine-row-btn');
  const addPrecBtn = document.getElementById('add-precaution-row-btn');
  const form = document.getElementById('care-plan-form');

  if (addMedBtn) {
    addMedBtn.addEventListener('click', addMedicineRow);
    addMedicineRow();
  }

  if (addPrecBtn) {
    addPrecBtn.addEventListener('click', addPrecautionRow);
    addPrecautionRow();
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const patientId = document.getElementById('presc-patient-id').value;
      if (!patientId) {
        showToast('Please select a patient from the left panel.', 'warning');
        return;
      }

      if (!validateCarePlanForm()) {
        showToast('Please fix the highlighted fields.', 'warning');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const restoreButton = setButtonLoading(submitBtn, 'Issuing Care Plan...');

      try {
        const res = await apiFetch('/prescriptions', {
          method: 'POST',
          body: JSON.stringify({
            patientId,
            diagnosis: document.getElementById('presc-diagnosis').value.trim(),
            clinicalNotes: document.getElementById('presc-notes').value.trim(),
            followUpDate: document.getElementById('presc-followup').value,
            medications: collectMedications(),
            precautions: collectPrecautions()
          })
        });

        const data = await readJson(res);

        if (data.success) {
          showToast(
            `Prescription issued! Created ${data.tasksGeneratedCount} interactive tasks for patient.`,
            'success'
          );

          form.reset();
          document.getElementById('medications-container').innerHTML = '';
          document.getElementById('precautions-container').innerHTML = '';
          clearCarePlanError();
          addMedicineRow();
          addPrecautionRow();
          initializeFollowUpDate();

          // Refresh workspace
          selectPatient(patientId);
          loadPatientsList();
        } else {
          showToast(data.message || 'Failed to submit prescription.', 'danger');
          if (Array.isArray(data.errors)) {
            data.errors.forEach(({ field, message }) => {
              const map = {
                diagnosis: 'presc-diagnosis',
                followUpDate: 'presc-followup'
              };
              const input = document.getElementById(map[field]);
              if (input) {
                setFieldError(input, message);
              } else {
                showCarePlanError(message);
              }
            });
          }
        }
      } catch (error) {
        showToast(error.message || 'Error issuing prescription.', 'danger');
      } finally {
        restoreButton();
      }
    });

    form.dataset.ready = 'true';
  }
}

function addMedicineRow() {
  medicationCount++;
  const container = document.getElementById('medications-container');
  const rowId = `med-row-${medicationCount}`;

  const rowHtml = `
    <div class="medication-row card p-3 mb-2 border" id="${rowId}">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-primary-subtle text-primary fw-bold">Medicine #${medicationCount}</span>
        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" onclick="removeRow('${rowId}')">
          <i class="bi bi-x"></i> Remove
        </button>
      </div>
      <div class="row g-2">
        <div class="col-md-5">
          <label class="small text-muted" for="med-name-${rowId}">Medicine Name & Strength</label>
          <input type="text" id="med-name-${rowId}" class="form-control form-control-sm med-name" placeholder="e.g. Amoxicillin 500mg, Metformin" maxlength="120" autocomplete="off">
        </div>
        <div class="col-md-3">
          <label class="small text-muted" for="med-dosage-${rowId}">Dosage</label>
          <input type="text" id="med-dosage-${rowId}" class="form-control form-control-sm med-dosage" placeholder="e.g. 1 Tablet, 5ml" maxlength="60" value="1 Tablet" autocomplete="off">
        </div>
        <div class="col-md-4">
          <label class="small text-muted" for="med-frequency-${rowId}">Frequency</label>
          <select id="med-frequency-${rowId}" class="form-select form-select-sm med-frequency">
            <option value="Once daily">Once daily</option>
            <option value="Twice daily" selected>Twice daily</option>
            <option value="Thrice daily">Thrice daily</option>
            <option value="Four times daily">Four times daily</option>
            <option value="As needed (SOS)">As needed (SOS)</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="small text-muted">Intake Timing Checklist</label>
          <div class="d-flex gap-3 mt-1">
            <div class="form-check form-check-inline">
              <input class="form-check-input med-time-morning" type="checkbox" id="m-${rowId}" checked>
              <label class="form-check-label small" for="m-${rowId}">Morning</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input med-time-afternoon" type="checkbox" id="a-${rowId}">
              <label class="form-check-label small" for="a-${rowId}">Afternoon</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input med-time-night" type="checkbox" id="n-${rowId}" checked>
              <label class="form-check-label small" for="n-${rowId}">Night</label>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <label class="small text-muted" for="med-instruction-${rowId}">Instructions</label>
          <select id="med-instruction-${rowId}" class="form-select form-select-sm med-instruction">
            <option value="After food" selected>After food</option>
            <option value="Before food">Before food</option>
            <option value="With food">With food</option>
            <option value="Empty stomach">Empty stomach</option>
            <option value="At bedtime">At bedtime</option>
          </select>
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', rowHtml);
}

function addPrecautionRow() {
  precautionCount++;
  const container = document.getElementById('precautions-container');
  const rowId = `prec-row-${precautionCount}`;

  const rowHtml = `
    <div class="precaution-row card p-3 mb-2 border border-warning-subtle" id="${rowId}">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-warning text-dark fw-bold">Precaution / Rule #${precautionCount}</span>
        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" onclick="removeRow('${rowId}')">
          <i class="bi bi-x"></i> Remove
        </button>
      </div>
      <div class="row g-2">
        <div class="col-md-7">
          <label class="small text-muted" for="prec-title-${rowId}">Precaution or Instruction Title</label>
          <input type="text" id="prec-title-${rowId}" class="form-control form-control-sm prec-title" placeholder="e.g. Check sitting BP every morning, Low sodium diet" maxlength="160" autocomplete="off">
        </div>
        <div class="col-md-5">
          <label class="small text-muted" for="prec-category-${rowId}">Category</label>
          <select id="prec-category-${rowId}" class="form-select form-select-sm prec-category">
            <option value="Diet">Diet</option>
            <option value="Monitoring / Vitals" selected>Monitoring / Vitals</option>
            <option value="Physical Activity">Physical Activity</option>
            <option value="Hydration">Hydration</option>
            <option value="General Hygiene">General Hygiene</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="col-12">
          <label class="small text-muted" for="prec-desc-${rowId}">Specific Direction / Goal</label>
          <input type="text" id="prec-desc-${rowId}" class="form-control form-control-sm prec-desc" placeholder="e.g. Record systolic/diastolic, keep salt under 2g/day" maxlength="500" autocomplete="off">
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', rowHtml);
}

window.removeRow = function (rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
};

// Search patients filter
window.searchPatients = function (query) {
  const search = String(query || '').toLowerCase();
  const filtered = allPatients.filter(
    (patient) =>
      String(patient.name || '').toLowerCase().includes(search) ||
      String(patient.email || '').toLowerCase().includes(search)
  );
  renderPatientsRoster(filtered);
};
