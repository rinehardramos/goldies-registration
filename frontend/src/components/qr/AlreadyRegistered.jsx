import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, QrCode } from 'lucide-react';
import Card from '../ui/Card';

const AlreadyRegistered = ({ registrant, eventDate }) => {
  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Manila',
      })
    : 'Date to be announced';

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
      </motion.div>

      <Card style={{ width: '100%', textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="success-icon"
        >
          <CheckCircle size={56} />
        </motion.div>

        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: '16px' }}>
          You're Registered!
        </h2>

        {registrant && (
          <div style={{ marginBottom: '16px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            <p><strong style={{ color: 'var(--color-text)' }}>Name:</strong> {registrant.firstName} {registrant.lastName}</p>
            {registrant.batchYear && (
              <p><strong style={{ color: 'var(--color-text)' }}>Batch:</strong> {registrant.batchYear}</p>
            )}
          </div>
        )}

        <div
          className="success-info"
          style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '16px' }}
        >
          <Calendar size={16} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{formattedDate}</span>
        </div>

        <div className="ar-instructions" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', textAlign: 'left' }}>
          <QrCode size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Show this QR code at the entrance on event day for check-in. Keep this
            link saved so you can access it quickly.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default AlreadyRegistered;
