import React, { useEffect, useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import api from '../../services/api';

const InvitationsTab = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulkEmails, setBulkEmails] = useState('');
  const [sendingBulk, setSendingBulk] = useState(false);
  const [resendingId, setResendingId] = useState(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = () => {
    setLoading(true);
    api.get('/api/invitations')
      .then(({ data }) => setInvitations(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Failed to load invitations'))
      .finally(() => setLoading(false));
  };

  const handleResend = async (id) => {
    setResendingId(id);
    try {
      await api.post(`/api/invitations/${id}/resend`);
      toast.success('Invitation resent');
    } catch {
      toast.error('Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  const handleBulkInvite = async () => {
    const emails = bulkEmails
      .split(/[\n,;]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emails.length === 0) {
      toast.error('Enter at least one email address');
      return;
    }

    setSendingBulk(true);
    try {
      await api.post('/api/invitations', { emails });
      toast.success(`Sent ${emails.length} invitation${emails.length > 1 ? 's' : ''}`);
      setBulkEmails('');
      fetchInvitations();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to send invitations');
    } finally {
      setSendingBulk(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Bulk Invite */}
      <div className="card card--flat" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)' }}>
          Bulk Invite
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Enter email addresses separated by commas, semicolons, or new lines.
        </p>
        <textarea
          className="input-textarea"
          placeholder="alice@example.com&#10;bob@example.com"
          rows={4}
          value={bulkEmails}
          onChange={e => setBulkEmails(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleBulkInvite} loading={sendingBulk} disabled={!bulkEmails.trim()}>
            <Send size={16} /> Send Invitations
          </Button>
        </div>
      </div>

      {/* Invitations Table */}
      {loading ? (
        <div className="flex justify-center" style={{ padding: 'var(--space-12)' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Email', 'Invited By', 'Status', 'Sent On', ''].map(h => (
                  <th key={h} style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No invitations yet.
                  </td>
                </tr>
              ) : invitations.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--space-3)' }}>{inv.email}</td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)' }}>{inv.invitedBy ?? '-'}</td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <Badge status={inv.status} />
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)' }}>
                    {inv.sentAt ? new Date(inv.sentAt).toLocaleDateString() : inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <button
                      onClick={() => handleResend(inv.id)}
                      disabled={resendingId === inv.id}
                      style={{ background: 'none', border: 'none', color: 'var(--color-maroon)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      title="Resend"
                    >
                      <RefreshCw size={15} style={resendingId === inv.id ? { animation: 'spin 1s linear infinite' } : {}} />
                      Resend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvitationsTab;
