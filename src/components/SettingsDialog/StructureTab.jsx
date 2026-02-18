import React, { useState, useEffect } from 'react';
import { Briefcase, Tag, ListTodo, FileText, Calendar, ShieldCheck, Lock, X, Battery } from 'lucide-react';
import StructureOption from './StructureOption';
import { STRUCTURE_MODES } from '../../contexts/SettingsContext';
import { EDIT_LOCK_MODES, EDIT_LOCK_LABELS } from '../../utils/editLockUtils';
import logger from '../../utils/logger';
import styles from './StructureTab.module.css';

/**
 * טאב בחירת מבנה הדיווח
 * מאפשר בחירה ויזואלית של סוג ההיררכיה
 */
const StructureTab = ({ settings, onChange, monday }) => {
  const { structureMode, enableNotes, showHolidays } = settings;

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
