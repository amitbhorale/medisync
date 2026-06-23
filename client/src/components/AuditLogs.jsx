import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filterAction, setFilterAction] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Error fetching logs', err);
    } finally {
      setLoading(false);
    }
  };

  const actionsList = [
    'ALL',
    'DATABASE_INITIALIZATION',
    'USER_LOGIN',
    'PATIENT_REGISTER',
    'PATIENT_CREATE',
    'PATIENT_DOC_UPLOAD',
    'APPOINTMENT_CREATE',
    'APPOINTMENT_UPDATE',
    'PRESCRIPTION_CREATE',
    'INVENTORY_DEDUCTION',
    'INVENTORY_ADD',
    'INVENTORY_UPDATE',
    'BILLING_CREATE',
    'BILLING_PAYMENT'
  ];

  const filteredLogs = filterAction === 'ALL' 
    ? logs 
    : logs.filter(l => l.action === filterAction);

  return (
    <div className="glass-panel" style={{ minHeight: '500px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Security & System Audit logs</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginTop: '4px' }}>
            Chronological ledger of user interactions, modifications, database mutations, and login checks.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>Filter Event:</span>
          <select 
            className="form-input" 
            style={{ width: '220px', padding: '8px 12px' }}
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            {actionsList.map(act => (
              <option key={act} value={act}>{act.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p>Retrieving transaction audits...</p>
      ) : filteredLogs.length === 0 ? (
        <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', marginTop: '50px' }}>
          No logged actions found for the selected category.
        </p>
      ) : (
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator</th>
                <th>Role</th>
                <th>Event Type</th>
                <th>Operation Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    <code>{log.timestamp.replace('T', ' ').substring(0, 19)}</code>
                  </td>
                  <td>
                    <strong>{log.userName}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>ID: {log.userId}</div>
                  </td>
                  <td>
                    <span className={`badge ${log.role === 'Doctor' ? 'badge-critical' : log.role === 'Staff' ? 'badge-normal' : log.role === 'Patient' ? 'badge-success' : 'badge-normal'}`} style={{ fontSize: '0.65rem' }}>
                      {log.role}
                    </span>
                  </td>
                  <td>
                    <code style={{ 
                      backgroundColor: 'hsl(var(--bg-tertiary))', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      color: 'hsl(var(--primary))',
                      fontWeight: 'bold',
                      fontSize: '0.8rem'
                    }}>
                      {log.action}
                    </code>
                  </td>
                  <td style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
