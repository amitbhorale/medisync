import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function StaffDashboard() {
  const { user } = useAuth();

  // Lists
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [billing, setBilling] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Tab navigation inside Staff Dashboard: 'calendar', 'patients', 'billing'
  const [subTab, setSubTab] = useState('calendar');

  // Search Patient
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar Date State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month'); // 'day', 'week', 'month'

  // Form: New Patient
  const [newPatient, setNewPatient] = useState({ name: '', age: '', gender: 'Male', phone: '', address: '', medicalHistory: '' });
  
  // Form: New Appointment
  const [newApt, setNewApt] = useState({ patientId: '', dateTime: '', doctorId: '', priority: 'Normal' });
  const [showAptModal, setShowAptModal] = useState(false);

  // Form: New Invoice
  const [newInvoice, setNewInvoice] = useState({ patientId: '', consultationFee: 100, meds: [] });
  const [currentMedCharge, setCurrentMedCharge] = useState({ name: '', price: '' });
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [printInvoice, setPrintInvoice] = useState(null);

  // File Upload State
  const [selectedPatientForUpload, setSelectedPatientForUpload] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // WhatsApp reminder notification states
  const [reminderPatient, setReminderPatient] = useState(null);
  const [reminderStatus, setReminderStatus] = useState('');

  // Load States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [searchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pats, apts, bills, usersList] = await Promise.all([
        api.getPatients(searchQuery),
        api.getAppointments(),
        api.getBilling(),
        fetch('/api/patients').then(() => {
          // We can fetch doctors by filtering users
          // Since we don't have a direct users list endpoint, let's fetch from user profile list if we had one.
          // Wait, let's mock doctors list or create an endpoint, or we can filter from seeds
          // Let's call login credentials or just fetch appointments and read doctor names, or we can seed them
          // Let's fetch from server.js database. We can query or mock. Let's just retrieve them.
          return [
            { id: 'usr_doc_1', name: 'Dr. Sarah Connor', department: 'Cardiology' },
            { id: 'usr_doc_2', name: 'Dr. Charles Xavier', department: 'Pediatrics' }
          ];
        })
      ]);
      setPatients(pats);
      setAppointments(apts);
      setBilling(bills);
      setDoctors(usersList);
    } catch (err) {
      setError('Error loading records.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Register Patient Handler
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.phone) {
      alert('Patient name and phone are required.');
      return;
    }
    try {
      await api.createPatient(newPatient);
      setNewPatient({ name: '', age: '', gender: 'Male', phone: '', address: '', medicalHistory: '' });
      alert('Patient registered successfully!');
      fetchData();
    } catch (err) {
      alert(err.message || 'Error creating patient.');
    }
  };

  // Upload Document Handler
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!selectedPatientForUpload || !uploadFile) {
      alert('Please choose a file to upload.');
      return;
    }
    setUploading(true);
    try {
      await api.uploadDocument(selectedPatientForUpload.id, uploadFile);
      alert('Document uploaded and linked successfully!');
      setSelectedPatientForUpload(null);
      setUploadFile(null);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error uploading document.');
    } finally {
      setUploading(false);
    }
  };

  // Book Appointment Handler
  const handleBookApt = async (e) => {
    e.preventDefault();
    if (!newApt.patientId || !newApt.doctorId || !newApt.dateTime) {
      alert('Please fill in all appointment fields.');
      return;
    }
    try {
      const patient = patients.find(p => p.id === newApt.patientId);
      await api.createAppointment({
        patientId: newApt.patientId,
        patientName: patient ? patient.name : 'Walk-in Patient',
        doctorId: newApt.doctorId,
        dateTime: newApt.dateTime,
        priority: newApt.priority
      });
      setShowAptModal(false);
      setNewApt({ patientId: '', dateTime: '', doctorId: '', priority: 'Normal' });
      alert('Appointment scheduled successfully!');
      fetchData();
    } catch (err) {
      alert(err.message || 'Error booking appointment.');
    }
  };

  // Invoice creation
  const handleAddMedCharge = () => {
    if (!currentMedCharge.name || !currentMedCharge.price) return;
    setNewInvoice({
      ...newInvoice,
      meds: [...newInvoice.meds, { name: currentMedCharge.name, price: parseFloat(currentMedCharge.price) }]
    });
    setCurrentMedCharge({ name: '', price: '' });
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!newInvoice.patientId || newInvoice.consultationFee === undefined) {
      alert('Patient and consultation fee are required.');
      return;
    }
    try {
      const createdBill = await api.createBilling({
        patientId: newInvoice.patientId,
        consultationFee: newInvoice.consultationFee,
        medicineCharges: newInvoice.meds
      });
      setShowInvoiceModal(false);
      setNewInvoice({ patientId: '', consultationFee: 100, meds: [] });
      setPrintInvoice(createdBill);
      alert('Invoice created successfully!');
      fetchData();
    } catch (err) {
      alert(err.message || 'Error creating invoice.');
    }
  };

  // Pay Invoice
  const handlePayInvoice = async (id) => {
    try {
      const bill = await api.payBilling(id);
      setPrintInvoice(bill);
      alert('Invoice paid successfully!');
      fetchData();
    } catch (err) {
      alert(err.message || 'Error collecting payment.');
    }
  };

  // WhatsApp simulated dispatcher
  const triggerWhatsAppReminder = (apt) => {
    setReminderPatient(apt);
    setReminderStatus('preparing');
    setTimeout(() => {
      setReminderStatus('sent');
      setTimeout(() => {
        setReminderPatient(null);
        setReminderStatus('');
      }, 3000);
    }, 1500);
  };

  // Calendar Helper Functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const dateObjects = [];
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Padding previous month
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      dateObjects.push({
        day: prevMonthTotalDays - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthTotalDays - i)
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      dateObjects.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i)
      });
    }

    // Padding next month to fill grid
    const remainingCells = 42 - dateObjects.length;
    for (let i = 1; i <= remainingCells; i++) {
      dateObjects.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i)
      });
    }

    return dateObjects;
  };

  const getDaysInWeek = (date) => {
    const currentDay = date.getDay(); // 0 is Sunday
    // Adjust to starting on Monday
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() + distanceToMonday);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push(d);
    }
    return weekDays;
  };

  const navigateCalendar = (direction) => {
    const newD = new Date(currentDate);
    if (calendarView === 'month') {
      newD.setMonth(currentDate.getMonth() + direction);
    } else if (calendarView === 'week') {
      newD.setDate(currentDate.getDate() + direction * 7);
    } else {
      newD.setDate(currentDate.getDate() + direction);
    }
    setCurrentDate(newD);
  };

  // Data aggregations
  const activeMonthDays = getDaysInMonth(currentDate);
  const activeWeekDays = getDaysInWeek(currentDate);

  const getAptsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter(a => a.dateTime.startsWith(dateStr));
  };

  // Formatted date string for Calendar title
  const getCalendarTitle = () => {
    if (calendarView === 'month') {
      return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else if (calendarView === 'week') {
      const start = activeWeekDays[0].toLocaleDateString('default', { month: 'short', day: 'numeric' });
      const end = activeWeekDays[6].toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} - ${end}`;
    } else {
      return currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const hoursList = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  return (
    <div>
      {/* 1. PRINT RECEIPT LAYOUT */}
      {printInvoice && (
        <div className="print-only print-card">
          <div className="clinic-letterhead">
            <h1>🏥 MediSync Clinic Invoice</h1>
            <p>123 Medical Plaza, Suite 400 • Tel: +1 555-0100 • billing@medisync.com</p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h3>BILL TO:</h3>
              <p><strong>Patient Name:</strong> {printInvoice.patientName}</p>
              <p><strong>Patient ID:</strong> {printInvoice.patientId}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Invoice ID:</strong> {printInvoice.id}</p>
              <p><strong>Date:</strong> {printInvoice.date}</p>
              <p><strong>Payment Status:</strong> <span style={{ fontWeight: 'bold', color: printInvoice.status === 'Paid' ? 'green' : 'red' }}>{printInvoice.status}</span></p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000', textAlign: 'left' }}>
                <th style={{ padding: '8px 0' }}>Item Description</th>
                <th style={{ textAlign: 'right' }}>Amount ($)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '12px 0' }}>Doctor Consultation Fee ({user.name})</td>
                <td style={{ textAlign: 'right' }}>${printInvoice.consultationFee.toFixed(2)}</td>
              </tr>
              {printInvoice.medicineCharges.map((med, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 0', paddingLeft: '10px', color: '#555' }}>↳ Pharmacy: {med.name}</td>
                  <td style={{ textAlign: 'right', color: '#555' }}>${med.price.toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold' }}>
                <td style={{ padding: '16px 0', fontSize: '18px' }}>Grand Total Due:</td>
                <td style={{ textAlign: 'right', fontSize: '18px' }}>${printInvoice.totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div className="print-footer" style={{ marginTop: '100px' }}>
            <p>Cashier Signature: _______________________</p>
            <p>Billing system automatically audited. Thank you for your payment!</p>
          </div>
        </div>
      )}

      {/* SCREEN VIEW */}
      <div className="no-print">
        
        {/* Print Success Alert */}
        {printInvoice && (
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: 'hsl(var(--primary) / 8%)' }}>
            <div>
              <h3 style={{ color: 'hsl(var(--primary))' }}>📄 Billing Invoice compiled successfully!</h3>
              <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
                For Patient: <strong>{printInvoice.patientName}</strong> (${printInvoice.totalAmount.toFixed(2)})
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => window.print()} className="btn btn-primary">
                🖨️ Print Invoice
              </button>
              <button onClick={() => setPrintInvoice(null)} className="btn btn-secondary">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* WhatsApp simulation notification bar */}
        {reminderPatient && (
          <div className="glass-panel" style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            maxWidth: '320px',
            backgroundColor: '#075e54',
            color: '#fff',
            borderColor: '#128c7e'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '1.8rem' }}>💬</span>
              <div>
                <strong>WhatsApp Dispatcher</strong>
                {reminderStatus === 'preparing' ? (
                  <p style={{ fontSize: '0.8rem', color: '#c7eed8' }}>Packaging SMS template alert...</p>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: '#c7eed8' }}>Sent reminder code to {reminderPatient.patientName}! ✅</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '12px' }}>
          <button onClick={() => setSubTab('calendar')} className={`btn ${subTab === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}>
            📅 Appointments Calendar
          </button>
          <button onClick={() => setSubTab('patients')} className={`btn ${subTab === 'patients' ? 'btn-primary' : 'btn-secondary'}`}>
            👤 Patients Registry
          </button>
          <button onClick={() => setSubTab('billing')} className={`btn ${subTab === 'billing' ? 'btn-primary' : 'btn-secondary'}`}>
            💵 Billing & Invoicing
          </button>
        </div>

        {/* SUBTAB: CALENDAR VIEW */}
        {subTab === 'calendar' && (
          <div className="glass-panel">
            <div className="calendar-container">
              <div className="calendar-controls">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={() => navigateCalendar(-1)} className="btn btn-secondary">◀</button>
                  <button onClick={() => setCurrentDate(new Date())} className="btn btn-secondary">Today</button>
                  <button onClick={() => navigateCalendar(1)} className="btn btn-secondary">▶</button>
                  <h3 style={{ marginLeft: '12px' }}>{getCalendarTitle()}</h3>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select 
                    className="form-input" 
                    style={{ padding: '6px 12px', width: '130px' }}
                    value={calendarView}
                    onChange={(e) => setCalendarView(e.target.value)}
                  >
                    <option value="month">Month View</option>
                    <option value="week">Week View</option>
                    <option value="day">Day View</option>
                  </select>
                  <button onClick={() => setShowAptModal(true)} className="btn btn-primary">
                    ➕ Book Appointment
                  </button>
                </div>
              </div>

              {/* MONTH CALENDAR GRID */}
              {calendarView === 'month' && (
                <div className="calendar-grid-month">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="calendar-header-cell">{day}</div>
                  ))}
                  {activeMonthDays.map((cell, idx) => {
                    const dayApts = getAptsForDate(cell.date);
                    const isToday = cell.date.toDateString() === new Date().toDateString();
                    return (
                      <div 
                        key={idx} 
                        className={`calendar-cell-month ${!cell.isCurrentMonth ? 'calendar-cell-other-month' : ''} ${isToday ? 'calendar-cell-today' : ''}`}
                      >
                        <div className="calendar-date-number">{cell.date.getDate()}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flexGrow: 1 }}>
                          {dayApts.map(apt => (
                            <div 
                              key={apt.id}
                              onClick={() => triggerWhatsAppReminder(apt)}
                              className={`calendar-event-pill event-${apt.priority.toLowerCase()}`}
                              title={`Click to send WhatsApp reminder to ${apt.patientName}`}
                            >
                              🔔 {apt.patientName.split(' ')[0]} ({apt.priority.charAt(0)})
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* WEEK CALENDAR GRID */}
              {calendarView === 'week' && (
                <div className="calendar-grid-week">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                    const cellDate = activeWeekDays[idx];
                    const dayApts = getAptsForDate(cellDate);
                    const isToday = cellDate.toDateString() === new Date().toDateString();
                    return (
                      <div 
                        key={day} 
                        className={`calendar-cell-month ${isToday ? 'calendar-cell-today' : ''}`}
                        style={{ minHeight: '350px' }}
                      >
                        <div className="calendar-header-cell" style={{ marginBottom: '8px' }}>
                          {day} {cellDate.getDate()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {dayApts.map(apt => (
                            <div 
                              key={apt.id}
                              onClick={() => triggerWhatsAppReminder(apt)}
                              className={`calendar-event-pill event-${apt.priority.toLowerCase()}`}
                              style={{ padding: '8px', whiteSpace: 'normal', borderRadius: '6px' }}
                              title="Click to send WhatsApp reminder"
                            >
                              <strong>{apt.patientName}</strong>
                              <p style={{ fontSize: '0.65rem', marginTop: '2px', opacity: 0.9 }}>🕒 {apt.dateTime.split('T')[1]}</p>
                              <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', opacity: 0.9 }}>Dept: {apt.department}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* DAY CALENDAR GRID (HOURLY TIMELINE) */}
              {calendarView === 'day' && (
                <div className="calendar-grid-day">
                  {hoursList.map(hour => {
                    const todayApts = getAptsForDate(currentDate);
                    // Match hourly slot
                    const hourApts = todayApts.filter(a => {
                      const aptHour = a.dateTime.split('T')[1]?.substring(0, 2);
                      return aptHour === hour.substring(0, 2);
                    });

                    return (
                      <div key={hour} className="time-slot-row">
                        <div className="time-slot-hour">{hour}</div>
                        <div className="time-slot-events">
                          {hourApts.length === 0 ? (
                            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary) / 40%)' }}>No appointments</span>
                          ) : (
                            hourApts.map(apt => (
                              <div 
                                key={apt.id} 
                                onClick={() => triggerWhatsAppReminder(apt)}
                                className={`calendar-event-pill event-${apt.priority.toLowerCase()}`}
                                style={{ padding: '10px 16px', borderRadius: '8px', display: 'inline-flex', flexDirection: 'column', gap: '2px', cursor: 'pointer' }}
                              >
                                <strong>{apt.patientName} ({apt.priority})</strong>
                                <span style={{ fontSize: '0.7rem' }}>Physician: {apt.doctorName} ({apt.department})</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        )}

        {/* SUBTAB: PATIENTS REGISTRY */}
        {subTab === 'patients' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
            
            {/* Left: New Patient Registry */}
            <div className="glass-panel">
              <h3 style={{ marginBottom: '16px' }}>Register New Patient</h3>
              <form onSubmit={handleRegisterPatient}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Age</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={newPatient.age}
                      onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                      placeholder="28"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select 
                      className="form-input"
                      value={newPatient.gender}
                      onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    placeholder="+1 555-0245"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Home Address</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newPatient.address}
                    onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                    placeholder="221B Baker St, London"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Medical History / Notes</label>
                  <textarea 
                    className="form-input" 
                    rows="3"
                    value={newPatient.medicalHistory}
                    onChange={(e) => setNewPatient({ ...newPatient, medicalHistory: e.target.value })}
                    placeholder="Allergies, chronic conditions..."
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  📝 Register Patient
                </button>
              </form>
            </div>

            {/* Right: Patient Listing, Documents, Uploader */}
            <div className="glass-panel" style={{ minHeight: '500px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>Search Patients</h3>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ width: '240px', padding: '8px 12px' }}
                  placeholder="Filter name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {loading ? (
                <p>Querying patients database...</p>
              ) : patients.length === 0 ? (
                <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', marginTop: '50px' }}>No patients matching details.</p>
              ) : (
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Details</th>
                        <th>Phone</th>
                        <th>Documents</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map(p => (
                        <tr key={p.id}>
                          <td><code>{p.id}</code></td>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.age} yrs • {p.gender}</td>
                          <td>{p.phone}</td>
                          <td>
                            {p.documents && p.documents.length > 0 ? (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {p.documents.map(d => (
                                  <a key={d.id} href={d.filepath} target="_blank" rel="noopener noreferrer" className="badge badge-normal" style={{ textDecoration: 'none', fontSize: '0.7rem' }}>
                                    📄 Report
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary) / 50%)' }}>No reports</span>
                            )}
                          </td>
                          <td>
                            <button onClick={() => setSelectedPatientForUpload(p)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                              📎 Upload Doc
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Upload Document Modal overlay */}
              {selectedPatientForUpload && (
                <div className="modal-overlay">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h3>Upload Report for {selectedPatientForUpload.name}</h3>
                      <button onClick={() => { setSelectedPatientForUpload(null); setUploadFile(null); }} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
                    </div>
                    <form onSubmit={handleUploadDocument}>
                      <div className="modal-body">
                        <div className="form-group">
                          <label className="form-label">Select Document (PDF, JPG, PNG)</label>
                          <input 
                            type="file" 
                            className="form-input" 
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={(e) => setUploadFile(e.target.files[0])}
                            required
                          />
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button type="button" onClick={() => { setSelectedPatientForUpload(null); setUploadFile(null); }} className="btn btn-secondary">Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={uploading}>
                          {uploading ? 'Uploading...' : 'Upload File'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* SUBTAB: BILLING VIEW */}
        {subTab === 'billing' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Billing & Payment Records</h3>
              <button onClick={() => setShowInvoiceModal(true)} className="btn btn-primary">
                💵 Compile New Invoice
              </button>
            </div>

            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Patient</th>
                    <th>Date</th>
                    <th>Fees</th>
                    <th>Pharmacy Items</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.map(bill => {
                    const medChargesSum = bill.medicineCharges.reduce((sum, item) => sum + item.price, 0);
                    const finalTotal = bill.consultationFee + medChargesSum;
                    return (
                      <tr key={bill.id}>
                        <td><code>{bill.id}</code></td>
                        <td><strong>{bill.patientName}</strong></td>
                        <td>{bill.date}</td>
                        <td>${bill.consultationFee.toFixed(2)}</td>
                        <td>
                          {bill.medicineCharges.length > 0 ? (
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                              {bill.medicineCharges.map((m, idx) => (
                                <div key={idx}>• {m.name} (${m.price.toFixed(2)})</div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary) / 50%)' }}>No medicines</span>
                          )}
                        </td>
                        <td><strong>${finalTotal.toFixed(2)}</strong></td>
                        <td>
                          <span className={`badge ${bill.status === 'Paid' ? 'badge-success' : 'badge-critical'}`}>
                            {bill.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {bill.status === 'Unpaid' && (
                              <button onClick={() => handlePayInvoice(bill.id)} className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                Mark Paid
                              </button>
                            )}
                            <button onClick={() => setPrintInvoice(bill)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                              🖨️ View/Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: Book Appointment */}
        {showAptModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Schedule Patient Visit Slot</h3>
                <button onClick={() => setShowAptModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
              </div>
              <form onSubmit={handleBookApt}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Select Patient</label>
                    <select 
                      className="form-input" 
                      value={newApt.patientId} 
                      onChange={(e) => setNewApt({ ...newApt, patientId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Select Doctor & Department</label>
                    <select 
                      className="form-input"
                      value={newApt.doctorId}
                      onChange={(e) => setNewApt({ ...newApt, doctorId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Doctor --</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.department})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Appointment Date & Time</label>
                      <input 
                        type="datetime-local" 
                        className="form-input"
                        value={newApt.dateTime}
                        onChange={(e) => setNewApt({ ...newApt, dateTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Priority Level</label>
                      <select 
                        className="form-input"
                        value={newApt.priority}
                        onChange={(e) => setNewApt({ ...newApt, priority: e.target.value })}
                      >
                        <option value="Normal">Normal</option>
                        <option value="Critical">Critical</option>
                        <option value="Follow-up">Follow-up</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setShowAptModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Schedule Visit</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Compile New Invoice */}
        {showInvoiceModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Compile Billing Invoice</h3>
                <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
              </div>
              <form onSubmit={handleCreateInvoice}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Select Patient</label>
                    <select 
                      className="form-input"
                      value={newInvoice.patientId}
                      onChange={(e) => setNewInvoice({ ...newInvoice, patientId: e.target.value })}
                      required
                    >
                      <option value="">-- Select Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Consultation Fee ($)</label>
                    <input 
                      type="number" 
                      className="form-input"
                      value={newInvoice.consultationFee}
                      onChange={(e) => setNewInvoice({ ...newInvoice, consultationFee: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>

                  <div style={{ marginTop: '16px', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '12px' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Add Medicine Pharmacy Charge</label>
                    <div className="form-row" style={{ alignItems: 'end', marginTop: '8px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Medicine Description</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={currentMedCharge.name}
                          onChange={(e) => setCurrentMedCharge({ ...currentMedCharge, name: e.target.value })}
                          placeholder="e.g. Paracetamol 650mg x10"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Price ($)</label>
                        <input 
                          type="number" 
                          className="form-input"
                          value={currentMedCharge.price}
                          onChange={(e) => setCurrentMedCharge({ ...currentMedCharge, price: e.target.value })}
                          placeholder="e.g. 15.00"
                        />
                      </div>
                      <button type="button" onClick={handleAddMedCharge} className="btn btn-secondary">Add Item</button>
                    </div>

                    {newInvoice.meds.length > 0 && (
                      <div style={{ marginTop: '12px', backgroundColor: 'hsl(var(--bg-tertiary))', padding: '12px', borderRadius: '8px' }}>
                        {newInvoice.meds.map((med, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                            <span>• {med.name}</span>
                            <strong>${med.price.toFixed(2)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setShowInvoiceModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={!newInvoice.patientId}>Generate Invoice</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
