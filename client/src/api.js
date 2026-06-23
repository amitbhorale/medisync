// Centralized Client API Service

const getAuthHeaders = () => {
  const token = localStorage.getItem('medisync_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const handleResponse = async (res) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${res.status}`);
  }
  return res.json();
};

export const api = {
  // Auth
  login: async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return handleResponse(res);
  },

  register: async (patientData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData)
    });
    return handleResponse(res);
  },

  // Patients
  getPatients: async (search = '') => {
    const res = await fetch(`/api/patients?search=${encodeURIComponent(search)}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  createPatient: async (patientData) => {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(patientData)
    });
    return handleResponse(res);
  },

  uploadDocument: async (patientId, file) => {
    const formData = new FormData();
    formData.append('document', file);

    const res = await fetch(`/api/patients/${patientId}/upload`, {
      method: 'POST',
      headers: getAuthHeaders(), // Fetch auto-adds Multipart Boundary header when body is FormData
      body: formData
    });
    return handleResponse(res);
  },

  // Appointments
  getAppointments: async () => {
    const res = await fetch('/api/appointments', {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  createAppointment: async (appointmentData) => {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(appointmentData)
    });
    return handleResponse(res);
  },

  updateAppointmentStatus: async (id, status) => {
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ status })
    });
    return handleResponse(res);
  },

  // Prescriptions
  getPrescriptions: async () => {
    const res = await fetch('/api/prescriptions', {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  createPrescription: async (prescriptionData) => {
    const res = await fetch('/api/prescriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(prescriptionData)
    });
    return handleResponse(res);
  },

  // Billing
  getBilling: async () => {
    const res = await fetch('/api/billing', {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  createBilling: async (billingData) => {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(billingData)
    });
    return handleResponse(res);
  },

  payBilling: async (id) => {
    const res = await fetch(`/api/billing/${id}/pay`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Inventory
  getInventory: async () => {
    const res = await fetch('/api/inventory', {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  updateInventoryItem: async (id, itemData) => {
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(itemData)
    });
    return handleResponse(res);
  },

  createInventoryItem: async (itemData) => {
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(itemData)
    });
    return handleResponse(res);
  },

  // Audit Logs
  getAuditLogs: async () => {
    const res = await fetch('/api/audit-logs', {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // AI Symptom Engine
  checkSymptoms: async (symptoms) => {
    const res = await fetch('/api/ai/symptom-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms })
    });
    return handleResponse(res);
  }
};
