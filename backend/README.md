# 🩺 CareSync: Patient-Doctor Health Vault & Care Compliance Platform

A full-stack healthcare web application built with **Node.js, Express, MongoDB, Mongoose, Bootstrap 5, CSS, and JavaScript**.

CareSync bridges the gap between clinic visits and home care:
1. **Medical Records Vault**: Patients can upload past and present medical reports (blood tests, X-rays, MRI scans, discharge summaries) in PDF/Image formats.
2. **Clinical Review & Care Plan**: Doctors inspect chronological records, formulate diagnoses, and prescribe medicines along with lifestyle precautions.
3. **Interactive Adherence Checklist**: Prescriptions and precautions are converted into a daily interactive task checklist where patients mark items as **"Done"** or **"To Do Yet"**, giving physicians live compliance tracking.

---

## 🌟 Key Features

### For Patients
- **Medical Records Vault**: Upload and organize reports with category tags (Blood Test, Radiology, Prescription, Discharge Summary, ECG, Pathology).
- **Chronological Timeline**: View, filter, and inspect past and present medical history.
- **Interactive Daily Tasks Checklist**:
  - Live **Adherence Rate (%)** and dynamic progress bar.
  - Check off morning, afternoon, and night medicines.
  - Check off lifestyle precautions (e.g., *Low-sodium diet*, *30-minute walk*, *Measure morning BP*).
  - One-click toggle between **Done** and **To Do Yet**.
- **Physician Advice History**: View detailed diagnosis, dosage instructions, and doctor remarks.
- **Select / Change Primary Doctor**: Connect directly with registered physicians.

### For Doctors
- **Patient Roster**: Filter and view patients with their report counts and real-time adherence scores.
- **Patient 360° Workspace**:
  - Review patient demographics, blood group, and known allergies.
  - Chronological document viewer with one-click full inspection.
  - Live compliance monitor tracking how diligently the patient is following advice.
- **Care Plan & Precaution Builder**:
  - Add multiple medications dynamically (dosage, frequency, morning/afternoon/night toggles, food instructions).
  - Add structured precautions & lifestyle rules (Diet, Vitals, Activity, Hydration).
  - Submitting automatically generates the interactive checklist in the patient's portal.

### Quick Demo Testing
- **1-Click Demo Buttons** on the landing page allow testing both the **Patient** and **Doctor** experiences instantly without manually signing up.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or v20+)
- [MongoDB](https://www.mongodb.com/) (Local Community Server or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)

### Installation & Setup

1. **Navigate to the project directory**:
   ```bash
   cd "C:\Users\dhyan\.gemini\antigravity\scratch\caresync-health-portal"
   ```

2. **Configure Environment Variables**:
   Verify or edit the `.env` file:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGO_URI=mongodb://127.0.0.1:27017/caresync
   JWT_SECRET=caresync_super_secret_jwt_key_2026_secure
   ```
   *(If using MongoDB Atlas, replace `MONGO_URI` with your connection string: `mongodb+srv://<user>:<password>@cluster0.mongodb.net/caresync`)*

3. **Install Dependencies** (already installed in workspace):
   ```bash
   npm install
   ```

4. **(Optional) Seed Demo Data**:
   Populate the database with sample doctors, patients, reports, and active care plans:
   ```bash
   npm run seed
   ```

5. **Start the Application**:
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

6. **Open in Browser**:
   - Web App: [http://localhost:5000](http://localhost:5000)
   - Patient Portal: [http://localhost:5000/patient](http://localhost:5000/patient)
   - Doctor Portal: [http://localhost:5000/doctor](http://localhost:5000/doctor)

---

## 🔐 Demo Credentials

If you ran `npm run seed`:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Doctor** | `doctor.sarah@caresync.com` | `Password123!` |
| **Patient** | `john.patient@caresync.com` | `Password123!` |

*(You can also simply click the "Demo Patient" or "Demo Doctor" buttons on the landing page!)*

---

## 🏗️ Project Architecture

```
caresync-health-portal/
├── server.js               # Express application entrypoint
├── seed.js                 # Database seeder with sample data
├── config/
│   └── db.js               # Resilient Mongoose connection
├── models/
│   ├── User.js             # Patient & Doctor profiles & auth
│   ├── Report.js           # Uploaded medical records metadata
│   ├── Prescription.js     # Prescriptions & precautions
│   └── Task.js             # Interactive daily tasks & compliance status
├── middleware/
│   └── auth.js             # JWT verification, RBAC, Multer file upload
├── controllers/
│   ├── authController.js   # Login, registration, 1-click demo login
│   ├── reportController.js # Medical report upload, list, delete
│   ├── prescriptionController.js # Care plan creation & task auto-generation
│   ├── taskController.js   # Task toggle ('done'/'todo') & adherence stats
│   └── doctorController.js # Patient roster & doctor listings
├── routes/
│   ├── authRoutes.js
│   ├── reportRoutes.js
│   ├── prescriptionRoutes.js
│   ├── taskRoutes.js
│   └── doctorRoutes.js
└── public/
    ├── css/
    │   └── style.css       # Custom styles & health theme
    ├── js/
    │   ├── common.js       # Auth tokens, toasts, date utilities
    │   ├── auth.js         # Login, register, demo handlers
    │   ├── patient.js      # Patient vault, checklist, prescriptions
    │   └── doctor.js       # Doctor roster, review workspace, care plan builder
    ├── uploads/            # Safe storage for uploaded reports (PDF/images)
    ├── index.html          # Landing page & auth modals
    ├── patient-dashboard.html # Patient interface
    └── doctor-dashboard.html  # Doctor clinical workspace
```

---

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` - Create patient or doctor account
- `POST /api/auth/login` - Authenticate & obtain JWT
- `GET /api/auth/me` - Get current session profile
- `POST /api/auth/quick-demo-login` - 1-Click demo sign-in

### Reports
- `POST /api/reports/upload` - Upload PDF/Image report *(Patient)*
- `GET /api/reports/my-reports` - List patient's reports *(Patient)*
- `GET /api/reports/patient/:patientId` - List patient's reports *(Doctor)*
- `DELETE /api/reports/:id` - Delete uploaded report *(Patient)*

### Prescriptions & Care Plans
- `POST /api/prescriptions` - Issue diagnosis, medicines & precautions *(Doctor)*
- `GET /api/prescriptions/my-prescriptions` - View prescriptions *(Patient)*
- `GET /api/prescriptions/patient/:patientId` - Review prescriptions *(Doctor)*

### Interactive Tasks & Adherence
- `GET /api/tasks/my-tasks` - Fetch daily tasks and compliance % *(Patient)*
- `PATCH /api/tasks/:id/toggle` - Toggle task status (`done` / `todo`) *(Patient)*
- `GET /api/tasks/patient/:patientId` - Monitor patient adherence *(Doctor)*
- `POST /api/tasks/create-task` - Assign direct custom task *(Doctor)*
