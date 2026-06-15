import React from 'react';
import { motion } from 'framer-motion';
import PageContainer from '../components/layout/PageContainer';
import Countdown from '../components/Countdown';
import RegisterWizard from '../components/register/RegisterWizard';

export default function RegisterPage() {
  return (
    <PageContainer>
      <div className="register-page">
        <div className="register-spark register-spark--left" />
        <div className="register-spark register-spark--right" />
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="register-header"
        >
          <h1>Goldies Day 2026</h1>
          <p className="register-subtitle">Register for the event</p>
          <Countdown />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: 'easeOut' }}
          className="register-wizard"
        >
          <RegisterWizard />
        </motion.div>
      </div>
    </PageContainer>
  );
}
