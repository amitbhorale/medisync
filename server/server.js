const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'medisync_super_secret_jwt_key_2026';

// Initialize lowdb database
const isNetlify = process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT;
const dbPath = isNetlify 
  ? path.join('/tmp', 'db.json') 
  : path.join(__dirname, 'db.json');

// If on Netlify, copy original seed db.json to /tmp if not already present
if (isNetlify && !fs.existsSync(dbPath)) {
  const seedPath = path.join(__dirname, 'db.json');
  if (fs.existsSync(seedPath)) {
    try {
      fs.copyFileSync(seedPath, dbPath);
    } catch (err) {
      console.error('Failed to copy seed database to /tmp:', err);
    }
  }
}

const adapter = new FileSync(dbPath);
const db = low(adapter);

// Setup folders
const uploadsDir = isNetlify 
  ? path.join('/tmp', 'uploads') 
  : path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database Defaults & Seeds
db.defaults({
  users: [],
  patients: [],
  appointments: [],
  prescriptions: [],
  billing: [],
  inventory: [],
  auditLogs: []
}).write();

// Seed Database helper
function seedDatabase() {
  const usersCount = db.get('users').size().value();
  if (usersCount === 0) {
    // Hash passwords
    const salt = bcrypt.genSaltSync(10);
    const doctorPassHash = bcrypt.hashSync('doctor123', salt);
    const staffPassHash = bcrypt.hashSync('staff123', salt);
    const patientPassHash = bcrypt.hashSync('patient123', salt);

    // Doctors
    db.get('users').push({
      id: 'usr_doc_1',
      username: 'doctor',
      passwordHash: doctorPassHash,
      role: 'Doctor',
      name: 'Dr. Sarah Connor',
      department: 'Cardiology'
    }).write();

    db.get('users').push({
      id: 'usr_doc_2',
      username: 'pediatrician',
      passwordHash: doctorPassHash,
      role: 'Doctor',
      name: 'Dr. Charles Xavier',
      department: 'Pediatrics'
    }).write();

    // Staff
    db.get('users').push({
      id: 'usr_stf_1',
      username: 'staff',
      passwordHash: staffPassHash,
      role: 'Staff',
      name: 'Emma Watson',
      department: 'Reception'
    }).write();

    // Patient User
    db.get('users').push({
      id: 'usr_pat_1',
      username: 'patient',
      passwordHash: patientPassHash,
      role: 'Patient',
      name: 'John Doe',
      department: 'N/A'
    }).write();

    // Seed Patients
    db.get('patients').push({
      id: 'pat_1',
      name: 'John Doe',
      age: 34,
      gender: 'Male',
      phone: '+1 555-0199',
      address: '742 Evergreen Terrace, Springfield',
      medicalHistory: 'Mild asthma, allergic to penicillin',
      documents: []
    }).write();

    db.get('patients').push({
      id: 'pat_2',
      name: 'Jane Smith',
      age: 28,
      gender: 'Female',
      phone: '+1 555-0245',
      address: '221B Baker St, London',
      medicalHistory: 'No chronic diseases, blood type O+',
      documents: []
    }).write();

    // Seed Appointments
    db.get('appointments').push({
      id: 'apt_1',
      patientId: 'pat_1',
      patientName: 'John Doe',
      doctorId: 'usr_doc_1',
      doctorName: 'Dr. Sarah Connor',
      department: 'Cardiology',
      dateTime: '2026-06-24T10:00',
      priority: 'Normal',
      status: 'Scheduled'
    }).write();

    db.get('appointments').push({
      id: 'apt_2',
      patientId: 'pat_2',
      patientName: 'Jane Smith',
      doctorId: 'usr_doc_2',
      doctorName: 'Dr. Charles Xavier',
      department: 'Pediatrics',
      dateTime: '2026-06-25T14:30',
      priority: 'Critical',
      status: 'Scheduled'
    }).write();

    // Seed Medicine Inventory
    db.get('inventory').push(
      { id: 'inv_1', name: 'Amoxicillin 500mg', stock: 15, minThreshold: 25, expiryDate: '2027-05-12', unitPrice: 15 },
      { id: 'inv_2', name: 'Paracetamol 650mg', stock: 150, minThreshold: 30, expiryDate: '2028-10-20', unitPrice: 5 },
      { id: 'inv_3', name: 'Ibuprofen 400mg', stock: 8, minThreshold: 20, expiryDate: '2027-02-15', unitPrice: 8 },
      { id: 'inv_4', name: 'Metformin 500mg', stock: 85, minThreshold: 20, expiryDate: '2026-12-31', unitPrice: 12 },
      { id: 'inv_5', name: 'Atorvastatin 20mg', stock: 40, minThreshold: 15, expiryDate: '2027-09-08', unitPrice: 22 }
    ).write();

    // Seed Billing
    db.get('billing').push({
      id: 'inv_1',
      patientId: 'pat_1',
      patientName: 'John Doe',
      date: '2026-06-22',
      consultationFee: 100,
      medicineCharges: [
        { name: 'Paracetamol 650mg', price: 10 }
      ],
      status: 'Paid'
    }).write();

    // Seed Logs
    db.get('auditLogs').push({
      id: 'log_seed',
      timestamp: new Date().toISOString(),
      userId: 'system',
      userName: 'System Administrator',
      role: 'System',
      action: 'DATABASE_INITIALIZATION',
      details: 'MediSync system default seeds initialized.'
    }).write();

    console.log('Database seeded successfully.');
  }
}
seedDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({
  storage: storage,
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

// Authentication middleware
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

// Audit logging helper
const logAction = (user, action, details) => {
  const log = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    userId: user.id || 'anonymous',
    userName: user.name || user.username || 'Anonymous',
    role: user.role || 'Visitor',
    action: action,
    details: details
  };
  db.get('auditLogs').unshift(log).write();
};

// --- AUTH API ROUTES ---

// POST /api/auth/register (For patients)
app.post('/api/auth/register', (req, res) => {
  const { username, password, name, phone, address, age, gender } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ message: 'Username, password, and name are required.' });
  }

  const existingUser = db.get('users').find({ username: username.toLowerCase() }).value();
  if (existingUser) {
    return res.status(400).json({ message: 'Username is already taken.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newPatientId = 'pat_' + Date.now();
  const userId = 'usr_' + Date.now();

  // Create patient entry
  db.get('patients').push({
    id: newPatientId,
    name: name,
    age: parseInt(age) || 30,
    gender: gender || 'Male',
    phone: phone || '',
    address: address || '',
    medicalHistory: 'Newly registered online',
    documents: []
  }).write();

  // Create user entry
  const newUser = {
    id: userId,
    username: username.toLowerCase(),
    passwordHash: passwordHash,
    role: 'Patient',
    name: name,
    department: 'N/A'
  };
  db.get('users').push(newUser).write();

  logAction({ id: userId, name: name, role: 'Patient' }, 'PATIENT_REGISTER', `Username ${username} registered online.`);

  res.status(201).json({ message: 'Registration successful! You can now log in.' });
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter both username and password.' });
  }

  const user = db.get('users').find({ username: username.toLowerCase() }).value();
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  // Generate Token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name, department: user.department },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Find linked patient ID if user is Patient
  let patientId = null;
  if (user.role === 'Patient') {
    const patientObj = db.get('patients').find({ name: user.name }).value();
    if (patientObj) patientId = patientObj.id;
  }

  logAction(user, 'USER_LOGIN', `User ${user.username} logged in successfully.`);

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
});

