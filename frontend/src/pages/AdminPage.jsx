import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Mail, QrCode, Settings, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import Dashboard from '../components/admin/Dashboard';
import RegistrantsTab from '../components/admin/RegistrantsTab';
import InvitationsTab from '../components/admin/InvitationsTab';
import CheckInTab from '../components/admin/CheckInTab';
import SettingsTab from '../components/admin/SettingsTab';

const TAB_LIST = [
  { id: 'dashboard',   label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LayoutDashboard size={15} /> Dashboard</span>  },
  { id: 'registrants', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={15} /> Registrants</span>           },
  { id: 'invitations', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={15} /> Invitations</span>            },
  { id: 'checkin',     label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><QrCode size={15} /> Check-in</span>             },
  { id: 'settings',   label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Settings size={15} /> Settings</span>            },
];

const COMPONENTS = {
  dashboard:   <Dashboard />,
  registrants: <RegistrantsTab />,
  invitations: <InvitationsTab />,
  checkin:     <CheckInTab />,
  settings:    <SettingsTab />,
};

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Guard: redirect to login if not admin once auth is resolved
  useEffect(() => {
    if (loading) return;
    if (!user || !user.isAdmin) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user?.isAdmin) return null;

  return (
    <div className="admin-page">
      {/* Sticky header */}
      <header className="admin-header">
        <h1>Admin Panel</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout} style={{ color: 'var(--color-gold)' }}>
          <LogOut size={16} /> Logout
        </Button>
      </header>

      {/* Main content */}
      <div className="admin-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Tabs tabs={TAB_LIST} activeTab={activeTab} onTabChange={setActiveTab} />
          <div>
            {COMPONENTS[activeTab]}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
