import React, { useState, useEffect } from 'react';
import { FileText, Calendar, ShieldCheck, Lock, X, Battery, Settings } from 'lucide-react';
import { FIELD_MODES, TOGGLE_MODES, DEFAULT_FIELD_CONFIG } from '../../contexts/SettingsContext';
import { EDIT_LOCK_MODES, EDIT_LOCK_LABELS } from '../../utils/editLockUtils';
import logger from '../../utils/logger';
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
 * טאב הגדרת שדות דיווח
 * מאפשר הגדרה גמישה של כל שדה: חובה / רשות / מוסתר
 */
const StructureTab = ({ settings, onChange, monday }) => {
  const fieldConfig = settings.fieldConfig || DEFAULT_FIELD_CONFIG;

  // State - People picker למנהלים
  const [accountUsers, setAccountUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // טעינת משתמשי החשבון כש-approval מופעל
  useEffect(() => {
    if (settings.enableApproval && monday && accountUsers.length === 0) {
      fetchAccountUsers();
    }
  }, [settings.enableApproval, monday]);

  const fetchAccountUsers = async () => {
    if (!monday) return;
    setLoadingUsers(true);
    try {
      const res = await monday.api(`query { users(kind: non_guests) { id name photo_thumb_small } }`);
      if (res.data?.users) {
        setAccountUsers(res.data.users.map(u => ({
          id: String(u.id),
          name: u.name,
          photo: u.photo_thumb_small
        })));
      }
    } catch (err) {
      logger.error('StructureTab', 'Error fetching account users', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddManager = (userId) => {
    const current = settings.approvedManagerIds || [];
    if (!current.includes(userId)) {
      onChange({ approvedManagerIds: [...current, userId] });
    }
    setUserSearchQuery('');
  };

  const handleRemoveManager = (userId) => {
    const current = settings.approvedManagerIds || [];
    onChange({ approvedManagerIds: current.filter(id => id !== userId) });
  };

  const filteredUsers = accountUsers.filter(u => {
    const managerIds = settings.approvedManagerIds || [];
    if (managerIds.includes(u.id)) return false;
    if (!userSearchQuery) return true;
    return u.name.toLowerCase().includes(userSearchQuery.toLowerCase());
  });

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

  const handleHolidaysToggle = () => {
    onChange({ showHolidays: !settings.showHolidays });
  };

  const isBillableToggleVisible = fieldConfig.billableToggle === TOGGLE_MODES.VISIBLE;

  return (
    <div className={styles.container}>
      {/* הגדרת שדות דיווח */}
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

      {/* חגים */}
      <label className={styles.notesToggle}>
        <div className={styles.notesCheckbox}>
          <input
            type="checkbox"
            checked={settings.showHolidays !== false}
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

      {/* אישור מנהל */}
      <label className={styles.notesToggle}>
        <div className={styles.notesCheckbox}>
          <input
            type="checkbox"
            checked={settings.enableApproval || false}
            onChange={() => onChange({ enableApproval: !settings.enableApproval })}
          />
        </div>
        <div className={styles.notesContent}>
          <span className={styles.notesTitle}>
            <ShieldCheck size={20} className={styles.notesIcon} />
            אישור מנהל על דיווחים
          </span>
        </div>
      </label>

      {settings.enableApproval && (
        <div className={styles.approvalManagersSection}>
          <label className={styles.approvalLabel}>מנהלים מורשים לאישור</label>

          {/* רשימת מנהלים קיימים */}
          {(settings.approvedManagerIds || []).length > 0 && (
            <div className={styles.managersList}>
              {(settings.approvedManagerIds || []).map(managerId => {
                const user = accountUsers.find(u => u.id === managerId);
                return (
                  <div key={managerId} className={styles.managerChip}>
                    {user?.photo && <img src={user.photo} alt="" className={styles.managerAvatar} />}
                    <span>{user?.name || `משתמש ${managerId}`}</span>
                    <button
                      className={styles.managerRemoveBtn}
                      onClick={() => handleRemoveManager(managerId)}
                      type="button"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* חיפוש והוספת מנהל */}
          <div className={styles.managerSearchWrapper}>
            <input
              type="text"
              className={styles.managerSearchInput}
              placeholder={loadingUsers ? 'טוען משתמשים...' : 'חפש משתמש להוספה...'}
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              onFocus={() => {
                if (accountUsers.length === 0 && !loadingUsers) {
                  fetchAccountUsers();
                }
              }}
              disabled={loadingUsers}
            />
            {userSearchQuery && filteredUsers.length > 0 && (
              <div className={styles.managerDropdown}>
                {filteredUsers.slice(0, 10).map(user => (
                  <button
                    key={user.id}
                    className={styles.managerDropdownItem}
                    onClick={() => handleAddManager(user.id)}
                    type="button"
                  >
                    {user.photo && <img src={user.photo} alt="" className={styles.managerAvatar} />}
                    <span>{user.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* נעילת עריכה */}
      <div className={styles.editLockSection}>
        <div className={styles.editLockHeader}>
          <Lock size={20} className={styles.notesIcon} />
          <span className={styles.editLockTitle}>נעילת עריכת דיווחים</span>
        </div>
        <div className={styles.editLockOptions}>
          {Object.entries(EDIT_LOCK_LABELS).map(([mode, label]) => (
            <label key={mode} className={styles.editLockOption}>
              <input
                type="radio"
                name="editLockMode"
                value={mode}
                checked={(settings.editLockMode || EDIT_LOCK_MODES.NONE) === mode}
                onChange={() => onChange({ editLockMode: mode })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {settings.enableApproval && (settings.editLockMode || 'none') !== 'none' && (
          <div className={styles.editLockNote}>
            מנהלים מורשים פטורים מנעילת עריכה
          </div>
        )}
      </div>

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

export default StructureTab;
