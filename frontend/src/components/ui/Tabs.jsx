import React from 'react';

/**
 * Simple tab bar. `tabs` is an array of `{ id, label }` objects.
 * `activeTab` and `onTabChange` control the selected tab externally.
 */
const Tabs = ({ tabs, activeTab, onTabChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        role="tab"
        aria-selected={activeTab === tab.id}
        className={`tab${activeTab === tab.id ? ' tab-active' : ''}`}
        onClick={() => onTabChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

export default Tabs;
