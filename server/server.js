const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'medisync_super_secret_jwt_key_2026';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'medisync_super_secret_jwt_key_2026') {
  console.warn('WARNING: Running in production mode with default JWT secret. Set JWT_SECRET in your env!');
}

// Enable secure HTTP response headers
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP to allow speech-to-text API integrations
}));

app.use(cors());
app.use(express.json());

// Setup folders for local storage
const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.LAMBDA_TASK_ROOT;
const uploadsDir = isServerless ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// --- Rate Limiting for Auth routes ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // Max 100 requests per IP
  message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// --- lowdb fallback initialization ---
const dbPath = isServerless ? path.join('/tmp', 'db.json') : path.join(__dirname, 'db.json');
if (isServerless && !fs.existsSync(dbPath)) {
  const seedPath = path.join(__dirname, 'db.json');
  if (fs.existsSync(seedPath)) {
    try {
      fs.copyFileSync(seedPath, dbPath);
    } catch (err) {
      console.error('Failed to copy seed db.json to /tmp:', err);
    }
  }
}
const adapter = new FileSync(dbPath);
const db = low(adapter);
db.defaults({
  users: [],
  patients: [],
  appointments: [],
  prescriptions: [],
  billing: [],
  inventory: [],
  auditLogs: []
}).write();

// --- MONGODB CONFIG & SCHEMAS ---
const UserSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true },
  name: { type: String, required: true },
  department: { type: String, default: 'N/A' }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const PatientSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, default: '' },
  medicalHistory: { type: String, default: '' },
  documents: [{
    id: String,
    filename: String,
    filepath: String,
    uploadedAt: String
  }]
});
const Patient = mongoose.models.Patient || mongoose.model('Patient', PatientSchema);

const AppointmentSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  patientId: { type: String, required: true },
  patientName: { type: String, required: true },
  doctorId: { type: String, required: true },
  doctorName: { type: String, required: true },
  department: { type: String, required: true },
  dateTime: { type: String, required: true },
  priority: { type: String, default: 'Normal' },
  status: { type: String, default: 'Scheduled' }
});
const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', AppointmentSchema);

const PrescriptionSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  appointmentId: { type: String, default: '' },
  patientId: { type: String, required: true },
  patientName: { type: String, required: true },
  doctorId: { type: String, required: true },
  doctorName: { type: String, required: true },
  date: { type: String, required: true },
  diagnosis: { type: String, required: true },
  allergies: { type: String, default: 'None reported' },
  medicines: [{
    name: String,
    dosage: String,
    frequency: String,
    duration: String
  }],
  nextVisitDate: { type: String, default: '' }
});
const Prescription = mongoose.models.Prescription || mongoose.model('Prescription', PrescriptionSchema);

const BillingSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  patientId: { type: String, required: true },
  patientName: { type: String, required: true },
  date: { type: String, required: true },
  consultationFee: { type: Number, required: true },
  medicineCharges: [{
    name: String,
    price: Number
  }],
  status: { type: String, default: 'Unpaid' }
});
const Billing = mongoose.models.Billing || mongoose.model('Billing', BillingSchema);

const InventorySchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  stock: { type: Number, required: true },
  minThreshold: { type: Number, default: 10 },
  expiryDate: { type: String, required: true },
  unitPrice: { type: Number, required: true }
});
const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);

const AuditLogSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  timestamp: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  role: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String, required: true }
});
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

// --- DB CONNECTION MANAGER ---
let isMongo = false;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB successfully.');
      isMongo = true;
      seedMongoDatabase();
    })
    .catch(err => {
      console.error('Failed to connect to MongoDB. Using local lowdb fallback:', err.message);
    });
} else {
  console.log('No MONGODB_URI found. Defaulting to local lowdb database.');
}

