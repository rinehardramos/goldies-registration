import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';

export default function StepSuccess() {
  return (
    <div className="step-success">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="success-icon"
      >
        <CheckCircle size={72} strokeWidth={1.5} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2>You&apos;re Officially Registered!</h2>
        <p className="success-subtitle">
          Welcome to Goldies Day 2026. A confirmation email with your QR code
          has been sent to your inbox.
        </p>

        <div className="success-details">
          <div className="success-info">
            <strong>Event Date</strong>
            <span>July 25, 2026</span>
          </div>
          <div className="success-info">
            <strong>What to bring</strong>
            <span>Show your QR code at the entrance for check-in</span>
          </div>
        </div>

        <div className="step-actions" style={{ justifyContent: 'center', marginTop: '2rem' }}>
          <Link to="/profile">
            <Button variant="primary" size="lg">
              Go to My Profile
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
