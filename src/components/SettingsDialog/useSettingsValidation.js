import { useMemo } from 'react';

/**
 * Hook ל-validation של הגדרות
 * @param {Object} settings - ההגדרות הנוכחיות
 * @param {Object} context - ה-context של Monday
 * @returns {Object} { errors, isValid, getFieldError }
 */
export const useSettingsValidation = (settings, context) => {
  const errors = useMemo(() => {
    const errs = {};

    // בדיקת לוח חיצוני
    if (!settings.connectedBoardId) {
      errs.connectedBoardId = 'יש לבחור לוח חיצוני';
    }
    if (settings.connectedBoardId && (!settings.peopleColumnIds || settings.peopleColumnIds.length === 0)) {
      errs.peopleColumnIds = 'יש לבחור לפחות עמודת אנשים אחת';
    }

    // בדיקת לוח נוכחי
    if (!context?.boardId) {
      errs.currentBoard = 'לא נמצא לוח נוכחי - פתח את האפליקציה מתוך לוח';
    } else {
      if (!settings.dateColumnId) {
        errs.dateColumnId = 'יש לבחור עמודת תאריך';
      }
      if (!settings.durationColumnId) {
        errs.durationColumnId = 'יש לבחור עמודת משך זמן';
      }
      if (!settings.projectColumnId) {
        errs.projectColumnId = 'יש לבחור עמודת קישור לפרויקט';
      }
      if (!settings.reporterColumnId) {
        errs.reporterColumnId = 'יש לבחור עמודת מדווח';
      }
      if (!settings.eventTypeStatusColumnId) {
        errs.eventTypeStatusColumnId = 'יש לבחור עמודת סטטוס לסוג אירוע';
      }
    }

    // בדיקת מוצרים - חובה במערכת
    if (!settings.productsCustomerColumnId) {
      errs.productsCustomerColumnId = 'יש לבחור עמודת מוצרים בלוח לקוחות';
    }
    
    if (settings.productsCustomerColumnId) {
      if (!settings.productsBoardId) {
        errs.productsBoardId = 'יש לבחור לוח מוצרים';
      }
      if (context?.boardId && !settings.productColumnId) {
        errs.productColumnId = 'יש לבחור עמודת קישור למוצר בלוח הנוכחי';
      }
    }

    // בדיקת שלב - חובה אם יש מוצר
    if (settings.productColumnId && !settings.stageColumnId) {
      errs.stageColumnId = 'יש לבחור עמודת שלב (חובה אם יש הגדרת מוצר)';
    }

    // בדיקת שעות עבודה
    if (settings.workDayStart && settings.workDayEnd) {
      const [startHours, startMinutes] = settings.workDayStart.split(':').map(Number);
      const [endHours, endMinutes] = settings.workDayEnd.split(':').map(Number);
      const startTime = startHours * 60 + startMinutes;
      const endTime = endHours * 60 + endMinutes;
      
      if (startTime >= endTime) {
        errs.workHours = 'שעת התחלה חייבת להיות לפני שעת הסיום';
      }
    }

    return errs;
  }, [settings, context]);

  const isValid = Object.keys(errors).length === 0;

  const getFieldError = (fieldName) => {
    return errors[fieldName] || null;
  };

  return {
    errors,
    isValid,
    getFieldError
  };
};