// --- DB SERVICE ADAPTER LAYER ---
const dbService = {
  // Users
  getUsersCount: async () => {
    if (isMongo) return await User.countDocuments();
    return db.get('users').size().value();
  },
  createUser: async (user) => {
    if (isMongo) return await (new User(user)).save();
    db.get('users').push(user).write();
    return user;
  },
  findUser: async (query) => {
    if (isMongo) return await User.findOne(query).lean();
    return db.get('users').find(query).value();
  },

  // Patients
  getPatients: async (search) => {
    if (isMongo) {
      if (!search) return await Patient.find({}).lean();
      const regex = new RegExp(search, 'i');
      return await Patient.find({
        $or: [
          { name: regex },
          { phone: regex },
          { address: regex }
        ]
      }).lean();
    }
    let query = db.get('patients');
    if (search) {
      const searchLower = search.toLowerCase();
      query = query.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.phone.includes(searchLower) ||
        (p.address && p.address.toLowerCase().includes(searchLower))
      );
    }
    return query.value();
  },
  findPatient: async (query) => {
    if (isMongo) return await Patient.findOne(query).lean();
    return db.get('patients').find(query).value();
  },
  createPatient: async (patient) => {
    if (isMongo) return await (new Patient(patient)).save();
    db.get('patients').push(patient).write();
    return patient;
  },
  addPatientDocument: async (patientId, doc) => {
    if (isMongo) {
      return await Patient.findOneAndUpdate(
        { id: patientId },
        { $push: { documents: { $each: [doc], $position: 0 } } },
        { new: true }
      ).lean();
    }
    db.get('patients').find({ id: patientId }).get('documents').unshift(doc).write();
    return doc;
  },

  // Appointments
  getAppointments: async (filter) => {
    if (isMongo) return await Appointment.find(filter).lean();
    let appointments = db.get('appointments').value();
    if (filter.patientName) {
      appointments = appointments.filter(a => a.patientName === filter.patientName);
    } else if (filter.doctorId) {
      appointments = appointments.filter(a => a.doctorId === filter.doctorId);
    }
    return appointments;
  },
  findAppointment: async (query) => {
    if (isMongo) return await Appointment.findOne(query).lean();
    return db.get('appointments').find(query).value();
  },
  createAppointment: async (appointment) => {
    if (isMongo) return await (new Appointment(appointment)).save();
    db.get('appointments').push(appointment).write();
    return appointment;
  },
  updateAppointment: async (id, updates) => {
    if (isMongo) {
      return await Appointment.findOneAndUpdate(
        { id: id },
        { $set: updates },
        { new: true }
      ).lean();
    }
    db.get('appointments').find({ id: id }).assign(updates).write();
    return db.get('appointments').find({ id: id }).value();
  },

  // Prescriptions
  getPrescriptions: async (filter) => {
    if (isMongo) return await Prescription.find(filter).lean();
    let prescriptions = db.get('prescriptions').value();
    if (filter.patientId) {
      prescriptions = prescriptions.filter(p => p.patientId === filter.patientId);
    } else if (filter.doctorId) {
      prescriptions = prescriptions.filter(p => p.doctorId === filter.doctorId);
    }
    return prescriptions;
  },
  createPrescription: async (prescription) => {
    if (isMongo) return await (new Prescription(prescription)).save();
    db.get('prescriptions').push(prescription).write();
    return prescription;
  },

  // Billing
  getBilling: async (filter) => {
    if (isMongo) return await Billing.find(filter).lean();
    let bills = db.get('billing').value();
    if (filter.patientId) {
      bills = bills.filter(b => b.patientId === filter.patientId);
    }
    return bills;
  },
  findBilling: async (query) => {
    if (isMongo) return await Billing.findOne(query).lean();
    return db.get('billing').find(query).value();
  },
  createBilling: async (billing) => {
    if (isMongo) return await (new Billing(billing)).save();
    db.get('billing').push(billing).write();
    return billing;
  },
  payBilling: async (id) => {
    if (isMongo) {
      return await Billing.findOneAndUpdate(
        { id: id },
        { $set: { status: 'Paid' } },
        { new: true }
      ).lean();
    }
    db.get('billing').find({ id: id }).assign({ status: 'Paid' }).write();
    return db.get('billing').find({ id: id }).value();
  },

  // Inventory
  getInventory: async () => {
    if (isMongo) return await Inventory.find({}).lean();
    return db.get('inventory').value();
  },
  findInventoryItem: async (query) => {
    if (isMongo) return await Inventory.findOne(query).lean();
    return db.get('inventory').find(query).value();
  },
  findInventoryItemByName: async (name) => {
    if (isMongo) return await Inventory.findOne({ name: name }).lean();
    return db.get('inventory').find({ name: name }).value();
  },
  createInventoryItem: async (item) => {
    if (isMongo) return await (new Inventory(item)).save();
    db.get('inventory').push(item).write();
    return item;
  },
  updateInventoryItem: async (id, updates) => {
    if (isMongo) {
      return await Inventory.findOneAndUpdate(
        { id: id },
        { $set: updates },
        { new: true }
      ).lean();
    }
    db.get('inventory').find({ id: id }).assign(updates).write();
    return db.get('inventory').find({ id: id }).value();
  },

  // Audit Logs
  getAuditLogs: async () => {
    if (isMongo) return await AuditLog.find({}).sort({ timestamp: -1 }).lean();
    return db.get('auditLogs').value();
  },
  createAuditLog: async (log) => {
    if (isMongo) return await (new AuditLog(log)).save();
    db.get('auditLogs').unshift(log).write();
    return log;
  }
};

