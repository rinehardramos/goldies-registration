import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import Countdown from '../components/Countdown';

const RegistrationPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ batchYear: '', fullName: '', email: '', password: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  // Password Validation State
  const [validations, setValidations] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false
  });

  const validatePassword = (pass) => {
    setValidations({
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[^A-Za-z0-9]/.test(pass)
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'password') validatePassword(value);
  };

  const isPasswordValid = Object.values(validations).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Please meet all password requirements');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      await axios.post(`${apiUrl}/api/register`, formData);
      setStatus('success');
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
      setStatus('error');
    }
  };

  return (
    <div className="container">
      <div className="glass-card">
        <Link to="/" style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '1rem', opacity: 0.7 }}>
          <ArrowLeft size={18} /> Back to Login
        </Link>
        <h1>Goldies Day 2026</h1>
        <Countdown />

        <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
          <div className="form-group">
            <label htmlFor="batchYear">Batch Year</label>
            <input type="text" id="batchYear" name="batchYear" placeholder="e.g. 1999" value={formData.batchYear} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="fullName">Full Name (Last Name First)</label>
            <input type="text" id="fullName" name="fullName" placeholder="Dela Cruz, Juan" value={formData.fullName} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input type="email" id="email" name="email" placeholder="juan@example.com" value={formData.email} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" placeholder="Create a strong password" value={formData.password} onChange={handleChange} required />
            <div className="password-requirements">
              <p className={validations.length ? 'valid' : ''}>• Min 8 characters</p>
              <p className={validations.uppercase ? 'valid' : ''}>• One uppercase letter</p>
              <p className={validations.number ? 'valid' : ''}>• One number</p>
              <p className={validations.special ? 'valid' : ''}>• One special character</p>
            </div>
          </div>

          <button type="submit" disabled={status === 'loading' || !isPasswordValid}>
            {status === 'loading' ? 'Registering...' : 'Register Now'}
          </button>

          {status === 'success' && (
            <div className="success-message">
              <CheckCircle size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
              Registration Successful! Redirecting to login...
            </div>
          )}
          {error && (
            <div className="error-message" style={{ color: '#ff4d4d', textAlign: 'center', marginTop: '1rem' }}>
              <AlertCircle size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
              {error}
            </div>
          )}
        </form>
      </div>
      <div className="footer">"Let's bleed gold!"</div>
    </div>
  );
};

export default RegistrationPage;
