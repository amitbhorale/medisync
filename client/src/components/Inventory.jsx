import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);

  // Form State: Add Medicine
  const [newMed, setNewMed] = useState({ name: '', stock: '', minThreshold: '10', expiryDate: '', unitPrice: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State: Edit Medicine
  const [editStock, setEditStock] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [editPrice, setEditPrice] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = await api.getInventory();
      setInventory(data);
    } catch (err) {
      console.error('Error fetching inventory', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    if (!newMed.name || newMed.stock === '' || newMed.unitPrice === '') {
      alert('Name, initial stock, and unit price are required.');
      return;
    }

    try {
      await api.createInventoryItem({
        name: newMed.name,
        stock: parseInt(newMed.stock),
        minThreshold: parseInt(newMed.minThreshold) || 10,
        expiryDate: newMed.expiryDate,
        unitPrice: parseFloat(newMed.unitPrice)
      });
      alert('New medicine added successfully!');
      setShowAddForm(false);
      setNewMed({ name: '', stock: '', minThreshold: '10', expiryDate: '', unitPrice: '' });
      fetchInventory();
    } catch (err) {
      alert(err.message || 'Failed to add medicine.');
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditStock(item.stock);
    setEditThreshold(item.minThreshold);
    setEditPrice(item.unitPrice);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      await api.updateInventoryItem(editingItem.id, {
        stock: parseInt(editStock),
        minThreshold: parseInt(editThreshold),
        unitPrice: parseFloat(editPrice)
      });
      alert('Stock adjustments applied!');
      setEditingItem(null);
      fetchInventory();
    } catch (err) {
      alert(err.message || 'Failed to update medicine details.');
    }
  };

  return (
    <div className="glass-panel" style={{ minHeight: '500px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Medicine Inventory & Pharmacy Management</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginTop: '4px' }}>
            Monitor and adjust clinic pharmacy stock levels and threshold alerts.
          </p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
          📦 Add New Medication
        </button>
      </div>

      {loading ? (
        <p>Loading pharmacy inventory...</p>
      ) : (
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Medicine Name</th>
                <th>In Stock</th>
                <th>Min Limit</th>
                <th>Unit Price</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => {
                const isLow = item.stock < item.minThreshold;
                return (
                  <tr key={item.id} style={{ backgroundColor: isLow ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                    <td><code>{item.id}</code></td>
                    <td><strong>{item.name}</strong></td>
                    <td style={{ fontWeight: 'bold', color: isLow ? 'hsl(var(--accent-critical))' : 'inherit' }}>
                      {item.stock} units
                    </td>
                    <td>{item.minThreshold} units</td>
                    <td>${item.unitPrice.toFixed(2)}</td>
                    <td>{item.expiryDate}</td>
                    <td>
                      {isLow ? (
                        <span className="badge badge-critical">⚠️ Low Stock</span>
                      ) : (
                        <span className="badge badge-success">Stock OK</span>
                      )}
                    </td>
                    <td>
                      <button onClick={() => handleEditItem(item)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                        ✏️ Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Add New Medication */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Register New Medicine</h3>
              <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
            </div>
            <form onSubmit={handleAddMedicine}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Medicine Name & Formulation</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newMed.name}
                    onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                    placeholder="e.g. Amoxicillin 500mg"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Initial Stock Level</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={newMed.stock}
                      onChange={(e) => setNewMed({ ...newMed, stock: e.target.value })}
                      placeholder="e.g. 100"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Alert Threshold</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={newMed.minThreshold}
                      onChange={(e) => setNewMed({ ...newMed, minThreshold: e.target.value })}
                      placeholder="e.g. 15"
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit Price ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-input" 
                      value={newMed.unitPrice}
                      onChange={(e) => setNewMed({ ...newMed, unitPrice: e.target.value })}
                      placeholder="e.g. 12.50"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiration Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={newMed.expiryDate}
                      onChange={(e) => setNewMed({ ...newMed, expiryDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Medicine</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adjust Stock / Edit Medicine */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Adjust Stock: {editingItem.name}</h3>
              <button onClick={() => setEditingItem(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Current Stock Count</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Alert Limit</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={editThreshold}
                    onChange={(e) => setEditThreshold(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-input" 
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setEditingItem(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
