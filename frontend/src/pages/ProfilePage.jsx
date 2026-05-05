import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import {
  User, Lock, QrCode, Users, Mail, LogOut, Plus, Edit2, Trash2, X, Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

// ─── Helpers ────────────────────────────────────────────────────────────────

const BATCH_YEARS = Array.from({ length: 51 }, (_, i) => String(2020 - i));

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '20px',
  paddingBottom: '12px',
  borderBottom: '1px solid var(--color-border)',
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const twoColStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
};

// ─── Personal Details Section ────────────────────────────────────────────────

function PersonalDetailsSection({ profile, onSaved }) {
  const [form, setForm] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    batchYear: profile?.batchYear || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        batchYear: profile.batchYear || '',
      });
    }
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/api/profile', form);
      toast.success('Profile updated');
      onSaved(data.user || data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div style={sectionHeaderStyle}>
        <User size={20} style={{ color: 'var(--color-maroon)' }} />
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Personal Details</h3>
      </div>
      <form onSubmit={handleSave} style={formStyle}>
        <div style={twoColStyle}>
          <Input
            label="First Name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <Input
            label="Last Name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <div className="input-group">
          <label className="input-label">Batch Year</label>
          <select
            className="input-field"
            value={form.batchYear}
            onChange={(e) => setForm({ ...form, batchYear: e.target.value })}
            required
          >
            <option value="">Select batch year</option>
            {BATCH_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <Button type="submit" variant="primary" loading={saving}>
            <Save size={16} /> Save Changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Security Section ────────────────────────────────────────────────────────

function SecuritySection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [validations, setValidations] = useState({
    length: false, uppercase: false, number: false, special: false,
  });

  const validatePassword = (pass) => {
    setValidations({
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[^A-Za-z0-9]/.test(pass),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!Object.values(validations).every(Boolean)) {
      toast.error('New password does not meet requirements');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/profile/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setValidations({ length: false, uppercase: false, number: false, special: false });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const reqItems = [
    [validations.length, 'Min 8 characters'],
    [validations.uppercase, 'One uppercase letter'],
    [validations.number, 'One number'],
    [validations.special, 'One special character'],
  ];

  return (
    <Card>
      <div style={sectionHeaderStyle}>
        <Lock size={20} style={{ color: 'var(--color-maroon)' }} />
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Security</h3>
      </div>
      <form onSubmit={handleSubmit} style={formStyle}>
        <Input
          label="Current Password"
          type="password"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          required
        />
        <div className="input-group">
          <label className="input-label">New Password</label>
          <input
            type="password"
            className="input-field"
            value={form.newPassword}
            onChange={(e) => {
              setForm({ ...form, newPassword: e.target.value });
              validatePassword(e.target.value);
            }}
            required
          />
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {reqItems.map(([valid, label]) => (
              <p
                key={label}
                style={{
                  margin: 0,
                  fontSize: 'var(--text-xs)',
                  color: valid ? 'var(--color-success)' : 'var(--color-text-muted)',
                  fontWeight: valid ? 600 : 400,
                }}
              >
                {valid ? '✓' : '•'} {label}
              </p>
            ))}
          </div>
        </div>
        <Input
          label="Confirm New Password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          required
        />
        <div>
          <Button type="submit" variant="secondary" loading={saving}>
            <Lock size={16} /> Change Password
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── QR Code Section ─────────────────────────────────────────────────────────

function QRCodeSection({ qrToken }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!qrToken) return;
    const url = `${window.location.origin}/qr/${qrToken}`;
    QRCode.toDataURL(url, {
      width: 250,
      margin: 2,
      color: { dark: '#800000', light: '#FFFFFF' },
    })
      .then(setDataUrl)
      .catch(() => toast.error('Failed to generate QR code'));
  }, [qrToken]);

  return (
    <Card>
      <div style={sectionHeaderStyle}>
        <QrCode size={20} style={{ color: 'var(--color-maroon)' }} />
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>My QR Code</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        {dataUrl ? (
          <>
            <img
              src={dataUrl}
              alt="My QR Code"
              style={{ width: '200px', height: '200px', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-border)' }}
            />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              Show this QR code at the entrance on event day for check-in.
            </p>
            <a href={dataUrl} download="goldies-qr.png" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">Download QR</Button>
            </a>
          </>
        ) : (
          <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="loading-spinner" />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Attendees Section ───────────────────────────────────────────────────────

const EMPTY_FORM = { fullName: '', email: '', phone: '', batchYear: '', address: '' };

function AttendeesSection() {
  const [attendees, setAttendees] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/attendees')
      .then(({ data }) => setAttendees(data))
      .catch(() => toast.error('Failed to load attendees'))
      .finally(() => setLoadingList(false));
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (attendee) => {
    setEditing(attendee);
    setForm({
      fullName: attendee.fullName,
      email: attendee.email,
      phone: attendee.phone,
      batchYear: attendee.batchYear || '',
      address: attendee.address || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/api/attendees/${editing.id}`, form);
        setAttendees((prev) => prev.map((a) => (a.id === editing.id ? data : a)));
        toast.success('Attendee updated');
      } else {
        const { data } = await api.post('/api/attendees', form);
        setAttendees((prev) => [data, ...prev]);
        toast.success('Attendee added');
      }
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save attendee');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Archive this attendee?')) return;
    try {
      await api.delete(`/api/attendees/${id}`);
      setAttendees((prev) => prev.filter((a) => a.id !== id));
      toast.success('Attendee archived');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to archive attendee');
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={20} style={{ color: 'var(--color-maroon)' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>My Attendees</h3>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { resetForm(); setShowForm(true); }}
        >
          <Plus size={16} /> Add Attendee
        </Button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontWeight: 700 }}>{editing ? 'Edit Attendee' : 'New Attendee'}</h4>
            <button
              onClick={resetForm}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} style={formStyle}>
            <Input
              label="Full Name *"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
            <div style={twoColStyle}>
              <Input
                label="Email *"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                label="Phone *"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div style={twoColStyle}>
              <Input
                label="Batch Year"
                value={form.batchYear}
                onChange={(e) => setForm({ ...form, batchYear: e.target.value })}
              />
              <Input
                label="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button type="submit" variant="primary" size="sm" loading={saving}>
                <Save size={14} /> {editing ? 'Update' : 'Save'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </motion.div>
      )}

      {loadingList ? (
        <div style={{ padding: '32px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-spinner" />
        </div>
      ) : attendees.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '32px 0' }}>
          No attendees yet. Click "Add Attendee" to get started.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr>
                {['Name', 'Email', 'Phone', 'Batch', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      borderBottom: '1px solid var(--color-border)',
                      background: 'var(--color-surface-alt)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 12px' }}>{a.fullName}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{a.email}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{a.phone}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{a.batchYear || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => openEdit(a)}
                        title="Edit"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-gold-dark)',
                          padding: '4px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        title="Archive"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-error)',
                          padding: '4px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Invite Others Section ───────────────────────────────────────────────────

function InviteSection() {
  const [emails, setEmails] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    const emailList = emails
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (emailList.length === 0) {
      toast.error('Please enter at least one email address');
      return;
    }

    setSending(true);
    try {
      const { data } = await api.post('/api/invitations', { emails: emailList });
      const sent = data.results?.filter((r) => r.status === 'sent').length || 0;
      const skipped = (data.results?.length || 0) - sent;
      if (sent > 0) toast.success(`${sent} invitation${sent > 1 ? 's' : ''} sent`);
      if (skipped > 0) toast(`${skipped} skipped (already registered or invited)`, { icon: 'ℹ️' });
      setEmails('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invitations');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <div style={sectionHeaderStyle}>
        <Mail size={20} style={{ color: 'var(--color-maroon)' }} />
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Invite Others</h3>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '16px' }}>
        Enter email addresses below (one per line or comma-separated) to send invitations.
      </p>
      <form onSubmit={handleSend} style={formStyle}>
        <Input
          as="textarea"
          label="Email Addresses"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder={'friend@example.com\nanother@example.com'}
          rows={5}
        />
        <div>
          <Button type="submit" variant="primary" loading={sending}>
            <Mail size={16} /> Send Invitations
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Profile Page ────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    api.get('/api/profile')
      .then(({ data }) => setProfile(data))
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoadingProfile(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleProfileSaved = (updatedUser) => {
    setProfile((prev) => ({ ...prev, ...updatedUser }));
    if (setUser) setUser((prev) => ({ ...prev, ...updatedUser }));
  };

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : '';

  return (
    <PageContainer className="page-content--wide">
      <div style={{ width: '100%' }}>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-maroon)' }}>
              My Profile
            </h1>
            {displayName && (
              <p style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>{displayName}</p>
            )}
          </div>
          <Button variant="danger" size="sm" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </Button>
        </motion.div>

        {loadingProfile ? (
          <div style={{ padding: '80px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="loading-spinner" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <PersonalDetailsSection profile={profile} onSaved={handleProfileSaved} />
            <SecuritySection />
            <QRCodeSection qrToken={profile?.qrToken} />
            <AttendeesSection />
            <InviteSection />
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default ProfilePage;
