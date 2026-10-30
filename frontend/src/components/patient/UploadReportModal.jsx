import { useEffect, useRef, useState } from 'react';
import Modal from '../Modal.jsx';
import FieldError from '../FieldError.jsx';
import { apiFetch, readJson } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatFileSize, localDateString } from '../../utils/format.js';

const ALLOWED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];
const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

const CATEGORY_OPTIONS = [
  'Blood Test',
  'Radiology / X-Ray / Scan',
  'Prescription',
  'Discharge Summary',
  'Pathology',
  'Cardiology / ECG',
  'Other'
];

const SERVER_FIELD_MAP = {
  title: 'title',
  reportDate: 'reportDate',
  category: 'category',
  labOrHospital: 'labOrHospital',
  notes: 'notes'
};

function isAllowedUpload(file) {
  const extension = `.${file.name.split('.').pop().toLowerCase()}`;
  return (
    ALLOWED_UPLOAD_TYPES.includes(file.type) &&
    ALLOWED_UPLOAD_EXTENSIONS.includes(extension)
  );
}

export default function UploadReportModal({ show, onClose, onUploaded }) {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Blood Test');
  const [reportDate, setReportDate] = useState('');
  const [labOrHospital, setLabOrHospital] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dragover, setDragover] = useState(false);

  const maxDate = localDateString();

  const resetForm = () => {
    setTitle('');
    setCategory('Blood Test');
    setReportDate(localDateString());
    setLabOrHospital('');
    setNotes('');
    setFile(null);
    setErrors({});
    setUploadError('');
    setDragover(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (show) resetForm();
    // resetForm only uses state setters and a ref, so this is safe to run on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const applyFile = (nextFile) => {
    setFile(nextFile);
    if (!nextFile) return;

    if (!isAllowedUpload(nextFile)) {
      setUploadError('Only PDF, JPG, PNG, and WEBP files are allowed.');
    } else if (nextFile.size > MAX_UPLOAD_SIZE) {
      setUploadError('File is too large. The maximum allowed size is 15 MB.');
    } else {
      setUploadError('');
    }
  };

  const validate = () => {
    const nextErrors = {};
    setErrors({});
    setUploadError('');

    let valid = true;

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2 || trimmedTitle.length > 120) {
      nextErrors.title = 'Report title must be between 2 and 120 characters.';
      valid = false;
    }

    if (!reportDate) {
      nextErrors.reportDate = 'Please select the report date.';
      valid = false;
    } else {
      const selected = new Date(`${reportDate}T00:00:00`);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      if (Number.isNaN(selected.getTime())) {
        nextErrors.reportDate = 'Please select a valid report date.';
        valid = false;
      } else if (selected > endOfToday) {
        nextErrors.reportDate = 'Report date cannot be in the future.';
        valid = false;
      }
    }

    if (!file) {
      setUploadError('Please choose a PDF or image file to upload.');
      valid = false;
    } else if (!isAllowedUpload(file)) {
      setUploadError('Only PDF, JPG, PNG, and WEBP files are allowed.');
      valid = false;
    } else if (file.size > MAX_UPLOAD_SIZE) {
      setUploadError('File is too large. The maximum allowed size is 15 MB.');
      valid = false;
    }

    setErrors(nextErrors);
    return valid;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('reportDate', reportDate);
      formData.append('labOrHospital', labOrHospital);
      formData.append('notes', notes);

      const res = await apiFetch('/reports/upload', {
        method: 'POST',
        body: formData
      });
      const data = await readJson(res);

      if (data.success) {
        showToast('Medical report uploaded successfully!', 'success');
        onUploaded();
        onClose();
        resetForm();
      } else {
        showToast(data.message || 'Upload failed.', 'danger');
        if (Array.isArray(data.errors)) {
          const serverErrors = {};
          data.errors.forEach(({ field, message }) => {
            const key = SERVER_FIELD_MAP[field];
            if (key) serverErrors[key] = message;
          });
          setErrors(serverErrors);
        }
      }
    } catch (error) {
      showToast(error.message || 'Failed to upload file.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (event) => {
    applyFile(event.target.files && event.target.files[0] ? event.target.files[0] : null);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragover(false);
    if (event.dataTransfer.files.length > 0) {
      applyFile(event.dataTransfer.files[0]);
    }
  };

  const fileIsValid = file && isAllowedUpload(file) && file.size <= MAX_UPLOAD_SIZE;

  return (
    <Modal show={show} onClose={onClose} size="modal-lg" labelledBy="uploadReportModalLabel">
      <div
        className="modal-header bg-teal text-white"
        style={{ backgroundColor: '#0f766e' }}
      >
        <h5 className="modal-title fw-bold" id="uploadReportModalLabel">
          <i className="bi bi-cloud-arrow-up me-2"></i>Upload Medical Report
        </h5>
        <button
          type="button"
          className="btn-close btn-close-white"
          onClick={onClose}
          aria-label="Close"
        ></button>
      </div>
      <div className="modal-body p-4">
        <form id="upload-report-form" noValidate onSubmit={handleSubmit}>
          <div
            className={`alert alert-danger ${uploadError ? '' : 'd-none'} py-2`}
            role="alert"
          >
            {uploadError}
          </div>

          <div
            className={`drop-zone mb-3 ${dragover ? 'dragover' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Choose a medical report file"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragover(true);
            }}
            onDragLeave={() => setDragover(false)}
            onDrop={handleDrop}
          >
            <i className="bi bi-cloud-upload display-4 text-teal" style={{ color: '#0f766e' }}></i>
            <h6 className="mt-2 fw-semibold">
              Drag &amp; drop your file here, or click to browse
            </h6>
            <p className="text-muted small mb-1">
              Supported formats: PDF, JPG, PNG, WEBP (Max 15 MB)
            </p>
            <div className="mt-2">
              {file ? (
                <span className={`badge ${fileIsValid ? 'bg-teal' : 'bg-danger'} p-2`}>
                  <i
                    className={`bi ${
                      fileIsValid ? 'bi-file-earmark-check' : 'bi-exclamation-triangle'
                    } me-1`}
                  ></i>
                  {file.name} ({formatFileSize(file.size)})
                </span>
              ) : null}
            </div>
            <input
              type="file"
              id="report-file"
              name="file"
              className="d-none"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="report-title">
                Report Title / Description
              </label>
              <input
                type="text"
                id="report-title"
                name="title"
                className={`form-control${errors.title ? ' is-invalid' : ''}`}
                placeholder="e.g. Complete Blood Count (CBC)"
                maxLength={120}
                required
                aria-describedby="report-title-error"
                aria-invalid={errors.title ? 'true' : undefined}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <FieldError id="report-title-error" message={errors.title} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="report-category">
                Category
              </label>
              <select
                id="report-category"
                name="category"
                className="form-select"
                required
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="report-date">
                Test / Report Date
              </label>
              <input
                type="date"
                id="report-date"
                name="reportDate"
                className={`form-control${errors.reportDate ? ' is-invalid' : ''}`}
                max={maxDate}
                required
                aria-describedby="report-date-error"
                aria-invalid={errors.reportDate ? 'true' : undefined}
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
              />
              <FieldError id="report-date-error" message={errors.reportDate} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="report-lab">
                Lab or Hospital Name
              </label>
              <input
                type="text"
                id="report-lab"
                name="labOrHospital"
                className="form-control"
                placeholder="e.g. Metropolis Diagnostics, Apollo Clinic"
                maxLength={120}
                value={labOrHospital}
                onChange={(event) => setLabOrHospital(event.target.value)}
              />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold" htmlFor="report-notes">
                Any notes or symptoms at the time of test
              </label>
              <textarea
                id="report-notes"
                name="notes"
                className="form-control"
                rows={2}
                maxLength={1000}
                placeholder="e.g. Conducted during high fever and body ache..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              ></textarea>
            </div>
          </div>

          <div className="modal-footer border-0 px-0 pb-0 mt-3">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-teal text-white"
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
                  Uploading...
                </>
              ) : (
                <>
                  <i className="bi bi-cloud-arrow-up me-1"></i>Upload Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
