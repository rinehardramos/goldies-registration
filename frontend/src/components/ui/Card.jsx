import React from 'react';

/**
 * Simple white card with shadow. Pass `className` for extra styles.
 */
const Card = ({ children, className = '', ...rest }) => (
  <div className={`card ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export default Card;
