import { useMemo } from 'react';
import { STRUCTURE_MODES } from '../../contexts/SettingsContext';
import { getEffectiveBoardId, hasValidReportingBoard } from '../../utils/boardIdResolver';
import { validateMapping } from '../../utils/eventTypeMapping';

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

  // חישוב לוח דיווחים אפקטיבי
  const effectiveBoardId = getEffectiveBoardId(settings, context);
  const hasReportingBoard = hasValidReportingBoard(settings, context);

  const errors = useMemo(() => {
    const errors = {};

    // --- שדות חובה תמיד ---

    // לוח פרויקטים - חובה רק אם לא במצב הקצאות
    if (!settings.useAssignmentsMode) {
      if (!settings.connectedBoardId) {
        errors.connectedBoardId = 'יש לבחור לוח פרויקטים';
      }
      if (settings.connectedBoardId && (!settings.peopleColumnIds || settings.peopleColumnIds.length === 0)) {
        errors.peopleColumnIds = 'יש לבחור לפחות עמודת אנשים אחת';
      }
    }

    // לוח דיווחים - בדיקה לפי ההגדרות החדשות
    if (!hasReportingBoard) {
      // אם הטוגל פעיל אבל אין context.boardId
      if (settings.useCurrentBoardForReporting && !context?.boardId) {
        errors.currentBoard = 'האפליקציה רצה כ-Custom Object - יש לבחור לוח דיווחים או לפתוח מתוך לוח';
      }
      // אם הטוגל כבוי ואין לוח דיווחים נבחר
      else if (!settings.useCurrentBoardForReporting && !settings.timeReportingBoardId) {
        errors.timeReportingBoardId = 'יש לבחור לוח דיווחי שעות';
      }
      // אם אין לוח בכלל
      else {
        errors.currentBoard = 'לא נמצא לוח דיווחים - יש לבחור לוח או לפתוח את האפליקציה מתוך לוח';
      }
    } else {
      // עמודות לוח הדיווחים - חובה רק אם יש לוח
      if (!settings.projectColumnId) {
        errors.projectColumnId = 'יש לבחור עמודת קישור לפרויקט';
      }
      if (!settings.dateColumnId) {
        errors.dateColumnId = 'יש לבחור עמודת תאריך התחלה';
      }
      if (!settings.endTimeColumnId) {
        errors.endTimeColumnId = 'יש לבחור עמודת תאריך סיום';
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
      // ולידציה של מיפוי סוגי דיווח
      if (settings.eventTypeStatusColumnId && !settings.eventTypeMapping) {
        errors.eventTypeMapping = 'יש להגדיר מיפוי סוגי דיווח';
      } else if (settings.eventTypeMapping) {
        const mappingValidation = validateMapping(settings.eventTypeMapping);
        if (!mappingValidation.isValid) {
          errors.eventTypeMapping = mappingValidation.errors[0];
        }
      }
    }

    // --- שדות חובה רק במצבי TASKS ---
    if (hasTasks) {
      if (!settings.useAssignmentsMode && !settings.tasksProjectColumnId) {
        errors.tasksProjectColumnId = 'יש לבחור עמודת משימות בלוח פרויקטים';
      }
      if (settings.tasksProjectColumnId && !settings.tasksBoardId) {
        errors.tasksBoardId = 'יש לבחור לוח משימות';
      }
      if (settings.tasksBoardId && hasReportingBoard && !settings.taskColumnId) {
        errors.taskColumnId = 'יש לבחור עמודת קישור למשימה בלוח הדיווחים';
      }
    }

    // --- שדות חובה רק במצבי STAGE ---
    if (hasStage && hasReportingBoard) {
      if (!settings.stageColumnId) {
        errors.stageColumnId = 'יש לבחור עמודת סיווג';
      }
    }

    // --- בדיקת פילטר סטטוס פרויקטים ---
    if (!settings.useAssignmentsMode && settings.projectStatusFilterEnabled) {
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

    // --- בדיקת הקצאות (Assignments) - אם טוגל הקצאות פעיל, כל העמודות חובה ---
    if (settings.useAssignmentsMode) {
      if (!settings.assignmentsBoardId) {
        errors.assignmentsBoardId = 'יש לבחור לוח הקצאות';
      }
      if (settings.assignmentsBoardId) {
        if (!settings.assignmentPersonColumnId) {
          errors.assignmentPersonColumnId = 'יש לבחור עמודת אנשים בלוח הקצאות';
        }
        if (!settings.assignmentStartDateColumnId) {
          errors.assignmentStartDateColumnId = 'יש לבחור עמודת תאריך התחלה בלוח הקצאות';
        }
        if (!settings.assignmentEndDateColumnId) {
          errors.assignmentEndDateColumnId = 'יש לבחור עמודת תאריך סיום בלוח הקצאות';
        }
        if (!settings.assignmentProjectLinkColumnId) {
          errors.assignmentProjectLinkColumnId = 'יש לבחור עמודת קישור לפרויקט בלוח הקצאות';
        }
        // עמודת קישור להקצאה בלוח הדיווחים
        if (hasReportingBoard && !settings.assignmentColumnId) {
          errors.assignmentColumnId = 'יש לבחור עמודת קישור להקצאה בלוח הדיווחים';
        }
      }
    }

    return errors;
  }, [settings, context, hasTasks, hasStage, hasReportingBoard]);

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
