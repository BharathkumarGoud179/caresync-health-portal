// Common Utility Functions for CareSync Portal

const API_BASE = '/api';

// Retrieve auth token
function getToken() {
  return localStorage.getItem('caresync_token') || getCookie('token');
}

// Set auth token
function setToken(token) {
  if (token) localStorage.setItem('caresync_token', token);
}

// Helper to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Clear locally stored session data
function clearSession() {
  localStorage.removeItem('caresync_token');
  localStorage.removeItem('caresync_user');
}

// Clear token & logout
function logout() {
  clearSession();
  fetch(`${API_BASE}/auth/logout`, { method: 'POST' })
    .catch(() => {})
    .finally(() => {
      window.location.href = '/';
    });
}

// Store user data
function setCurrentUser(user) {
  try {
    localStorage.setItem('caresync_user', JSON.stringify(user));
  } catch (error) {
    console.warn('Could not persist user profile:', error);
  }
}

// Get user data (never throw on corrupted localStorage)
function getCurrentUser() {
  try {
    const user = localStorage.getItem('caresync_user');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    localStorage.removeItem('caresync_user');
    return null;
  }
}

// Escape untrusted text before inserting it into HTML.
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]
  );
}

// Toast notification helper. Messages are escaped because some of them come
// from the API and could contain user-provided text.
function showToast(message, type = 'primary') {
  const container = (() => {
    let element = document.getElementById('toast-container');
    if (!element) {
      element = document.createElement('div');
      element.id = 'toast-container';
      document.body.appendChild(element);
    }
    return element;
  })();

  const bgClasses = {
    success: 'text-bg-success',
    danger: 'text-bg-danger',
    warning: 'text-bg-warning',
    info: 'text-bg-info',
    primary: 'text-bg-primary'
  };

  const toastId = 'toast-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center ${bgClasses[type] || 'text-bg-dark'} border-0 mb-2 shadow" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${escapeHtml(message)}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  const toastElement = document.getElementById(toastId);

  if (typeof bootstrap === 'undefined' || !bootstrap.Toast) {
    console.warn(message);
    return;
  }

  const bsToast = new bootstrap.Toast(toastElement, { delay: 3500 });
  bsToast.show();

  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

// Central API wrapper: attaches the bearer token and redirects on expiry.
async function apiFetch(path, options = {}) {
  const { skipAuthRedirect = false, ...fetchOptions } = options;
  const url =
    path.startsWith('http') || path.startsWith('/api/')
      ? path
      : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(fetchOptions.headers || {});
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData =
    typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  if (fetchOptions.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...fetchOptions, headers });

  // A 401 from the login endpoint means "wrong credentials", not an expired
  // session, so auth requests opt out of the redirect.
  if (response.status === 401 && !skipAuthRedirect) {
    clearSession();
    window.location.href = '/';
    throw new Error('Your session has expired. Please log in again.');
  }

  return response;
}

// Read a response as JSON without throwing on empty/non-JSON bodies.
async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { success: false, message: 'The server returned an unexpected response.' };
  }
}

// Show an inline Bootstrap validation error on an input.
function setFieldError(input, message) {
  if (!input) return;
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');

  const feedback = document.getElementById(`${input.id}-error`);
  if (feedback) {
    feedback.textContent = message;
    feedback.classList.add('d-block');
  }
}

// Clear one inline validation error.
function clearFieldError(input) {
  if (!input) return;
  input.classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');

  const feedback = document.getElementById(`${input.id}-error`);
  if (feedback) {
    feedback.textContent = '';
    feedback.classList.remove('d-block');
  }
}

// Clear every inline error inside a form.
function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll('.is-invalid').forEach((input) => {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  });
  form.querySelectorAll('.invalid-feedback').forEach((feedback) => {
    feedback.textContent = '';
    feedback.classList.remove('d-block');
  });
}

// Toggle a button into a loading state. Returns a restore function.
function setButtonLoading(button, loadingText = 'Please wait...') {
  if (!button) return () => {};

  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${escapeHtml(loadingText)}`;

  return () => {
    button.disabled = false;
    button.innerHTML = originalHtml;
  };
}

// Format Date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format relative time
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffInDays < 0) return formatDate(dateStr);
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return formatDate(dateStr);
}

// Format bytes into a readable size
function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((value / Math.pow(k, index)).toFixed(1))} ${sizes[index]}`;
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
        Authorization: `Bearer ${token}`
      }
    });

    const data = await readJson(res);
    if (!res.ok || !data.success || !data.user) {
      clearSession();
      window.location.href = '/';
      return null;
    }

    setCurrentUser(data.user);

    if (requiredRole && data.user.role !== requiredRole) {
      window.location.href = data.user.role === 'doctor' ? '/doctor' : '/patient';
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Auth verification failed:', error);
    clearSession();
    window.location.href = '/';
    return null;
  }
}
