const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const Report = require('./models/Report');
const Prescription = require('./models/Prescription');
const Task = require('./models/Task');
const ConnectionRequest = require('./models/ConnectionRequest');
const Notification = require('./models/Notification');
const { analyzeMedicalReport } = require('./utils/aiLabAnalyzer');

dotenv.config();

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create a dummy sample PDF / text file if none exists
const sampleFilePath = path.join(uploadDir, 'sample-blood-test.pdf');
if (!fs.existsSync(sampleFilePath)) {
  fs.writeFileSync(sampleFilePath, '%PDF-1.4\n% Sample CareSync Medical Report Document\nPatient: John Doe\nTest: Complete Blood Count\nHemoglobin: 14.2 g/dL\nWBC: 6,800 /mcL\nPlatelets: 240,000 /mcL\nStatus: Normal\n%%EOF');
}

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/caresync';
    console.log(`Connecting to database at ${mongoUri}...`);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected! Seeding initial data...');

    // Clear existing data
    await User.deleteMany({});
    await Report.deleteMany({});
    await Prescription.deleteMany({});
    await Task.deleteMany({});
    await ConnectionRequest.deleteMany({});
    await Notification.deleteMany({});

    // 1. Create Doctors
    const doctor = await User.create({
      name: 'Dr. Sarah Mitchell, MD',
      email: 'doctor.sarah@caresync.com',
      password: 'Password123!',
      role: 'doctor',
      specialization: 'Internal Medicine & Cardiology',
      hospital: 'City Central Multispeciality Hospital',
      licenseNumber: 'MD-89241',
      experienceYears: 12,
      phone: '9876543210'
    });

    const doctor2 = await User.create({
      name: 'Dr. David Chen, MD',
      email: 'doctor.chen@caresync.com',
      password: 'Password123!',
      role: 'doctor',
      specialization: 'Pulmonology & General Medicine',
      hospital: 'Metro Care Health Institute',
      licenseNumber: 'MD-74102',
      experienceYears: 9,
      phone: '9876543211'
    });

    // 2. Create Patients
    const patient1 = await User.create({
      name: 'John Doe',
      email: 'john.patient@caresync.com',
      password: 'Password123!',
      role: 'patient',
      age: 42,
      gender: 'Male',
      bloodGroup: 'O+',
      allergies: 'Penicillin, Shellfish',
      phone: '9876543212',
      assignedDoctor: doctor._id
    });

    const patient2 = await User.create({
      name: 'Emma Watson',
      email: 'emma.patient@caresync.com',
      password: 'Password123!',
      role: 'patient',
      age: 29,
      gender: 'Female',
      bloodGroup: 'B+',
      allergies: 'Aspirin',
      phone: '9876543213'
    });

    // Create Connection Requests:
    // 1. Patient 1 (John Doe) has an ACCEPTED connection with Dr. Sarah Mitchell
    await ConnectionRequest.create({
      patient: patient1._id,
      doctor: doctor._id,
      status: 'accepted',
      message: 'Routine health checkup consultation and record sharing.',
      respondedAt: new Date()
    });

    // 2. Patient 2 (Emma Watson) has a PENDING connection invitation for Dr. Sarah Mitchell
    await ConnectionRequest.create({
      patient: patient2._id,
      doctor: doctor._id,
      status: 'pending',
      message: 'Hello Dr. Mitchell, requesting clinical consultation for recurring migraine headaches.'
    });

    // 3. Create Sample Medical Reports for Patient 1
    const report1 = await Report.create({
      patient: patient1._id,
      title: 'Comprehensive Metabolic Panel (CMP)',
      category: 'Blood Test',
      reportDate: new Date('2026-08-15'),
      labOrHospital: 'Quest Diagnostics',
      notes: 'Fasting test conducted for routine cardiovascular checkup.',
      fileName: 'sample-blood-test.pdf',
      originalName: 'CMP_August_2026.pdf',
      filePath: '/uploads/sample-blood-test.pdf',
      fileType: 'application/pdf',
      fileSize: 45020
    });

    const report2 = await Report.create({
      patient: patient1._id,
      title: 'Chest X-Ray (PA View)',
      category: 'Radiology / X-Ray / Scan',
      reportDate: new Date('2026-09-02'),
      labOrHospital: 'City Central Radiology Unit',
      notes: 'Clear lung fields, normal cardiothoracic ratio.',
      fileName: 'sample-blood-test.pdf',
      originalName: 'Chest_XRay_Sept_2026.pdf',
      filePath: '/uploads/sample-blood-test.pdf',
      fileType: 'application/pdf',
      fileSize: 92300
    });

    const report3 = await Report.create({
      patient: patient1._id,
      title: 'Lipid & Cholesterol Profile',
      category: 'Blood Test',
      reportDate: new Date('2026-10-10'),
      labOrHospital: 'Apollo Diagnostics',
      notes: 'Total cholesterol slightly elevated at 215 mg/dL. Fasting glucose: 106 mg/dL.',
      fileName: 'sample-blood-test.pdf',
      originalName: 'Lipid_Profile_Oct_2026.pdf',
      filePath: '/uploads/sample-blood-test.pdf',
      fileType: 'application/pdf',
      fileSize: 38400
    });

    // Run AI analysis on reports
    report1.aiAnalysis = await analyzeMedicalReport(report1);
    await report1.save();
    report3.aiAnalysis = await analyzeMedicalReport(report3);
    await report3.save();

    // 4. Create Prescription & Precautions from Doctor for Patient 1
    const prescription = await Prescription.create({
      patient: patient1._id,
      doctor: doctor._id,
      diagnosis: 'Stage 1 Essential Hypertension & Borderline Hyperlipidemia',
      clinicalNotes: 'Blood pressure reading at clinic was 138/88 mmHg. Advised lifestyle modifications, daily sodium restrictions, and 30-day medication.',
      followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      medications: [
        {
          medicineName: 'Amlodipine 5mg',
          dosage: '1 Tablet',
          frequency: 'Once daily',
          timeOfDay: { morning: true, afternoon: false, night: false },
          instruction: 'After food',
          durationDays: 30
        },
        {
          medicineName: 'Atorvastatin 10mg',
          dosage: '1 Tablet',
          frequency: 'Once daily',
          timeOfDay: { morning: false, afternoon: false, night: true },
          instruction: 'At bedtime',
          durationDays: 30
        }
      ],
      precautions: [
        {
          title: 'Strict Low-Sodium Diet (Under 2g salt/day)',
          category: 'Diet',
          description: 'Avoid processed snacks, canned foods, extra table salt, and deep-fried items.'
        },
        {
          title: 'Daily Morning Blood Pressure Check',
          category: 'Monitoring / Vitals',
          description: 'Measure and record resting sitting BP before having morning tea or medications.'
        },
        {
          title: '30-Minute Brisk Walking',
          category: 'Physical Activity',
          description: 'Moderate aerobic walking 5 days a week.'
        }
      ]
    });

    // 5. Generate Initial Actionable Care Tasks with mixed statuses (Done & To Do Yet)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Task.create([
      {
        patient: patient1._id,
        doctor: doctor._id,
        prescription: prescription._id,
        taskType: 'Medication',
        title: 'Take Amlodipine 5mg (1 Tablet)',
        description: 'After food - Morning dosage for blood pressure.',
        timing: 'Morning',
        targetDate: today,
        status: 'done',
        completedAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
      },
      {
        patient: patient1._id,
        doctor: doctor._id,
        prescription: prescription._id,
        taskType: 'Vital Check',
        title: 'Daily Morning Blood Pressure Check',
        description: 'Measure and record resting sitting BP before having morning tea.',
        timing: 'Morning',
        targetDate: today,
        status: 'done',
        completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        patientFeedback: 'BP reading was 126/82 mmHg.'
      },
      {
        patient: patient1._id,
        doctor: doctor._id,
        prescription: prescription._id,
        taskType: 'Medication',
        title: 'Take Atorvastatin 10mg (1 Tablet)',
        description: 'At bedtime - Night dosage for cholesterol management.',
        timing: 'Night',
        targetDate: today,
        status: 'todo'
      },
      {
        patient: patient1._id,
        doctor: doctor._id,
        prescription: prescription._id,
        taskType: 'Precaution',
        title: 'Strict Low-Sodium Diet (Under 2g salt/day)',
        description: 'Avoid processed snacks, canned foods, extra table salt, and deep-fried items.',
        timing: 'Throughout the day',
        targetDate: today,
        status: 'todo'
      },
      {
        patient: patient1._id,
        doctor: doctor._id,
        prescription: prescription._id,
        taskType: 'Lifestyle & Diet',
        title: '30-Minute Brisk Walking',
        description: 'Moderate aerobic walking 5 days a week in the evening.',
        timing: 'Evening',
        targetDate: today,
        status: 'todo'
      }
    ]);

    // 6. Seed In-App Notifications
    await Notification.create([
      {
        recipient: patient1._id,
        sender: doctor._id,
        type: 'invite_accepted',
        title: 'Connection Request Accepted',
        message: `Dr. ${doctor.name} accepted your connection invitation. Your health vault is now securely linked.`,
        link: '/patient',
        read: false
      },
      {
        recipient: patient1._id,
        sender: doctor._id,
        type: 'new_prescription',
        title: 'New Care Plan Prescribed',
        message: `Dr. ${doctor.name} issued a new care plan for "${prescription.diagnosis}". Daily care tasks have been assigned.`,
        link: '/patient',
        read: false
      },
      {
        recipient: patient1._id,
        sender: null,
        type: 'ai_analysis_ready',
        title: 'AI Lab Analysis Ready',
        message: 'AI Diagnostic Pipeline completed review of your Lipid & Cholesterol Profile. 1 borderline biomarker flagged.',
        link: '/patient',
        read: false
      },
      {
        recipient: doctor._id,
        sender: patient2._id,
        type: 'invite_received',
        title: 'New Patient Invitation',
        message: `${patient2.name} sent you an invitation request for medical consultation and health vault review.`,
        link: '/doctor',
        read: false
      }
    ]);

    console.log(`
✅ Database seeding completed successfully!
--------------------------------------------------
🩺 Doctor Account:
   Email:    doctor.sarah@caresync.com
   Password: Password123!

🧑‍🦱 Patient Account:
   Email:    john.patient@caresync.com
   Password: Password123!
--------------------------------------------------
Login with your registered credentials or sign up directly through the portal!
`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error.message);
    process.exit(1);
  }
};

seedDatabase();
