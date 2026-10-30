const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Please provide a title for the report'],
      trim: true,
      minlength: [2, 'Report title must be at least 2 characters'],
      maxlength: [120, 'Report title must be 120 characters or fewer']
    },
    category: {
      type: String,
      enum: [
        'Blood Test',
        'Radiology / X-Ray / Scan',
        'Prescription',
        'Discharge Summary',
        'Pathology',
        'Cardiology / ECG',
        'Other'
      ],
      default: 'Blood Test'
    },
    reportDate: {
      type: Date,
      required: [true, 'Please provide the date of the test/report'],
      default: Date.now
    },
    labOrHospital: {
      type: String,
      trim: true,
      maxlength: [120, 'Lab or hospital name must be 120 characters or fewer'],
      default: 'Unknown Clinic/Lab'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes must be 1000 characters or fewer']
    },
    fileName: {
      type: String,
      required: true
    },
    originalName: {
      type: String
    },
    filePath: {
      type: String,
      required: true
    },
    fileType: {
      type: String
    },
    fileSize: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

// Index by patient and reportDate for quick chronological sorting
reportSchema.index({ patient: 1, reportDate: -1 });

module.exports = mongoose.model('Report', reportSchema);
