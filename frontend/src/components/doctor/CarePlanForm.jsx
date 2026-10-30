import { useRef, useState } from 'react';
import FieldError from '../FieldError.jsx';
import { apiFetch, readJson } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { localDateString } from '../../utils/format.js';

const FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Thrice daily',
  'Four times daily',
  'As needed (SOS)'
];

const INSTRUCTIONS = ['After food', 'Before food', 'With food', 'Empty stomach', 'At bedtime'];

const PRECAUTION_CATEGORIES = [
  'Diet',
  'Monitoring / Vitals',
  'Physical Activity',
  'Hydration',
  'General Hygiene',
  'Other'
];

function createMedication(number) {
  return {
    id: `med-${number}`,
    number,
    name: '',
    dosage: '1 Tablet',
    frequency: 'Twice daily',
    morning: true,
    afternoon: false,
    night: true,
    instruction: 'After food'
  };
}

function createPrecaution(number) {
  return {
    id: `prec-${number}`,
    number,
    title: '',
    category: 'Monitoring / Vitals',
    description: ''
  };
}

export default function CarePlanForm({ patientId, onIssued }) {
  const { showToast } = useToast();

  const [diagnosis, setDiagnosis] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState([createMedication(1)]);
  const [precautions, setPrecautions] = useState([createPrecaution(1)]);
  const [errors, setErrors] = useState({});
  const [carePlanError, setCarePlanError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const medicationCounter = useRef(1);
  const precautionCounter = useRef(1);

  const updateMedication = (id, field, value) => {
    setMedications((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const updatePrecaution = (id, field, value) => {
    setPrecautions((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const addMedication = () => {
    medicationCounter.current += 1;
    setMedications((current) => [
      ...current,
      createMedication(medicationCounter.current)
    ]);
  };

  const addPrecaution = () => {
    precautionCounter.current += 1;
    setPrecautions((current) => [
      ...current,
      createPrecaution(precautionCounter.current)
    ]);
  };

  const removeMedication = (id) => {
    setMedications((current) => current.filter((row) => row.id !== id));
  };

  const removePrecaution = (id) => {
    setPrecautions((current) => current.filter((row) => row.id !== id));
  };

  const collectMedications = () =>
    medications
      .filter((row) => row.name.trim())
      .map((row) => ({
        medicineName: row.name.trim(),
        dosage: row.dosage.trim() || '1 Tablet',
        frequency: row.frequency,
        instruction: row.instruction,
        timeOfDay: {
          morning: row.morning,
          afternoon: row.afternoon,
          night: row.night
        }
      }));

  const collectPrecautions = () =>
    precautions
      .filter((row) => row.title.trim())
      .map((row) => ({
        title: row.title.trim(),
        category: row.category,
        description: row.description.trim()
      }));

  const validate = () => {
    const nextErrors = {};
    let valid = true;
    const fail = (field, message) => {
      nextErrors[field] = message;
      valid = false;
    };

    setErrors({});
    setCarePlanError('');

    const trimmedDiagnosis = diagnosis.trim();
    if (trimmedDiagnosis.length < 2 || trimmedDiagnosis.length > 200) {
      fail('diagnosis', 'Diagnosis must be between 2 and 200 characters.');
    }

    if (followUpDate) {
      const selected = new Date(`${followUpDate}T00:00:00`);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      if (Number.isNaN(selected.getTime())) {
        fail('followUpDate', 'Please select a valid follow-up date.');
      } else if (selected < startOfToday) {
        fail('followUpDate', 'Follow-up date cannot be in the past.');
      }
    }

    if (collectMedications().length === 0 && collectPrecautions().length === 0) {
      setCarePlanError('Add at least one medication or precaution to the care plan.');
      valid = false;
    }

    setErrors(nextErrors);
    return valid;
  };

  const resetAfterSuccess = () => {
    setDiagnosis('');
    setFollowUpDate('');
    setNotes('');
    setErrors({});
    setCarePlanError('');

    // The original builder clears the rows and immediately adds a fresh one.
    medicationCounter.current += 1;
    precautionCounter.current += 1;
    setMedications([createMedication(medicationCounter.current)]);
    setPrecautions([createPrecaution(precautionCounter.current)]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!patientId) {
      showToast('Please select a patient from the left panel.', 'warning');
      return;
    }

    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiFetch('/prescriptions', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          diagnosis: diagnosis.trim(),
          clinicalNotes: notes.trim(),
          followUpDate,
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
        resetAfterSuccess();
        onIssued(patientId);
      } else {
        showToast(data.message || 'Failed to submit prescription.', 'danger');
        if (Array.isArray(data.errors)) {
          const serverErrors = {};
          let unmatched = '';
          data.errors.forEach(({ field, message }) => {
            if (field === 'diagnosis' || field === 'followUpDate') {
              serverErrors[field] = message;
            } else {
              unmatched = message;
            }
          });
          setErrors(serverErrors);
          if (unmatched) setCarePlanError(unmatched);
        }
      }
    } catch (error) {
      showToast(error.message || 'Error issuing prescription.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-4 custom-card mb-3">
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
        <div>
          <h5 className="fw-bold mb-0 text-teal">
            <i className="bi bi-prescription me-2"></i>Issue Care Plan &amp; Actionable
            Precautions
          </h5>
          <small className="text-muted">
            Items entered here will automatically instantiate daily tasks in the patient&apos;s
            interactive checklist.
          </small>
        </div>
      </div>

      <form id="care-plan-form" noValidate onSubmit={handleSubmit}>
        <div
          className={`alert alert-danger ${carePlanError ? '' : 'd-none'} py-2`}
          role="alert"
        >
          {carePlanError}
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-7">
            <label className="form-label small fw-semibold" htmlFor="presc-diagnosis">
              Clinical Diagnosis / Chief Complaint
            </label>
            <input
              type="text"
              id="presc-diagnosis"
              className={`form-control${errors.diagnosis ? ' is-invalid' : ''}`}
              placeholder="e.g. Stage 1 Hypertension, Acute Bronchitis"
              maxLength={200}
              required
              aria-describedby="presc-diagnosis-error"
              aria-invalid={errors.diagnosis ? 'true' : undefined}
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
            />
            <FieldError id="presc-diagnosis-error" message={errors.diagnosis} />
          </div>
          <div className="col-md-5">
            <label className="form-label small fw-semibold" htmlFor="presc-followup">
              Follow-Up Date
            </label>
            <input
              type="date"
              id="presc-followup"
              className={`form-control${errors.followUpDate ? ' is-invalid' : ''}`}
              min={localDateString()}
              aria-describedby="presc-followup-error"
              aria-invalid={errors.followUpDate ? 'true' : undefined}
              value={followUpDate}
              onChange={(event) => setFollowUpDate(event.target.value)}
            />
            <FieldError id="presc-followup-error" message={errors.followUpDate} />
          </div>
          <div className="col-12">
            <label className="form-label small fw-semibold" htmlFor="presc-notes">
              Clinical Findings &amp; Doctor Notes
            </label>
            <textarea
              id="presc-notes"
              className="form-control"
              rows={2}
              maxLength={2000}
              placeholder="e.g. Patient reports fatigue and elevated evening BP. Advised monitoring."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            ></textarea>
          </div>
        </div>

        <div className="border-top pt-3 mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold mb-0 text-primary">
              <i className="bi bi-capsule me-1"></i>Prescribe Medications
            </h6>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={addMedication}
            >
              <i className="bi bi-plus-lg me-1"></i>Add Another Medicine
            </button>
          </div>

          {medications.map((row) => (
            <div className="medication-row card p-3 mb-2 border" key={row.id}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="badge bg-primary-subtle text-primary fw-bold">
                  Medicine #{row.number}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger py-0 px-2"
                  onClick={() => removeMedication(row.id)}
                >
                  <i className="bi bi-x"></i> Remove
                </button>
              </div>
              <div className="row g-2">
                <div className="col-md-5">
                  <label className="small text-muted" htmlFor={`med-name-${row.id}`}>
                    Medicine Name &amp; Strength
                  </label>
                  <input
                    type="text"
                    id={`med-name-${row.id}`}
                    className="form-control form-control-sm med-name"
                    placeholder="e.g. Amoxicillin 500mg, Metformin"
                    maxLength={120}
                    autoComplete="off"
                    value={row.name}
                    onChange={(event) =>
                      updateMedication(row.id, 'name', event.target.value)
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="small text-muted" htmlFor={`med-dosage-${row.id}`}>
                    Dosage
                  </label>
                  <input
                    type="text"
                    id={`med-dosage-${row.id}`}
                    className="form-control form-control-sm med-dosage"
                    placeholder="e.g. 1 Tablet, 5ml"
                    maxLength={60}
                    autoComplete="off"
                    value={row.dosage}
                    onChange={(event) =>
                      updateMedication(row.id, 'dosage', event.target.value)
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="small text-muted" htmlFor={`med-frequency-${row.id}`}>
                    Frequency
                  </label>
                  <select
                    id={`med-frequency-${row.id}`}
                    className="form-select form-select-sm med-frequency"
                    value={row.frequency}
                    onChange={(event) =>
                      updateMedication(row.id, 'frequency', event.target.value)
                    }
                  >
                    {FREQUENCIES.map((frequency) => (
                      <option key={frequency} value={frequency}>
                        {frequency}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="small text-muted">Intake Timing Checklist</label>
                  <div className="d-flex gap-3 mt-1">
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`m-${row.id}`}
                        checked={row.morning}
                        onChange={(event) =>
                          updateMedication(row.id, 'morning', event.target.checked)
                        }
                      />
                      <label className="form-check-label small" htmlFor={`m-${row.id}`}>
                        Morning
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`a-${row.id}`}
                        checked={row.afternoon}
                        onChange={(event) =>
                          updateMedication(row.id, 'afternoon', event.target.checked)
                        }
                      />
                      <label className="form-check-label small" htmlFor={`a-${row.id}`}>
                        Afternoon
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`n-${row.id}`}
                        checked={row.night}
                        onChange={(event) =>
                          updateMedication(row.id, 'night', event.target.checked)
                        }
                      />
                      <label className="form-check-label small" htmlFor={`n-${row.id}`}>
                        Night
                      </label>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="small text-muted" htmlFor={`med-instruction-${row.id}`}>
                    Instructions
                  </label>
                  <select
                    id={`med-instruction-${row.id}`}
                    className="form-select form-select-sm med-instruction"
                    value={row.instruction}
                    onChange={(event) =>
                      updateMedication(row.id, 'instruction', event.target.value)
                    }
                  >
                    {INSTRUCTIONS.map((instruction) => (
                      <option key={instruction} value={instruction}>
                        {instruction}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-top pt-3 mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold mb-0 text-warning text-dark">
              <i className="bi bi-shield-exclamation me-1"></i>Mandatory Precautions &amp;
              Patient Tasks
            </h6>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning text-dark"
              onClick={addPrecaution}
            >
              <i className="bi bi-plus-lg me-1"></i>Add Another Precaution
            </button>
          </div>
          <small className="text-muted d-block mb-3">
            These will be tracked on the patient&apos;s dashboard where they can mark them as
            &quot;Done&quot; or &quot;To Do Yet&quot;.
          </small>

          {precautions.map((row) => (
            <div
              className="precaution-row card p-3 mb-2 border border-warning-subtle"
              key={row.id}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="badge bg-warning text-dark fw-bold">
                  Precaution / Rule #{row.number}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger py-0 px-2"
                  onClick={() => removePrecaution(row.id)}
                >
                  <i className="bi bi-x"></i> Remove
                </button>
              </div>
              <div className="row g-2">
                <div className="col-md-7">
                  <label className="small text-muted" htmlFor={`prec-title-${row.id}`}>
                    Precaution or Instruction Title
                  </label>
                  <input
                    type="text"
                    id={`prec-title-${row.id}`}
                    className="form-control form-control-sm prec-title"
                    placeholder="e.g. Check sitting BP every morning, Low sodium diet"
                    maxLength={160}
                    autoComplete="off"
                    value={row.title}
                    onChange={(event) =>
                      updatePrecaution(row.id, 'title', event.target.value)
                    }
                  />
                </div>
                <div className="col-md-5">
                  <label className="small text-muted" htmlFor={`prec-category-${row.id}`}>
                    Category
                  </label>
                  <select
                    id={`prec-category-${row.id}`}
                    className="form-select form-select-sm prec-category"
                    value={row.category}
                    onChange={(event) =>
                      updatePrecaution(row.id, 'category', event.target.value)
                    }
                  >
                    {PRECAUTION_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="small text-muted" htmlFor={`prec-desc-${row.id}`}>
                    Specific Direction / Goal
                  </label>
                  <input
                    type="text"
                    id={`prec-desc-${row.id}`}
                    className="form-control form-control-sm prec-desc"
                    placeholder="e.g. Record systolic/diastolic, keep salt under 2g/day"
                    maxLength={500}
                    autoComplete="off"
                    value={row.description}
                    onChange={(event) =>
                      updatePrecaution(row.id, 'description', event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-end border-top pt-3">
          <button
            type="submit"
            className="btn btn-teal text-white btn-lg fw-semibold"
            style={{ backgroundColor: '#0f766e' }}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Issuing Care Plan...
              </>
            ) : (
              <>
                <i className="bi bi-send-check me-1"></i>Issue Prescription &amp; Care Plan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
