import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [billing, setBilling] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [patients, setPatients] = useState([]);

  // Active Consult State
  const [activeConsult, setActiveConsult] = useState(null); // appointment object
  const [activePatient, setActivePatient] = useState(null); // patient object

  // Form States for active consult
  const [diagnosis, setDiagnosis] = useState('');
  const [allergies, setAllergies] = useState('');
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [prescribedMeds, setPrescribedMeds] = useState([]); // array of { name, dosage, frequency, duration }
  const [currentMed, setCurrentMed] = useState({ name: '', dosage: '1 tablet', frequency: 'Twice daily', duration: '5 days' });

  // AI & Voice states
  const [isRecording, setIsRecording] = useState(false);
  const [symptomQuery, setSymptomQuery] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Printing State
  const [printPrescription, setPrintPrescription] = useState(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [savingConsult, setSavingConsult] = useState(false);
  const [error, setError] = useState('');

  // Voice Speech Recognition Setup
  let recognition = null;
  if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [apts, rxs, bills, invs, pats] = await Promise.all([
        api.getAppointments(),
        api.getPrescriptions(),
        api.getBilling(),
        api.getInventory(),
        api.getPatients()
      ]);
      setAppointments(apts);
      setPrescriptions(rxs);
      setBilling(bills);
      setInventory(invs);
      setPatients(pats);
    } catch (err) {
      setError('Error compiling clinic analytics data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDictation = () => {
    if (!recognition) {
      alert('Speech Recognition is not supported in this browser. Try Google Chrome.');
      return;
    }
    setError('');
    setIsRecording(true);
    recognition.start();

    recognition.onresult = (event) => {
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript;
      setDiagnosis(prev => prev ? prev + ' ' + transcript : transcript);
    };

    recognition.onerror = (e) => {
      console.error('Speech recognition error', e);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };
  };

  const handleStopDictation = () => {
    if (recognition) {
      recognition.stop();
      setIsRecording(false);
    }
  };

  const handleAskAI = async () => {
    if (!symptomQuery.trim()) return;
    setAiLoading(true);
    setAiSuggestions(null);
    try {
      const result = await api.checkSymptoms(symptomQuery);
      setAiSuggestions(result);
    } catch (err) {
      console.error(err);
      alert('AI Symptom check failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSelectPatient = (apt) => {
    setActiveConsult(apt);
    const pat = patients.find(p => p.id === apt.patientId);
    setActivePatient(pat);
    
    // Autofill initial values
    setDiagnosis('');
    setAllergies(pat ? pat.medicalHistory : '');
    setNextVisitDate('');
    setPrescribedMeds([]);
    setSymptomQuery('');
    setAiSuggestions(null);
    setError('');
  };

  const handleAddMed = () => {
    if (!currentMed.name) return;
    setPrescribedMeds([...prescribedMeds, currentMed]);
    setCurrentMed({ name: '', dosage: '1 tablet', frequency: 'Twice daily', duration: '5 days' });
  };

  const handleRemoveMed = (index) => {
    setPrescribedMeds(prescribedMeds.filter((_, i) => i !== index));
  };

  const handleSubmitConsult = async (e) => {
    e.preventDefault();
    if (!activeConsult) return;
    if (!diagnosis.trim()) {
      setError('Please fill in the diagnosis details.');
      return;
    }
    if (prescribedMeds.length === 0) {
      setError('Prescription must contain at least one medicine.');
      return;
    }

    setSavingConsult(true);
    setError('');

    try {
      // 1. Create prescription
      const rx = await api.createPrescription({
        appointmentId: activeConsult.id,
        patientId: activeConsult.patientId,
        diagnosis,
        allergies,
        medicines: prescribedMeds,
        nextVisitDate
      });

      // 2. Automatically generate Billing entry for medicines and consultation
      const medicineCharges = prescribedMeds.map(med => {
        const invMatch = inventory.find(i => i.name === med.name);
        return {
          name: med.name,
          price: invMatch ? invMatch.unitPrice * (parseInt(med.duration) || 5) : 50
        };
      });

      await api.createBilling({
        patientId: activeConsult.patientId,
        consultationFee: 150, // Standard consultation charge
        medicineCharges: medicineCharges
      });

      // Show print receipt
      setPrintPrescription(rx);
      
      // Reset consultation workspace
      setActiveConsult(null);
      setActivePatient(null);

      // Refresh data
      await fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Error processing consultation records.');
    } finally {
      setSavingConsult(false);
    }
  };

  // Real-time calculated analytics helper
  const getAnalytics = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayApts = appointments.filter(a => a.dateTime.startsWith(todayStr));
    
    // Revenue calculations from Paid invoices
    const monthlyRevenue = billing
      .filter(b => b.status === 'Paid')
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // Disease frequency dictionary tracking
    const diseases = {};
    prescriptions.forEach(p => {
      const diag = p.diagnosis.toLowerCase();
      // Match common disease keywords for aggregate chart
      let matched = false;
      ['flu', 'cold', 'infection', 'asthma', 'angina', 'acid reflux', 'diabetes', 'hypertension', 'migraine', 'arthritis'].forEach(d => {
        if (diag.includes(d)) {
          diseases[d] = (diseases[d] || 0) + 1;
          matched = true;
        }
      });
      if (!matched) {
        // extract first 2 words
        const words = p.diagnosis.split(' ').slice(0, 2).join(' ');
        diseases[words] = (diseases[words] || 0) + 1;
      }
    });

    const commonDisease = Object.entries(diseases).sort((a,b) => b[1] - a[1])[0];

    // Inventory warning count
    const lowStockAlerts = inventory.filter(item => item.stock < item.minThreshold).length;

    return {
      todayCount: todayApts.length,
      revenue: monthlyRevenue,
      disease: commonDisease ? `${commonDisease[0]} (${commonDisease[1]} cases)` : 'None recorded yet',
      lowStock: lowStockAlerts
    };
  };

  const stats = getAnalytics();
  const queue = appointments.filter(a => a.status === 'Scheduled');

  // Autocomplete Inventory Medicine helper
  const selectedMedInventoryInfo = inventory.find(item => item.name === currentMed.name);
  const isStockLow = selectedMedInventoryInfo && selectedMedInventoryInfo.stock < selectedMedInventoryInfo.minThreshold;

  return (
    <div>
      {/* 1. PRINT DIALOG VIEW OVERLAY (HIDDEN ON SCREEN, REVEALED IN PRINT ONLY) */}
      {printPrescription && (
        <div className="print-only print-card">
          <div className="clinic-letterhead">
            <h1>🏥 MediSync Telehealth Clinic</h1>
            <p>123 Medical Plaza, Suite 400 • Tel: +1 555-0100 • info@medisync.com</p>
            <p><strong>Issued By:</strong> {printPrescription.doctorName} ({user.department})</p>
          </div>
          
          <div className="prescription-grid">
            <div>
              <h3>PATIENT INFORMATION</h3>
              <p><strong>Name:</strong> {printPrescription.patientName}</p>
              <p><strong>Date:</strong> {printPrescription.date}</p>
            </div>
            <div>
              <h3>CLINICAL SYNOPSIS</h3>
              <p><strong>Diagnosis:</strong> {printPrescription.diagnosis}</p>
              <p><strong>Allergies Recorded:</strong> {printPrescription.allergies}</p>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <span className="prescription-rx">Rx</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000', textAlign: 'left' }}>
                  <th style={{ padding: '8px 0' }}>Medicine Name</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {printPrescription.medicines.map((med, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px 0', fontWeight: 'bold' }}>{med.name}</td>
                    <td>{med.dosage}</td>
                    <td>{med.frequency}</td>
                    <td>{med.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {printPrescription.nextVisitDate && (
            <p style={{ marginTop: '30px', fontSize: '13px' }}>
              <strong>Follow-up Consultation Appointment:</strong> {printPrescription.nextVisitDate}
            </p>
          )}

          <div className="print-footer">
            <p>Authorized Signature: _______________________</p>
            <p>Thank you for choosing MediSync. Feel better soon!</p>
          </div>
        </div>
      )}

      {/* NO-PRINT SCREEN WORKSPACE */}
      <div className="no-print">
        {/* Real-time Analytics Cards */}
        <div className="dashboard-grid">
          <div className="analytics-card">
            <div className="analytics-icon">📅</div>
            <div className="analytics-info">
              <h3>{stats.todayCount}</h3>
              <p>Today's Appointments</p>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}>💵</div>
            <div className="analytics-info">
              <h3>${stats.revenue}</h3>
              <p>Monthly Total Revenue</p>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>🦠</div>
            <div className="analytics-info">
              <h3 style={{ fontSize: '1.2rem', padding: '6px 0' }}>{stats.disease}</h3>
              <p>Most Common Disease</p>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>⚠️</div>
            <div className="analytics-info">
              <h3>{stats.lowStock}</h3>
              <p>Low Stock Medicines</p>
            </div>
          </div>
        </div>

        {/* Prescription printing alert banner */}
        {printPrescription && (
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: 'hsl(var(--primary) / 8%)' }}>
            <div>
              <h3 style={{ color: 'hsl(var(--primary))' }}>📄 Prescription Generated Successfully!</h3>
              <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
                For Patient: <strong>{printPrescription.patientName}</strong> ({printPrescription.id})
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => window.print()} className="btn btn-primary">
                🖨️ Print / Save PDF
              </button>
              <button onClick={() => setPrintPrescription(null)} className="btn btn-secondary">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Queue */}
          <div className="glass-panel" style={{ minHeight: '500px' }}>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '8px' }}>
              Consultation Queue
            </h3>
            
            {loading ? (
              <p>Loading patient lists...</p>
            ) : queue.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', marginTop: '40px' }}>
                🎉 No pending patients in queue today.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {queue.map(apt => (
                  <div 
                    key={apt.id} 
                    onClick={() => handleSelectPatient(apt)}
                    className={`glass-panel`}
                    style={{ 
                      padding: '16px', 
                      cursor: 'pointer',
                      borderColor: activeConsult?.id === apt.id ? 'hsl(var(--primary))' : 'hsl(var(--border-color))',
                      backgroundColor: activeConsult?.id === apt.id ? 'hsl(var(--primary) / 6%)' : 'hsl(var(--bg-secondary) / 50%)',
                      borderLeftWidth: '5px',
                      borderLeftColor: apt.priority === 'Critical' ? 'hsl(var(--accent-critical))' : apt.priority === 'Follow-up' ? 'hsl(var(--accent-followup))' : 'hsl(var(--accent-normal))'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1rem' }}>{apt.patientName}</strong>
                      <span className={`badge ${apt.priority === 'Critical' ? 'badge-critical' : apt.priority === 'Follow-up' ? 'badge-followup' : 'badge-normal'}`}>
                        {apt.priority}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginTop: '4px' }}>
                      📅 Slot: {apt.dateTime.replace('T', ' ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Consultation Workspace */}
          <div className="glass-panel" style={{ minHeight: '500px' }}>
            {!activeConsult ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: 'hsl(var(--text-secondary))' }}>
                <span style={{ fontSize: '4rem', marginBottom: '16px' }}>🩺</span>
                <h3>Clinical Workspace</h3>
                <p>Select a patient from the queue on the left to start consultation.</p>
              </div>
            ) : (
              <div>
                <div style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2>Consulting: {activeConsult.patientName}</h2>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginTop: '4px' }}>
                      Age: {activePatient?.age || 'N/A'} • Gender: {activePatient?.gender || 'N/A'} • Phone: {activePatient?.phone || 'N/A'}
                    </p>
                  </div>
                  <button onClick={() => { setActiveConsult(null); setActivePatient(null); }} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    Cancel
                  </button>
                </div>

                {error && (
                  <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    ⚠️ {error}
                  </div>
                )}

                {/* Patient Medical History Summary */}
                <div style={{ backgroundColor: 'hsl(var(--bg-tertiary))', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: '6px' }}>Medical History & Allergies</h4>
                  <p style={{ fontSize: '0.95rem' }}>{activePatient?.medicalHistory || 'No previous medical files recorded.'}</p>
                  
                  {activePatient?.documents && activePatient.documents.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <h5 style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Patient Uploaded Documents:</h5>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {activePatient.documents.map(doc => (
                          <a key={doc.id} href={doc.filepath} target="_blank" rel="noopener noreferrer" className="badge badge-normal" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                            📄 {doc.filename}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmitConsult}>
                  
                  {/* Speech Dictation Notes & Diagnosis */}
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label">Diagnosis & Medical Notes</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {isRecording ? (
                          <button type="button" onClick={handleStopDictation} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                            🛑 Stop Voice Note
                          </button>
                        ) : (
                          <button type="button" onClick={handleStartDictation} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'hsl(var(--accent-critical))', color: 'hsl(var(--accent-critical))' }}>
                            🎙️ Dictate Notes
                          </button>
                        )}
                        <div className={`voice-wave ${isRecording ? 'active' : ''}`}>
                          <span className="voice-bar"></span>
                          <span className="voice-bar"></span>
                          <span className="voice-bar"></span>
                          <span className="voice-bar"></span>
                          <span className="voice-bar"></span>
                        </div>
                      </div>
                    </div>
                    <textarea 
                      className="form-input"
                      rows="4"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Type patient symptoms and diagnostic findings, or use Voice Dictation..."
                      disabled={savingConsult}
                    />
                  </div>

                  {/* AI SYMPTOM HELPER EXPANSION */}
                  <div className="glass-panel" style={{ marginBottom: '20px', backgroundColor: 'hsl(var(--bg-primary) / 40%)' }}>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>💡 AI Symptom Suggestion Guide</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="text" 
                          className="form-input"
                          value={symptomQuery}
                          onChange={(e) => setSymptomQuery(e.target.value)}
                          placeholder="Search symptoms (e.g. fever, cough, chest pain)..."
                        />
                        <button type="button" onClick={handleAskAI} className="btn btn-secondary" disabled={aiLoading || !symptomQuery}>
                          {aiLoading ? 'Thinking...' : 'Analyze'}
                        </button>
                      </div>
                    </div>

                    {aiSuggestions && (
                      <div style={{ backgroundColor: 'hsl(var(--bg-secondary))', padding: '12px', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'hsl(var(--primary))' }}>Rule-Based Conditions suggestion:</h4>
                        {aiSuggestions.conditions.map((c, i) => (
                          <div key={i} style={{ marginBottom: '8px', borderBottom: i < aiSuggestions.conditions.length-1 ? '1px solid hsl(var(--border-color))' : 'none', paddingBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong>{c.name}</strong>
                              <span className={`badge ${c.probability === 'Critical' ? 'badge-critical' : 'badge-normal'}`}>{c.probability}</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>{c.recommendation}</p>
                            <button 
                              type="button" 
                              onClick={() => {
                                setDiagnosis(prev => prev ? prev + `. Suggested condition: ${c.name}` : `Suggested condition: ${c.name}`);
                              }}
                              className="btn btn-secondary" 
                              style={{ padding: '2px 8px', fontSize: '0.72rem', marginTop: '6px' }}
                            >
                              + Append to Notes
                            </button>
                          </div>
                        ))}
                        <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontStyle: 'italic', marginTop: '10px' }}>
                          ⚠️ {aiSuggestions.disclaimer}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Prescription Allergies & Next Visit */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Allergies / Special Warnings</label>
                      <input 
                        type="text" 
                        className="form-input"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                        placeholder="e.g. Penicillin, Lactose intolerant"
                        disabled={savingConsult}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Next Visit / Follow-up Date</label>
                      <input 
                        type="date" 
                        className="form-input"
                        value={nextVisitDate}
                        onChange={(e) => setNextVisitDate(e.target.value)}
                        disabled={savingConsult}
                      />
                    </div>
                  </div>

                  {/* Prescribed Medicines Builder */}
                  <div style={{ marginTop: '20px', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '16px' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>🛠️ Prescribe Medicines</label>
                    
                    <div className="form-row" style={{ alignItems: 'end', marginBottom: '16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Medicine Name</label>
                        <select 
                          className="form-input"
                          value={currentMed.name}
                          onChange={(e) => setCurrentMed({ ...currentMed, name: e.target.value })}
                          disabled={savingConsult}
                        >
                          <option value="">-- Choose Medicine --</option>
                          {inventory.map(item => (
                            <option key={item.id} value={item.name}>
                              {item.name} (Stock: {item.stock})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Dosage</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={currentMed.dosage}
                          onChange={(e) => setCurrentMed({ ...currentMed, dosage: e.target.value })}
                          placeholder="e.g. 1 tablet"
                          disabled={savingConsult}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Frequency</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={currentMed.frequency}
                          onChange={(e) => setCurrentMed({ ...currentMed, frequency: e.target.value })}
                          placeholder="e.g. Twice daily"
                          disabled={savingConsult}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Duration</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={currentMed.duration}
                          onChange={(e) => setCurrentMed({ ...currentMed, duration: e.target.value })}
                          placeholder="e.g. 5 days"
                          disabled={savingConsult}
                        />
                      </div>

                      <button type="button" onClick={handleAddMed} className="btn btn-secondary" style={{ height: '42px' }} disabled={savingConsult || !currentMed.name}>
                        Add
                      </button>
                    </div>

                    {/* Stock Alert Warning */}
                    {currentMed.name && selectedMedInventoryInfo && (
                      <div style={{ marginBottom: '16px', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', backgroundColor: isStockLow ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)', border: isStockLow ? '1px solid #f59e0b' : '1px solid #22c55e', color: isStockLow ? '#f59e0b' : '#22c55e' }}>
                        {isStockLow ? (
                          <strong>⚠️ Low Stock Alert: Pre-ordering recommended! Only {selectedMedInventoryInfo.stock} units left in clinic inventory.</strong>
                        ) : (
                          <strong>✅ Stock OK: {selectedMedInventoryInfo.stock} units available.</strong>
                        )}
                      </div>
                    )}

                    {/* Prescribed List Table */}
                    {prescribedMeds.length > 0 && (
                      <div className="custom-table-container" style={{ marginBottom: '24px' }}>
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Medicine</th>
                              <th>Dosage</th>
                              <th>Frequency</th>
                              <th>Duration</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prescribedMeds.map((med, index) => (
                              <tr key={index}>
                                <td><strong>{med.name}</strong></td>
                                <td>{med.dosage}</td>
                                <td>{med.frequency}</td>
                                <td>{med.duration}</td>
                                <td>
                                  <button type="button" onClick={() => handleRemoveMed(index)} className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '48px', marginTop: '12px' }} disabled={savingConsult}>
                    {savingConsult ? 'Completing Diagnosis & billing...' : '📋 Complete Consultation & Issue Prescription'}
                  </button>

                </form>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
