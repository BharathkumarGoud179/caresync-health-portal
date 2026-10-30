// Shared validation helpers used by controllers.
// Keeping validation here means the API rejects bad input consistently
// instead of relying on Mongoose cast/validation errors (which used to
// surface as HTTP 500 responses).

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+?[0-9][0-9\s().-]{6,19}$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const ROLES = ['patient', 'doctor'];
const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const REPORT_CATEGORIES = [
  'Blood Test',
  'Radiology / X-Ray / Scan',
  'Prescription',
  'Discharge Summary',
  'Pathology',
  'Cardiology / ECG',
  'Other'
];
const FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Thrice daily',
  'Four times daily',
  'As needed (SOS)'
];
const INSTRUCTIONS = ['After food', 'Before food', 'With food', 'At bedtime', 'Empty stomach'];
const PRECAUTION_CATEGORIES = [
  'Diet',
  'Physical Activity',
  'Monitoring / Vitals',
  'Hydration',
  'General Hygiene',
  'Other'
];
const TASK_TYPES = ['Medication', 'Precaution', 'Vital Check', 'Lifestyle & Diet'];
const TASK_TIMINGS = [
  'Morning',
  'Afternoon',
  'Evening',
  'Night',
  'Throughout the day',
  'Anytime'
];
const TASK_STATUSES = ['todo', 'done', 'skipped'];

const asString = (value) => (typeof value === 'string' ? value.trim() : '');

const isObjectId = (value) => typeof value === 'string' && OBJECT_ID_REGEX.test(value);

const isEmail = (value) => typeof value === 'string' && EMAIL_REGEX.test(value.trim());

const isPhone = (value) => typeof value === 'string' && PHONE_REGEX.test(value.trim());

const parseDate = (value) => {
  if (value === undefined || value === null || value === '') return null;

  // Date-only strings come from <input type="date">. Parsing them as local
  // midnight avoids a UTC offset making "today" look like yesterday.
  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim())) {
    const [year, month, day] = value.trim().split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const isRealDate =
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return isRealDate ? date : null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isFutureDate = (date) => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date.getTime() > endOfToday.getTime();
};

// Convert an optional numeric field, pushing a validation error when needed.
const optionalNumber = (raw, field, label, min, max, errors, { integer = false } = {}) => {
  if (raw === undefined || raw === null || raw === '') return undefined;

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    errors.push({ field, message: `${label} must be a valid number.` });
    return undefined;
  }
  if (integer && !Number.isInteger(value)) {
    errors.push({ field, message: `${label} must be a whole number.` });
    return undefined;
  }
  if (value < min || value > max) {
    errors.push({ field, message: `${label} must be between ${min} and ${max}.` });
    return undefined;
  }
  return value;
};

const sendValidationError = (res, errors, message = 'Please correct the highlighted fields.') => {
  return res.status(400).json({ success: false, message, errors });
};

const validateRegistration = (body = {}) => {
  const errors = [];
  const name = asString(body.name);
  const email = asString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const role = asString(body.role) || 'patient';
  const phone = asString(body.phone);

  if (name.length < 2 || name.length > 80) {
    errors.push({ field: 'name', message: 'Name must be between 2 and 80 characters.' });
  }
  if (!isEmail(email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address.' });
  } else if (email.length > 254) {
    errors.push({ field: 'email', message: 'Email address is too long.' });
  }
  if (password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters.' });
  } else if (password.length > 72) {
    errors.push({ field: 'password', message: 'Password must be 72 characters or fewer.' });
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must include at least one letter and one number.' });
  }
  if (!ROLES.includes(role)) {
    errors.push({ field: 'role', message: 'Role must be either patient or doctor.' });
  }
  if (phone && !isPhone(phone)) {
    errors.push({ field: 'phone', message: 'Please enter a valid phone number.' });
  }

  const value = { name, email, password, role, phone: phone || undefined };

  if (role === 'patient') {
    value.age = optionalNumber(body.age, 'age', 'Age', 0, 120, errors, { integer: true });

    const gender = asString(body.gender);
    if (gender && !GENDERS.includes(gender)) {
      errors.push({ field: 'gender', message: 'Please select a valid gender.' });
    }
    value.gender = gender || undefined;

    const bloodGroup = asString(body.bloodGroup);
    if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup)) {
      errors.push({ field: 'bloodGroup', message: 'Please select a valid blood group.' });
    }
    value.bloodGroup = bloodGroup || undefined;

    const allergies = asString(body.allergies);
    if (allergies.length > 300) {
      errors.push({ field: 'allergies', message: 'Allergies must be 300 characters or fewer.' });
    }
    value.allergies = allergies || undefined;
  } else {
    const specialization = asString(body.specialization);
    const licenseNumber = asString(body.licenseNumber);
    const hospital = asString(body.hospital);

    if (specialization.length < 2 || specialization.length > 120) {
      errors.push({ field: 'specialization', message: 'Specialization is required (2-120 characters).' });
    }
    if (licenseNumber.length < 2 || licenseNumber.length > 60) {
      errors.push({ field: 'licenseNumber', message: 'Medical license number is required (2-60 characters).' });
    }
    if (hospital.length > 120) {
      errors.push({ field: 'hospital', message: 'Hospital name must be 120 characters or fewer.' });
    }

    value.specialization = specialization;
    value.licenseNumber = licenseNumber;
    value.hospital = hospital || undefined;
    value.experienceYears = optionalNumber(
      body.experienceYears,
      'experienceYears',
      'Years of practice',
      0,
      70,
      errors,
      { integer: true }
    );
  }

  return { errors, value };
};

