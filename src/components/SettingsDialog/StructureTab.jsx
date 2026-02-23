import React from 'react';
import { Settings, Zap } from 'lucide-react';
import { FIELD_MODES, TOGGLE_MODES, DEFAULT_FIELD_CONFIG } from '../../contexts/SettingsContext';
import { XOR_FIELD_LABELS } from '../../utils/xorValidation';
import styles from './StructureTab.module.css';

// הגדרות שדות הניתנים לקונפיגורציה
const TASK_FIELD = { key: 'task', label: 'משימה', description: 'קישור למשימה מלוח משימות נפרד' };
const STAGE_FIELD = { key: 'stage', label: 'סיווג (חיוב)', description: 'עמודת סטטוס לסיווג הדיווח' };
const NON_BILLABLE_FIELD = { key: 'nonBillableType', label: 'סיווג (לא לחיוב)', description: 'סיווג משנה לדיווחים שאינם לחיוב' };
const NOTES_FIELD = { key: 'notes', label: 'הערות', description: 'מלל חופשי לדיווח' };

/**
 * טאב מבנה דיווח
 * טבלת הגדרת שדות: חובה / רשות / מוסתר
 */
const StructureTab = ({ settings, onChange }) => {
  const fieldConfig = settings.fieldConfig || DEFAULT_FIELD_CONFIG;

  const advancedValidation = settings.advancedValidation || { enabled: false, xorFields: [null, null] };
  const isBillableToggleVisible = fieldConfig.billableToggle === TOGGLE_MODES.VISIBLE;

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

    // אם שדה XOR איבד מצב REQUIRED → כיבוי אוטומטי של ולידציה מתקדמת
    if (advancedValidation.enabled && mode !== FIELD_MODES.REQUIRED) {
      const [xorA, xorB] = advancedValidation.xorFields;
      if (fieldKey === xorA || fieldKey === xorB) {
        legacyUpdates.advancedValidation = { enabled: false, xorFields: [null, null] };
      }
    }

    onChange({ fieldConfig: updatedConfig, ...legacyUpdates });
  };

  // עדכון טוגל לחיוב/לא לחיוב
  const handleBillableToggleChange = () => {
    const newMode = fieldConfig.billableToggle === TOGGLE_MODES.VISIBLE
      ? TOGGLE_MODES.HIDDEN
      : TOGGLE_MODES.VISIBLE;

    const updatedConfig = { ...fieldConfig, billableToggle: newMode };
    const extraUpdates = {};

    // כשטוגל מוסתר, nonBillableType מתאפס ל-hidden
    if (newMode === TOGGLE_MODES.HIDDEN) {
      updatedConfig.nonBillableType = FIELD_MODES.HIDDEN;
      // אם nonBillableType היה בשדות XOR → כיבוי אוטומטי
      const [xorA, xorB] = advancedValidation.xorFields;
      if (advancedValidation.enabled && (xorA === 'nonBillableType' || xorB === 'nonBillableType')) {
        extraUpdates.advancedValidation = { enabled: false, xorFields: [null, null] };
      }
    } else if (updatedConfig.nonBillableType === FIELD_MODES.HIDDEN) {
      // כשמפעילים חזרה, ברירת מחדל: חובה
      updatedConfig.nonBillableType = FIELD_MODES.REQUIRED;
    }

    onChange({ fieldConfig: updatedConfig, ...extraUpdates });
  };

  // --- ולידציה מתקדמת (XOR) ---
  // רשימת שדות חובה זמינים לבחירה ב-XOR
  const requiredFields = [
    TASK_FIELD,
    STAGE_FIELD,
    ...(isBillableToggleVisible ? [NON_BILLABLE_FIELD] : []),
    NOTES_FIELD
  ].filter(f => fieldConfig[f.key] === FIELD_MODES.REQUIRED);

  const showAdvancedSection = requiredFields.length >= 2;

  const handleAdvancedToggle = () => {
    if (advancedValidation.enabled) {
      onChange({ advancedValidation: { enabled: false, xorFields: [null, null] } });
    } else {
      onChange({ advancedValidation: { enabled: true, xorFields: [null, null] } });
    }
  };

  const handleXorFieldChange = (index, value) => {
    const newXorFields = [...advancedValidation.xorFields];
    newXorFields[index] = value || null;
    onChange({ advancedValidation: { ...advancedValidation, xorFields: newXorFields } });
  };

  // רנדור שורת שדה בטבלה
  const renderFieldRow = (field) => (
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
  );

  return (
    <div className={styles.container}>
      <div className={styles.editLockSection}>
        <div className={styles.editLockHeader}>
          <Settings size={20} className={styles.notesIcon} />
          <span className={styles.editLockTitle}>הגדרת שדות דיווח</span>
        </div>

        {/* טבלת הגדרת שדות */}
        <div className={styles.fieldConfigTable}>
          <div className={styles.fieldConfigHeader}>
            <span className={styles.fieldConfigHeaderLabel}>שדה</span>
            <span className={styles.fieldConfigHeaderOption}>חובה</span>
            <span className={styles.fieldConfigHeaderOption}>רשות</span>
            <span className={styles.fieldConfigHeaderOption}>מוסתר</span>
          </div>

          {/* 1. פרויקט — תמיד חובה, לא ניתן לשינוי */}
          <div className={`${styles.fieldConfigRow} ${styles.fieldConfigRowDisabled}`}>
            <div className={styles.fieldConfigLabel}>
              <span>פרויקט</span>
              <span className={styles.fieldConfigDesc}>קישור ללוח פרויקטים</span>
            </div>
            {[FIELD_MODES.REQUIRED, FIELD_MODES.OPTIONAL, FIELD_MODES.HIDDEN].map(mode => (
              <label key={mode} className={styles.fieldConfigRadio}>
                <input
                  type="radio"
                  name="field_project"
                  value={mode}
                  checked={mode === FIELD_MODES.REQUIRED}
                  disabled
                />
              </label>
            ))}
          </div>

          {/* 2. משימה */}
          {renderFieldRow(TASK_FIELD)}

          {/* 3. טוגל לחיוב/לא לחיוב */}
          <div className={styles.fieldConfigToggleRow}>
            <label className={styles.fieldConfigToggle}>
              <input
                type="checkbox"
                checked={isBillableToggleVisible}
                onChange={handleBillableToggleChange}
              />
              <div className={styles.fieldConfigToggleContent}>
                <span className={styles.fieldConfigToggleTitle}>אפשר בחירה חיוב/לא לחיוב</span>
                <span className={styles.fieldConfigDesc}>כשמוסתר, כל הדיווחים ייחשבו לחיוב אוטומטית</span>
              </div>
            </label>
          </div>

          {/* 4. סיווג (חיוב) */}
          {renderFieldRow(STAGE_FIELD)}

          {/* 5. סיווג (לא לחיוב) — רק כשטוגל פעיל */}
          {isBillableToggleVisible && renderFieldRow(NON_BILLABLE_FIELD)}

          {/* 6. הערות */}
          {renderFieldRow(NOTES_FIELD)}
        </div>
      </div>

      {/* === ולידציה מתקדמת (XOR) === */}
      {showAdvancedSection && (
        <div className={styles.editLockSection}>
          <div className={styles.editLockHeader}>
            <Zap size={20} className={styles.notesIcon} />
            <span className={styles.editLockTitle}>מתקדם</span>
          </div>

          <label className={styles.advancedToggle}>
            <input
              type="checkbox"
              checked={advancedValidation.enabled}
              onChange={handleAdvancedToggle}
            />
            <div className={styles.advancedToggleContent}>
              <span className={styles.advancedToggleTitle}>הגדר בחירה בין שדות חובה</span>
              <span className={styles.fieldConfigDesc}>כשמופעל, מספיק למלא אחד מהשדות שנבחרו</span>
            </div>
          </label>

          {advancedValidation.enabled && (
            <div className={styles.xorSelectors}>
              <select
                className={styles.xorSelect}
                value={advancedValidation.xorFields[0] || ''}
                onChange={(e) => handleXorFieldChange(0, e.target.value)}
              >
                <option value="">בחר שדה...</option>
                {requiredFields
                  .filter(f => f.key !== advancedValidation.xorFields[1])
                  .map(f => (
                    <option key={f.key} value={f.key}>{XOR_FIELD_LABELS[f.key] || f.label}</option>
                  ))}
              </select>

              <span className={styles.xorOrLabel}>או</span>

              <select
                className={styles.xorSelect}
                value={advancedValidation.xorFields[1] || ''}
                onChange={(e) => handleXorFieldChange(1, e.target.value)}
              >
                <option value="">בחר שדה...</option>
                {requiredFields
                  .filter(f => f.key !== advancedValidation.xorFields[0])
                  .map(f => (
                    <option key={f.key} value={f.key}>{XOR_FIELD_LABELS[f.key] || f.label}</option>
                  ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StructureTab;
