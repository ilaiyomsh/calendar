import React from 'react';
import styles from './SettingsSection.module.css';

const SettingsSection = ({ id, title, isOpen, onToggle, children, isComplete, description }) => {
  return (
    <div className={styles.section}>
      <div 
        className={styles.sectionHeader}
        onClick={onToggle}
      >
        <div className={styles.sectionHeaderLeft}>
          <span className={styles.sectionIcon}>
            {isOpen ? '▼' : '▶'}
          </span>
          <h3 className={styles.sectionTitle}>{title}</h3>
          {isComplete && (
            <span className={styles.completeIndicator} title="הוגדר במלואו">✓</span>
          )}
        </div>
      </div>
      {isOpen && (
        <>
          {description && (
            <p className={styles.sectionDescription}>{description}</p>
          )}
          <div className={styles.sectionContent}>
            {children}
          </div>
        </>
      )}
    </div>
  );
};

export default SettingsSection;

