import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Edit2, Check, X, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';

// Split a single "full name" into first / last for the shared columns.
const splitName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const TypeBadge = ({ type }) => {
  const isAttendee = type === 'Attendee';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: isAttendee ? 'var(--color-gold-dark)' : 'var(--color-maroon)',
        background: isAttendee ? 'var(--color-gold-soft, #fbf3dd)' : 'var(--color-maroon-soft, #f6e4e6)',
        border: `1px solid ${isAttendee ? 'var(--color-gold)' : 'var(--color-maroon)'}`,
      }}
    >
      {type}
    </span>
  );
};

const RegistrantsTab = () => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editingUid, setEditingUid] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', batchYear: '' });
  const [resendingId, setResendingId] = useState(null);

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = () => {
    setLoading(true);
    Promise.allSettled([
      api.get('/api/admin/registrations'),
      api.get('/api/admin/attendees'),
    ])
      .then(([regRes, attRes]) => {
        if (regRes.status === 'rejected') toast.error('Failed to load registrations');
        if (attRes.status === 'rejected') toast.error('Failed to load attendees');

        const regs = (regRes.status === 'fulfilled' && Array.isArray(regRes.value.data) ? regRes.value.data : [])
          .map(r => ({ ...r, _type: 'Registrant', uid: `reg-${r.id}` }));

        const atts = (attRes.status === 'fulfilled' && Array.isArray(attRes.value.data) ? attRes.value.data : [])
          .map(a => ({ ...a, ...splitName(a.fullName), _type: 'Attendee', uid: `att-${a.id}` }));

        const combined = [...regs, ...atts].sort(
          (x, y) => new Date(y.createdAt || 0) - new Date(x.createdAt || 0),
        );
        setPeople(combined);
      })
      .finally(() => setLoading(false));
  };

  const startEdit = (row) => {
    setEditingUid(row.uid);
    setEditForm({
      firstName: row.firstName ?? '',
      lastName: row.lastName ?? '',
      email: row.email ?? '',
      batchYear: row.batchYear ?? '',
    });
  };

  const cancelEdit = () => setEditingUid(null);

  const handleResendConfirmation = async (row) => {
    setResendingId(row.uid);
    try {
      await api.post(`/api/admin/registrations/${row.id}/resend-confirmation`);
      toast.success('Confirmation email resent');
    } catch {
      toast.error('Failed to resend confirmation email');
    } finally {
      setResendingId(null);
    }
  };

  const handleResendInvite = async (row) => {
    setResendingId(row.uid);
    try {
      await api.post(`/api/admin/attendees/${row.id}/resend-confirmation`);
      toast.success('Invite resent');
    } catch {
      toast.error('Failed to resend invite');
    } finally {
      setResendingId(null);
    }
  };

  const saveEdit = async (row) => {
    try {
      const { data } = await api.put(`/api/admin/registrations/${row.id}`, editForm);
      setPeople(prev => prev.map(r => (r.uid === row.uid ? { ...r, ...data } : r)));
      setEditingUid(null);
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
      'Type':          r._type ?? '',
      'Registered On': r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');
    XLSX.writeFile(wb, `participants_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const uniqueBatches = [...new Set(people.map(r => r.batchYear).filter(Boolean))].sort();

  const filtered = people.filter(r => {
    const name = `${r.firstName ?? ''} ${r.lastName ?? ''} ${r.email ?? ''}`.toLowerCase();
    const matchSearch = name.includes(searchTerm.toLowerCase());
    const matchBatch = !batchFilter || String(r.batchYear) === batchFilter;
    const matchType = !typeFilter || r._type === typeFilter;
    return matchSearch && matchBatch && matchType;
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
        <div style={{ flex: '0 1 160px' }}>
          <div className="input-group">
            <label className="input-label">Type</label>
            <select
              className="input-field"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="Registrant">Registrants</option>
              <option value="Attendee">Attendees</option>
            </select>
          </div>
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
                {['First Name', 'Last Name', 'Email', 'Batch Year', 'Type', 'Registered On', 'Actions'].map(h => (
                  <th key={h} style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No registrations found.
                  </td>
                </tr>
              ) : filtered.map(row => (
                <tr key={row.uid} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {editingUid === row.uid ? (
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
                      <td style={{ padding: 'var(--space-3)' }}><TypeBadge type={row._type} /></td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)' }}>
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap' }}>
                        <button onClick={() => saveEdit(row)} style={{ background: 'none', border: 'none', color: 'var(--color-success)', cursor: 'pointer', marginRight: 8 }} title="Save">
                          <Check size={16} />
                        </button>
                        <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer' }} title="Cancel">
                          <X size={16} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: 'var(--space-3)' }}>{row.firstName ?? '-'}</td>
                      <td style={{ padding: 'var(--space-3)' }}>{row.lastName ?? '-'}</td>
                      <td style={{ padding: 'var(--space-3)' }}>{row.email ?? '-'}</td>
                      <td style={{ padding: 'var(--space-3)' }}>{row.batchYear ?? '-'}</td>
                      <td style={{ padding: 'var(--space-3)' }}><TypeBadge type={row._type} /></td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)' }}>
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: 'var(--space-3)', whiteSpace: 'nowrap' }}>
                        {row._type === 'Registrant' ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={() => startEdit(row)} style={{ background: 'none', border: 'none', color: 'var(--color-maroon)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)' }} title="Edit">
                              <Edit2 size={14} /> Edit
                            </button>
                            <button
                              onClick={() => handleResendConfirmation(row)}
                              disabled={resendingId === row.uid}
                              style={{ background: 'none', border: '1px solid var(--color-gold)', color: 'var(--color-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-sm)', padding: '2px 8px' }}
                              title="Resend confirmation email"
                            >
                              <RefreshCw size={13} style={resendingId === row.uid ? { animation: 'spin 1s linear infinite' } : {}} />
                              {resendingId === row.uid ? 'Sending…' : 'Resend'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleResendInvite(row)}
                            disabled={resendingId === row.uid}
                            style={{ background: 'none', border: '1px solid var(--color-maroon)', color: 'var(--color-maroon)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-sm)', padding: '2px 8px' }}
                            title="Resend invite (confirmation email with check-in QR)"
                          >
                            <RefreshCw size={13} style={resendingId === row.uid ? { animation: 'spin 1s linear infinite' } : {}} />
                            {resendingId === row.uid ? 'Sending…' : 'Resend Invite'}
                          </button>
                        )}
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
