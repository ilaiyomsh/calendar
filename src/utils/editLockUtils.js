/**
 * לוגיקת נעילת עריכת אירועים לפי חלון זמן
 *
 * מצבים:
 * - none: ללא הגבלה
 * - two_days: עד יומיים אחרי יצירת הדיווח
 * - current_week: רק אירועים מהשבוע הנוכחי (ראשון-שבת)
 * - current_month: רק אירועים מהחודש הנוכחי
 */

export const EDIT_LOCK_MODES = {
    NONE: 'none',
    TWO_DAYS: 'two_days',
    CURRENT_WEEK: 'current_week',
    CURRENT_MONTH: 'current_month'
};

export const EDIT_LOCK_LABELS = {
    [EDIT_LOCK_MODES.NONE]: 'ללא הגבלה',
    [EDIT_LOCK_MODES.TWO_DAYS]: 'עד יומיים אחרי יצירת הדיווח',
    [EDIT_LOCK_MODES.CURRENT_WEEK]: 'שבוע נוכחי בלבד',
    [EDIT_LOCK_MODES.CURRENT_MONTH]: 'חודש נוכחי בלבד'
};

/**
 * בדיקה אם אירוע נעול לעריכה
 * @param {Object} event - אובייקט האירוע
 * @param {string} lockMode - מצב הנעילה
 * @returns {{ locked: boolean, reason: string }}
 */
export function isEventLocked(event, lockMode) {
    if (!lockMode || lockMode === EDIT_LOCK_MODES.NONE) {
        return { locked: false, reason: '' };
    }

    const now = new Date();

    switch (lockMode) {
        case EDIT_LOCK_MODES.TWO_DAYS: {
            // נעילה אם עברו יותר מ-48 שעות מיצירת הדיווח
            const createdAt = event.createdAt;
            if (!createdAt) {
                // אם אין תאריך יצירה - לא נועלים (backward compatible)
                return { locked: false, reason: '' };
            }
            const twoDaysMs = 48 * 60 * 60 * 1000;
            const elapsed = now.getTime() - createdAt.getTime();
            if (elapsed > twoDaysMs) {
                return {
                    locked: true,
                    reason: 'הדיווח נעול - עברו יותר מיומיים מיצירתו'
                };
            }
            return { locked: false, reason: '' };
        }

        case EDIT_LOCK_MODES.CURRENT_WEEK: {
            // נעילה אם האירוע מחוץ לשבוע הנוכחי (ראשון-שבת)
            const eventDate = event.start;
            if (!eventDate) return { locked: false, reason: '' };

            const weekStart = getWeekStart(now);
            const weekEnd = getWeekEnd(now);

            if (eventDate < weekStart || eventDate > weekEnd) {
                return {
                    locked: true,
                    reason: 'הדיווח נעול - ניתן לערוך רק דיווחים מהשבוע הנוכחי'
                };
            }
            return { locked: false, reason: '' };
        }

        case EDIT_LOCK_MODES.CURRENT_MONTH: {
            // נעילה אם האירוע מחוץ לחודש הנוכחי
            const eventDate = event.start;
            if (!eventDate) return { locked: false, reason: '' };

            if (eventDate.getMonth() !== now.getMonth() || eventDate.getFullYear() !== now.getFullYear()) {
                return {
                    locked: true,
                    reason: 'הדיווח נעול - ניתן לערוך רק דיווחים מהחודש הנוכחי'
                };
            }
            return { locked: false, reason: '' };
        }

        default:
            return { locked: false, reason: '' };
    }
}

/**
 * תחילת השבוע הנוכחי - יום ראשון בשעה 00:00
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * סוף השבוע הנוכחי - מוצאי שבת 23:59:59
 */
function getWeekEnd(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day));
    d.setHours(23, 59, 59, 999);
    return d;
}
