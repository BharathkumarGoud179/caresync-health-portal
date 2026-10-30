// Authentication Logic (Login, Register, Demo Accounts)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,19}$/;

const REGISTER_FIELD_MAP = {
  name: 'reg-name',
  email: 'reg-email',
  password: 'reg-password',
  phone: 'reg-phone',
  age: 'reg-age',
  gender: 'reg-gender',
  bloodGroup: 'reg-blood-group',
  allergies: 'reg-allergies',
  specialization: 'reg-specialization',
  hospital: 'reg-hospital',
  licenseNumber: 'reg-license',
  experienceYears: 'reg-experience'
};

const LOGIN_FIELD_MAP = {
  email: 'login-email',
  password: 'login-password'
};

const redirectForRole = (role) => {
  window.location.href = role === 'doctor' ? '/doctor' : '/patient';
};

// Guard against a submit before DOMContentLoaded attaches the real handlers.
// Without this, the browser's native GET submission would put form values
// (including the password) in the URL.
const guardAuthForm = (formId) => {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener('submit', (event) => {
    if (form.dataset.ready !== 'true') {
      event.preventDefault();
      showToast('Please wait a moment while the page finishes loading.', 'info');
    }
  });
};

guardAuthForm('login-form');
guardAuthForm('register-form');

// Verify a stored token before redirecting away from the landing page.
const redirectIfAlreadyLoggedIn = async () => {
  if (window.location.pathname !== '/') return;

  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await readJson(res);
    if (res.ok && data.success && data.user) {
      setCurrentUser(data.user);
      redirectForRole(data.user.role);
    } else {
      clearSession();
    }
  } catch (error) {
    // Leave the visitor on the landing page if the check fails.
  }
};

const applyServerErrors = (data, fieldMap) => {
  if (!data || !Array.isArray(data.errors)) return;
  data.errors.forEach(({ field, message }) => {
    const input = document.getElementById(fieldMap[field]);
    if (input) setFieldError(input, message);
  });
};

const validateLoginForm = () => {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');

  clearFormErrors(form);
  let valid = true;
  const fail = (input, message) => {
    setFieldError(input, message);
    valid = false;
  };

  const email = emailInput.value.trim();
  if (!EMAIL_PATTERN.test(email)) {
    fail(emailInput, 'Enter a valid email address.');
  }
  if (!passwordInput.value) {
    fail(passwordInput, 'Enter your password.');
  }

  return valid;
};

const validateRegisterForm = () => {
  const form = document.getElementById('register-form');
  const role = document.getElementById('reg-role').value;

  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const phoneInput = document.getElementById('reg-phone');
  const passwordInput = document.getElementById('reg-password');
  const confirmInput = document.getElementById('reg-confirm-password');

  clearFormErrors(form);
  let valid = true;
  const fail = (input, message) => {
    setFieldError(input, message);
    valid = false;
  };

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmInput.value;

  if (name.length < 2 || name.length > 80) {
    fail(nameInput, 'Name must be between 2 and 80 characters.');
  }
  if (!EMAIL_PATTERN.test(email)) {
    fail(emailInput, 'Enter a valid email address.');
  }
  if (phone && !PHONE_PATTERN.test(phone)) {
    fail(phoneInput, 'Enter a valid phone number (7-20 digits).');
  }
  if (password.length < 8) {
    fail(passwordInput, 'Password must be at least 8 characters.');
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    fail(passwordInput, 'Password must include at least one letter and one number.');
  }
  if (confirmPassword !== password) {
    fail(confirmInput, 'Passwords do not match.');
  }

  if (role === 'patient') {
    const ageInput = document.getElementById('reg-age');
    const age = ageInput.value.trim();
    if (age !== '') {
      const ageNumber = Number(age);
      if (!Number.isInteger(ageNumber) || ageNumber < 0 || ageNumber > 120) {
        fail(ageInput, 'Age must be a whole number between 0 and 120.');
      }
    }
  } else {
    const specializationInput = document.getElementById('reg-specialization');
    const licenseInput = document.getElementById('reg-license');
    const experienceInput = document.getElementById('reg-experience');

    if (specializationInput.value.trim().length < 2) {
      fail(specializationInput, 'Enter your medical specialization.');
    }
    if (licenseInput.value.trim().length < 2) {
      fail(licenseInput, 'Enter your medical license number.');
    }

    const experience = experienceInput.value.trim();
    if (experience !== '') {
      const years = Number(experience);
      if (!Number.isInteger(years) || years < 0 || years > 70) {
        fail(experienceInput, 'Years of practice must be between 0 and 70.');
      }
    }
  }

  return valid;
};

