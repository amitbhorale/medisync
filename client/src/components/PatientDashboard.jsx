import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [patientRecord, setPatientRecord] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [billing, setBilling] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Form: Symptom Checker
  const [symptoms, setSymptoms] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Form: Book Appointment
  const [bookDept, setBookDept] = useState('Cardiology');
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDateTime, setBookDateTime] = useState('');
  const [booking, setBooking] = useState(false);

  // Load state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPatientData();
  }, []);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const [apts, rxs, bills, docs] = await Promise.all([
        api.getAppointments(),
        api.getPrescriptions(),
        api.getBilling(),
        fetch('/api/patients').then(() => {
          return [
            { id: 'usr_doc_1', name: 'Dr. Sarah Connor', department: 'Cardiology' },
            { id: 'usr_doc_2', name: 'Dr. Charles Xavier', department: 'Pediatrics' }
          ];
        })
      ]);
      setAppointments(apts);
      setPrescriptions(rxs);
      setBilling(bills);
      setDoctors(docs);

      // Fetch patient file profile (including uploaded reports)
      const patientList = await api.getPatients(user.name);
      const record = patientList.find(p => p.name === user.name);
      if (record) {
        setPatientRecord(record);
      }
    } catch (err) {
      setError('Error compiling medical histories.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAISymptomCheck = async (e) => {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setAiLoading(true);
    setAiSuggestions(null);
    try {
      const result = await api.checkSymptoms(symptoms);
      setAiSuggestions(result);
    } catch (err) {
      console.error(err);
      alert('Symptom analysis failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!bookDoctorId || !bookDateTime) {
      alert('Please select a doctor and appointment date-time.');
      return;
    }
    setBooking(true);
    try {
      const doctor = doctors.find(d => d.id === bookDoctorId);
      await api.createAppointment({
        patientId: patientRecord?.id || 'pat_unlinked',
        patientName: user.name,
        doctorId: bookDoctorId,
        dateTime: bookDateTime,
        priority: 'Normal'
      });
      alert('Your appointment slot is locked! We look forward to seeing you.');
      setBookDoctorId('');
      setBookDateTime('');
      fetchPatientData();
    } catch (err) {
      alert(err.message || 'Error booking appointment slot.');
    } finally {
      setBooking(false);
    }
  };

  // Filter doctors by selected department
  const filteredDoctors = doctors.filter(d => d.department === bookDept);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Booking & AI Symptoms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* AI SYMPTOM CHECKER */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '12px' }}>💡 AI Symptom Assistant</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', marginBottom: '16px' }}>
              Describe your symptoms below to get potential conditions.
            </p>
            
            <form onSubmit={handleAISymptomCheck}>
              <div className="form-group">
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. I have a high fever, cough, and runny nose..."
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={aiLoading || !symptoms.trim()}>
                {aiLoading ? 'Analyzing Symptoms...' : 'Analyze Health Condition'}
              </button>
            </form>

            {aiSuggestions && (
              <div style={{ marginTop: '16px', backgroundColor: 'hsl(var(--bg-tertiary))', padding: '16px', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
                <h4 style={{ fontSize: '0.92rem', marginBottom: '8px', color: 'hsl(var(--primary))' }}>Matching Possibilities:</h4>
                
                {aiSuggestions.conditions.map((cond, idx) => (
                  <div key={idx} style={{ marginBottom: '12px', borderBottom: idx < aiSuggestions.conditions.length - 1 ? '1px solid hsl(var(--border-color))' : 'none', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{cond.name}</strong>
                      <span className={`badge ${cond.probability === 'Critical' ? 'badge-critical' : 'badge-normal'}`}>{cond.probability}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginTop: '4px' }}>{cond.recommendation}</p>
                  </div>
                ))}

                <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', fontStyle: 'italic', marginTop: '10px', lineHeight: '1.4' }}>
                  ⚠️ {aiSuggestions.disclaimer}
                </p>
              </div>
            )}
          </div>

          {/* APPOINTMENT BOOKER */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px' }}>📅 Book Consultation</h3>
            <form onSubmit={handleBookAppointment}>
              <div className="form-group">
                <label className="form-label">Clinic Department</label>
                <select 
                  className="form-input"
                  value={bookDept}
                  onChange={(e) => { setBookDept(e.target.value); setBookDoctorId(''); }}
                >
                  <option value="Cardiology">Cardiology</option>
                  <option value="Pediatrics">Pediatrics</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Practitioner</label>
                <select 
                  className="form-input"
                  value={bookDoctorId}
                  onChange={(e) => setBookDoctorId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Doctor --</option>
                  {filteredDoctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Date & Time</label>
                <input 
                  type="datetime-local" 
                  className="form-input"
                  value={bookDateTime}
                  onChange={(e) => setBookDateTime(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={booking}>
                {booking ? 'Locking Appointment...' : '📅 Reserve Slot'}
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: MY HEALTH RECORDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* PRESCRIPTIONS HISTORY */}
          <div className="glass-panel" style={{ minHeight: '260px' }}>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '8px' }}>
              My Digital Prescriptions
            </h3>

            {loading ? (
              <p>Loading prescription history...</p>
            ) : prescriptions.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', marginTop: '40px' }}>
                No prescription files recorded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {prescriptions.map(rx => (
                  <div key={rx.id} style={{ border: '1px solid hsl(var(--border-color))', borderRadius: '8px', padding: '16px', backgroundColor: 'hsl(var(--bg-secondary) / 50%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong>Dr. {rx.doctorName}</strong>
                      <span className="badge badge-success">{rx.date}</span>
                    </div>
                    <p style={{ fontSize: '0.9rem' }}><strong>Diagnosis:</strong> {rx.diagnosis}</p>
                    <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginTop: '4px' }}><strong>Allergies Warning:</strong> {rx.allergies}</p>
                    
                    <div style={{ marginTop: '10px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Prescribed Medicines:</span>
                      <ul style={{ paddingLeft: '16px', marginTop: '4px', fontSize: '0.85rem' }}>
                        {rx.medicines.map((med, idx) => (
                          <li key={idx}><strong>{med.name}</strong> - {med.dosage} ({med.frequency} for {med.duration})</li>
                        ))}
                      </ul>
                    </div>

                    {rx.nextVisitDate && (
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', marginTop: '10px', fontWeight: 600 }}>
                        📅 Follow-up scheduled for: {rx.nextVisitDate}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LAB REPORTS & UPLOADS */}
          <div className="glass-panel" style={{ minHeight: '200px' }}>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '8px' }}>
              My Medical Reports
            </h3>

            {loading ? (
              <p>Searching lab folders...</p>
            ) : !patientRecord?.documents || patientRecord.documents.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', marginTop: '40px' }}>
                No lab report files uploaded yet.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                {patientRecord.documents.map(doc => (
                  <div key={doc.id} style={{ border: '1px solid hsl(var(--border-color))', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'hsl(var(--bg-secondary) / 50%)' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <strong style={{ fontSize: '0.88rem', display: 'block', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }} title={doc.filename}>
                        {doc.filename}
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))' }}>
                        Uploaded: {doc.uploadedAt.split('T')[0]}
                      </span>
                    </div>
                    <a href={doc.filepath} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                      📥 Open
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* INVOICES & PAYMENTS */}
          <div className="glass-panel" style={{ minHeight: '200px' }}>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '8px' }}>
              Invoices & Billing Statements
            </h3>

            {loading ? (
              <p>Fetching balance statements...</p>
            ) : billing.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', marginTop: '40px' }}>
                No billing statements recorded.
              </p>
            ) : (
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Date</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.map(bill => (
                      <tr key={bill.id}>
                        <td><code>{bill.id}</code></td>
                        <td>{bill.date}</td>
                        <td><strong>${bill.totalAmount.toFixed(2)}</strong></td>
                        <td>
                          <span className={`badge ${bill.status === 'Paid' ? 'badge-success' : 'badge-critical'}`}>
                            {bill.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
