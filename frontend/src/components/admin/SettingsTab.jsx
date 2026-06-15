import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldPlus } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';

const EMPTY_ADMIN_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  batchYear: '',
  password: '',
};

const SettingsTab = () => {
  const [eventDate, setEventDate] = useState('');
  const [admins, setAdmins] = useState([]);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/settings'),
      api.get('/api/admin/admins'),
    ])
      .then(([settingsResult, adminsResult]) => {
        // data may be an array of {key, value} or an object
        const data = settingsResult.data;
        let value = null;
        if (Array.isArray(data)) {
          const row = data.find(s => s.key === 'event_date');
          value = row?.value;
        } else {
          value = data?.event_date ?? data?.eventDate;
        }
        if (value) {
          // Convert ISO string to datetime-local compatible format (drop seconds/tz)
          setEventDate(value.slice(0, 16));
        }
        setAdmins(adminsResult.data || []);
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!eventDate) {
      toast.error('Please select an event date');
      return;
    }
    setSaving(true);
    try {
      await api.put('/api/admin/settings', {
        key: 'event_date',
        value: new Date(eventDate).toISOString(),
      });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateAdminForm = (field, value) => {
    setAdminForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    setCreatingAdmin(true);
    try {
      const { data } = await api.post('/api/admin/admins', adminForm);
      setAdmins(prev => [data, ...prev]);
      setAdminForm(EMPTY_ADMIN_FORM);
      toast.success('Administrator created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create administrator');
    } finally {
      setCreatingAdmin(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center" style={{ padding: 'var(--space-12)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="settings-tab" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Event Settings</h2>
      <div className="card card--flat settings-form" style={{ maxWidth: 480 }}>
        <Input
          label="Event Date & Time"
          id="event-date"
          type="datetime-local"
          value={eventDate}
          onChange={e => setEventDate(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleSave} loading={saving}>
            Save Settings
          </Button>
        </div>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
        <div className="card card--flat settings-form">
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldPlus size={20} /> Add Administrator
          </h3>
          <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Input
              label="First Name"
              value={adminForm.firstName}
              onChange={e => updateAdminForm('firstName', e.target.value)}
              required
            />
            <Input
              label="Last Name"
              value={adminForm.lastName}
              onChange={e => updateAdminForm('lastName', e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={adminForm.email}
              onChange={e => updateAdminForm('email', e.target.value)}
              required
            />
            <Input
              label="Batch Year"
              value={adminForm.batchYear}
              onChange={e => updateAdminForm('batchYear', e.target.value)}
              required
            />
            <Input
              label="Temporary Password"
              type="password"
              value={adminForm.password}
              onChange={e => updateAdminForm('password', e.target.value)}
              required
            />
            <Button type="submit" loading={creatingAdmin}>
              Create Admin
            </Button>
          </form>
        </div>

        <div className="card card--flat">
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Administrators</h3>
          <div className="registrant-list" style={{ marginTop: 'var(--space-4)' }}>
            {admins.map(admin => (
              <div key={admin.id} className="registrant-card">
                <div className="registrant-info">
                  <strong>{admin.firstName} {admin.lastName}</strong>
                  <span className="registrant-type">{admin.email}</span>
                </div>
              </div>
            ))}
            {admins.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No administrators found.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsTab;
