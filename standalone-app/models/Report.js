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
      trim: true
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
      default: 'Unknown Clinic/Lab'
    },
    notes: {
      type: String,
      trim: true
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
    },
    aiAnalysis: {
      analyzedAt: { type: Date },
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
      },
      summary: { type: String, default: '' },
      overallRiskScore: {
        type: String,
        enum: ['Low', 'Moderate', 'High', 'Critical'],
        default: 'Low'
      },
      confidenceScore: { type: Number, default: 95 },
      keyBiomarkers: [
        {
          name: { type: String, required: true },
          value: { type: String, required: true },
          unit: { type: String, default: '' },
          referenceRange: { type: String, default: '' },
          status: {
            type: String,
            enum: ['Normal', 'High', 'Low', 'Critical', 'Attention'],
            default: 'Normal'
          },
          explanation: { type: String, default: '' }
        }
      ],
      clinicalInsights: [{ type: String }],
      lifestyleRecommendations: [{ type: String }],
      questionsForDoctor: [{ type: String }]
    }
  },
  {
    timestamps: true
  }
);

// Index by patient and reportDate for quick chronological sorting
reportSchema.index({ patient: 1, reportDate: -1 });

module.exports = mongoose.model('Report', reportSchema);
