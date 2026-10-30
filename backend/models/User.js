const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name must be 80 characters or fewer']
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email address is too long'],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      maxlength: [72, 'Password must be 72 characters or fewer'],
      select: false
    },
    role: {
      type: String,
      enum: ['patient', 'doctor'],
      required: [true, 'Please specify a role (patient or doctor)'],
      default: 'patient'
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number is too long'],
      match: [/^\+?[0-9][0-9\s().-]{6,19}$/, 'Please provide a valid phone number']
    },
    // Patient Specific Details
    age: {
      type: Number,
      min: [0, 'Age cannot be negative'],
      max: [120, 'Age cannot exceed 120']
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', '']
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']
    },
    allergies: {
      type: String,
      trim: true,
      maxlength: [300, 'Allergies must be 300 characters or fewer'],
      default: 'None reported'
    },
    assignedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Doctor Specific Details
    specialization: {
      type: String,
      trim: true,
      maxlength: [120, 'Specialization must be 120 characters or fewer'],
      default: 'General Physician'
    },
    licenseNumber: {
      type: String,
      trim: true,
      maxlength: [60, 'License number must be 60 characters or fewer']
    },
    hospital: {
      type: String,
      trim: true,
      maxlength: [120, 'Hospital name must be 120 characters or fewer']
    },
    experienceYears: {
      type: Number,
      min: [0, 'Years of practice cannot be negative'],
      max: [70, 'Years of practice cannot exceed 70']
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
