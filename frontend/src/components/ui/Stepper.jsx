import React from 'react';
import { Check } from 'lucide-react';

/**
 * Multi-step wizard progress indicator.
 * `steps` — array of `{ id, label }` objects
 * `currentStep` — 0-based index of the active step
 */
const Stepper = ({ steps, currentStep }) => (
  <div className="stepper">
    {steps.map((step, index) => {
      const isComplete = index < currentStep;
      const isActive = index === currentStep;

      const itemClass = [
        'stepper-item',
        isActive ? 'stepper-active' : '',
        isComplete ? 'stepper-complete' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <React.Fragment key={step.id}>
          <div className={itemClass}>
            <div className="stepper-circle">
              {isComplete ? <Check size={14} strokeWidth={3} /> : index + 1}
            </div>
            <span className="stepper-label">{step.label}</span>
          </div>
          {index < steps.length - 1 && <div className="stepper-line" />}
        </React.Fragment>
      );
    })}
  </div>
);

export default Stepper;