// --- PATIENT API ROUTES ---

// GET /api/patients
app.get('/api/patients', auth, (req, res) => {
  const { search } = req.query;
  let query = db.get('patients');

  if (search) {
    const searchLower = search.toLowerCase();
    query = query.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.phone.includes(searchLower) ||
      (p.address && p.address.toLowerCase().includes(searchLower))
    );
  }

  res.json(query.value());
});

// POST /api/patients
app.post('/api/patients', auth, (req, res) => {
  if (req.user.role !== 'Doctor' && req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { name, age, gender, phone, address, medicalHistory } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ message: 'Patient name and phone are required.' });
  }

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

  db.get('patients').push(newPatient).write();
  logAction(req.user, 'PATIENT_CREATE', `Created patient record for ${name} (${id}).`);

  res.status(201).json(newPatient);
});

// POST /api/patients/:id/upload
app.post('/api/patients/:id/upload', auth, upload.single('document'), (req, res) => {
  if (req.user.role !== 'Doctor' && req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { id } = req.params;
  const patient = db.get('patients').find({ id: id }).value();
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });

  if (!req.file) return res.status(400).json({ message: 'No file uploaded or invalid file format.' });

  const doc = {
    id: 'doc_' + Date.now(),
    filename: req.file.originalname,
    filepath: '/uploads/' + req.file.filename,
    uploadedAt: new Date().toISOString()
  };

  // Add document to patient record
  db.get('patients').find({ id: id }).get('documents').unshift(doc).write();

  logAction(req.user, 'PATIENT_DOC_UPLOAD', `Uploaded document ${req.file.originalname} for patient ${patient.name}.`);

  res.status(201).json(doc);
});

// --- APPOINTMENT API ROUTES ---

