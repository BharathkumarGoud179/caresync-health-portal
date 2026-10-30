const User = require('../models/User');
const jwt = require('jsonwebtoken');
const {
  sendValidationError,
  validateRegistration,
  validateLogin,
  ROLES
} = require('../utils/validation');

const getJwtSecret = () =>
  process.env.JWT_SECRET || 'caresync_super_secret_jwt_key_2026_secure';

// Helper to generate JWT and send cookie
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        specialization: user.specialization,
        bloodGroup: user.bloodGroup,
        age: user.age,
        gender: user.gender
      }
    });
};

// @desc    Register a new user (Patient or Doctor)
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { errors, value } = validateRegistration(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const existingUser = await User.findOne({ email: value.email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const userData = {
      name: value.name,
      email: value.email,
      password: value.password,
      role: value.role,
      phone: value.phone
    };

    if (value.role === 'patient') {
      userData.age = value.age;
      userData.gender = value.gender;
      userData.bloodGroup = value.bloodGroup;
      userData.allergies = value.allergies;
    } else {
      userData.specialization = value.specialization;
      userData.licenseNumber = value.licenseNumber;
      userData.hospital = value.hospital;
      userData.experienceYears = value.experienceYears;
    }

    const user = await User.create(userData);
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Log in user
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { errors, value } = validateLogin(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const user = await User.findOne({ email: value.email }).select('+password');

    // Use the same message for unknown email and wrong password so the API
    // does not reveal which accounts exist.
    if (!user || !(await user.matchPassword(value.password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate(
      'assignedDoctor',
      'name specialization hospital email'
    );
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log out user / Clear cookie
// @route   POST /api/auth/logout
exports.logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

const DEMO_ACCOUNTS = {
  patient: {
    email: 'john.patient@caresync.com',
    name: 'John Doe',
    password: 'Password123!',
    role: 'patient',
    age: 42,
    gender: 'Male',
    bloodGroup: 'O+',
    allergies: 'Penicillin, Shellfish',
    phone: '+1 (555) 987-6543'
  },
  doctor: {
    email: 'doctor.sarah@caresync.com',
    name: 'Dr. Sarah Mitchell, MD',
    password: 'Password123!',
    role: 'doctor',
    specialization: 'Internal Medicine & Cardiology',
    hospital: 'City Central Multispeciality Hospital',
    licenseNumber: 'MD-89241',
    experienceYears: 12,
    phone: '+1 (555) 234-5678'
  }
};

// @desc    Quick demo credentials seeder for 1-click test
// @route   POST /api/auth/quick-demo-login
exports.quickDemoLogin = async (req, res, next) => {
  try {
    const role = req.body && req.body.role;
    if (!ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Demo role must be either patient or doctor.'
      });
    }

    const demo = DEMO_ACCOUNTS[role];
    let demoUser = await User.findOne({ email: demo.email });

    if (demoUser && demoUser.role !== role) {
      return res.status(409).json({
        success: false,
        message: 'The demo account is misconfigured. Please run npm run seed again.'
      });
    }

    if (!demoUser) {
      demoUser = await User.create(demo);
    }

    // Make the demo patient usable end-to-end by linking a demo doctor.
    if (role === 'patient' && !demoUser.assignedDoctor) {
      const demoDoctor = await User.findOne({
        email: DEMO_ACCOUNTS.doctor.email,
        role: 'doctor'
      });
      if (demoDoctor) {
        demoUser.assignedDoctor = demoDoctor._id;
        await demoUser.save();
      }
    }

    sendTokenResponse(demoUser, 200, res);
  } catch (error) {
    next(error);
  }
};
