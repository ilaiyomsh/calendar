import React from 'react';
import { Settings } from 'lucide-react';
import { FIELD_MODES, TOGGLE_MODES, DEFAULT_FIELD_CONFIG } from '../../contexts/SettingsContext';
import styles from './StructureTab.module.css';

// הגדרות שדות הניתנים לקונפיגורציה
const CONFIGURABLE_FIELDS = [
  { key: 'task', label: 'משימה', description: 'קישור למשימה מלוח משימות נפרד' },
  { key: 'stage', label: 'סיווג (חיוב)', description: 'עמודת סטטוס לסיווג הדיווח' },
  { key: 'notes', label: 'הערות', description: 'מלל חופשי לדיווח' },
];

// שדה "סוג לא לחיוב" — מוצג רק כשטוגל לחיוב פעיל
const NON_BILLABLE_FIELD = { key: 'nonBillableType', label: 'סוג לא לחיוב', description: 'סיווג משנה לדיווחים שאינם לחיוב' };

/**
 * טאב מבנה דיווח
 * טבלת הגדרת שדות: חובה / רשות / מוסתר
 */
const StructureTab = ({ settings, onChange }) => {
  const fieldConfig = settings.fieldConfig || DEFAULT_FIELD_CONFIG;

  // עדכון fieldConfig
  const handleFieldModeChange = (fieldKey, mode) => {
    const updatedConfig = { ...fieldConfig, [fieldKey]: mode };

    // סנכרון legacy: structureMode + enableNotes
    const legacyUpdates = {};
    if (fieldKey === 'task' || fieldKey === 'stage') {
      if (updatedConfig.task !== FIELD_MODES.HIDDEN) {
        legacyUpdates.structureMode = 'PROJECT_WITH_TASKS';
      } else if (updatedConfig.stage !== FIELD_MODES.HIDDEN) {
        legacyUpdates.structureMode = 'PROJECT_WITH_STAGE';
      } else {
        legacyUpdates.structureMode = 'PROJECT_ONLY';
      }
    }
    if (fieldKey === 'notes') {
      legacyUpdates.enableNotes = mode !== FIELD_MODES.HIDDEN;
    }

    onChange({ fieldConfig: updatedConfig, ...legacyUpdates });
  };

  // עדכון טוגל לחיוב/לא לחיוב
  const handleBillableToggleChange = () => {
    const newMode = fieldConfig.billableToggle === TOGGLE_MODES.VISIBLE
      ? TOGGLE_MODES.HIDDEN
      : TOGGLE_MODES.VISIBLE;

    const updatedConfig = { ...fieldConfig, billableToggle: newMode };

    // כשטוגל מוסתר, nonBillableType מתאפס ל-hidden
    if (newMode === TOGGLE_MODES.HIDDEN) {
      updatedConfig.nonBillableType = FIELD_MODES.HIDDEN;
    } else if (updatedConfig.nonBillableType === FIELD_MODES.HIDDEN) {
      // כשמפעילים חזרה, ברירת מחדל: חובה
      updatedConfig.nonBillableType = FIELD_MODES.REQUIRED;
    }

    onChange({ fieldConfig: updatedConfig });
  };

  const isBillableToggleVisible = fieldConfig.billableToggle === TOGGLE_MODES.VISIBLE;

  return (
    <div className={styles.container}>
      <div className={styles.editLockSection}>
        <div className={styles.editLockHeader}>
          <Settings size={20} className={styles.notesIcon} />
          <span className={styles.editLockTitle}>הגדרת שדות דיווח</span>
        </div>

        {/* פרויקט — תמיד חובה */}
        <div className={styles.fieldConfigInfo}>
          פרויקט: <strong>חובה</strong> (קבוע, לא ניתן לשינוי)
        </div>

        {/* טוגל לחיוב/לא לחיוב */}
        <label className={styles.notesToggle} style={{ marginTop: '12px' }}>
          <div className={styles.notesCheckbox}>
            <input
              type="checkbox"
              checked={isBillableToggleVisible}
              onChange={handleBillableToggleChange}
            />
          </div>
          <div className={styles.notesContent}>
            <span className={styles.notesTitle}>
              הצג טוגל לחיוב / לא לחיוב
            </span>
            <span className={styles.notesDescription}>
              כשמוסתר, כל הדיווחים ייחשבו לחיוב אוטומטית
            </span>
          </div>
        </label>

        {/* טבלת הגדרת שדות */}
        <div className={styles.fieldConfigTable}>
          <div className={styles.fieldConfigHeader}>
            <span className={styles.fieldConfigHeaderLabel}>שדה</span>
            <span className={styles.fieldConfigHeaderOption}>חובה</span>
            <span className={styles.fieldConfigHeaderOption}>רשות</span>
            <span className={styles.fieldConfigHeaderOption}>מוסתר</span>
          </div>

          {CONFIGURABLE_FIELDS.map(field => (
            <div key={field.key} className={styles.fieldConfigRow}>
              <div className={styles.fieldConfigLabel}>
                <span>{field.label}</span>
                <span className={styles.fieldConfigDesc}>{field.description}</span>
              </div>
              {[FIELD_MODES.REQUIRED, FIELD_MODES.OPTIONAL, FIELD_MODES.HIDDEN].map(mode => (
                <label key={mode} className={styles.fieldConfigRadio}>
                  <input
                    type="radio"
                    name={`field_${field.key}`}
                    value={mode}
                    checked={(fieldConfig[field.key] || FIELD_MODES.HIDDEN) === mode}
                    onChange={() => handleFieldModeChange(field.key, mode)}
                  />
                </label>
              ))}
            </div>
          ))}

          {/* שורת nonBillableType — רק כשטוגל פעיל */}
          {isBillableToggleVisible && (
            <div className={styles.fieldConfigRow}>
              <div className={styles.fieldConfigLabel}>
                <span>{NON_BILLABLE_FIELD.label}</span>
                <span className={styles.fieldConfigDesc}>{NON_BILLABLE_FIELD.description}</span>
              </div>
              {[FIELD_MODES.REQUIRED, FIELD_MODES.OPTIONAL, FIELD_MODES.HIDDEN].map(mode => (
                <label key={mode} className={styles.fieldConfigRadio}>
                  <input
                    type="radio"
                    name={`field_${NON_BILLABLE_FIELD.key}`}
                    value={mode}
                    checked={(fieldConfig[NON_BILLABLE_FIELD.key] || FIELD_MODES.HIDDEN) === mode}
                    onChange={() => handleFieldModeChange(NON_BILLABLE_FIELD.key, mode)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StructureTab;
