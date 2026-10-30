import { useState } from 'react';
import Modal from '../Modal.jsx';
import FieldError from '../FieldError.jsx';
import { apiFetch, readJson } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { EMAIL_PATTERN } from '../../utils/validation.js';

export default function LoginModal({ show, onClose, onAuthenticated }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const nextErrors = {};
    if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      nextErrors.password = 'Enter your password.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        skipAuthRedirect: true,
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await readJson(res);

      if (data.success) {
        onAuthenticated(data, `Welcome back, ${data.user.name}!`, 800);
      } else {
        showToast(data.message || 'Login failed. Please check your credentials.', 'danger');
        if (Array.isArray(data.errors)) {
          const serverErrors = {};
          data.errors.forEach(({ field, message }) => {
            if (field === 'email' || field === 'password') serverErrors[field] = message;
          });
          setErrors(serverErrors);
        }
        setSubmitting(false);
      }
    } catch (error) {
      showToast(
        error.message || 'Error connecting to server. Is the backend running?',
        'danger'
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onClose={onClose} labelledBy="loginModalLabel">
      <div className="modal-header border-0 pb-0">
        <div className="d-flex align-items-center gap-2">
          <img src="/img/favicon.svg" alt="CareSync" width="32" height="32" />
          <h5 className="modal-title fw-bold" id="loginModalLabel">
            Sign In to CareSync
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
        <form id="login-form" noValidate onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label small fw-semibold" htmlFor="login-email">
              Email Address
            </label>
            <input
              type="email"
              id="login-email"
              className={`form-control${errors.email ? ' is-invalid' : ''}`}
              placeholder="name@example.com"
              autoComplete="email"
              maxLength={254}
              required
              aria-describedby="login-email-error"
              aria-invalid={errors.email ? 'true' : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <FieldError id="login-email-error" message={errors.email} />
          </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold" htmlFor="login-password">
              Password
            </label>
            <input
              type="password"
              id="login-password"
              className={`form-control${errors.password ? ' is-invalid' : ''}`}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              aria-describedby="login-password-error"
              aria-invalid={errors.password ? 'true' : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FieldError id="login-password-error" message={errors.password} />
          </div>
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
                Logging in...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right me-1"></i>Log In
              </>
            )}
          </button>
        </form>
      </div>
    </Modal>
  );
}
