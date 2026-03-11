import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';
import Countdown from '../components/Countdown';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const response = await axios.post(`${apiUrl}/api/login`, { email, password });
      setStatus('success');
      // In a real app, store token/user data
      console.log('Login success:', response.data);
      alert(`Welcome back, ${response.data.user.fullName}!`);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
      setStatus('error');
    }
  };

  return (
    <div className="container">
      <div className="glass-card">
        <h1>Goldies Day 2026</h1>
        <Countdown />
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--gold)' }}>Welcome Back</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Logging in...' : (
              <>
                <LogIn size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                Login
              </>
            )}
          </button>

          {error && (
            <div className="error-message" style={{ color: '#ff4d4d', textAlign: 'center', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <AlertCircle size={18} />
              {error}
            </div>
          )}
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ opacity: 0.8 }}>Don't have an account?</p>
          <Link to="/register" style={{ color: 'var(--gold)', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '0.5rem' }}>
            <UserPlus size={18} />
            Register Here
          </Link>
        </div>
      </div>
      <div className="footer">"Let's bleed gold!"</div>
    </div>
  );
};

export default LoginPage;