// --- DATABASE SEEDING FOR MONGO ---
async function seedMongoDatabase() {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      const salt = bcrypt.genSaltSync(10);
      const doctorPassHash = bcrypt.hashSync('doctor123', salt);
      const staffPassHash = bcrypt.hashSync('staff123', salt);
      const patientPassHash = bcrypt.hashSync('patient123', salt);

      await User.insertMany([
        { id: 'usr_doc_1', username: 'doctor', passwordHash: doctorPassHash, role: 'Doctor', name: 'Dr. Sarah Connor', department: 'Cardiology' },
        { id: 'usr_doc_2', username: 'pediatrician', passwordHash: doctorPassHash, role: 'Doctor', name: 'Dr. Charles Xavier', department: 'Pediatrics' },
        { id: 'usr_stf_1', username: 'staff', passwordHash: staffPassHash, role: 'Staff', name: 'Emma Watson', department: 'Reception' },
        { id: 'usr_pat_1', username: 'patient', passwordHash: patientPassHash, role: 'Patient', name: 'John Doe', department: 'N/A' }
      ]);

      await Patient.insertMany([
        { id: 'pat_1', name: 'John Doe', age: 34, gender: 'Male', phone: '+1 555-0199', address: '742 Evergreen Terrace, Springfield', medicalHistory: 'Mild asthma, allergic to penicillin', documents: [] },
        { id: 'pat_2', name: 'Jane Smith', age: 28, gender: 'Female', phone: '+1 555-0245', address: '221B Baker St, London', medicalHistory: 'No chronic diseases, blood type O+', documents: [] }
      ]);

      await Appointment.insertMany([
        { id: 'apt_1', patientId: 'pat_1', patientName: 'John Doe', doctorId: 'usr_doc_1', doctorName: 'Dr. Sarah Connor', department: 'Cardiology', dateTime: '2026-06-24T10:00', priority: 'Normal', status: 'Scheduled' },
        { id: 'apt_2', patientId: 'pat_2', patientName: 'Jane Smith', doctorId: 'usr_doc_2', doctorName: 'Dr. Charles Xavier', department: 'Pediatrics', dateTime: '2026-06-25T14:30', priority: 'Critical', status: 'Scheduled' }
      ]);

      await Inventory.insertMany([
        { id: 'inv_1', name: 'Amoxicillin 500mg', stock: 15, minThreshold: 25, expiryDate: '2027-05-12', unitPrice: 15 },
        { id: 'inv_2', name: 'Paracetamol 650mg', stock: 150, minThreshold: 30, expiryDate: '2028-10-20', unitPrice: 5 },
        { id: 'inv_3', name: 'Ibuprofen 400mg', stock: 8, minThreshold: 20, expiryDate: '2027-02-15', unitPrice: 8 },
        { id: 'inv_4', name: 'Metformin 500mg', stock: 85, minThreshold: 20, expiryDate: '2026-12-31', unitPrice: 12 },
        { id: 'inv_5', name: 'Atorvastatin 20mg', stock: 40, minThreshold: 15, expiryDate: '2027-09-08', unitPrice: 22 }
      ]);

      await Billing.insertMany([
        { id: 'inv_1', patientId: 'pat_1', patientName: 'John Doe', date: '2026-06-22', consultationFee: 100, medicineCharges: [{ name: 'Paracetamol 650mg', price: 10 }], status: 'Paid' }
      ]);

      await new AuditLog({
        id: 'log_seed_mongo',
        timestamp: new Date().toISOString(),
        userId: 'system',
        userName: 'System Administrator',
        role: 'System',
        action: 'DATABASE_INITIALIZATION',
        details: 'MediSync system default seeds initialized on MongoDB.'
      }).save();

      console.log('MongoDB Seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding MongoDB:', err);
  }
}

