import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';

const SCANNER_ELEMENT_ID = 'admin-qr-reader';

const CheckInTab = () => {
  const [stats, setStats] = useState(null);
  const [qrInput, setQrInput] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [scannedRecord, setScannedRecord] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [checkingIn, setCheckingIn] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const searchTimeout = useRef(null);
  const scannerRef = useRef(null);
  const scanLockRef = useRef(false);

  useEffect(() => {
    fetchStats();
    return () => {
      clearTimeout(searchTimeout.current);
      stopScanner();
    };
  }, []);

  const fetchStats = () => {
    api.get('/api/checkin/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {});
  };

  const extractQrToken = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    const match = trimmed.match(/\/qr\/([^/?#\s]+)/);
    return match ? match[1] : trimmed.match(/^[0-9a-f-]{36}$/i)?.[0] || null;
  };

  const handleQrInput = async (value) => {
    setQrInput(value);
    const token = extractQrToken(value);
    if (!token) return;
    setQrInput('');
    await lookupScannedToken(token);
  };

  const lookupScannedToken = async (token) => {
    setCheckingIn(token);
    try {
      const { data } = await api.get(`/api/qr/${token}`);
      if (data.type !== 'checkin' && data.type !== 'already_registered') {
        toast.error('This QR code is not tied to a completed registration.');
        return;
      }
      setScannedRecord({ token, ...data });
      setConfirmation(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'QR code not found');
      setScannedRecord(null);
    } finally {
      setCheckingIn(null);
    }
  };

  const doCheckIn = async (token) => {
    setCheckingIn(token);
    try {
      const { data } = await api.post(`/api/checkin/${token}`);
      setConfirmation(data);
      setScannedRecord(null);
      fetchStats();
      toast.success(`Checked in: ${data.name ?? data.fullName ?? 'Guest'}`);
    } catch (err) {
      const duplicate = err.response?.status === 409 ? err.response.data : null;
      const msg = duplicate?.error ?? err.response?.data?.error ?? 'Check-in failed';
      toast.error(msg);
      if (duplicate?.registrant) {
        const fullName = `${duplicate.registrant.firstName} ${duplicate.registrant.lastName}`.trim();
        setConfirmation({
          ...duplicate,
          name: fullName,
          fullName,
          batchYear: duplicate.registrant.batchYear,
        });
      } else {
        setConfirmation(null);
      }
    } finally {
      setCheckingIn(null);
    }
  };

  const startScanner = async () => {
    if (scannerActive || scannerRef.current) return;
    scanLockRef.current = false;
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          if (scanLockRef.current) return;
          const token = extractQrToken(decodedText);
          if (!token) return;
          scanLockRef.current = true;
          await lookupScannedToken(token);
          setTimeout(() => {
            scanLockRef.current = false;
          }, 1800);
        },
      );
      setScannerActive(true);
    } catch {
      scannerRef.current = null;
      toast.error('Camera unavailable. Use HTTPS, allow camera access, or paste the QR URL.');
    }
  };

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      await scanner.clear();
    } catch {
      // Scanner cleanup can throw if the browser already released the camera.
    } finally {
      scannerRef.current = null;
      setScannerActive(false);
    }
  };

  const handleManualSearch = (value) => {
    setManualSearch(value);
    clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/checkin/search?q=${encodeURIComponent(value)}`);
        setSearchResults(Array.isArray(data) ? data.slice(0, 10) : []);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  };

  const checkedIn = stats?.checkedIn ?? stats?.totalCheckedIn ?? stats?.checked_in ?? 0;
  const total = stats?.total ?? stats?.totalRegistered ?? 0;
  const recentCheckIns = stats?.recentCheckIns ?? stats?.recent ?? [];
  const confirmationName = confirmation?.name ?? confirmation?.fullName ?? (
    confirmation?.registrant
      ? `${confirmation.registrant.firstName} ${confirmation.registrant.lastName}`.trim()
      : 'Guest'
  );
  const confirmationBatch = confirmation?.batchYear ?? confirmation?.registrant?.batchYear;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>QR Scanner</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Scan with the event camera or paste a QR URL. Check-in fires automatically.
          </p>
          <div className="qr-camera-panel">
            <div id={SCANNER_ELEMENT_ID} className="qr-camera-view" />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button size="sm" onClick={startScanner} disabled={scannerActive}>
                <Camera size={16} /> Start Camera
              </Button>
              <Button size="sm" variant="secondary" onClick={stopScanner} disabled={!scannerActive}>
                <CameraOff size={16} /> Stop
              </Button>
            </div>
          </div>
          <Input
            label="Scan / Paste URL"
            placeholder="https://.../qr/abc123"
            value={qrInput}
            onChange={e => handleQrInput(e.target.value)}
          />
          {scannedRecord?.registrant && (
            <div className="checkin-card" style={{ textAlign: 'left', boxShadow: 'var(--shadow-sm)' }}>
              <div className="registrant-info">
                <strong>{scannedRecord.registrant.firstName} {scannedRecord.registrant.lastName}</strong>
                <span className="registrant-type">
                  Batch {scannedRecord.registrant.batchYear || 'N/A'} - {scannedRecord.registrant.email}
                </span>
              </div>
              {scannedRecord.alreadyCheckedIn ? (
                <p className="checkin-time" style={{ marginTop: 'var(--space-3)' }}>
                  Already checked in at {new Date(scannedRecord.checkedInAt).toLocaleTimeString()}
                </p>
              ) : (
                <Button
                  fullWidth
                  loading={checkingIn === scannedRecord.token}
                  onClick={() => doCheckIn(scannedRecord.token)}
                  style={{ marginTop: 'var(--space-3)' }}
                >
                  Check In
                </Button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Manual Check-In</h3>
          <Input
            label="Search by name"
            placeholder="Type a name..."
            value={manualSearch}
            onChange={e => handleManualSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {searchResults.map(reg => {
                const name = `${reg.firstName ?? ''} ${reg.lastName ?? ''}`.trim() || reg.fullName || 'Unknown';
                const token = reg.qrToken ?? reg.token ?? reg.id;
                return (
                  <div key={`${reg.type ?? 'reg'}-${reg.id}`} className="registrant-card" style={{ justifyContent: 'space-between' }}>
                    <div className="registrant-info">
                      <strong>{name}</strong>
                      <span className="registrant-type">
                        {reg.type === 'attendee' ? 'Attendee · ' : ''}{reg.batchYear ?? ''}{reg.email ? ` - ${reg.email}` : ''}
                      </span>
                    </div>
                    <Button size="sm" loading={checkingIn === token} disabled={!token} onClick={() => doCheckIn(token)}>
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

      {confirmation && (
        <div className={`checkin-card ${confirmation.error === 'Already checked in' ? 'checkin-duplicate' : 'checkin-success'}`}>
          <div className="checkin-success-icon">
            <CheckCircle size={28} />
          </div>
          <div className="checkin-name">{confirmationName}</div>
          {confirmationBatch && <div className="checkin-batch">Batch {confirmationBatch}</div>}
          <div className="checkin-time" style={{ marginTop: 'var(--space-2)' }}>
            {confirmation.error === 'Already checked in' ? 'Already checked in' : 'Checked in'} at{' '}
            {new Date(confirmation.checkedInAt || Date.now()).toLocaleTimeString()}
          </div>
        </div>
      )}

      {recentCheckIns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Recent Check-ins</h3>
          <div className="registrant-list">
            {recentCheckIns.map((item, idx) => {
              const name = item.name
                ?? item.fullName
                ?? (`${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || 'Unknown');
              return (
                <div key={idx} className="registrant-card">
                  <CheckCircle size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <div className="registrant-info">
                    <strong>{name}</strong>
                    <span className="registrant-type">
                      {item.batchYear ? `Batch ${item.batchYear}` : ''}
                      {item.checkedInAt ? ` - ${new Date(item.checkedInAt).toLocaleTimeString()}` : ''}
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
