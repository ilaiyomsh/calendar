import React, { useState } from 'react';
import styles from './SettingsTabs.module.css';

const SettingsTabs = ({ children, defaultTab = 'info' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabs = [
    { id: 'info', label: 'הגדרות מידע' },
    { id: 'calendar', label: 'הגדרות יומן' }
  ];

  return (
    <div className={styles.tabsContainer}>
      <div className={styles.tabsHeader}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className={styles.tabsContent}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            // נבדוק אם יש data-tab-id ב-props (עבור div elements)
            const tabId = child.props['data-tab-id'];
            if (tabId === activeTab) {
              return child;
            }
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default SettingsTabs;

