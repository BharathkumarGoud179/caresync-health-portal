const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Helper to generate JWT and send cookie
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'caresync_super_secret_jwt_key_2026_secure',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: false,
    sameSite: 'lax'
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
        gender: user.gender,
        phone: user.phone
      }
    });
};

// @desc    Register a new user (Patient or Doctor) with Strict Validation
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      age,
      gender,
      bloodGroup,
      allergies,
      specialization,
      licenseNumber,
      hospital,
      experienceYears
    } = req.body;

    // 1. Check required fields
    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and phone number.'
      });
    }

    // 2. Strict Phone Number Validation: Exactly 10 digits
    const cleanedPhone = phone.toString().trim();
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be exactly 10 digits (numbers only, no spaces or symbols).'
      });
    }

    // 3. Strict Age Validation: cannot be negative or zero
    if (role === 'patient') {
      if (age === undefined || age === null || age === '') {
        return res.status(400).json({
          success: false,
          message: 'Please provide patient age.'
        });
      }
      const parsedAge = Number(age);
      if (isNaN(parsedAge) || parsedAge <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Age cannot be zero, negative, or invalid. Please enter a valid age (e.g. 1 to 120).'
        });
      }
      if (parsedAge > 120) {
        return res.status(400).json({
          success: false,
          message: 'Age cannot exceed 120 years.'
        });
      }
    }

    // 4. Strict Password Validation:
    // At least 8 characters, mix of letters, numbers, and special characters
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);

    if (!hasLetter || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain a mix of letters, numbers, and at least one special character (!@#$%^&* etc.).'
      });
    }

    // 5. Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in.'
      });
    }

    // 6. Create User
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role || 'patient',
      phone: cleanedPhone,
      age: role === 'patient' ? Number(age) : undefined,
      gender,
      bloodGroup,
      allergies,
      specialization,
      licenseNumber,
      hospital,
      experienceYears: experienceYears ? Number(experienceYears) : undefined
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while registering user'
    });
  }
};

// @desc    Log in user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('assignedDoctor', 'name specialization hospital email');
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Log out user / Clear cookie
// @route   GET /api/auth/logout
exports.logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};