// GET /api/appointments
app.get('/api/appointments', auth, (req, res) => {
  let appointments = db.get('appointments').value();

  if (req.user.role === 'Patient') {
    // Find appointments for this specific patient
    // Matches patient by user name
    appointments = appointments.filter(a => a.patientName === req.user.name);
  } else if (req.user.role === 'Doctor') {
    appointments = appointments.filter(a => a.doctorId === req.user.id);
  }

  res.json(appointments);
});

// POST /api/appointments
app.post('/api/appointments', auth, (req, res) => {
  const { patientId, patientName, doctorId, dateTime, priority } = req.body;
  if (!patientName || !doctorId || !dateTime) {
    return res.status(400).json({ message: 'Patient name, doctor, and date-time are required.' });
  }

  const doctor = db.get('users').find({ id: doctorId, role: 'Doctor' }).value();
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

  db.get('appointments').push(appointment).write();
  logAction(req.user, 'APPOINTMENT_CREATE', `Booked appointment for ${patientName} with ${doctor.name} at ${dateTime}.`);

  res.status(201).json(appointment);
});

// PATCH /api/appointments/:id
app.patch('/api/appointments/:id', auth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (req.user.role !== 'Doctor' && req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const appointment = db.get('appointments').find({ id: id }).value();
  if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });

  db.get('appointments').find({ id: id }).assign({ status: status }).write();
  logAction(req.user, 'APPOINTMENT_UPDATE', `Updated status of appointment ${id} to ${status}.`);

  res.json(db.get('appointments').find({ id: id }).value());
});

// --- PRESCRIPTION API ROUTES ---

// GET /api/prescriptions
app.get('/api/prescriptions', auth, (req, res) => {
  let prescriptions = db.get('prescriptions').value();

  if (req.user.role === 'Patient') {
    // Get patient ID
    const patientObj = db.get('patients').find({ name: req.user.name }).value();
    if (patientObj) {
      prescriptions = prescriptions.filter(p => p.patientId === patientObj.id);
    } else {
      prescriptions = [];
    }
  } else if (req.user.role === 'Doctor') {
    prescriptions = prescriptions.filter(p => p.doctorId === req.user.id);
  }

  res.json(prescriptions);
});

// POST /api/prescriptions
app.post('/api/prescriptions', auth, (req, res) => {
  if (req.user.role !== 'Doctor') {
    return res.status(403).json({ message: 'Only Doctors can issue prescriptions.' });
  }

  const { appointmentId, patientId, diagnosis, allergies, medicines, nextVisitDate } = req.body;
  if (!patientId || !diagnosis || !medicines || medicines.length === 0) {
    return res.status(400).json({ message: 'Patient, diagnosis, and at least one medicine are required.' });
  }

  const patientObj = db.get('patients').find({ id: patientId }).value();
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
    medicines: medicines, // Array of { name, dosage, frequency, duration }
    nextVisitDate: nextVisitDate || ''
  };

  // Perform atomic stock reduction
  medicines.forEach(item => {
    const invItem = db.get('inventory').find({ name: item.name }).value();
    if (invItem) {
      const currentStock = invItem.stock;
      // Extract numeric duration
      const durationDays = parseInt(item.duration) || 5;
      const timesPerDay = item.frequency.toLowerCase().includes('times') || item.frequency.toLowerCase().includes('x')
        ? (parseInt(item.frequency) || 2)
        : 2;
      const quantityToDeduct = Math.min(currentStock, durationDays * timesPerDay);

      db.get('inventory')
        .find({ id: invItem.id })
        .assign({ stock: currentStock - quantityToDeduct })
        .write();

      logAction(req.user, 'INVENTORY_DEDUCTION', `Deducted ${quantityToDeduct} units of ${item.name} for prescription.`);
    }
  });

  db.get('prescriptions').push(prescriptionObj).write();

  // If there's an associated appointment, mark it completed
  if (appointmentId) {
    db.get('appointments').find({ id: appointmentId }).assign({ status: 'Completed' }).write();
  }

  logAction(req.user, 'PRESCRIPTION_CREATE', `Created prescription ${id} for patient ${patientObj.name}.`);

  res.status(201).json(prescriptionObj);
});

// --- BILLING API ROUTES ---

// GET /api/billing
app.get('/api/billing', auth, (req, res) => {
  let bills = db.get('billing').value();

  if (req.user.role === 'Patient') {
    const patientObj = db.get('patients').find({ name: req.user.name }).value();
    if (patientObj) {
      bills = bills.filter(b => b.patientId === patientObj.id);
    } else {
      bills = [];
    }
  }

  // Dynamically calculate totalAmount and return
  const calculatedBills = bills.map(bill => {
    const medicineTotal = bill.medicineCharges.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const totalAmount = (parseFloat(bill.consultationFee) || 0) + medicineTotal;
    return {
      ...bill,
      totalAmount: totalAmount
    };
  });

  res.json(calculatedBills);
});

