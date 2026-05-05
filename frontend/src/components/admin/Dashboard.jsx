import React, { useEffect, useState } from 'react';
import { Users, Mail, Clock, CheckSquare } from 'lucide-react';
import api from '../../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/dashboard')
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 'var(--space-12)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const cards = [
    { label: 'Registered',   value: stats?.registered   ?? 0, Icon: Users,       color: 'var(--color-info)' },
    { label: 'Invitations',  value: stats?.invitations  ?? 0, Icon: Mail,        color: 'var(--color-maroon)' },
    { label: 'Pending',      value: stats?.pending      ?? 0, Icon: Clock,       color: 'var(--color-warning)' },
    { label: 'Checked In',   value: stats?.checkedIn    ?? 0, Icon: CheckSquare, color: 'var(--color-success)' },
  ];

  return (
    <div className="dashboard">
      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
        Overview
      </h2>
      <div className="stats-grid">
        {cards.map(({ label, value, Icon, color }) => (
          <div key={label} className="stat-card">
            <Icon size={24} style={{ color }} />
            <span className="stat-value" style={{ color }}>{value}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
