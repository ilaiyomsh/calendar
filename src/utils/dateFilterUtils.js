/**
 * כלי עזר לפילטר תאריכים בדשבורד
 * תומך בתנאים: שבוע, חודש, שנה, בין תאריכים
 */

import {
    startOfMonth, endOfMonth, addMonths,
    startOfWeek, endOfWeek, addWeeks,
    startOfYear, endOfYear, addYears,
    format
} from 'date-fns';
import { he } from 'date-fns/locale';

/**
 * פורמט תאריך ל-YYYY-MM-DD
 */
const fmt = (d) => format(d, 'yyyy-MM-dd');

/**
 * בניית חוק פילטר GraphQL לתאריכים
 * @param {'between'|'exact'|'after'|'onOrAfter'|'before'|'onOrBefore'|'month'|'week'|'year'} condition
 * @param {string} dateColumnId
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo - YYYY-MM-DD
 * @returns {{ column_id: string, compare_value: any, operator: string }}
 */
export const buildDateFilterRule = (condition, dateColumnId, dateFrom, dateTo) => {
    switch (condition) {
        case 'between':
            return {
                column_id: dateColumnId,
                compare_value: [dateFrom, dateTo],
                operator: 'between'
            };

        case 'month': {
            const anchor = new Date(dateFrom + 'T00:00:00');
            return {
                column_id: dateColumnId,
                compare_value: [fmt(startOfMonth(anchor)), fmt(endOfMonth(anchor))],
                operator: 'between'
            };
        }

        case 'week': {
            const anchor = new Date(dateFrom + 'T00:00:00');
            const weekStart = startOfWeek(anchor, { weekStartsOn: 0 });
            const weekEnd = endOfWeek(anchor, { weekStartsOn: 0 });
            return {
                column_id: dateColumnId,
                compare_value: [fmt(weekStart), fmt(weekEnd)],
                operator: 'between'
            };
        }

        case 'year': {
            const anchor = new Date(dateFrom + 'T00:00:00');
            return {
                column_id: dateColumnId,
                compare_value: [fmt(startOfYear(anchor)), fmt(endOfYear(anchor))],
                operator: 'between'
            };
        }

        default:
            return {
                column_id: dateColumnId,
                compare_value: [dateFrom, dateTo],
                operator: 'between'
            };
    }
};

/**
 * חישוב טווח תאריכים אפקטיבי לפי תנאי
 * @param {string} condition
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo - YYYY-MM-DD
 * @returns {{ from: string, to: string }}
 */
export const getEffectiveDateRange = (condition, dateFrom, dateTo) => {
    switch (condition) {
        case 'month': {
            const anchor = new Date(dateFrom + 'T00:00:00');
            return { from: fmt(startOfMonth(anchor)), to: fmt(endOfMonth(anchor)) };
        }
        case 'week': {
            const anchor = new Date(dateFrom + 'T00:00:00');
            return {
                from: fmt(startOfWeek(anchor, { weekStartsOn: 0 })),
                to: fmt(endOfWeek(anchor, { weekStartsOn: 0 }))
            };
        }
        case 'year': {
            const anchor = new Date(dateFrom + 'T00:00:00');
            return { from: fmt(startOfYear(anchor)), to: fmt(endOfYear(anchor)) };
        }
        default:
            return { from: dateFrom, to: dateTo };
    }
};

/**
 * הזזת תקופה קדימה/אחורה
 * @param {'month'|'week'|'year'} condition
 * @param {Date} anchorDate
 * @param {1|-1} direction - 1=הבא, -1=הקודם
 * @returns {Date}
 */
export const shiftPeriod = (condition, anchorDate, direction) => {
    switch (condition) {
        case 'month':
            return addMonths(anchorDate, direction);
        case 'week':
            return addWeeks(anchorDate, direction);
        case 'year':
            return addYears(anchorDate, direction);
        default:
            return anchorDate;
    }
};

/**
 * תווית עברית לתקופה הנוכחית
 * @param {'month'|'week'|'year'} condition
 * @param {Date} anchorDate
 * @returns {string}
 */
export const formatPeriodLabel = (condition, anchorDate) => {
    switch (condition) {
        case 'month':
            return format(anchorDate, 'MMMM yyyy', { locale: he });

        case 'week': {
            const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
            const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 0 });
            const startDay = format(weekStart, 'd', { locale: he });
            const endDay = format(weekEnd, 'd', { locale: he });
            const monthAbbr = format(weekEnd, 'MMM', { locale: he });
            const year = format(weekEnd, 'yyyy');
            return `${startDay}-${endDay} ${monthAbbr} ${year}`;
        }

        case 'year':
            return format(anchorDate, 'yyyy');

        default:
            return '';
    }
};
