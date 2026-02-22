import React from 'react';
import { Calendar, Clock, Battery } from 'lucide-react';
import styles from './StructureTab.module.css';

/**
 * טאב הגדרות יומן
 * חגים ישראליים, אירועים זמניים, ויעדי שעות
 */
const CalendarTab = ({ settings, onChange }) => {
  return (
    <div className={styles.container}>
      {/* חגים ישראליים */}
      <label className={styles.notesToggle}>
        <div className={styles.notesCheckbox}>
          <input
            type="checkbox"
            checked={settings.showHolidays !== false}
            onChange={() => onChange({ showHolidays: !settings.showHolidays })}
          />
        </div>
        <div className={styles.notesContent}>
          <span className={styles.notesTitle}>
            <Calendar size={20} className={styles.notesIcon} />
            הצג חגים ישראליים
          </span>
        </div>
      </label>

      {/* אירועים זמניים */}
      <label className={styles.notesToggle}>
        <div className={styles.notesCheckbox}>
          <input
            type="checkbox"
            checked={settings.showTemporaryEvents !== false}
            onChange={() => onChange({ showTemporaryEvents: !(settings.showTemporaryEvents !== false) })}
          />
        </div>
        <div className={styles.notesContent}>
          <span className={styles.notesTitle}>
            <Clock size={20} className={styles.notesIcon} />
            הצג אירועים זמניים בלוח
          </span>
          <span className={styles.notesDescription}>
            אירועים עם סטטוס "זמני" יוצגו בעיצוב חלול. לחיצה עליהם תפתח טופס המרה.
          </span>
        </div>
      </label>

      {/* יעד שעות חודשי */}
      <div className={styles.editLockSection}>
        <div className={styles.editLockHeader}>
          <Battery size={20} className={styles.notesIcon} />
          <span className={styles.editLockTitle}>יעד שעות חודשי</span>
        </div>
        <div className={styles.monthlyTargetInputs}>
          <label className={styles.monthlyTargetField}>
            <span>יעד שעות בחודש</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={settings.monthlyHoursTarget ?? 182.5}
              onChange={(e) => onChange({ monthlyHoursTarget: parseFloat(e.target.value) || 0 })}
              className={styles.monthlyTargetInput}
            />
          </label>
          <label className={styles.monthlyTargetField}>
            <span>יעד שעות בשבוע</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={settings.weeklyHoursTarget ?? ''}
              placeholder={((settings.monthlyHoursTarget ?? 182.5) / 4.33).toFixed(1)}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ weeklyHoursTarget: val === '' ? null : (parseFloat(val) || 0) });
              }}
              className={styles.monthlyTargetInput}
            />
          </label>
          <label className={styles.monthlyTargetField}>
            <span>אורך יום עבודה (שעות)</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={settings.workdayLength ?? 8.5}
              onChange={(e) => onChange({ workdayLength: parseFloat(e.target.value) || 0 })}
              className={styles.monthlyTargetInput}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default CalendarTab;
