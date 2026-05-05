import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';

const CheckInTab = () => {
  const [stats, setStats] = useState(null);
  const [qrInput, setQrInput] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [checkingIn, setCheckingIn] = useState(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = () => {
    api.get('/api/checkin/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {});
  };

  // Extract token from QR URL and trigger check-in
  const handleQrInput = async (value) => {
    setQrInput(value);
    const match = value.match(/\/qr\/([^/?#\s]+)/);
    if (!match) return;
    const token = match[1];
    setQrInput('');
    await doCheckIn(token);
  };

  const doCheckIn = async (token) => {
    setCheckingIn(token);
    try {
      const { data } = await api.post(`/api/checkin/${token}`);
      setConfirmation(data);
      fetchStats();
      toast.success(`Checked in: ${data.name ?? data.fullName ?? 'Guest'}`);
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Check-in failed';
      toast.error(msg);
      setConfirmation(null);
    } finally {
      setCheckingIn(null);
    }
  };

  // Debounced manual search
  const handleManualSearch = (value) => {
    setManualSearch(value);
    clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/admin/registrations?search=${encodeURIComponent(value)}`);
        setSearchResults(Array.isArray(data) ? data.slice(0, 10) : []);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  };

  const checkedIn = stats?.checkedIn ?? stats?.checked_in ?? 0;
  const total = stats?.total ?? 0;
  const recentCheckIns = stats?.recentCheckIns ?? stats?.recent ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Stats Bar */}
      {stats !== null && (
        <div className="card card--flat" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <CheckCircle size={28} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-maroon)' }}>
              {checkedIn} / {total}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>guests checked in</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
        {/* QR Scanner Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>QR Scanner</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Paste or scan a QR URL (e.g. <code>/qr/TOKEN</code>). Check-in fires automatically.
          </p>
          <Input
            label="Scan / Paste URL"
            placeholder="https://…/qr/abc123"
            value={qrInput}
            onChange={e => handleQrInput(e.target.value)}
          />
        </div>

        {/* Manual Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Manual Check-In</h3>
          <Input
            label="Search by name"
            placeholder="Type a name…"
            value={manualSearch}
            onChange={e => handleManualSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {searchResults.map(reg => {
                const name = `${reg.firstName ?? ''} ${reg.lastName ?? ''}`.trim() || reg.fullName || 'Unknown';
                const token = reg.qrToken ?? reg.token ?? reg.id;
                return (
                  <div
                    key={reg.id}
                    className="registrant-card"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <div className="registrant-info">
                      <strong>{name}</strong>
                      <span className="registrant-type">{reg.batchYear ?? ''} · {reg.email ?? ''}</span>
                    </div>
                    <Button
                      size="sm"
                      loading={checkingIn === token}
                      onClick={() => doCheckIn(token)}
                    >
                      Check In
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {manualSearch && searchResults.length === 0 && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>No results.</p>
          )}
        </div>
      </div>

      {/* Confirmation Card */}
      {confirmation && (
        <div className="checkin-card checkin-success">
          <div className="checkin-success-icon">
            <CheckCircle size={28} />
          </div>
          <div className="checkin-name">
            {confirmation.name ?? confirmation.fullName ?? 'Guest'}
          </div>
          {confirmation.batchYear && (
            <div className="checkin-batch">Batch {confirmation.batchYear}</div>
          )}
          <div className="checkin-time" style={{ marginTop: 'var(--space-2)' }}>
            Checked in at {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Recent Check-ins */}
      {recentCheckIns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Recent Check-ins</h3>
          <div className="registrant-list">
            {recentCheckIns.map((item, idx) => {
              const name = item.name ?? item.fullName ?? 'Unknown';
              return (
                <div key={idx} className="registrant-card">
                  <CheckCircle size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <div className="registrant-info">
                    <strong>{name}</strong>
                    <span className="registrant-type">
                      {item.batchYear ? `Batch ${item.batchYear}` : ''}
                      {item.checkedInAt ? ` · ${new Date(item.checkedInAt).toLocaleTimeString()}` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInTab;
