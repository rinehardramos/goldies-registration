import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Input from '../ui/Input';
import Button from '../ui/Button';

export default function StepInvite({ onNext }) {
  const [emailsText, setEmailsText] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const emails = emailsText
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emails.length === 0) {
      toast.error('Enter at least one email address');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/api/invitations', { emails });
      const sent = data.results?.filter((r) => r.status === 'sent').length ?? 0;
      const failed = data.results?.filter((r) => r.status === 'send_failed').length ?? 0;
      const alreadyInvited = data.results?.filter(
        (r) => r.status === 'already_invited' || r.status === 'already_registered'
      ).length ?? 0;

      if (sent > 0) toast.success(`${sent} invitation${sent > 1 ? 's' : ''} sent!`);
      if (alreadyInvited > 0) toast(`${alreadyInvited} already invited or registered`, { icon: 'ℹ️' });
      if (failed > 0) toast.error(`${failed} invitation${failed > 1 ? 's' : ''} failed to send`);

      onNext();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    onNext();
  }

  return (
    <div className="step-invite">
      <p className="step-invite-hint">
        Know someone who should come? Enter their email addresses below and
        we&apos;ll send them an invitation with a QR code to register.
      </p>

      <Input
        as="textarea"
        label="Email Addresses"
        id="inviteEmails"
        value={emailsText}
        onChange={(e) => setEmailsText(e.target.value)}
        placeholder="friend@example.com, another@example.com&#10;(one per line or comma-separated)"
        rows={5}
      />

      <div className="step-actions">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={handleSkip}
          disabled={loading}
        >
          Skip
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          loading={loading}
          onClick={handleSend}
        >
          Send Invites &amp; Complete
        </Button>
      </div>
    </div>
  );
}
