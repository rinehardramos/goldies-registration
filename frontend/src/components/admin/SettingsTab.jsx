import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';

const SettingsTab = () => {
  const [eventDate, setEventDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/admin/settings')
      .then(({ data }) => {
        // data may be an array of {key, value} or an object
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

  if (loading) {
    return (
      <div className="flex justify-center" style={{ padding: 'var(--space-12)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="settings-tab">
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
    </div>
  );
};

export default SettingsTab;
