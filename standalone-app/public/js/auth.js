// Authentication Logic & Strict Client-Side Form Validation

document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in, redirect accordingly
  const user = getCurrentUser();
  const token = getToken();

  if (user && token && window.location.pathname === '/') {
    if (user.role === 'patient') {
      window.location.href = '/patient';
    } else if (user.role === 'doctor') {
      window.location.href = '/doctor';
    }
  }

  // Handle Role Switching in Register Form
  const roleSelect = document.getElementById('reg-role');
  const patientFields = document.getElementById('patient-specific-fields');
  const doctorFields = document.getElementById('doctor-specific-fields');
  const ageInput = document.getElementById('reg-age');

  if (roleSelect) {
    roleSelect.addEventListener('change', () => {
      if (roleSelect.value === 'doctor') {
        doctorFields.classList.remove('d-none');
        patientFields.classList.add('d-none');
        if (ageInput) ageInput.removeAttribute('required');
      } else {
        patientFields.classList.remove('d-none');
        doctorFields.classList.add('d-none');
        if (ageInput) ageInput.setAttribute('required', 'true');
      }
    });
  }

  // Live Password Validation Indicators
  const passwordInput = document.getElementById('reg-password');
  const ruleLength = document.getElementById('rule-length');
  const ruleLetter = document.getElementById('rule-letter');
  const ruleNumber = document.getElementById('rule-number');
  const ruleSpecial = document.getElementById('rule-special');

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      const isLength = val.length >= 8;
      const isLetter = /[a-zA-Z]/.test(val);
      const isNumber = /[0-9]/.test(val);
      const isSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(val);

      updateRule(ruleLength, isLength);
      updateRule(ruleLetter, isLetter);
      updateRule(ruleNumber, isNumber);
      updateRule(ruleSpecial, isSpecial);

      if (isLength && isLetter && isNumber && isSpecial) {
        passwordInput.classList.remove('is-invalid');
        passwordInput.classList.add('is-valid');
      } else {
        passwordInput.classList.remove('is-valid');
        if (val.length > 0) passwordInput.classList.add('is-invalid');
      }
    });
  }

  function updateRule(elem, isValid) {
    if (!elem) return;
    if (isValid) {
      elem.classList.remove('text-muted', 'text-danger');
      elem.classList.add('text-success');
      const icon = elem.querySelector('i');
      if (icon) icon.className = 'bi bi-check-circle-fill me-1';
    } else {
      elem.classList.remove('text-success');
      elem.classList.add('text-muted');
      const icon = elem.querySelector('i');
      if (icon) icon.className = 'bi bi-circle me-1';
    }
  }

  // Live Phone Validation (Exactly 10 numbers)
  const phoneInput = document.getElementById('reg-phone');
  if (phoneInput) {
    // Only allow numbers to be typed
    phoneInput.addEventListener('input', (e) => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
      if (phoneInput.value.length === 10) {
        phoneInput.classList.remove('is-invalid');
        phoneInput.classList.add('is-valid');
      } else {
        phoneInput.classList.remove('is-valid');
        if (phoneInput.value.length > 0) phoneInput.classList.add('is-invalid');
      }
    });
  }

  // Live Age Validation (Positive integer only, > 0)
  if (ageInput) {
    ageInput.addEventListener('input', () => {
      const val = Number(ageInput.value);
      if (!isNaN(val) && val > 0 && val <= 120) {
        ageInput.classList.remove('is-invalid');
        ageInput.classList.add('is-valid');
      } else {
        ageInput.classList.remove('is-valid');
        if (ageInput.value !== '') ageInput.classList.add('is-invalid');
      }
    });
  }

  // Handle Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (data.success) {
          setToken(data.token);
          setCurrentUser(data.user);
          showToast(`Welcome, ${data.user.name}!`, 'success');
          setTimeout(() => {
            if (data.user.role === 'doctor') {
              window.location.href = '/doctor';
            } else {
              window.location.href = '/patient';
            }
          }, 600);
        } else {
          showToast(data.message || 'Login failed. Please check your credentials.', 'danger');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>Sign In';
        }
      } catch (err) {
        showToast('Error connecting to server.', 'danger');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>Sign In';
      }
    });
  }

  // Handle Register Form with Strict Validation
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = document.getElementById('reg-role').value;
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const phone = document.getElementById('reg-phone').value.trim();
      const ageVal = document.getElementById('reg-age') ? document.getElementById('reg-age').value : '';

      // 1. Strict Phone Check
      if (!/^\d{10}$/.test(phone)) {
        showToast('Phone number must be exactly 10 digits (digits only).', 'warning');
        if (phoneInput) {
          phoneInput.focus();
          phoneInput.classList.add('is-invalid');
        }
        return;
      }

      // 2. Strict Age Check (for patient)
      if (role === 'patient') {
        const ageNum = Number(ageVal);
        if (isNaN(ageNum) || ageNum <= 0) {
          showToast('Age cannot be zero or negative. Please enter a valid age (e.g. 1 to 120).', 'warning');
          if (ageInput) {
            ageInput.focus();
            ageInput.classList.add('is-invalid');
          }
          return;
        }
        if (ageNum > 120) {
          showToast('Age cannot exceed 120.', 'warning');
          if (ageInput) ageInput.focus();
          return;
        }
      }

      // 3. Strict Password Check
      if (password.length < 8) {
        showToast('Password must be at least 8 characters long.', 'warning');
        if (passwordInput) passwordInput.focus();
        return;
      }
      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
      if (!hasLetter || !hasNumber || !hasSpecial) {
        showToast('Password must contain letters, numbers, and at least one special character.', 'warning');
        if (passwordInput) passwordInput.focus();
        return;
      }

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating Account...';

      const payload = {
        name,
        email,
        password,
        phone,
        role
      };

      if (role === 'patient') {
        payload.age = Number(ageVal);
        payload.gender = document.getElementById('reg-gender').value;
        payload.bloodGroup = document.getElementById('reg-blood-group').value;
        payload.allergies = document.getElementById('reg-allergies').value.trim();
      } else {
        payload.specialization = document.getElementById('reg-specialization').value.trim();
        payload.hospital = document.getElementById('reg-hospital').value.trim();
        payload.licenseNumber = document.getElementById('reg-license').value.trim();
        payload.experienceYears = document.getElementById('reg-experience').value || undefined;
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          setToken(data.token);
          setCurrentUser(data.user);
          showToast('Account registered successfully!', 'success');
          setTimeout(() => {
            if (data.user.role === 'doctor') {
              window.location.href = '/doctor';
            } else {
              window.location.href = '/patient';
            }
          }, 600);
        } else {
          showToast(data.message || 'Registration failed.', 'danger');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="bi bi-person-check me-1"></i>Create Account';
        }
      } catch (err) {
        showToast('Server communication error.', 'danger');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-person-check me-1"></i>Create Account';
      }
    });
  }
});
