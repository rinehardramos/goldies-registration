import React from 'react';

/**
 * Status badge. `status` maps to a CSS modifier class:
 * pending | registered | checkedin | sent | failed
 */
const Badge = ({ status, label, className = '' }) => {
  const statusClass = status ? `badge-${status.toLowerCase().replace(/\s+/g, '')}` : '';
  return (
    <span className={`badge ${statusClass} ${className}`.trim()}>
      {label ?? status}
    </span>
  );
};

export default Badge;