const buildRegisterPayload = () => {
  const role = document.getElementById('reg-role').value;
  const payload = {
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value,
    phone: document.getElementById('reg-phone').value.trim(),
    role
  };

  if (role === 'patient') {
    const age = document.getElementById('reg-age').value.trim();
    payload.age = age === '' ? undefined : Number(age);
    payload.gender = document.getElementById('reg-gender').value;
    payload.bloodGroup = document.getElementById('reg-blood-group').value;
    payload.allergies = document.getElementById('reg-allergies').value.trim();
  } else {
    payload.specialization = document.getElementById('reg-specialization').value.trim();
    payload.hospital = document.getElementById('reg-hospital').value.trim();
    payload.licenseNumber = document.getElementById('reg-license').value.trim();
    const experience = document.getElementById('reg-experience').value.trim();
    payload.experienceYears = experience === '' ? undefined : Number(experience);
  }

  return payload;
};

document.addEventListener('DOMContentLoaded', () => {
  redirectIfAlreadyLoggedIn();

  // Handle Role Switching in Register Form
  const roleSelect = document.getElementById('reg-role');
  const patientFields = document.getElementById('patient-specific-fields');
  const doctorFields = document.getElementById('doctor-specific-fields');
  const registerForm = document.getElementById('register-form');

  if (roleSelect && patientFields && doctorFields) {
    const updateRoleFields = () => {
      const isDoctor = roleSelect.value === 'doctor';
      doctorFields.classList.toggle('d-none', !isDoctor);
      patientFields.classList.toggle('d-none', isDoctor);

      // Required is enforced by our JS validator, but keeping the DOM
      // attribute in sync helps assistive technology.
      document.getElementById('reg-specialization').required = isDoctor;
      document.getElementById('reg-license').required = isDoctor;

      clearFormErrors(registerForm);
    };

    roleSelect.addEventListener('change', updateRoleFields);
    updateRoleFields();
  }

  // Handle Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateLoginForm()) {
        showToast('Please fix the highlighted fields.', 'warning');
        return;
      }

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const restoreButton = setButtonLoading(submitBtn, 'Logging in...');
      let shouldRestore = true;

      try {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          skipAuthRedirect: true,
          body: JSON.stringify({
            email: document.getElementById('login-email').value.trim(),
            password: document.getElementById('login-password').value
          })
        });

        const data = await readJson(res);
        if (data.success) {
          shouldRestore = false;
          setToken(data.token);
          setCurrentUser(data.user);
          showToast(`Welcome back, ${data.user.name}!`, 'success');
          setTimeout(() => redirectForRole(data.user.role), 800);
        } else {
          showToast(data.message || 'Login failed. Please check your credentials.', 'danger');
          applyServerErrors(data, LOGIN_FIELD_MAP);
        }
      } catch (error) {
        showToast(error.message || 'Error connecting to server. Is the backend running?', 'danger');
      } finally {
        if (shouldRestore) restoreButton();
      }
    });
  }

  // Handle Register Form
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateRegisterForm()) {
        showToast('Please fix the highlighted fields.', 'warning');
        return;
      }

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const restoreButton = setButtonLoading(submitBtn, 'Creating account...');
      let shouldRestore = true;

      try {
        const res = await apiFetch('/auth/register', {
          method: 'POST',
          skipAuthRedirect: true,
          body: JSON.stringify(buildRegisterPayload())
        });

        const data = await readJson(res);
        if (data.success) {
          shouldRestore = false;
          setToken(data.token);
          setCurrentUser(data.user);
          showToast('Account created successfully!', 'success');
          setTimeout(() => redirectForRole(data.user.role), 800);
        } else {
          showToast(data.message || 'Registration failed.', 'danger');
          applyServerErrors(data, REGISTER_FIELD_MAP);
        }
      } catch (error) {
        showToast(error.message || 'Error communicating with server.', 'danger');
      } finally {
        if (shouldRestore) restoreButton();
      }
    });
  }

  // Quick Demo Login buttons
  document.querySelectorAll('.btn-demo-login').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const role = btn.getAttribute('data-role');
      const restoreButton = setButtonLoading(btn, 'Starting session...');
      let shouldRestore = true;

      try {
        const res = await apiFetch('/auth/quick-demo-login', {
          method: 'POST',
          skipAuthRedirect: true,
          body: JSON.stringify({ role })
        });
        const data = await readJson(res);

        if (data.success) {
          shouldRestore = false;
          setToken(data.token);
          setCurrentUser(data.user);
          showToast(`Signed in as Demo ${String(role).toUpperCase()}: ${data.user.name}`, 'success');
          setTimeout(() => redirectForRole(role), 600);
        } else {
          showToast(data.message || 'Demo login failed.', 'danger');
        }
      } catch (error) {
        showToast(error.message || 'Server connection failed.', 'danger');
      } finally {
        if (shouldRestore) restoreButton();
      }
    });
  });
});
