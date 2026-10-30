// Doctor Dashboard Controller (Patient Roster, Report Inspector, Care Plan Builder, Compliance Tracker)

let currentDoctor = null;
let allPatients = [];
let selectedPatientId = null;
let medicationCount = 0;
let precautionCount = 0;

document.addEventListener('DOMContentLoaded', async () => {
  currentDoctor = await checkAuth('doctor');
  if (!currentDoctor) return;

  // Initialize Socket.io connection for real-time messaging & WebRTC calling
  if (typeof initSocket === 'function') {
    initSocket(currentDoctor.id || currentDoctor._id);
  }

  renderDoctorHeader();
  loadPendingRequests();
  loadPatientsList();
  setupPrescriptionForm();
});

function renderDoctorHeader() {
  document.getElementById('doctor-name-display').textContent = currentDoctor.name;
  document.getElementById('doctor-specialization-display').textContent = currentDoctor.specialization || 'Consultant Physician';
  document.getElementById('doctor-hospital-display').textContent = currentDoctor.hospital || 'Care Clinic';
}

// ==========================================
// PENDING PATIENT INVITATIONS & ACCESS CONTROL
// ==========================================
async function loadPendingRequests() {
  const container = document.getElementById('pending-requests-container');
  const badge = document.getElementById('pending-requests-badge');
  if (!container) return;

  try {
    const res = await fetch('/api/doctors/requests/pending', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      const requests = data.requests || [];
      if (badge) {
        badge.textContent = requests.length;
        badge.style.display = requests.length > 0 ? 'inline-block' : 'none';
      }

      if (requests.length === 0) {
        container.innerHTML = '<p class="text-muted small mb-0 p-2"><i class="bi bi-check2-circle me-1 text-success"></i>No pending patient connection requests.</p>';
        return;
      }

      container.innerHTML = requests.map((req) => {
        const pt = req.patient;
        if (!pt) return '';
        return `
          <div class="card p-3 mb-2 border border-warning-subtle bg-warning-subtle shadow-xs">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <span class="badge bg-warning text-dark small mb-1"><i class="bi bi-clock me-1"></i>New Invitation</span>
                <h6 class="mb-0 fw-bold">${escapeHtml(pt.name)}</h6>
                <small class="text-muted">${pt.gender || 'Patient'} ${pt.age ? '• ' + pt.age + 'y' : ''} ${pt.bloodGroup ? '• Blood: ' + pt.bloodGroup : ''}</small>
                <p class="small text-secondary mb-2 mt-1"><em>"${escapeHtml(req.message)}"</em></p>
              </div>
            </div>
            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-success flex-grow-1" onclick="respondToInvitation('${req._id}', 'accept')">
                <i class="bi bi-check-lg me-1"></i>Accept & Grant Access
              </button>
              <button class="btn btn-sm btn-outline-secondary" onclick="respondToInvitation('${req._id}', 'reject')">
                Decline
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    if (container) container.innerHTML = '<p class="text-danger small">Failed to load requests.</p>';
  }
}

window.respondToInvitation = async function (requestId, action) {
  try {
    const res = await fetch(`/api/doctors/requests/${requestId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, action === 'accept' ? 'success' : 'info');
      loadPendingRequests();
      loadPatientsList();
    } else {
      showToast(data.message || 'Action failed.', 'danger');
    }
  } catch (err) {
    showToast('Failed to respond to request.', 'danger');
  }
};

// ==========================================
// 1. PATIENTS ROSTER (APPROVED ONLY)
// ==========================================
async function loadPatientsList() {
  const container = document.getElementById('patients-list-container');
  container.innerHTML = '<div class="text-center py-4"><span class="spinner-border spinner-border-sm text-teal"></span> Loading connected patients...</div>';

  try {
    const res = await fetch('/api/doctors/patients', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      allPatients = data.patients;
      document.getElementById('total-patients-badge').textContent = `${allPatients.length} Connected`;
      renderPatientsRoster(allPatients);

      // Auto select first patient if available
      if (allPatients.length > 0 && !selectedPatientId) {
        selectPatient(allPatients[0].id);
      } else if (allPatients.length === 0) {
        // Clear workspace
        document.getElementById('workspace-patient-name').textContent = 'No Connected Patient Selected';
        document.getElementById('patient-reports-container').innerHTML = '<p class="text-muted text-center py-4">No patient reports accessible.</p>';
        document.getElementById('patient-compliance-container').innerHTML = '<p class="text-muted text-center py-4">No care compliance data.</p>';
      }
    }
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger py-2">Failed to load patients.</div>';
  }
}

function renderPatientsRoster(patients) {
  const container = document.getElementById('patients-list-container');
  if (patients.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 px-2 text-muted">
        <i class="bi bi-shield-lock display-6 text-teal opacity-75 d-block mb-2"></i>
        <h6 class="fw-bold text-dark">No Connected Patients Yet</h6>
        <p class="small text-muted mb-0">Patient records are strictly private. When a patient sends you an invitation, accept it above to view their reports and issue care plans.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = patients.map((p) => {
    const isSelected = p.id === selectedPatientId;
    const adherenceBadgeClass = p.adherenceRate >= 80 ? 'bg-success' : p.adherenceRate >= 50 ? 'bg-warning' : 'bg-secondary';

    return `
      <div class="patient-select-item ${isSelected ? 'active' : ''} mb-2" onclick="selectPatient('${p.id}')">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h6 class="mb-0 fw-bold">${escapeHtml(p.name)}</h6>
            <small class="text-muted">${p.gender || 'Patient'} ${p.age ? '• ' + p.age + 'y' : ''} ${p.bloodGroup ? '• ' + p.bloodGroup : ''}</small>
          </div>
          <div class="text-end">
            <span class="badge bg-primary-subtle text-primary border">${p.reportCount} Reports</span>
            <div class="mt-1">
              <span class="badge ${adherenceBadgeClass} small" title="Care Plan Adherence">${p.adherenceRate}% Adherence</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Select a patient and load their 360 Workspace
window.selectPatient = async function (patientId) {
  selectedPatientId = patientId;
  renderPatientsRoster(allPatients); // update active class

  const target = allPatients.find((p) => p.id === patientId);
  if (!target) return;

  // Populate patient info card
  document.getElementById('workspace-patient-name').textContent = target.name;
  document.getElementById('workspace-patient-email').textContent = target.email;
  document.getElementById('workspace-patient-phone').textContent = target.phone || 'Not provided';
  document.getElementById('workspace-patient-age').textContent = target.age ? `${target.age} years` : 'N/A';
  document.getElementById('workspace-patient-gender').textContent = target.gender || 'N/A';
  document.getElementById('workspace-patient-blood').textContent = target.bloodGroup || 'N/A';
  document.getElementById('workspace-patient-allergies').textContent = target.allergies || 'None reported';

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
  container.innerHTML = '<div class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary"></span> Loading reports...</div>';

  try {
    const res = await fetch(`/api/reports/patient/${patientId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      if (data.reports.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4 text-muted bg-light rounded">
            <i class="bi bi-folder2-open fs-3"></i>
            <p class="mb-0 mt-2">No medical reports uploaded by this patient yet.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.reports.map((r) => {
        const isPdf = r.filePath.toLowerCase().endsWith('.pdf');
        const icon = isPdf ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-image text-primary';

        return `
          <div class="card p-3 mb-2 border shadow-sm">
            <div class="d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center gap-3">
                <i class="bi ${icon} fs-2"></i>
                <div>
                  <h6 class="mb-0 fw-bold">${escapeHtml(r.title)}</h6>
                  <small class="text-muted">
                    <span class="badge bg-light text-dark border">${r.category}</span>
                    <span class="ms-2">Test Date: <strong>${formatDate(r.reportDate)}</strong></span>
                    <span class="ms-2">• Lab: ${escapeHtml(r.labOrHospital || 'Clinic')}</span>
                  </small>
                  ${r.notes ? `<p class="small text-secondary mb-0 mt-1"><em>Patient notes:</em> ${escapeHtml(r.notes)}</p>` : ''}
                </div>
              </div>
              <div class="d-flex flex-wrap gap-2 align-items-center">
                <button class="btn btn-sm btn-outline-teal shadow-xs" onclick="openAiAnalysisModal('${r._id}')" title="AI Health Intelligence">
                  <i class="bi bi-robot me-1 text-teal"></i>AI Lab Review ${r.aiAnalysis && r.aiAnalysis.status === 'completed' ? `<span class="badge bg-teal ms-1">${r.aiAnalysis.overallRiskScore}</span>` : ''}
                </button>
                <a href="${r.filePath}" target="_blank" class="btn btn-sm btn-outline-primary">
                  <i class="bi bi-box-arrow-up-right me-1"></i>Inspect Document
                </a>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger py-2">Error loading patient reports.</div>';
  }
}

// ==========================================
// 3. PATIENT COMPLIANCE & TASK ADHERENCE
// ==========================================
async function loadPatientTasksAndCompliance(patientId) {
  const container = document.getElementById('patient-compliance-container');
  container.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm text-teal"></span> Calculating compliance metrics...</div>';

  try {
    const res = await fetch(`/api/tasks/patient/${patientId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      const stats = data.stats;
      const tasks = data.tasks;

      const rateClass = stats.adherenceRate >= 80 ? 'text-success' : stats.adherenceRate >= 50 ? 'text-warning' : 'text-danger';
      const barClass = stats.adherenceRate >= 80 ? 'bg-success' : stats.adherenceRate >= 50 ? 'bg-warning' : 'bg-primary';

      let tasksHtml = '';
      if (tasks.length === 0) {
        tasksHtml = '<p class="text-muted small mb-0">No active care tasks or precautions assigned yet.</p>';
      } else {
        tasksHtml = tasks.map((t) => {
          const isDone = t.status === 'done';
          return `
            <div class="d-flex justify-content-between align-items-center py-1 border-bottom small">
              <div>
                <span class="${isDone ? 'text-decoration-line-through text-success' : 'fw-bold'}">${escapeHtml(t.title)}</span>
                <span class="badge bg-light text-dark border ms-1">${t.taskType}</span>
                <span class="text-muted ms-1">(${t.timing})</span>
              </div>
              <div>
                ${isDone 
                  ? `<span class="badge bg-success"><i class="bi bi-check me-1"></i>Done (${formatRelativeTime(t.completedAt)})</span>`
                  : '<span class="badge bg-secondary">To Do Yet</span>'
                }
              </div>
            </div>
          `;
        }).join('');
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
    }
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger py-2">Error checking compliance.</div>';
  }
}

// Load previous prescriptions
async function loadPatientPrescriptions(patientId) {
  const container = document.getElementById('patient-prescriptions-history');
  try {
    const res = await fetch(`/api/prescriptions/patient/${patientId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success && data.prescriptions.length > 0) {
      container.innerHTML = data.prescriptions.map((p) => `
        <div class="card p-2 mb-2 border-0 bg-light">
          <div class="d-flex justify-content-between align-items-center">
            <strong class="text-dark small">${escapeHtml(p.diagnosis)}</strong>
            <div class="d-flex align-items-center gap-1">
              <small class="text-muted">${formatDate(p.createdAt)}</small>
              <button class="btn btn-sm btn-outline-primary py-0 px-2 ms-1" onclick="downloadPrescriptionPdf('${p._id}')" title="Download Rx PDF">
                <i class="bi bi-file-earmark-pdf"></i> PDF
              </button>
            </div>
          </div>
          <small class="text-muted">${p.medications.length} medicines • ${p.precautions.length} precautions</small>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p class="text-muted small">No past prescriptions on record.</p>';
    }
  } catch (err) {
    container.innerHTML = '<p class="text-danger small">Failed to load history.</p>';
  }
}

// ==========================================
// 4. PRESCRIPTION & PRECAUTIONS BUILDER
// ==========================================
function setupPrescriptionForm() {
  const addMedBtn = document.getElementById('add-medicine-row-btn');
  const addPrecBtn = document.getElementById('add-precaution-row-btn');
  const form = document.getElementById('care-plan-form');

  if (addMedBtn) {
    addMedBtn.addEventListener('click', addMedicineRow);
    // Add 1 default row
    addMedicineRow();
  }

  if (addPrecBtn) {
    addPrecBtn.addEventListener('click', addPrecautionRow);
    // Add 1 default row
    addPrecautionRow();
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const patientId = document.getElementById('presc-patient-id').value;
      if (!patientId) {
        showToast('Please select a patient from the left panel.', 'warning');
        return;
      }

      const diagnosis = document.getElementById('presc-diagnosis').value.trim();
      const clinicalNotes = document.getElementById('presc-notes').value.trim();
      const followUpDate = document.getElementById('presc-followup').value;

      // Extract medications
      const medications = [];
      document.querySelectorAll('.medication-row').forEach((row) => {
        const name = row.querySelector('.med-name').value.trim();
        const dosage = row.querySelector('.med-dosage').value.trim();
        const frequency = row.querySelector('.med-frequency').value;
        const instruction = row.querySelector('.med-instruction').value;
        const morning = row.querySelector('.med-time-morning').checked;
        const afternoon = row.querySelector('.med-time-afternoon').checked;
        const night = row.querySelector('.med-time-night').checked;

        if (name) {
          medications.push({
            medicineName: name,
            dosage: dosage || '1 Tablet',
            frequency,
            instruction,
            timeOfDay: { morning, afternoon, night }
          });
        }
      });

      // Extract precautions
      const precautions = [];
      document.querySelectorAll('.precaution-row').forEach((row) => {
        const title = row.querySelector('.prec-title').value.trim();
        const category = row.querySelector('.prec-category').value;
        const description = row.querySelector('.prec-desc').value.trim();

        if (title) {
          precautions.push({
            title,
            category,
            description
          });
        }
      });

      if (!diagnosis) {
        showToast('Please provide a diagnosis or consultation reason.', 'warning');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Issuing Care Plan...';

      try {
        const res = await fetch('/api/prescriptions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            patientId,
            diagnosis,
            clinicalNotes,
            medications,
            precautions,
            followUpDate
          })
        });

        const data = await res.json();
        if (data.success) {
          showToast(`Prescription issued! Created ${data.tasksGeneratedCount} interactive tasks for patient.`, 'success');
          form.reset();
          document.getElementById('medications-container').innerHTML = '';
          document.getElementById('precautions-container').innerHTML = '';
          addMedicineRow();
          addPrecautionRow();
          // Refresh workspace
          selectPatient(patientId);
          loadPatientsList();
        } else {
          showToast(data.message || 'Failed to submit prescription.', 'danger');
        }
      } catch (err) {
        showToast('Error issuing prescription.', 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-send-check me-1"></i>Issue Prescription & Care Plan';
      }
    });
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
          <label class="small text-muted">Medicine Name & Strength</label>
          <input type="text" class="form-control form-control-sm med-name" placeholder="e.g. Amoxicillin 500mg, Metformin" required>
        </div>
        <div class="col-md-3">
          <label class="small text-muted">Dosage</label>
          <input type="text" class="form-control form-control-sm med-dosage" placeholder="e.g. 1 Tablet, 5ml" value="1 Tablet">
        </div>
        <div class="col-md-4">
          <label class="small text-muted">Frequency</label>
          <select class="form-select form-select-sm med-frequency">
            <option value="Once daily">Once daily</option>
            <option value="Twice daily" selected>Twice daily</option>
            <option value="Thrice daily">Thrice daily</option>
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
          <label class="small text-muted">Instructions</label>
          <select class="form-select form-select-sm med-instruction">
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
          <label class="small text-muted">Precaution or Instruction Title</label>
          <input type="text" class="form-control form-control-sm prec-title" placeholder="e.g. Check sitting BP every morning, Low sodium diet" required>
        </div>
        <div class="col-md-5">
          <label class="small text-muted">Category</label>
          <select class="form-select form-select-sm prec-category">
            <option value="Diet">Diet</option>
            <option value="Monitoring / Vitals" selected>Monitoring / Vitals</option>
            <option value="Physical Activity">Physical Activity</option>
            <option value="Hydration">Hydration</option>
            <option value="General Hygiene">General Hygiene</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="col-12">
          <label class="small text-muted">Specific Direction / Goal</label>
          <input type="text" class="form-control form-control-sm prec-desc" placeholder="e.g. Record systolic/diastolic, keep salt under 2g/day">
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
  const filtered = allPatients.filter((p) => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.email.toLowerCase().includes(query.toLowerCase())
  );
  renderPatientsRoster(filtered);
};

// Doctor Chat & Calling Triggers
window.openChatWithActivePatient = function () {
  if (!selectedPatientId) {
    showToast('Please select a patient from the roster first.', 'warning');
    return;
  }
  const target = allPatients.find((p) => p.id === selectedPatientId);
  if (target) {
    openChat(target.id, target.name, 'Patient');
  }
};

window.startVoiceCallWithActivePatient = function () {
  if (!selectedPatientId) {
    showToast('Please select a patient from the roster first.', 'warning');
    return;
  }
  const target = allPatients.find((p) => p.id === selectedPatientId);
  if (target) {
    startCall(target.id, target.name, 'audio');
  }
};

window.startVideoCallWithActivePatient = function () {
  if (!selectedPatientId) {
    showToast('Please select a patient from the roster first.', 'warning');
    return;
  }
  const target = allPatients.find((p) => p.id === selectedPatientId);
  if (target) {
    startCall(target.id, target.name, 'video');
  }
};

// Helpers
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}
