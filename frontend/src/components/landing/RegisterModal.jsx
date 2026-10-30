import { useState } from 'react';
import Modal from '../Modal.jsx';
import FieldError from '../FieldError.jsx';
import { apiFetch, readJson } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { EMAIL_PATTERN, PHONE_PATTERN } from '../../utils/validation.js';

const INITIAL_FORM = {
  role: 'patient',
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  age: '',
  gender: '',
  bloodGroup: '',
  allergies: '',
  specialization: '',
  hospital: '',
  licenseNumber: '',
  experienceYears: ''
};

const SERVER_FIELD_MAP = {
  name: 'name',
  email: 'email',
  password: 'password',
  phone: 'phone',
  age: 'age',
  gender: 'gender',
  bloodGroup: 'bloodGroup',
  allergies: 'allergies',
  specialization: 'specialization',
  hospital: 'hospital',
  licenseNumber: 'licenseNumber',
  experienceYears: 'experienceYears'
};

export default function RegisterModal({ show, onClose, onAuthenticated }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleRoleChange = (role) => {
    setForm((current) => ({ ...current, role }));
    setErrors({});
  };

  const validate = () => {
    const nextErrors = {};
    const fail = (field, message) => {
      nextErrors[field] = message;
    };

    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const password = form.password;

    if (name.length < 2 || name.length > 80) {
      fail('name', 'Name must be between 2 and 80 characters.');
    }
    if (!EMAIL_PATTERN.test(email)) {
      fail('email', 'Enter a valid email address.');
    }
    if (phone && !PHONE_PATTERN.test(phone)) {
      fail('phone', 'Enter a valid phone number (7-20 digits).');
    }
    if (password.length < 8) {
      fail('password', 'Password must be at least 8 characters.');
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      fail('password', 'Password must include at least one letter and one number.');
    }
    if (form.confirmPassword !== password) {
      fail('confirmPassword', 'Passwords do not match.');
    }

    if (form.role === 'patient') {
      const age = form.age.trim();
      if (age !== '') {
        const ageNumber = Number(age);
        if (!Number.isInteger(ageNumber) || ageNumber < 0 || ageNumber > 120) {
          fail('age', 'Age must be a whole number between 0 and 120.');
        }
      }
    } else {
      if (form.specialization.trim().length < 2) {
        fail('specialization', 'Enter your medical specialization.');
      }
      if (form.licenseNumber.trim().length < 2) {
        fail('licenseNumber', 'Enter your medical license number.');
      }

      const experience = form.experienceYears.trim();
      if (experience !== '') {
        const years = Number(experience);
        if (!Number.isInteger(years) || years < 0 || years > 70) {
          fail('experienceYears', 'Years of practice must be between 0 and 70.');
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = () => {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone.trim(),
      role: form.role
    };

    if (form.role === 'patient') {
      const age = form.age.trim();
      payload.age = age === '' ? undefined : Number(age);
      payload.gender = form.gender;
      payload.bloodGroup = form.bloodGroup;
      payload.allergies = form.allergies.trim();
    } else {
      payload.specialization = form.specialization.trim();
      payload.hospital = form.hospital.trim();
      payload.licenseNumber = form.licenseNumber.trim();
      const experience = form.experienceYears.trim();
      payload.experienceYears = experience === '' ? undefined : Number(experience);
    }

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        skipAuthRedirect: true,
        body: JSON.stringify(buildPayload())
      });
      const data = await readJson(res);

      if (data.success) {
        onAuthenticated(data, 'Account created successfully!', 800);
      } else {
        showToast(data.message || 'Registration failed.', 'danger');
        if (Array.isArray(data.errors)) {
          const serverErrors = {};
          data.errors.forEach(({ field, message }) => {
            const key = SERVER_FIELD_MAP[field];
            if (key) serverErrors[key] = message;
          });
          setErrors(serverErrors);
        }
        setSubmitting(false);
      }
    } catch (error) {
      showToast(error.message || 'Error communicating with server.', 'danger');
      setSubmitting(false);
    }
  };

  const isDoctor = form.role === 'doctor';

  return (
    <Modal show={show} onClose={onClose} size="modal-lg" labelledBy="registerModalLabel">
      <div className="modal-header border-0 pb-0">
        <div className="d-flex align-items-center gap-2">
          <img src="/img/favicon.svg" alt="CareSync" width="32" height="32" />
          <h5 className="modal-title fw-bold" id="registerModalLabel">
            Create Your CareSync Account
          </h5>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={onClose}
          aria-label="Close"
        ></button>
      </div>

      <div className="modal-body p-4">
        <form id="register-form" noValidate onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="reg-role">
                Account Role
              </label>
              <select
                id="reg-role"
                className="form-select"
                required
                value={form.role}
                onChange={(event) => handleRoleChange(event.target.value)}
              >
                <option value="patient">I am a Patient</option>
                <option value="doctor">I am a Doctor / Physician</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="reg-name">
                Full Name
              </label>
              <input
                type="text"
                id="reg-name"
                className={`form-control${errors.name ? ' is-invalid' : ''}`}
                placeholder="John Doe or Dr. Sarah Mitchell"
                autoComplete="name"
                maxLength={80}
                required
                aria-describedby="reg-name-error"
                aria-invalid={errors.name ? 'true' : undefined}
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
              />
              <FieldError id="reg-name-error" message={errors.name} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="reg-email">
                Email Address
              </label>
              <input
                type="email"
                id="reg-email"
                className={`form-control${errors.email ? ' is-invalid' : ''}`}
                placeholder="name@example.com"
                autoComplete="email"
                maxLength={254}
                required
                aria-describedby="reg-email-error"
                aria-invalid={errors.email ? 'true' : undefined}
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
              <FieldError id="reg-email-error" message={errors.email} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="reg-phone">
                Contact Phone
              </label>
              <input
                type="tel"
                id="reg-phone"
                className={`form-control${errors.phone ? ' is-invalid' : ''}`}
                placeholder="+1 (555) 000-0000"
                autoComplete="tel"
                maxLength={20}
                aria-describedby="reg-phone-error"
                aria-invalid={errors.phone ? 'true' : undefined}
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
              <FieldError id="reg-phone-error" message={errors.phone} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="reg-password">
                Password
              </label>
              <input
                type="password"
                id="reg-password"
                className={`form-control${errors.password ? ' is-invalid' : ''}`}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                aria-describedby="reg-password-error reg-password-help"
                aria-invalid={errors.password ? 'true' : undefined}
                value={form.password}
                onChange={(event) => setField('password', event.target.value)}
              />
              <div className="form-text" id="reg-password-help">
                Use at least 8 characters with one letter and one number.
              </div>
              <FieldError id="reg-password-error" message={errors.password} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="reg-confirm-password">
                Confirm Password
              </label>
              <input
                type="password"
                id="reg-confirm-password"
                className={`form-control${errors.confirmPassword ? ' is-invalid' : ''}`}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                aria-describedby="reg-confirm-password-error"
                aria-invalid={errors.confirmPassword ? 'true' : undefined}
                value={form.confirmPassword}
                onChange={(event) => setField('confirmPassword', event.target.value)}
              />
              <FieldError id="reg-confirm-password-error" message={errors.confirmPassword} />
            </div>

            {form.role === 'patient' ? (
              <div className="row g-3 mt-1">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold" htmlFor="reg-age">
                    Age
                  </label>
                  <input
                    type="number"
                    id="reg-age"
                    className={`form-control${errors.age ? ' is-invalid' : ''}`}
                    placeholder="e.g. 35"
                    min={0}
                    max={120}
                    step={1}
                    inputMode="numeric"
                    aria-describedby="reg-age-error"
                    aria-invalid={errors.age ? 'true' : undefined}
                    value={form.age}
                    onChange={(event) => setField('age', event.target.value)}
                  />
                  <FieldError id="reg-age-error" message={errors.age} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold" htmlFor="reg-gender">
                    Gender
                  </label>
                  <select
                    id="reg-gender"
                    className={`form-select${errors.gender ? ' is-invalid' : ''}`}
                    aria-describedby="reg-gender-error"
                    aria-invalid={errors.gender ? 'true' : undefined}
                    value={form.gender}
                    onChange={(event) => setField('gender', event.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <FieldError id="reg-gender-error" message={errors.gender} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold" htmlFor="reg-blood-group">
                    Blood Group
                  </label>
                  <select
                    id="reg-blood-group"
                    className={`form-select${errors.bloodGroup ? ' is-invalid' : ''}`}
                    aria-describedby="reg-blood-group-error"
                    aria-invalid={errors.bloodGroup ? 'true' : undefined}
                    value={form.bloodGroup}
                    onChange={(event) => setField('bloodGroup', event.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                  <FieldError id="reg-blood-group-error" message={errors.bloodGroup} />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold" htmlFor="reg-allergies">
                    Known Allergies
                  </label>
                  <input
                    type="text"
                    id="reg-allergies"
                    className={`form-control${errors.allergies ? ' is-invalid' : ''}`}
                    placeholder="e.g. Penicillin, Peanuts, Sulfa (or None)"
                    maxLength={300}
                    aria-describedby="reg-allergies-error"
                    aria-invalid={errors.allergies ? 'true' : undefined}
                    value={form.allergies}
                    onChange={(event) => setField('allergies', event.target.value)}
                  />
                  <FieldError id="reg-allergies-error" message={errors.allergies} />
                </div>
              </div>
            ) : (
              <div className="row g-3 mt-1">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold" htmlFor="reg-specialization">
                    Medical Specialization
                  </label>
                  <input
                    type="text"
                    id="reg-specialization"
                    className={`form-control${errors.specialization ? ' is-invalid' : ''}`}
                    placeholder="e.g. Internal Medicine, Cardiology"
                    maxLength={120}
                    required
                    aria-describedby="reg-specialization-error"
                    aria-invalid={errors.specialization ? 'true' : undefined}
                    value={form.specialization}
                    onChange={(event) => setField('specialization', event.target.value)}
                  />
                  <FieldError id="reg-specialization-error" message={errors.specialization} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold" htmlFor="reg-hospital">
                    Clinic / Hospital Affiliation
                  </label>
                  <input
                    type="text"
                    id="reg-hospital"
                    className={`form-control${errors.hospital ? ' is-invalid' : ''}`}
                    placeholder="e.g. City Health Hospital"
                    maxLength={120}
                    aria-describedby="reg-hospital-error"
                    aria-invalid={errors.hospital ? 'true' : undefined}
                    value={form.hospital}
                    onChange={(event) => setField('hospital', event.target.value)}
                  />
                  <FieldError id="reg-hospital-error" message={errors.hospital} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold" htmlFor="reg-license">
                    Medical Registration / License #
                  </label>
                  <input
                    type="text"
                    id="reg-license"
                    className={`form-control${errors.licenseNumber ? ' is-invalid' : ''}`}
                    placeholder="e.g. REG-19284"
                    maxLength={60}
                    required
                    aria-describedby="reg-license-error"
                    aria-invalid={errors.licenseNumber ? 'true' : undefined}
                    value={form.licenseNumber}
                    onChange={(event) => setField('licenseNumber', event.target.value)}
                  />
                  <FieldError id="reg-license-error" message={errors.licenseNumber} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold" htmlFor="reg-experience">
                    Years of Practice
                  </label>
                  <input
                    type="number"
                    id="reg-experience"
                    className={`form-control${errors.experienceYears ? ' is-invalid' : ''}`}
                    placeholder="e.g. 10"
                    min={0}
                    max={70}
                    step={1}
                    inputMode="numeric"
                    aria-describedby="reg-experience-error"
                    aria-invalid={errors.experienceYears ? 'true' : undefined}
                    value={form.experienceYears}
                    onChange={(event) => setField('experienceYears', event.target.value)}
                  />
                  <FieldError id="reg-experience-error" message={errors.experienceYears} />
                </div>
              </div>
            )}

            <div className="col-12 mt-4">
              <button
                type="submit"
                className="btn btn-teal w-100 py-2 fw-semibold"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Creating account...
                  </>
                ) : (
                  'Complete Registration'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
