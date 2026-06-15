import React, { useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';

const BATCH_YEARS = Array.from({ length: 2025 - 1960 + 1 }, (_, i) => 2025 - i);

const EMPTY_FORM = {
  type: 'myself', // 'myself' | 'someone_else'
  firstName: '',
  lastName: '',
  email: '',
  batchYear: '',
  password: '',
  confirmPassword: '',
};

export default function StepWho({ onAdd, existingTypes, prefillEmail = '', inviteToken = '' }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, email: prefillEmail });
  const [errors, setErrors] = useState({});

  // Only allow one "myself" registrant
  const myselfAlreadyAdded = existingTypes.includes('myself');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validate() {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email address';
    }
    if (!form.batchYear) errs.batchYear = 'Batch year is required';

    if (form.type === 'myself') {
      if (!form.password) {
        errs.password = 'Password is required';
      } else if (form.password.length < 8) {
        errs.password = 'Password must be at least 8 characters';
      }
      if (form.password !== form.confirmPassword) {
        errs.confirmPassword = 'Passwords do not match';
      }
    }
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onAdd({ ...form, invitationToken: inviteToken || null });
    setForm({ ...EMPTY_FORM, email: prefillEmail });
    setErrors({});
  }

  return (
    <form onSubmit={handleSubmit} className="step-who">
      <div className="radio-group">
        <label className="radio-option">
          <input
            type="radio"
            name="type"
            value="myself"
            checked={form.type === 'myself'}
            onChange={() => set('type', 'myself')}
            disabled={myselfAlreadyAdded}
          />
          <span>Myself</span>
          {myselfAlreadyAdded && (
            <span className="radio-hint">&nbsp;(already added)</span>
          )}
        </label>
        <label className="radio-option">
          <input
            type="radio"
            name="type"
            value="someone_else"
            checked={form.type === 'someone_else'}
            onChange={() => set('type', 'someone_else')}
          />
          <span>Someone else</span>
        </label>
      </div>

      <Input
        label="First Name"
        id="firstName"
        type="text"
        value={form.firstName}
        onChange={(e) => set('firstName', e.target.value)}
        placeholder="Juan"
        error={errors.firstName}
        required
      />
      <Input
        label="Last Name"
        id="lastName"
        type="text"
        value={form.lastName}
        onChange={(e) => set('lastName', e.target.value)}
        placeholder="dela Cruz"
        error={errors.lastName}
        required
      />
      <Input
        label="Email"
        id="email"
        type="email"
        value={form.email}
        onChange={(e) => set('email', e.target.value)}
        placeholder="juan@example.com"
        error={errors.email}
        required
      />

      <div className="input-group">
        <label className="input-label" htmlFor="batchYear">Batch Year</label>
        <select
          id="batchYear"
          className={`input-field${errors.batchYear ? ' input-error' : ''}`}
          value={form.batchYear}
          onChange={(e) => set('batchYear', e.target.value)}
          required
        >
          <option value="">Select batch year</option>
          {BATCH_YEARS.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        {errors.batchYear && <p className="input-error-text">{errors.batchYear}</p>}
      </div>

      {form.type === 'myself' && (
        <>
          <Input
            label="Password"
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="At least 8 characters"
            error={errors.password}
            required
          />
          <Input
            label="Confirm Password"
            id="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            placeholder="Re-enter password"
            error={errors.confirmPassword}
            required
          />
        </>
      )}

      <div className="step-actions">
        <Button type="submit" variant="primary" size="lg" fullWidth>
          Add to List
        </Button>
      </div>
    </form>
  );
}
