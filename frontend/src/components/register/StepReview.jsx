import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { setAccessToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

export default function StepReview({ registrants, onRemove, onAddAnother, onNext }) {
  const { setUser } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setLoading(true);
    try {
      let loggedInUser = null;

      for (const r of registrants) {
        if (r.type === 'myself') {
          // Register the primary user
          const { data } = await api.post('/api/auth/register', {
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email,
            password: r.password,
            batchYear: r.batchYear,
          });
          if (data.accessToken) {
            setAccessToken(data.accessToken);
          }
          loggedInUser = data.user;
          setUser(loggedInUser);
        } else if (r.type === 'someone_else') {
          // Send invitation to the "someone else" registrant
          try {
            await api.post('/api/invitations', { emails: [r.email] });
          } catch (err) {
            const msg = err.response?.data?.error || `Failed to send invitation to ${r.email}`;
            toast.error(msg);
          }
        }
      }

      toast.success('Registration successful!');
      onNext();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="step-review">
      <p className="step-review-hint">
        Review the registrants below. You can remove or add more before continuing.
      </p>

      <div className="registrant-list">
        {registrants.map((r, idx) => (
          <div key={idx} className="registrant-card">
            <div className="registrant-info">
              <strong>{r.firstName} {r.lastName}</strong>
              <span>{r.email}</span>
              <span>Batch {r.batchYear}</span>
              {r.type === 'someone_else' && (
                <span className="registrant-badge">Guest (invitation will be sent)</span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm registrant-remove"
              onClick={() => onRemove(idx)}
              title="Remove"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="step-actions">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onAddAnother}
          disabled={loading}
        >
          + Add Another
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          loading={loading}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
