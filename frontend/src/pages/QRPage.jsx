import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import PageContainer from '../components/layout/PageContainer';
import AlreadyRegistered from '../components/qr/AlreadyRegistered';
import CheckInCard from '../components/qr/CheckInCard';
import Card from '../components/ui/Card';

const QRPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', data: null, error: 'Invalid QR code' });
      return;
    }

    api
      .get(`/api/qr/${token}`)
      .then(({ data }) => {
        if (data.type === 'register') {
          const params = new URLSearchParams({ token });
          if (data.email) params.set('email', data.email);
          navigate(`/register?${params.toString()}`, { replace: true });
        } else {
          setState({ status: 'ready', data, error: null });
        }
      })
      .catch((err) => {
        const message =
          err.response?.status === 404
            ? 'This QR code is invalid or has expired.'
            : err.response?.data?.error || 'Failed to load QR code';
        setState({ status: 'error', data: null, error: message });
      });
  }, [token, navigate]);

  if (state.status === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  const innerContent = state.status === 'error' ? (
    <Card style={{ textAlign: 'center', maxWidth: '440px', width: '100%' }}>
      <h2 style={{ color: 'var(--color-error)', marginBottom: '12px' }}>Invalid QR Code</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>{state.error}</p>
    </Card>
  ) : state.data?.type === 'already_registered' ? (
    <AlreadyRegistered
      registrant={state.data.registrant}
      eventDate={state.data.eventDate}
    />
  ) : state.data?.type === 'checkin' ? (
    <CheckInCard
      token={token}
      registrant={state.data.registrant}
      alreadyCheckedIn={state.data.alreadyCheckedIn}
      checkedInAt={state.data.checkedInAt}
    />
  ) : null;

  return (
    <PageContainer>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {innerContent}
      </div>
    </PageContainer>
  );
};

export default QRPage;
