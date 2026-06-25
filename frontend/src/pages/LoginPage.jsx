import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Countdown from '../components/Countdown';
import bluepointLogo from '../assets/bluepoint-logo.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  if (user) {
    navigate(user.isAdmin ? '/admin' : '/profile', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      toast.success('Welcome back!');
      navigate(loggedInUser.isAdmin ? '/admin' : '/profile');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="login-page">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="login-header"
        >
          <p className="login-eyebrow">Annual Celebration</p>
          <h1 className="login-title">
            Goldies&nbsp;Day <span className="login-title-year">2026</span>
          </h1>
          <span className="login-divider" aria-hidden="true" />
          <p className="login-tagline">Let&apos;s bleed gold!</p>
          <Countdown />
        </motion.div>

        <Card className="login-card">
          <h2>Sign In</h2>
          <form onSubmit={handleSubmit}>
            <Input
              label="Email"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
            <Input
              label="Password"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              fullWidth
              className="login-btn"
            >
              Sign In
            </Button>
          </form>
          <p className="login-footer">
            Don&apos;t have an account? <Link to="/register">Register here</Link>
          </p>
        </Card>

        <a
          className="powered-by"
          href="https://blueptsolution.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Powered by</span>
          <img src={bluepointLogo} alt="Bluepoint Solutions" />
        </a>
      </div>
    </PageContainer>
  );
}
