import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Edit2, Check, X, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';

const RegistrantsTab = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', batchYear: '' });
  const [resendingId, setResendingId] = useState(null);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = () => {
    setLoading(true);
    api.get('/api/admin/registrations')
      .then(({ data }) => setRegistrations(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Failed to load registrations'))
      .finally(() => setLoading(false));
  };

  const startEdit = (reg) => {
    setEditingId(reg.id);
    setEditForm({
      firstName: reg.firstName ?? '',
      lastName: reg.lastName ?? '',
      email: reg.email ?? '',
      batchYear: reg.batchYear ?? '',
    });
  };

  const cancelEdit = () => setEditingId(null);

  const handleResendConfirmation = async (id) => {
    setResendingId(id);
    try {
      await api.post(`/api/admin/registrations/${id}/resend-confirmation`);
      toast.success('Confirmation email resent');
    } catch {
      toast.error('Failed to resend confirmation email');
    } finally {
      setResendingId(null);
    }
  };

  const saveEdit = async (id) => {
    try {
      const { data } = await api.put(`/api/admin/registrations/${id}`, editForm);
      setRegistrations(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
      setEditingId(null);
      toast.success('Registration updated');
    } catch {
      toast.error('Failed to save changes');
    }
  };

  const handleExport = () => {
    const rows = filtered.map(r => ({
      'First Name':    r.firstName ?? '',
      'Last Name':     r.lastName ?? '',
      'Email':         r.email ?? '',
      'Batch Year':    r.batchYear ?? '',
      'Registered On': r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registrants');
    XLSX.writeFile(wb, `registrants_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const uniqueBatches = [...new Set(registrations.map(r => r.batchYear).filter(Boolean))].sort();

  const filtered = registrations.filter(r => {
    const name = `${r.firstName ?? ''} ${r.lastName ?? ''} ${r.email ?? ''}`.toLowerCase();
    const matchSearch = name.includes(searchTerm.toLowerCase());
    const matchBatch = !batchFilter || String(r.batchYear) === batchFilter;
    return matchSearch && matchBatch;
  });

  const editCell = (style = {}) => ({
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    fontSize: 'var(--text-sm)',
    width: '100%',
    ...style,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <Input
            label="Search"
            placeholder="Name or email…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ flex: '0 1 180px' }}>
          <div className="input-group">
            <label className="input-label">Batch Year</label>
            <select
              className="input-field"
              value={batchFilter}
              onChange={e => setBatchFilter(e.target.value)}
            >
              <option value="">All Batches</option>
              {uniqueBatches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          disabled={filtered.length === 0}
        >
          <Download size={16} /> Export Excel
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center" style={{ padding: 'var(--space-12)' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['First Name', 'Last Name', 'Email', 'Batch Year', 'Registered On', 'Actions'].map(h => (
                  <th key={h} style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No registrations found.
                  </td>
                </tr>
              ) : filtered.map(reg => (
                <tr key={reg.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {editingId === reg.id ? (
                    <>
                      <td style={{ padding: 'var(--space-2)' }}>
                        <input style={editCell()} value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        <input style={editCell()} value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        <input style={editCell()} type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        <input style={editCell({ width: '80px' })} value={editForm.batchYear} onChange={e => setEditForm(f => ({ ...f, batchYear: e.target.value }))} />
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)' }}>
                        {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap' }}>
                        <button onClick={() => saveEdit(reg.id)} style={{ background: 'none', border: 'none', color: 'var(--color-success)', cursor: 'pointer', marginRight: 8 }} title="Save">
                          <Check size={16} />
                        </button>
                        <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer' }} title="Cancel">
                          <X size={16} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: 'var(--space-3)' }}>{reg.firstName ?? '-'}</td>
                      <td style={{ padding: 'var(--space-3)' }}>{reg.lastName ?? '-'}</td>
                      <td style={{ padding: 'var(--space-3)' }}>{reg.email ?? '-'}</td>
                      <td style={{ padding: 'var(--space-3)' }}>{reg.batchYear ?? '-'}</td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)' }}>
                        {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: 'var(--space-3)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button onClick={() => startEdit(reg)} style={{ background: 'none', border: 'none', color: 'var(--color-maroon)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)' }} title="Edit">
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            onClick={() => handleResendConfirmation(reg.id)}
                            disabled={resendingId === reg.id}
                            style={{ background: 'none', border: '1px solid var(--color-gold)', color: 'var(--color-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-sm)', padding: '2px 8px' }}
                            title="Resend confirmation email"
                          >
                            <RefreshCw size={13} style={resendingId === reg.id ? { animation: 'spin 1s linear infinite' } : {}} />
                            {resendingId === reg.id ? 'Sending…' : 'Resend'}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RegistrantsTab;
