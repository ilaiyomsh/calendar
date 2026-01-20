import React from 'react';
import styles from './StructureOption.module.css';

/**
 * כרטיס בחירת מצב מבנה
 * @param {string} mode - מזהה המצב
 * @param {string} title - כותרת
 * @param {string} description - תיאור
 * @param {React.ComponentType} icon - קומפוננטת אייקון
 * @param {boolean} isSelected - האם נבחר
 * @param {function} onClick - פונקציית לחיצה
 */
const StructureOption = ({ mode, title, description, icon: Icon, isSelected, onClick }) => {
  return (
    <div 
      className={`${styles.option} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className={`${styles.iconWrapper} ${isSelected ? styles.iconSelected : ''}`}>
        <Icon size={24} />
      </div>
      
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>
      
      {isSelected && (
        <div className={styles.checkmark}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      )}
    </div>
  );
};

export default StructureOption;