const validateLogin = (body = {}) => {
  const errors = [];
  const email = asString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isEmail(email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address.' });
  } else if (email.length > 254) {
    errors.push({ field: 'email', message: 'Email address is too long.' });
  }
  if (!password) {
    errors.push({ field: 'password', message: 'Password is required.' });
  } else if (password.length > 72) {
    errors.push({ field: 'password', message: 'Password must be 72 characters or fewer.' });
  }

  return { errors, value: { email, password } };
};

const validateReport = (body = {}) => {
  const errors = [];
  const title = asString(body.title);
  const category = asString(body.category) || 'Blood Test';
  const labOrHospital = asString(body.labOrHospital);
  const notes = asString(body.notes);

  if (title.length < 2 || title.length > 120) {
    errors.push({ field: 'title', message: 'Report title must be between 2 and 120 characters.' });
  }
  if (!REPORT_CATEGORIES.includes(category)) {
    errors.push({ field: 'category', message: 'Please select a valid report category.' });
  }
  if (labOrHospital.length > 120) {
    errors.push({ field: 'labOrHospital', message: 'Lab or hospital name must be 120 characters or fewer.' });
  }
  if (notes.length > 1000) {
    errors.push({ field: 'notes', message: 'Notes must be 1000 characters or fewer.' });
  }

  let reportDate = parseDate(body.reportDate);
  if (body.reportDate && !reportDate) {
    errors.push({ field: 'reportDate', message: 'Please enter a valid report date.' });
  }
  if (reportDate && isFutureDate(reportDate)) {
    errors.push({ field: 'reportDate', message: 'Report date cannot be in the future.' });
  }
  if (!reportDate) reportDate = new Date();

  return {
    errors,
    value: {
      title,
      category,
      reportDate,
      labOrHospital: labOrHospital || 'General Clinic',
      notes
    }
  };
};

const validateMedications = (raw, errors) => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push({ field: 'medications', message: 'Medications must be a list.' });
    return [];
  }
  if (raw.length > 25) {
    errors.push({ field: 'medications', message: 'You can add at most 25 medications.' });
  }

  return raw
    .filter((item) => item && typeof item === 'object' && asString(item.medicineName))
    .slice(0, 25)
    .map((item) => {
      const medicineName = asString(item.medicineName);
      const dosage = asString(item.dosage) || '1 Tablet';
      const frequency = asString(item.frequency) || 'Once daily';
      const instruction = asString(item.instruction) || 'After food';

      if (medicineName.length > 120) {
        errors.push({ field: 'medications', message: 'Medicine names must be 120 characters or fewer.' });
      }
      if (dosage.length > 60) {
        errors.push({ field: 'medications', message: 'Dosage must be 60 characters or fewer.' });
      }
      if (!FREQUENCIES.includes(frequency)) {
        errors.push({ field: 'medications', message: 'Please select a valid medication frequency.' });
      }
      if (!INSTRUCTIONS.includes(instruction)) {
        errors.push({ field: 'medications', message: 'Please select a valid food instruction.' });
      }

      const timeOfDay = item.timeOfDay && typeof item.timeOfDay === 'object' ? item.timeOfDay : {};
      const durationDays = optionalNumber(
        item.durationDays,
        'medications',
        'Medication duration',
        1,
        365,
        errors,
        { integer: true }
      );

      return {
        medicineName,
        dosage,
        frequency,
        instruction,
        timeOfDay: {
          morning: Boolean(timeOfDay.morning),
          afternoon: Boolean(timeOfDay.afternoon),
          night: Boolean(timeOfDay.night)
        },
        durationDays: durationDays || 7
      };
    });
};

