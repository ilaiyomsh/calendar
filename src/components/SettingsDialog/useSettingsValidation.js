import { useMemo } from 'react';
import { STRUCTURE_MODES } from '../../contexts/SettingsContext';

/**
 * Hook ל-validation של הגדרות
 * @param {Object} settings - ההגדרות הנוכחיות
 * @param {Object} context - ה-context של Monday
 * @returns {Object} { errors, isValid, getFieldError, getMissingFieldsMessage }
 */
export const useSettingsValidation = (settings, context) => {
  const { structureMode } = settings;
  
  // בדיקה אם המצב כולל משימות
  const hasTasks = structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS;
  
  // בדיקה אם המצב כולל סיווג
  const hasStage = structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE;

  const errors = useMemo(() => {
    const errors = {};

    // --- שדות חובה תמיד ---
    
    // לוח פרויקטים
    if (!settings.connectedBoardId) {
      errors.connectedBoardId = 'יש לבחור לוח פרויקטים';
    }
    if (settings.connectedBoardId && (!settings.peopleColumnIds || settings.peopleColumnIds.length === 0)) {
      errors.peopleColumnIds = 'יש לבחור לפחות עמודת אנשים אחת';
    }

    // לוח נוכחי
    if (!context?.boardId) {
      errors.currentBoard = 'לא נמצא לוח נוכחי - פתח את האפליקציה מתוך לוח';
    } else {
      if (!settings.projectColumnId) {
        errors.projectColumnId = 'יש לבחור עמודת קישור לפרויקט';
      }
      if (!settings.dateColumnId) {
        errors.dateColumnId = 'יש לבחור עמודת תאריך';
      }
      if (!settings.durationColumnId) {
        errors.durationColumnId = 'יש לבחור עמודת משך זמן';
      }
      if (!settings.reporterColumnId) {
        errors.reporterColumnId = 'יש לבחור עמודת מדווח';
      }
      if (!settings.eventTypeStatusColumnId) {
        errors.eventTypeStatusColumnId = 'יש לבחור עמודת סוג דיווח';
      }
      if (!settings.nonBillableStatusColumnId) {
        errors.nonBillableStatusColumnId = 'יש לבחור עמודת סוגי לא לחיוב';
      }
    }

    // --- שדות חובה רק במצבי TASKS ---
    if (hasTasks) {
      if (!settings.tasksProjectColumnId) {
        errors.tasksProjectColumnId = 'יש לבחור עמודת משימות בלוח פרויקטים';
      }
      if (settings.tasksProjectColumnId && !settings.tasksBoardId) {
        errors.tasksBoardId = 'יש לבחור לוח משימות';
      }
      if (settings.tasksBoardId && context?.boardId && !settings.taskColumnId) {
        errors.taskColumnId = 'יש לבחור עמודת קישור למשימה בלוח הנוכחי';
      }
    }

    // --- שדות חובה רק במצבי STAGE ---
    if (hasStage && context?.boardId) {
      if (!settings.stageColumnId) {
        errors.stageColumnId = 'יש לבחור עמודת סיווג';
      }
    }

    // --- בדיקת פילטר סטטוס פרויקטים ---
    if (settings.projectStatusFilterEnabled) {
      if (!settings.projectStatusColumnId) {
        errors.projectStatusColumnId = 'יש לבחור עמודת סטטוס בלוח פרויקטים';
      }
      if (!settings.projectActiveStatusValues || settings.projectActiveStatusValues.length === 0) {
        errors.projectActiveStatusValues = 'יש לבחור לפחות ערך סטטוס אחד';
      }
    }

    // --- בדיקת פילטר סטטוס משימות ---
    if (hasTasks && settings.taskStatusFilterEnabled) {
      if (!settings.taskStatusColumnId) {
        errors.taskStatusColumnId = 'יש לבחור עמודת סטטוס בלוח משימות';
      }
      if (!settings.taskActiveStatusValues || settings.taskActiveStatusValues.length === 0) {
        errors.taskActiveStatusValues = 'יש לבחור לפחות ערך סטטוס אחד';
      }
    }

    return errors;
  }, [settings, context, hasTasks, hasStage]);

  const isValid = Object.keys(errors).length === 0;

  const getFieldError = (fieldName) => {
    return errors[fieldName] || null;
  };

  // הודעה מסכמת לשמירה חלקית
  const getMissingFieldsMessage = () => {
    const errorCount = Object.keys(errors).length;
    if (errorCount === 0) return null;
    
    return `יש ${errorCount} שדות חסרים`;
  };

  return {
    errors,
    isValid,
    getFieldError,
    getMissingFieldsMessage
  };
};
