import React from 'react';

/**
 * Full-viewport page wrapper with centered content and gradient background.
 * Wraps children in .page-container > .page-content.
 */
const PageContainer = ({ children, className = '' }) => (
  <div className="page-container">
    <div className={`page-content ${className}`.trim()}>{children}</div>
  </div>
);

export default PageContainer;