const validatePrecautions = (raw, errors) => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push({ field: 'precautions', message: 'Precautions must be a list.' });
    return [];
  }
  if (raw.length > 25) {
    errors.push({ field: 'precautions', message: 'You can add at most 25 precautions.' });
  }

  return raw
    .filter((item) => item && typeof item === 'object' && asString(item.title))
    .slice(0, 25)
    .map((item) => {
      const title = asString(item.title);
      const description = asString(item.description);
      const category = asString(item.category) || 'General Hygiene';

      if (title.length > 160) {
        errors.push({ field: 'precautions', message: 'Precaution titles must be 160 characters or fewer.' });
      }
      if (description.length > 500) {
        errors.push({ field: 'precautions', message: 'Precaution descriptions must be 500 characters or fewer.' });
      }
      if (!PRECAUTION_CATEGORIES.includes(category)) {
        errors.push({ field: 'precautions', message: 'Please select a valid precaution category.' });
      }

      return { title, description, category };
    });
};

const validatePrescription = (body = {}) => {
  const errors = [];
  const patientId = asString(body.patientId);
  const diagnosis = asString(body.diagnosis);
  const clinicalNotes = asString(body.clinicalNotes);

  if (!isObjectId(patientId)) {
    errors.push({ field: 'patientId', message: 'Please select a valid patient.' });
  }
  if (diagnosis.length < 2 || diagnosis.length > 200) {
    errors.push({ field: 'diagnosis', message: 'Diagnosis must be between 2 and 200 characters.' });
  }
  if (clinicalNotes.length > 2000) {
    errors.push({ field: 'clinicalNotes', message: 'Clinical notes must be 2000 characters or fewer.' });
  }

  let followUpDate = null;
  if (body.followUpDate) {
    followUpDate = parseDate(body.followUpDate);
    if (!followUpDate) {
      errors.push({ field: 'followUpDate', message: 'Please enter a valid follow-up date.' });
    } else {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (followUpDate < startOfToday) {
        errors.push({ field: 'followUpDate', message: 'Follow-up date cannot be in the past.' });
      }
    }
  }

  const medications = validateMedications(body.medications, errors);
  const precautions = validatePrecautions(body.precautions, errors);
  if (medications.length === 0 && precautions.length === 0) {
    errors.push({
      field: 'medications',
      message: 'Add at least one medication or precaution to the care plan.'
    });
  }

  return {
    errors,
    value: {
      patientId,
      diagnosis,
      clinicalNotes,
      medications,
      precautions,
      followUpDate
    }
  };
};

const validateDirectTask = (body = {}) => {
  const errors = [];
  const patientId = asString(body.patientId);
  const title = asString(body.title);
  const description = asString(body.description);
  const taskType = asString(body.taskType) || 'Precaution';
  const timing = asString(body.timing) || 'Throughout the day';

  if (!isObjectId(patientId)) {
    errors.push({ field: 'patientId', message: 'Please select a valid patient.' });
  }
  if (title.length < 2 || title.length > 160) {
    errors.push({ field: 'title', message: 'Task title must be between 2 and 160 characters.' });
  }
  if (description.length > 500) {
    errors.push({ field: 'description', message: 'Task description must be 500 characters or fewer.' });
  }
  if (!TASK_TYPES.includes(taskType)) {
    errors.push({ field: 'taskType', message: 'Please select a valid task type.' });
  }
  if (!TASK_TIMINGS.includes(timing)) {
    errors.push({ field: 'timing', message: 'Please select a valid task timing.' });
  }

  return { errors, value: { patientId, title, description, taskType, timing } };
};

const validateTaskStatus = (status) => TASK_STATUSES.includes(status);

module.exports = {
  ROLES,
  GENDERS,
  BLOOD_GROUPS,
  REPORT_CATEGORIES,
  FREQUENCIES,
  INSTRUCTIONS,
  PRECAUTION_CATEGORIES,
  TASK_TYPES,
  TASK_TIMINGS,
  TASK_STATUSES,
  asString,
  isObjectId,
  isEmail,
  isPhone,
  parseDate,
  sendValidationError,
  validateRegistration,
  validateLogin,
  validateReport,
  validatePrescription,
  validateDirectTask,
  validateTaskStatus
};
