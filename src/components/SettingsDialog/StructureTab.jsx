import React from 'react';
import { Briefcase, Tag, ListTodo, FileText, Calendar } from 'lucide-react';
import StructureOption from './StructureOption';
import { STRUCTURE_MODES } from '../../contexts/SettingsContext';
import styles from './StructureTab.module.css';

/**
 * טאב בחירת מבנה הדיווח
 * מאפשר בחירה ויזואלית של סוג ההיררכיה
 */
const StructureTab = ({ settings, onChange }) => {
  const { structureMode, enableNotes, showHolidays } = settings;

  const handleModeChange = (mode) => {
    onChange({ structureMode: mode });
  };

  const handleNotesToggle = () => {
    onChange({ enableNotes: !enableNotes });
  };

  const handleHolidaysToggle = () => {
    onChange({ showHolidays: !showHolidays });
  };

  const structureOptions = [
    {
      mode: STRUCTURE_MODES.PROJECT_ONLY,
      icon: Briefcase,
      title: 'דיווח כללי (פרויקט בלבד)',
      description: 'דיווח פשוט ברמת התיק/פרויקט, ללא פירוט נוסף.'
    },
    {
      mode: STRUCTURE_MODES.PROJECT_WITH_STAGE,
      icon: Tag,
      title: 'פרויקט + סיווג (סטטוס)',
      description: 'הפרויקט מחולק לפי ערכים קבועים (כגון: סוג פעילות, שלב, מחלקה) המנוהלים בעמודת סטטוס.'
    },
    {
      mode: STRUCTURE_MODES.PROJECT_WITH_TASKS,
      icon: ListTodo,
      title: 'פרויקט + משימות (Item)',
      description: 'לכל פרויקט יש משימות פרטניות המנוהלות בלוח משימות נפרד ומקושר.'
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.optionsGrid}>
        {structureOptions.map((option) => (
          <StructureOption
            key={option.mode}
            mode={option.mode}
            icon={option.icon}
            title={option.title}
            description={option.description}
            isSelected={structureMode === option.mode}
            onClick={() => handleModeChange(option.mode)}
          />
        ))}
      </div>

      <label className={styles.notesToggle}>
        <div className={styles.notesCheckbox}>
          <input
            type="checkbox"
            checked={enableNotes}
            onChange={handleNotesToggle}
          />
        </div>
        <div className={styles.notesContent}>
          <span className={styles.notesTitle}>
            <FileText size={20} className={styles.notesIcon} />
             הוספת מלל חופשי
          </span>
         
        </div>
      </label>

      <label className={styles.notesToggle}>
        <div className={styles.notesCheckbox}>
          <input
            type="checkbox"
            checked={showHolidays !== false}
            onChange={handleHolidaysToggle}
          />
        </div>
        <div className={styles.notesContent}>
          <span className={styles.notesTitle}>
            <Calendar size={20} className={styles.notesIcon} />
            הצג חגים ישראליים
          </span>
          
        </div>
      </label>
    </div>
  );
};

export default StructureTab;
