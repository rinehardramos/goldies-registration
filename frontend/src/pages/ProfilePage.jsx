import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, Save, ArrowLeft, Loader2, CheckCircle, AlertCircle, ShieldCheck, LogOut } from 'lucide-react';

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Profile Details State
  const [fullName, setFullName] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [email, setEmail] = useState('');
  
  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('idle');
  const [validations, setValidations] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false
  });

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    let storedUser = null;
    try {
      storedUser = (userStr && userStr !== 'undefined') ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      localStorage.removeItem('user');
      navigate('/');
      return;
    }

    if (!storedUser) {
      navigate('/');
      return;
    }
    setUser(storedUser);
    fetchProfile(storedUser.id);
  }, [navigate]);

  const fetchProfile = async (id) => {
    try {
      setLoading(true);
      let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
      
      const response = await axios.get(`${apiUrl}/api/profile/${id}`);
      const data = response.data;
      setFullName(data.fullName);
      setBatchYear(data.batchYear);
      setEmail(data.email);
      setLoading(false);
    } catch (err) {
      setError('Failed to load profile details');
      setLoading(false);
    }
  };

  const validatePassword = (pass) => {
    setValidations({
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[^A-Za-z0-9]/.test(pass)
    });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
      
      await axios.put(`${apiUrl}/api/profile/${user.id}`, { fullName, batchYear, email });
      setSuccess('Profile updated successfully');
      
      // Update local storage name if it changed
      const updatedUser = { ...user, fullName };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    const isPasswordValid = Object.values(validations).every(Boolean);
    if (!isPasswordValid) {
      setError('New password does not meet requirements');
      return;
    }

    setPasswordStatus('loading');
    try {
      let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
      
      await axios.post(`${apiUrl}/api/profile/${user.id}/change-password`, { currentPassword, newPassword });
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus('success');
      setValidations({ length: false, uppercase: false, number: false, special: false });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
      setPasswordStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <Loader2 size={48} className="animate-spin" style={{ color: 'var(--gold)' }} />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <div className="glass-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <Link to={user?.isAdmin ? "/admin" : "/"} style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', opacity: 0.7 }}>
            <ArrowLeft size={18} /> {user?.isAdmin ? "Back to Admin" : "Back to Home"}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={24} style={{ color: 'var(--gold)' }} />
            <h2 style={{ margin: 0, background: 'none', color: 'var(--gold)', fontSize: '1.5rem', WebkitTextFillColor: 'initial' }}>My Profile</h2>
          </div>
          <button 
            onClick={handleLogout}
            className="logout-btn"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>

        {error && (
          <div className="error-message" style={{ color: '#ff4d4d', textAlign: 'center', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {success && (
          <div className="success-message" style={{ color: '#4CAF50', textAlign: 'center', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle size={18} />
            {success}
          </div>
        )}

        <div className="profile-grid">
          {/* Profile Details Form */}
          <div>
            <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Personal Details</h3>
            <form onSubmit={handleProfileUpdate}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Batch Year</label>
                <input type="text" value={batchYear} onChange={(e) => setBatchYear(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button type="submit" style={{ marginTop: '1rem' }}>
                <Save size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Update Profile
              </button>
            </form>
          </div>

          {/* Password Change Form */}
          <div>
            <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Security</h3>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    validatePassword(e.target.value);
                  }} 
                  required 
                />
                <div className="password-requirements" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  <p className={validations.length ? 'valid' : ''}>• Min 8 chars</p>
                  <p className={validations.uppercase ? 'valid' : ''}>• One uppercase</p>
                  <p className={validations.number ? 'valid' : ''}>• One number</p>
                  <p className={validations.special ? 'valid' : ''}>• One special</p>
                </div>
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              <button type="submit" style={{ marginTop: '1rem', background: 'var(--maroon)', border: '1px solid var(--gold)' }} disabled={passwordStatus === 'loading'}>
                <Lock size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Change Password
              </button>
            </form>
          </div>
        </div>
      </div>
      <div className="footer">"Let's bleed gold!"</div>

      <style>{`
        .profile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }
        .logout-btn {
          background: rgba(255, 77, 77, 0.1);
          border: 1px solid #ff4d4d;
          color: #ff4d4d;
          padding: 0.4rem 0.8rem;
          borderRadius: 8px;
          display: flex;
          alignItems: center;
          gap: 8px;
          cursor: pointer;
          fontSize: 0.9rem;
          font-weight: bold;
          transition: all 0.2s ease;
          margin-left: 15px;
        }
        .logout-btn:hover {
          background: rgba(255, 77, 77, 0.2);
        }
        @media (max-width: 768px) {
          .profile-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
          .logout-btn {
            margin-left: 0;
            padding: 0.3rem 0.6rem;
            font-size: 0.85rem;
          }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .password-requirements p {
          margin: 0;
          opacity: 0.6;
        }
        .password-requirements p.valid {
          color: #4CAF50;
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;
