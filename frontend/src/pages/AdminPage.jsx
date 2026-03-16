import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Search, Filter, Loader2, ArrowLeft, Users, Edit2, Check, X, User, LogOut } from 'lucide-react';

const AdminPage = () => {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ fullName: '', batchYear: '', email: '' });

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  useEffect(() => {
    // Simple admin check
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/');
      return;
    }
    const user = JSON.parse(userStr);
    if (!user.isAdmin) {
      navigate('/');
      return;
    }

    fetchRegistrations();
  }, [navigate]);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
      
      const response = await axios.get(`${apiUrl}/api/registrations`);
      setRegistrations(response.rows || response.data || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load registrations');
      setLoading(false);
    }
  };

  const handleEditClick = (reg) => {
    setEditingId(reg.id);
    setEditFormData({ fullName: reg.fullName, batchYear: reg.batchYear, email: reg.email });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id) => {
    try {
      let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
      
      await axios.put(`${apiUrl}/api/registrations/${id}`, editFormData);
      
      setRegistrations(registrations.map(reg => reg.id === id ? { ...reg, ...editFormData } : reg));
      setEditingId(null);
    } catch (err) {
      alert('Failed to update registration');
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch = reg.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          reg.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBatch = batchFilter === '' || reg.batchYear.toString() === batchFilter;
    return matchesSearch && matchesBatch;
  });

  const uniqueBatches = [...new Set(registrations.map(reg => reg.batchYear))].sort();

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <div className="glass-card admin-card">
        <div className="admin-header">
          <Link to="/" className="back-link">
            <ArrowLeft size={18} /> Back to Login
          </Link>
          <div className="admin-nav-actions">
            <Link to="/profile" className="profile-link">
              <User size={18} /> My Profile
            </Link>
            <div className="admin-title-group">
              <Users size={24} style={{ color: 'var(--gold)' }} />
              <h2 className="admin-title">Admin Dashboard</h2>
            </div>
            <button 
              onClick={handleLogout}
              className="admin-logout-btn"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        <div className="admin-controls">
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-container">
            <Filter size={18} className="filter-icon" />
            <select 
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="batch-select"
            >
              <option value="">All Batches</option>
              {uniqueBatches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 size={48} className="animate-spin" style={{ color: 'var(--gold)' }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#ff4d4d' }}>{error}</div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '12px' }}>Full Name</th>
                  <th style={{ padding: '12px' }}>Batch</th>
                  <th style={{ padding: '12px' }}>Email</th>
                  <th style={{ padding: '12px' }}>Registered On</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations.length > 0 ? filteredRegistrations.map((reg) => (
                  <tr key={reg.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {editingId === reg.id ? (
                      <>
                        <td style={{ padding: '12px' }}>
                          <input type="text" value={editFormData.fullName} onChange={e => setEditFormData({...editFormData, fullName: e.target.value})} style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', color: 'white' }} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input type="text" value={editFormData.batchYear} onChange={e => setEditFormData({...editFormData, batchYear: e.target.value})} style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', color: 'white' }} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', color: 'white' }} />
                        </td>
                        <td style={{ padding: '12px', opacity: 0.7 }}>{new Date(reg.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button onClick={() => handleSaveEdit(reg.id)} style={{ background: 'transparent', border: 'none', color: '#4CAF50', cursor: 'pointer', marginRight: '8px' }} title="Save"><Check size={18} /></button>
                          <button onClick={handleCancelEdit} style={{ background: 'transparent', border: 'none', color: '#f44336', cursor: 'pointer' }} title="Cancel"><X size={18} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '12px' }}>{reg.fullName}</td>
                        <td style={{ padding: '12px' }}><span className="badge">{reg.batchYear}</span></td>
                        <td style={{ padding: '12px' }}>{reg.email}</td>
                        <td style={{ padding: '12px', opacity: 0.7 }}>{new Date(reg.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button onClick={() => handleEditClick(reg)} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer' }} title="Edit"><Edit2 size={18} /></button>
                        </td>
                      </>
                    )}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No registrations found matching your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="footer">"Let's bleed gold!"</div>
      
      <style>{`
        .admin-card {
          padding: 2rem;
        }
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .admin-nav-actions {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .admin-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .admin-title {
          margin: 0;
          color: var(--gold);
          font-size: 1.5rem;
        }
        .back-link {
          color: white;
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          opacity: 0.7;
        }
        .profile-link {
          color: white;
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          opacity: 0.8;
          font-size: 0.9rem;
        }
        .admin-logout-btn {
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
        }
        .admin-logout-btn:hover {
          background: rgba(255, 77, 77, 0.2);
        }
        .admin-controls {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .search-container {
          position: relative;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.5;
        }
        .search-input {
          padding-left: 40px !important;
        }
        .filter-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .batch-select {
          padding: 0.8rem;
          border-radius: 10px;
          background: rgba(0,0,0,0.2);
          color: white;
          border: 1px solid var(--glass-border);
        }
        .badge {
          background: var(--gold-dark);
          color: var(--maroon);
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 0.85rem;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .admin-card {
            padding: 1.5rem;
          }
          .admin-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .admin-nav-actions {
            width: 100%;
            justify-content: space-between;
            gap: 10px;
          }
          .admin-controls {
            grid-template-columns: 1fr;
          }
          .batch-select {
            width: 100%;
          }
          .filter-container {
            width: 100%;
          }
          .admin-title {
            font-size: 1.2rem;
          }
        }

        @media (max-width: 480px) {
          .admin-nav-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .admin-title-group {
            order: -1;
            margin-bottom: 0.5rem;
          }
          .admin-logout-btn {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminPage;
