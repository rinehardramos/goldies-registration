import React from 'react';

/**
 * Labeled input with optional error state.
 * Use `as="textarea"` to render a <textarea> instead of <input>.
 */
const Input = ({
  label,
  id,
  error,
  as: Tag = 'input',
  className = '',
  ...rest
}) => {
  const fieldClass = [
    Tag === 'textarea' ? 'input-textarea' : 'input-field',
    error ? 'input-error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="input-group">
      {label && (
        <label className="input-label" htmlFor={id}>
          {label}
        </label>
      )}
      <Tag id={id} className={fieldClass} {...rest} />
      {error && <p className="input-error-text">{error}</p>}
    </div>
  );
};

export default Input;
