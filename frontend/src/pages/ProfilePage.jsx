import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, Save, ArrowLeft, Loader2, CheckCircle, AlertCircle, ShieldCheck, LogOut, Users, Plus, Edit2, Trash2, X } from 'lucide-react';

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [fullName, setFullName] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [email, setEmail] = useState('');
  
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

  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [showAttendeeForm, setShowAttendeeForm] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState(null);
  const [attendeeForm, setAttendeeForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    batchYear: '',
    address: ''
  });
  const [attendeeError, setAttendeeError] = useState('');

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
    fetchAttendees(storedUser.id);
  }, [navigate]);

  const getApiUrl = () => {
    let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
    return apiUrl;
  };

  const fetchProfile = async (id) => {
    try {
      setLoading(true);
      const response = await axios.get(`${getApiUrl()}/api/profile/${id}`);
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

  const fetchAttendees = async (userId) => {
    try {
      setAttendeesLoading(true);
      const response = await axios.get(`${getApiUrl()}/api/attendees?userId=${userId}`);
      setAttendees(response.data);
      setAttendeesLoading(false);
    } catch (err) {
      setAttendeesLoading(false);
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
      await axios.put(`${getApiUrl()}/api/profile/${user.id}`, { fullName, batchYear, email });
      setSuccess('Profile updated successfully');
      
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
      await axios.post(`${getApiUrl()}/api/profile/${user.id}/change-password`, { currentPassword, newPassword });
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

  const resetAttendeeForm = () => {
    setAttendeeForm({ fullName: '', email: '', phone: '', batchYear: '', address: '' });
    setShowAttendeeForm(false);
    setEditingAttendee(null);
    setAttendeeError('');
  };

  const handleAttendeeSubmit = async (e) => {
    e.preventDefault();
    setAttendeeError('');

    if (!attendeeForm.fullName || !attendeeForm.email || !attendeeForm.phone) {
      setAttendeeError('Full name, email, and phone are required');
      return;
    }

    try {
      if (editingAttendee) {
        const response = await axios.put(`${getApiUrl()}/api/attendees/${editingAttendee.id}`, attendeeForm);
        setAttendees(attendees.map(a => a.id === editingAttendee.id ? response.data : a));
        setSuccess('Attendee updated successfully');
      } else {
        const response = await axios.post(`${getApiUrl()}/api/attendees`, { ...attendeeForm, userId: user.id });
        setAttendees([response.data, ...attendees]);
        setSuccess('Attendee added successfully');
      }
      resetAttendeeForm();
    } catch (err) {
      setAttendeeError(err.response?.data?.error || 'Failed to save attendee');
    }
  };

  const handleEditAttendee = (attendee) => {
    setEditingAttendee(attendee);
    setAttendeeForm({
      fullName: attendee.fullName,
      email: attendee.email,
      phone: attendee.phone,
      batchYear: attendee.batchYear || '',
      address: attendee.address || ''
    });
    setShowAttendeeForm(true);
    setAttendeeError('');
  };

  const handleDeleteAttendee = async (id) => {
    if (!window.confirm('Are you sure you want to archive this attendee?')) return;

    try {
      await axios.delete(`${getApiUrl()}/api/attendees/${id}`);
      setAttendees(attendees.filter(a => a.id !== id));
      setSuccess('Attendee archived successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to archive attendee');
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
    <div className="container" style={{ maxWidth: '900px' }}>
      <div className="glass-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <Link to={user?.isAdmin ? "/admin" : "/"} style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', opacity: 0.7 }}>
            <ArrowLeft size={18} /> {user?.isAdmin ? "Back to Admin" : "Back to Home"}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={24} style={{ color: 'var(--gold)' }} />
            <h2 style={{ margin: 0, background: 'none', color: 'var(--gold)', fontSize: '1.5rem', WebkitTextFillColor: 'initial' }}>My Profile</h2>
          </div>
          <button onClick={handleLogout} className="logout-btn">
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

        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Users size={20} style={{ color: 'var(--gold)' }} />
              My Attendees
            </h3>
            <button onClick={() => { resetAttendeeForm(); setShowAttendeeForm(true); }} className="add-attendee-btn">
              <Plus size={18} /> Add Attendee
            </button>
          </div>

          {showAttendeeForm && (
            <div className="attendee-form-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0 }}>{editingAttendee ? 'Edit Attendee' : 'Add New Attendee'}</h4>
                <button onClick={resetAttendeeForm} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {attendeeError && (
                <div style={{ color: '#ff4d4d', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  {attendeeError}
                </div>
              )}

              <form onSubmit={handleAttendeeSubmit} className="attendee-form">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" value={attendeeForm.fullName} onChange={(e) => setAttendeeForm({ ...attendeeForm, fullName: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" value={attendeeForm.email} onChange={(e) => setAttendeeForm({ ...attendeeForm, email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input type="tel" value={attendeeForm.phone} onChange={(e) => setAttendeeForm({ ...attendeeForm, phone: e.target.value })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Batch Year</label>
                    <input type="text" value={attendeeForm.batchYear} onChange={(e) => setAttendeeForm({ ...attendeeForm, batchYear: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <input type="text" value={attendeeForm.address} onChange={(e) => setAttendeeForm({ ...attendeeForm, address: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                  <button type="submit">
                    <Save size={16} style={{ marginRight: '6px' }} />
                    {editingAttendee ? 'Update' : 'Save'} Attendee
                  </button>
                  <button type="button" onClick={resetAttendeeForm} style={{ background: 'rgba(255,255,255,0.1)' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {attendeesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--gold)' }} />
            </div>
          ) : attendees.length > 0 ? (
            <div className="attendees-table-container">
              <table className="attendees-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Batch</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((attendee) => (
                    <tr key={attendee.id}>
                      <td>{attendee.fullName}</td>
                      <td>{attendee.email}</td>
                      <td>{attendee.phone}</td>
                      <td>{attendee.batchYear || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => handleEditAttendee(attendee)} className="action-btn edit-btn" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteAttendee(attendee.id)} className="action-btn delete-btn" title="Archive">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
              No attendees registered yet. Click "Add Attendee" to get started.
            </div>
          )}
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
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: bold;
          transition: all 0.2s ease;
          margin-left: 15px;
        }
        .logout-btn:hover {
          background: rgba(255, 77, 77, 0.2);
        }
        .add-attendee-btn {
          background: linear-gradient(45deg, var(--maroon), #8b0000);
          color: white;
          border: 1px solid var(--gold);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: bold;
          transition: all 0.2s ease;
        }
        .add-attendee-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .attendee-form-container {
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .attendee-form .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .attendees-table-container {
          overflow-x: auto;
        }
        .attendees-table {
          width: 100%;
          border-collapse: collapse;
          color: white;
        }
        .attendees-table th,
        .attendees-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .attendees-table th {
          background: rgba(0,0,0,0.2);
          font-weight: bold;
          color: var(--gold);
        }
        .attendees-table tr:hover {
          background: rgba(255,255,255,0.05);
        }
        .action-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        .action-btn.edit-btn {
          color: var(--gold);
        }
        .action-btn.edit-btn:hover {
          background: rgba(255, 215, 0, 0.1);
        }
        .action-btn.delete-btn {
          color: #ff4d4d;
        }
        .action-btn.delete-btn:hover {
          background: rgba(255, 77, 77, 0.1);
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
          .attendee-form .form-row {
            grid-template-columns: 1fr;
          }
          .attendees-table th:nth-child(3),
          .attendees-table td:nth-child(3),
          .attendees-table th:nth-child(4),
          .attendees-table td:nth-child(4) {
            display: none;
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
