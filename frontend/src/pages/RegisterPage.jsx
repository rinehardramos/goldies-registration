import React from 'react';
import { motion } from 'framer-motion';
import PageContainer from '../components/layout/PageContainer';
import Countdown from '../components/Countdown';
import RegisterWizard from '../components/register/RegisterWizard';

export default function RegisterPage() {
  return (
    <PageContainer>
      <div className="register-page">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="register-header"
        >
          <h1>Goldies Day 2026</h1>
          <p className="register-subtitle">Register for the event</p>
          <Countdown />
        </motion.div>

        <RegisterWizard />
      </div>
    </PageContainer>
  );
}