// --- seedDatabase (local lowdb fallback) ---
function seedDatabase() {
  const usersCount = db.get('users').size().value();
  if (usersCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const doctorPassHash = bcrypt.hashSync('doctor123', salt);
    const staffPassHash = bcrypt.hashSync('staff123', salt);
    const patientPassHash = bcrypt.hashSync('patient123', salt);

    db.get('users').push({ id: 'usr_doc_1', username: 'doctor', passwordHash: doctorPassHash, role: 'Doctor', name: 'Dr. Sarah Connor', department: 'Cardiology' }).write();
    db.get('users').push({ id: 'usr_doc_2', username: 'pediatrician', passwordHash: doctorPassHash, role: 'Doctor', name: 'Dr. Charles Xavier', department: 'Pediatrics' }).write();
    db.get('users').push({ id: 'usr_stf_1', username: 'staff', passwordHash: staffPassHash, role: 'Staff', name: 'Emma Watson', department: 'Reception' }).write();
    db.get('users').push({ id: 'usr_pat_1', username: 'patient', passwordHash: patientPassHash, role: 'Patient', name: 'John Doe', department: 'N/A' }).write();

    db.get('patients').push({ id: 'pat_1', name: 'John Doe', age: 34, gender: 'Male', phone: '+1 555-0199', address: '742 Evergreen Terrace, Springfield', medicalHistory: 'Mild asthma, allergic to penicillin', documents: [] }).write();
    db.get('patients').push({ id: 'pat_2', name: 'Jane Smith', age: 28, gender: 'Female', phone: '+1 555-0245', address: '221B Baker St, London', medicalHistory: 'No chronic diseases, blood type O+', documents: [] }).write();

    db.get('appointments').push({ id: 'apt_1', patientId: 'pat_1', patientName: 'John Doe', doctorId: 'usr_doc_1', doctorName: 'Dr. Sarah Connor', department: 'Cardiology', dateTime: '2026-06-24T10:00', priority: 'Normal', status: 'Scheduled' }).write();
    db.get('appointments').push({ id: 'apt_2', patientId: 'pat_2', patientName: 'Jane Smith', doctorId: 'usr_doc_2', doctorName: 'Dr. Charles Xavier', department: 'Pediatrics', dateTime: '2026-06-25T14:30', priority: 'Critical', status: 'Scheduled' }).write();

    db.get('inventory').push(
      { id: 'inv_1', name: 'Amoxicillin 500mg', stock: 15, minThreshold: 25, expiryDate: '2027-05-12', unitPrice: 15 },
      { id: 'inv_2', name: 'Paracetamol 650mg', stock: 150, minThreshold: 30, expiryDate: '2028-10-20', unitPrice: 5 },
      { id: 'inv_3', name: 'Ibuprofen 400mg', stock: 8, minThreshold: 20, expiryDate: '2027-02-15', unitPrice: 8 },
      { id: 'inv_4', name: 'Metformin 500mg', stock: 85, minThreshold: 20, expiryDate: '2026-12-31', unitPrice: 12 },
      { id: 'inv_5', name: 'Atorvastatin 20mg', stock: 40, minThreshold: 15, expiryDate: '2027-09-08', unitPrice: 22 }
    ).write();

    db.get('billing').push({ id: 'inv_1', patientId: 'pat_1', patientName: 'John Doe', date: '2026-06-22', consultationFee: 100, medicineCharges: [{ name: 'Paracetamol 650mg', price: 10 }], status: 'Paid' }).write();

    db.get('auditLogs').push({
      id: 'log_seed',
      timestamp: new Date().toISOString(),
      userId: 'system',
      userName: 'System Administrator',
      role: 'System',
      action: 'DATABASE_INITIALIZATION',
      details: 'MediSync system default seeds initialized.'
    }).write();

    console.log('Local lowdb Database seeded successfully.');
  }
}
seedDatabase();

