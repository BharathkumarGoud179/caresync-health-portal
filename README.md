# CareSync Health Portal

Patient–doctor medical records and care-compliance platform.

The project is split into two independent apps:

| Folder      | Stack                                          | Default URL             |
| ----------- | ---------------------------------------------- | ----------------------- |
| `backend/`  | Node.js, Express, MongoDB (Mongoose), JWT      | http://localhost:5000   |
| `frontend/` | React 18, Vite 5, React Router 6, Bootstrap 5  | http://localhost:5173   |

Each folder has its own `package.json`, dependencies, and `node_modules`. The
React app talks to the API over HTTP; nothing is imported across the folders.

## Prerequisites

- Node.js 18+
- npm
- A MongoDB database (local or MongoDB Atlas)

## 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` from `backend/.env.example` and fill in your values:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/caresync
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
UPLOAD_PATH=public/uploads
```

Seed the demo doctor/patient and sample data (optional but recommended):

```bash
npm run seed
```

Run it:

```bash
npm start        # production-style start
npm run dev      # nodemon, restarts on file changes
```

The API is served at `http://localhost:5000/api`. Uploaded reports are served
from `http://localhost:5000/uploads/...`.

`backend/public/` still contains the original server-rendered frontend. It is
kept so nothing is lost and remains reachable at `http://localhost:5000/`,
`/patient`, and `/doctor`. The React app in `frontend/` is the active frontend.

### Demo accounts

| Role    | Email                        | Password      |
| ------- | ---------------------------- | ------------- |
| Doctor  | `doctor.sarah@caresync.com`  | `Password123!` |
| Patient | `john.patient@caresync.com`  | `Password123!` |

The landing page also has one-click “Launch as Demo Patient/Doctor” buttons,
which use `POST /api/auth/quick-demo-login` and need no password.

## 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

`vite.config.js` proxies `/api` and `/uploads` to `http://localhost:5000`, so
the browser sees one origin during development. To point the proxy at another
backend, create `frontend/.env`:

```env
VITE_PROXY_TARGET=http://localhost:5000
```

Build for production:

```bash
npm run build     # output in frontend/dist
npm run preview   # serve the production build locally
```

When the built frontend is hosted on a different origin than the API, set the
following at build time instead of relying on the dev proxy:

```env
VITE_API_BASE_URL=https://api.example.com/api
VITE_ASSET_ORIGIN=https://api.example.com
```

## Project structure

```
caresync-health-portal/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── doctorController.js
│   │   ├── prescriptionController.js
│   │   ├── reportController.js
│   │   └── taskController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── Prescription.js
│   │   ├── Report.js
│   │   ├── Task.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── doctorRoutes.js
│   │   ├── prescriptionRoutes.js
│   │   ├── reportRoutes.js
│   │   └── taskRoutes.js
│   ├── utils/
│   │   └── validation.js
│   ├── public/                 # original vanilla frontend + uploaded files
│   │   ├── css/
│   │   ├── img/
│   │   ├── js/
│   │   ├── uploads/
│   │   ├── index.html
│   │   ├── patient-dashboard.html
│   │   └── doctor-dashboard.html
│   ├── .env                    # local config (not committed)
│   ├── .env.example
│   ├── package.json
│   ├── seed.js
│   └── server.js
├── frontend/
│   ├── public/
│   │   └── img/
│   │       ├── favicon.svg
│   │       ├── hero-illustration.svg
│   │       └── logo.svg
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js       # fetch wrapper, token + asset helpers
│   │   ├── components/
│   │   │   ├── doctor/
│   │   │   ├── landing/
│   │   │   ├── patient/
│   │   │   ├── FieldError.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── PageLoader.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── ToastContext.jsx
│   │   ├── hooks/
│   │   │   └── useRequireRole.js
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── PatientDashboard.jsx
│   │   │   └── DoctorDashboard.jsx
│   │   ├── styles/
│   │   │   └── style.css
│   │   ├── utils/
│   │   │   ├── format.js
│   │   │   └── validation.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## Routes

React frontend:

- `/` — landing page, live simulator, sign-in/register modals
- `/patient` — patient portal (tasks, reports vault, prescriptions)
- `/doctor` — doctor workspace (roster, reports, care plan, compliance)

The role guard calls `GET /api/auth/me` on load and redirects users who are not
signed in, or who open the other role’s dashboard.

## Notes

- Sessions use the same `caresync_token` / `caresync_user` localStorage keys as
  the original frontend, so existing sessions keep working.
- The backend enables CORS, so the separately hosted React app can call the API
  with `Authorization: Bearer <token>`.
- Both apps are independent: install and run commands from their own folders.
