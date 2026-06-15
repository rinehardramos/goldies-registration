import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, User, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';

const CheckInCard = ({ token, registrant, alreadyCheckedIn: initialAlreadyCheckedIn, checkedInAt: initialCheckedInAt }) => {
  const [status, setStatus] = useState(
    initialAlreadyCheckedIn ? 'duplicate' : 'pending'
  );
  const [checkedInAt, setCheckedInAt] = useState(initialCheckedInAt);
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/api/checkin/${token}`);
      setCheckedInAt(data.checkedInAt);
      setStatus('success');
      toast.success('Check-in successful!');
    } catch (err) {
      if (err.response?.status === 409) {
        setCheckedInAt(err.response.data.checkedInAt);
        setStatus('duplicate');
        toast.error('Already checked in');
      } else {
        toast.error(err.response?.data?.error || 'Check-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  };

  const borderStyle = status === 'success'
    ? { borderTop: '4px solid var(--color-success)' }
    : status === 'duplicate'
      ? { borderTop: '4px solid var(--color-warning)' }
      : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%', maxWidth: '440px' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center' }}
      >
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-maroon)' }}>
          Goldies Day 2026
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>Staff Check-In</p>
      </motion.div>

      <Card style={{ width: '100%', textAlign: 'center', ...borderStyle }}>
        {status === 'success' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="checkin-success-icon"
          >
            <CheckCircle size={32} />
          </motion.div>
        )}

        {status === 'duplicate' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="checkin-warning-icon"
          >
            <AlertTriangle size={32} />
          </motion.div>
        )}

        {status === 'pending' && (
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-alt)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--color-text-muted)',
            }}
          >
            <User size={28} />
          </div>
        )}

        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: '12px' }}>
          {status === 'success' && 'Check-In Successful!'}
          {status === 'duplicate' && 'Already Checked In'}
          {status === 'pending' && 'Check In'}
        </h2>

        {registrant && (
          <div className="checkin-name" style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
              {registrant.firstName} {registrant.lastName}
            </p>
            {registrant.batchYear && (
              <p className="checkin-batch">Batch {registrant.batchYear}</p>
            )}
          </div>
        )}

        {(status === 'success' || status === 'duplicate') && checkedInAt && (
          <div
            className="success-info"
            style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '16px' }}
          >
            <Clock size={14} />
            <span className="checkin-time">
              {status === 'duplicate' ? 'Previously checked in at ' : 'Checked in at '}
              {formatTime(checkedInAt)}
            </span>
          </div>
        )}

        {status === 'pending' && (
          <div style={{ marginTop: '20px' }}>
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              onClick={handleCheckIn}
              fullWidth
            >
              Check In
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CheckInCard;
