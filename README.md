# 🏥 MediSync Clinic Management & Telehealth System

MediSync is a modern, premium full-stack Clinic Management & Telehealth System designed for doctors, staff, and patients. It offers automated practice workflows, real-time analytics, digital prescribing, interactive calendar schedulers, AI symptom assistance, and clinic billing.

---

## 🚀 Live Production Deployment (Vercel)

This project is configured for direct, one-click deployments on **Vercel**.

### Configuration Highlights
- **Vercel Config**: Defined in [vercel.json](file:///c:/Users/amitb/OneDrive/Desktop/medisync/vercel.json) at the project root.
- **React Frontend**: Built statically via `@vercel/static-build` inside [client/](file:///c:/Users/amitb/OneDrive/Desktop/medisync/client).
- **Express Backend API**: Compiled into a serverless function via `@vercel/node` inside [server/](file:///c:/Users/amitb/OneDrive/Desktop/medisync/server).
- **Stateless Adaptability**: Operates out of `/tmp/db.json` (lowdb local copy) and `/tmp/uploads` automatically when deployed on serverless environments to prevent read-only filesystem crash errors.

---

## 🛠️ Technology Stack & Security
- **Frontend**: React (Vite, HSL theme systems, light/dark modes, custom print layouts).
- **Backend**: Express, Node.js.
- **Database**: Dual-engine persistence layer:
  - **Production Mode**: MongoDB (using Mongoose schemas).
  - **Local/Demo Fallback Mode**: lowdb (persistent JSON file).
- **Security Middleware**: 
  - `bcryptjs` password hashing.
  - `jsonwebtoken` (JWT) authorization guards on routes.
  - `helmet` HTTP secure headers protection.
  - `express-rate-limit` prevention against brute-force attacks on login paths.
- **Cloud Storage**: Integrates Cloudinary for client document uploads in production.

---

## ⚙️ Environment Variables

Copy the [example environment template](file:///c:/Users/amitb/OneDrive/Desktop/medisync/.env.example) to configure secrets:
```bash
cp .env.example .env
```

| Key | Description | Production Requirement |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` or `production` | Recommended `production` |
| `PORT` | Local Express listening port (Default `5000`) | Optional |
| `JWT_SECRET` | Secret key used to encrypt and sign JWT session tokens | **Mandatory** |
| `MONGODB_URI` | MongoDB Atlas cluster connection string | **Recommended** (falls back to local lowdb file if blank) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary name for secure patient document upload | Optional (falls back to `/tmp/uploads`) |
| `CLOUDINARY_API_KEY` | Cloudinary access key | Optional |
| `CLOUDINARY_API_SECRET` | Cloudinary access secret | Optional |
| `VITE_API_URL` | Explicit backend base URL (for separate client hostings) | Optional (defaults to relative `/api`) |

---

## 💻 Local Development Setup

Follow these steps to run the stack locally:

### 1. Install all dependencies
In the root directory, run the utility script to bootstrap root, client, and server dependencies:
```bash
npm run install-all
```

### 2. Start the dev server
Run the development environment. This boots Vite (port `5173`) and Express (port `5000`) concurrently:
```bash
npm run dev
```

### 3. Build for production (testing)
To verify client compilation:
```bash
npm run build
```

---

## 🔑 Demo Access Credentials

The system seeds default test accounts for trial use:

| Role | Username | Password | Linked Entity / Specialization |
| :--- | :--- | :--- | :--- |
| **👨‍⚕️ Doctor** | `doctor` | `doctor123` | Dr. Sarah Connor (Cardiology) |
| **👩‍💼 Staff** | `staff` | `staff123` | Emma Watson (Reception / Schedulers) |
| **🏥 Patient** | `patient` | `patient123` | John Doe (Allergies: Penicillin, Asthma) |

---

## 📁 Folder Structure
```
medisync/
├── .env.example            # Environment variables template
├── package.json            # Root workspace definitions & npm run commands
├── vercel.json             # Vercel serverless deployment specifications
├── client/                 # React SPA application
│   ├── src/
│   │   ├── api.js          # Unified fetch services wrapper
│   │   ├── App.jsx         # Routes, authentication context, and sidebar
│   │   └── components/     # Doctor, Staff, Patient, Inventory, and Log views
│   └── package.json
└── server/                 # Express backend API service
    ├── server.js           # Server routes, Mongoose models, and lowdb logic
    └── db.json             # Seed database file (lowdb local engine)
```
