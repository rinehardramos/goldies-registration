import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Stepper from '../ui/Stepper';
import Card from '../ui/Card';
import StepWho from './StepWho';
import StepReview from './StepReview';
import StepInvite from './StepInvite';
import StepSuccess from './StepSuccess';

const STEPS = [
  { id: 'who', label: 'Who' },
  { id: 'review', label: 'Review' },
  { id: 'invite', label: 'Invite' },
  { id: 'success', label: 'Done' },
];

// Step indices
const STEP_WHO = 0;
const STEP_REVIEW = 1;
const STEP_INVITE = 2;
const STEP_SUCCESS = 3;

export default function RegisterWizard() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');
  const inviteEmail = searchParams.get('email');

  const [currentStep, setCurrentStep] = useState(STEP_WHO);
  const [registrants, setRegistrants] = useState([]);

  // Pre-fill invited user if coming from invitation link
  const prefillEmail = inviteEmail || '';

  function handleAddRegistrant(registrant) {
    setRegistrants((prev) => [...prev, registrant]);
    setCurrentStep(STEP_REVIEW);
  }

  function handleRemoveRegistrant(index) {
    setRegistrants((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddAnother() {
    setCurrentStep(STEP_WHO);
  }

  function handleReviewNext() {
    setCurrentStep(STEP_INVITE);
  }

  function handleInviteNext() {
    setCurrentStep(STEP_SUCCESS);
  }

  const existingTypes = registrants.map((r) => r.type);

  return (
    <div className="wizard-container">
      {currentStep < STEP_SUCCESS && (
        <Stepper steps={STEPS} currentStep={currentStep} />
      )}

      <Card className="wizard-card">
        {currentStep === STEP_WHO && (
          <StepWho
            onAdd={handleAddRegistrant}
            existingTypes={existingTypes}
            prefillEmail={prefillEmail}
            inviteToken={inviteToken}
          />
        )}

        {currentStep === STEP_REVIEW && (
          <StepReview
            registrants={registrants}
            onRemove={handleRemoveRegistrant}
            onAddAnother={handleAddAnother}
            onNext={handleReviewNext}
          />
        )}

        {currentStep === STEP_INVITE && (
          <StepInvite onNext={handleInviteNext} />
        )}

        {currentStep === STEP_SUCCESS && <StepSuccess />}
      </Card>
    </div>
  );
}
