import React, { useState } from 'react';
import styles from './SettingsAccordion.module.css';

const SettingsAccordion = ({ children, defaultOpen = [] }) => {
  const [openSections, setOpenSections] = useState(new Set(defaultOpen));

  const toggleSection = (sectionId) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  return (
    <div className={styles.accordion}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            isOpen: openSections.has(child.props.id),
            onToggle: () => toggleSection(child.props.id)
          });
        }
        return child;
      })}
    </div>
  );
};

export default SettingsAccordion;