// --- CLOUDINARY UPLOADS CONFIG ---
let uploadStorage;
const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                              process.env.CLOUDINARY_API_KEY && 
                              process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  uploadStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'medisync_uploads',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      resource_type: 'auto'
    }
  });
  console.log('Cloudinary configured for document uploads.');
} else {
  uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  });
  console.log('Using local directory uploads storage.');
}

const upload = multer({
  storage: uploadStorage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, JPG, and PNG documents are allowed!'));
  }
});

// --- AUTH MIDDLEWARE ---
const auth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No authentication token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Session expired or invalid token.' });
    req.user = user;
    next();
  });
};

// --- AUDIT LOGGER ---
const logAction = async (user, action, details) => {
  const log = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    userId: user.id || 'anonymous',
    userName: user.name || user.username || 'Anonymous',
    role: user.role || 'Visitor',
    action: action,
    details: details
  };
  await dbService.createAuditLog(log);
};

// --- AUTH API ROUTES ---

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, password, name, phone, address, age, gender } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ message: 'Username, password, and name are required.' });
  }

  try {
    const existingUser = await dbService.findUser({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newPatientId = 'pat_' + Date.now();
    const userId = 'usr_' + Date.now();

    await dbService.createPatient({
      id: newPatientId,
      name: name,
      age: parseInt(age) || 30,
      gender: gender || 'Male',
      phone: phone || '',
      address: address || '',
      medicalHistory: 'Newly registered online',
      documents: []
    });

    const newUser = {
      id: userId,
      username: username.toLowerCase(),
      passwordHash: passwordHash,
      role: 'Patient',
      name: name,
      department: 'N/A'
    };
    await dbService.createUser(newUser);

    await logAction({ id: userId, name: name, role: 'Patient' }, 'PATIENT_REGISTER', `Username ${username} registered online.`);
    res.status(201).json({ message: 'Registration successful! You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter both username and password.' });
  }

  try {
    const user = await dbService.findUser({ username: username.toLowerCase() });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name, department: user.department },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    let patientId = null;
    if (user.role === 'Patient') {
      const patientObj = await dbService.findPatient({ name: user.name });
      if (patientObj) patientId = patientObj.id;
    }

    await logAction(user, 'USER_LOGIN', `User ${user.username} logged in successfully.`);

    res.json({
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        department: user.department,
        patientId: patientId
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PATIENT API ROUTES ---

// GET /api/patients
app.get('/api/patients', auth, async (req, res) => {
  try {
    const { search } = req.query;
    const patients = await dbService.getPatients(search);
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/patients
app.post('/api/patients', auth, async (req, res) => {
  if (req.user.role !== 'Doctor' && req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { name, age, gender, phone, address, medicalHistory } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ message: 'Patient name and phone are required.' });
  }

  try {
    const id = 'pat_' + Date.now();
    const newPatient = {
      id: id,
      name: name,
      age: parseInt(age) || 30,
      gender: gender || 'Male',
      phone: phone,
      address: address || '',
      medicalHistory: medicalHistory || 'None',
      documents: []
    };

    await dbService.createPatient(newPatient);
    await logAction(req.user, 'PATIENT_CREATE', `Created patient record for ${name} (${id}).`);
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/patients/:id/upload
app.post('/api/patients/:id/upload', auth, upload.single('document'), async (req, res) => {
  if (req.user.role !== 'Doctor' && req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { id } = req.params;
  try {
    const patient = await dbService.findPatient({ id: id });
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded or invalid file format.' });

    const filepath = req.file.path || '/uploads/' + req.file.filename;
    const doc = {
      id: 'doc_' + Date.now(),
      filename: req.file.originalname,
      filepath: filepath,
      uploadedAt: new Date().toISOString()
    };

    await dbService.addPatientDocument(id, doc);
    await logAction(req.user, 'PATIENT_DOC_UPLOAD', `Uploaded document ${req.file.originalname} for patient ${patient.name}.`);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- APPOINTMENT API ROUTES ---

// GET /api/appointments
app.get('/api/appointments', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Patient') {
      filter.patientName = req.user.name;
    } else if (req.user.role === 'Doctor') {
      filter.doctorId = req.user.id;
    }
    const appointments = await dbService.getAppointments(filter);
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/appointments
app.post('/api/appointments', auth, async (req, res) => {
  const { patientId, patientName, doctorId, dateTime, priority } = req.body;
  if (!patientName || !doctorId || !dateTime) {
    return res.status(400).json({ message: 'Patient name, doctor, and date-time are required.' });
  }

  try {
    const doctor = await dbService.findUser({ id: doctorId, role: 'Doctor' });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });

    const id = 'apt_' + Date.now();
    const appointment = {
      id: id,
      patientId: patientId || 'pat_walkin',
      patientName: patientName,
      doctorId: doctorId,
      doctorName: doctor.name,
      department: doctor.department,
      dateTime: dateTime,
      priority: priority || 'Normal',
      status: 'Scheduled'
    };

    await dbService.createAppointment(appointment);
    await logAction(req.user, 'APPOINTMENT_CREATE', `Booked appointment for ${patientName} with ${doctor.name} at ${dateTime}.`);
    res.status(201).json(appointment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/appointments/:id
app.patch('/api/appointments/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (req.user.role !== 'Doctor' && req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  try {
    const appointment = await dbService.findAppointment({ id: id });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });

    const updated = await dbService.updateAppointment(id, { status: status });
    await logAction(req.user, 'APPOINTMENT_UPDATE', `Updated status of appointment ${id} to ${status}.`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PRESCRIPTION API ROUTES ---

// GET /api/prescriptions
app.get('/api/prescriptions', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Patient') {
      const patientObj = await dbService.findPatient({ name: req.user.name });
      if (patientObj) {
        filter.patientId = patientObj.id;
      } else {
        return res.json([]);
      }
    } else if (req.user.role === 'Doctor') {
      filter.doctorId = req.user.id;
    }
    const prescriptions = await dbService.getPrescriptions(filter);
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/prescriptions
app.post('/api/prescriptions', auth, async (req, res) => {
  if (req.user.role !== 'Doctor') {
    return res.status(403).json({ message: 'Only Doctors can issue prescriptions.' });
  }

  const { appointmentId, patientId, diagnosis, allergies, medicines, nextVisitDate } = req.body;
  if (!patientId || !diagnosis || !medicines || medicines.length === 0) {
    return res.status(400).json({ message: 'Patient, diagnosis, and at least one medicine are required.' });
  }

  try {
    const patientObj = await dbService.findPatient({ id: patientId });
    if (!patientObj) return res.status(404).json({ message: 'Patient not found.' });

    const id = 'rx_' + Date.now();
    const prescriptionObj = {
      id: id,
      appointmentId: appointmentId || '',
      patientId: patientId,
      patientName: patientObj.name,
      doctorId: req.user.id,
      doctorName: req.user.name,
      date: new Date().toISOString().split('T')[0],
      diagnosis: diagnosis,
      allergies: allergies || 'None reported',
      medicines: medicines,
      nextVisitDate: nextVisitDate || ''
    };

    // Perform stock reductions
    for (const item of medicines) {
      const invItem = await dbService.findInventoryItemByName(item.name);
      if (invItem) {
        const currentStock = invItem.stock;
        const durationDays = parseInt(item.duration) || 5;
        const timesPerDay = item.frequency.toLowerCase().includes('times') || item.frequency.toLowerCase().includes('x')
          ? (parseInt(item.frequency) || 2)
          : 2;
        const quantityToDeduct = Math.min(currentStock, durationDays * timesPerDay);

        await dbService.updateInventoryItem(invItem.id, { stock: currentStock - quantityToDeduct });
        await logAction(req.user, 'INVENTORY_DEDUCTION', `Deducted ${quantityToDeduct} units of ${item.name} for prescription.`);
      }
    }

    await dbService.createPrescription(prescriptionObj);

    if (appointmentId) {
      await dbService.updateAppointment(appointmentId, { status: 'Completed' });
    }

    await logAction(req.user, 'PRESCRIPTION_CREATE', `Created prescription ${id} for patient ${patientObj.name}.`);
    res.status(201).json(prescriptionObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- BILLING API ROUTES ---

// GET /api/billing
app.get('/api/billing', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Patient') {
      const patientObj = await dbService.findPatient({ name: req.user.name });
      if (patientObj) {
        filter.patientId = patientObj.id;
      } else {
        return res.json([]);
      }
    }

    const bills = await dbService.getBilling(filter);

    const calculatedBills = bills.map(bill => {
      const medicineTotal = bill.medicineCharges.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      const totalAmount = (parseFloat(bill.consultationFee) || 0) + medicineTotal;
      return {
        ...bill,
        totalAmount: totalAmount
      };
    });

    res.json(calculatedBills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/billing
app.post('/api/billing', auth, async (req, res) => {
  if (req.user.role !== 'Staff' && req.user.role !== 'Doctor') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { patientId, consultationFee, medicineCharges } = req.body;
  if (!patientId || consultationFee === undefined) {
    return res.status(400).json({ message: 'Patient and consultation fee are required.' });
  }

  try {
    const patient = await dbService.findPatient({ id: patientId });
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });

    const id = 'inv_' + Date.now();
    const invoice = {
      id: id,
      patientId: patientId,
      patientName: patient.name,
      date: new Date().toISOString().split('T')[0],
      consultationFee: parseFloat(consultationFee),
      medicineCharges: medicineCharges || [],
      status: 'Unpaid'
    };

    await dbService.createBilling(invoice);
    await logAction(req.user, 'BILLING_CREATE', `Generated invoice ${id} for patient ${patient.name}.`);

    const medicineTotal = invoice.medicineCharges.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    res.status(201).json({
      ...invoice,
      totalAmount: invoice.consultationFee + medicineTotal
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/billing/:id/pay
app.patch('/api/billing/:id/pay', auth, async (req, res) => {
  if (req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Only staff can collect payments.' });
  }

  const { id } = req.params;
  try {
    const bill = await dbService.findBilling({ id: id });
    if (!bill) return res.status(404).json({ message: 'Invoice not found.' });

    const updatedBill = await dbService.payBilling(id);
    await logAction(req.user, 'BILLING_PAYMENT', `Collected payment for invoice ${id}.`);

    const medicineTotal = updatedBill.medicineCharges.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    res.json({
      ...updatedBill,
      totalAmount: updatedBill.consultationFee + medicineTotal
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- INVENTORY API ROUTES ---

// GET /api/inventory
app.get('/api/inventory', auth, async (req, res) => {
  try {
    const inventory = await dbService.getInventory();
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/inventory/:id
app.patch('/api/inventory/:id', auth, async (req, res) => {
  if (req.user.role !== 'Staff' && req.user.role !== 'Doctor') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { id } = req.params;
  const { stock, minThreshold, unitPrice, name, expiryDate } = req.body;

  try {
    const item = await dbService.findInventoryItem({ id: id });
    if (!item) return res.status(404).json({ message: 'Medicine item not found.' });

    const updates = {};
    if (stock !== undefined) updates.stock = parseInt(stock);
    if (minThreshold !== undefined) updates.minThreshold = parseInt(minThreshold);
    if (unitPrice !== undefined) updates.unitPrice = parseFloat(unitPrice);
    if (name !== undefined) updates.name = name;
    if (expiryDate !== undefined) updates.expiryDate = expiryDate;

    const updated = await dbService.updateInventoryItem(id, updates);
    await logAction(req.user, 'INVENTORY_UPDATE', `Updated inventory item ${item.name} (${id}).`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/inventory
app.post('/api/inventory', auth, async (req, res) => {
  if (req.user.role !== 'Staff' && req.user.role !== 'Doctor') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { name, stock, minThreshold, expiryDate, unitPrice } = req.body;
  if (!name || stock === undefined || unitPrice === undefined) {
    return res.status(400).json({ message: 'Medicine name, stock level, and price are required.' });
  }

  try {
    const id = 'inv_' + Date.now();
    const newItem = {
      id: id,
      name: name,
      stock: parseInt(stock),
      minThreshold: parseInt(minThreshold) || 10,
      expiryDate: expiryDate || '2027-12-31',
      unitPrice: parseFloat(unitPrice)
    };

    await dbService.createInventoryItem(newItem);
    await logAction(req.user, 'INVENTORY_ADD', `Added new medicine ${name} to stock.`);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- AUDIT LOGS ROUTE ---

// GET /api/audit-logs
app.get('/api/audit-logs', auth, async (req, res) => {
  if (req.user.role !== 'Doctor' && req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Access denied to audit logs.' });
  }
  try {
    const logs = await dbService.getAuditLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- AI SYMPTOM ENGINE ---

// POST /api/ai/symptom-check
app.post('/api/ai/symptom-check', (req, res) => {
  const { symptoms } = req.body;
  if (!symptoms) return res.status(400).json({ message: 'Symptoms description is required.' });

  const query = symptoms.toLowerCase();
  let conditions = [];

  if (query.includes('fever') || query.includes('cough') || query.includes('throat') || query.includes('runny nose')) {
    conditions.push({
      name: 'Common Influenza / Viral Pharyngitis',
      probability: 'High',
      recommendation: 'Rest, hydration, and fever reducers (Paracetamol). Consult if symptoms worsen or throat swelling increases.'
    });
    conditions.push({
      name: 'Streptococcal Pharyngitis (Strep Throat)',
      probability: 'Medium',
      recommendation: 'Requires physician throat swab and potential course of antibiotics (Amoxicillin).'
    });
  }

  if (query.includes('chest pain') || query.includes('breath') || query.includes('pressure') || query.includes('tightness')) {
    conditions.push({
      name: 'Cardiological Angina Pectoris / Coronary Syndrome',
      probability: 'Critical',
      recommendation: 'IMPORTANT: Seek immediate emergency cardiological evaluation. Do not delay. Call emergency response.'
    });
    conditions.push({
      name: 'Gastroesophageal Reflux Disease (GERD)',
      probability: 'Medium',
      recommendation: 'Acid suppression therapy. Needs clinical exclusion of cardiac causes.'
    });
  }

  if (query.includes('headache') || query.includes('migraine') || query.includes('vision')) {
    conditions.push({
      name: 'Migraine Headache',
      probability: 'High',
      recommendation: 'Rest in a dark room. Mild analgesics. Track trigger items.'
    });
    conditions.push({
      name: 'Hypertensive Crisis',
      probability: 'Medium',
      recommendation: 'Check blood pressure immediately. Seek medical validation if reading exceeds 140/90 mmHg.'
    });
  }

  if (query.includes('joint') || query.includes('pain') && (query.includes('stiff') || query.includes('knee') || query.includes('back'))) {
    conditions.push({
      name: 'Osteoarthritis',
      probability: 'High',
      recommendation: 'Low-impact exercises, heat/ice therapies, and anti-inflammatory support.'
    });
    conditions.push({
      name: 'Rheumatoid Arthritis',
      probability: 'Medium',
      recommendation: 'Consult rheumatologist for blood panel markers (RF / anti-CCP).'
    });
  }

  if (query.includes('stomach') || query.includes('vomit') || query.includes('nausea') || query.includes('diarrhea')) {
    conditions.push({
      name: 'Acute Gastroenteritis (Food Poisoning)',
      probability: 'High',
      recommendation: 'Oral Rehydration Salts (ORS), light diet. Avoid dairy and caffeine.'
    });
  }

  // Fallback
  if (conditions.length === 0) {
    conditions.push({
      name: 'Mild Viral Infection / Fatigue Syndrome',
      probability: 'Medium',
      recommendation: 'Get adequate rest, monitor body temperature, and document symptoms for doctor consultation.'
    });
  }

  res.json({
    symptoms: symptoms,
    conditions: conditions,
    disclaimer: 'DISCLAIMER: This is a rule-based AI Symptom guide and does NOT represent a medical diagnosis or clinical judgment. Please schedule an appointment with a licensed doctor for professional care.'
  });
});

// Start Server
if (!isServerless && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