// POST /api/billing
app.post('/api/billing', auth, (req, res) => {
  if (req.user.role !== 'Staff' && req.user.role !== 'Doctor') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { patientId, consultationFee, medicineCharges } = req.body;
  if (!patientId || consultationFee === undefined) {
    return res.status(400).json({ message: 'Patient and consultation fee are required.' });
  }

  const patient = db.get('patients').find({ id: patientId }).value();
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });

  const id = 'inv_' + Date.now();
  const invoice = {
    id: id,
    patientId: patientId,
    patientName: patient.name,
    date: new Date().toISOString().split('T')[0],
    consultationFee: parseFloat(consultationFee),
    medicineCharges: medicineCharges || [], // Array of { name, price }
    status: 'Unpaid'
  };

  db.get('billing').push(invoice).write();
  logAction(req.user, 'BILLING_CREATE', `Generated invoice ${id} for patient ${patient.name}.`);

  // Dynamically attach totalAmount for response
  const medicineTotal = invoice.medicineCharges.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  res.status(201).json({
    ...invoice,
    totalAmount: invoice.consultationFee + medicineTotal
  });
});

// PATCH /api/billing/:id/pay
app.patch('/api/billing/:id/pay', auth, (req, res) => {
  if (req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Only staff can collect payments.' });
  }

  const { id } = req.params;
  const bill = db.get('billing').find({ id: id }).value();
  if (!bill) return res.status(404).json({ message: 'Invoice not found.' });

  db.get('billing').find({ id: id }).assign({ status: 'Paid' }).write();
  logAction(req.user, 'BILLING_PAYMENT', `Collected payment for invoice ${id}.`);

  const updatedBill = db.get('billing').find({ id: id }).value();
  const medicineTotal = updatedBill.medicineCharges.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  res.json({
    ...updatedBill,
    totalAmount: updatedBill.consultationFee + medicineTotal
  });
});

// --- INVENTORY API ROUTES ---

// GET /api/inventory
app.get('/api/inventory', auth, (req, res) => {
  res.json(db.get('inventory').value());
});

// PATCH /api/inventory/:id
app.patch('/api/inventory/:id', auth, (req, res) => {
  if (req.user.role !== 'Staff' && req.user.role !== 'Doctor') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { id } = req.params;
  const { stock, minThreshold, unitPrice, name, expiryDate } = req.body;

  const item = db.get('inventory').find({ id: id }).value();
  if (!item) return res.status(404).json({ message: 'Medicine item not found.' });

  const updates = {};
  if (stock !== undefined) updates.stock = parseInt(stock);
  if (minThreshold !== undefined) updates.minThreshold = parseInt(minThreshold);
  if (unitPrice !== undefined) updates.unitPrice = parseFloat(unitPrice);
  if (name !== undefined) updates.name = name;
  if (expiryDate !== undefined) updates.expiryDate = expiryDate;

  db.get('inventory').find({ id: id }).assign(updates).write();
  logAction(req.user, 'INVENTORY_UPDATE', `Updated inventory item ${item.name} (${id}).`);

  res.json(db.get('inventory').find({ id: id }).value());
});

// POST /api/inventory (Add new medicine)
app.post('/api/inventory', auth, (req, res) => {
  if (req.user.role !== 'Staff' && req.user.role !== 'Doctor') {
    return res.status(403).json({ message: 'Unauthorized action.' });
  }

  const { name, stock, minThreshold, expiryDate, unitPrice } = req.body;
  if (!name || stock === undefined || unitPrice === undefined) {
    return res.status(400).json({ message: 'Medicine name, stock level, and price are required.' });
  }

  const id = 'inv_' + Date.now();
  const newItem = {
    id: id,
    name: name,
    stock: parseInt(stock),
    minThreshold: parseInt(minThreshold) || 10,
    expiryDate: expiryDate || '2027-12-31',
    unitPrice: parseFloat(unitPrice)
  };

  db.get('inventory').push(newItem).write();
  logAction(req.user, 'INVENTORY_ADD', `Added new medicine ${name} to stock.`);

  res.status(201).json(newItem);
});

// --- AUDIT LOGS ROUTE ---

// GET /api/audit-logs
app.get('/api/audit-logs', auth, (req, res) => {
  if (req.user.role !== 'Doctor' && req.user.role !== 'Staff') {
    return res.status(403).json({ message: 'Access denied to audit logs.' });
  }
  res.json(db.get('auditLogs').value());
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
if (!isNetlify && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
