/**
 * פונקציות עזר לטיפול בחגים ישראליים
 * משתמש ב-@hebcal/core לקבלת תאריכי חגים
 */

import { HebrewCalendar, Location } from '@hebcal/core';
import { HOLIDAYS_CONFIG, HOLIDAY_COLORS } from '../constants/holidayConfig';
import logger from './logger';

// מיקום ישראל (לחישוב נכון של חגים)
const ISRAEL_LOCATION = Location.lookup('Jerusalem');

/**
 * מייצר מזהה ייחודי לחג
 * @param {Date} date - תאריך החג
 * @param {string} title - שם החג
 * @returns {string} מזהה ייחודי
 */
const generateHolidayId = (date, title) => {
    const dateStr = date.toISOString().split('T')[0];
    return `holiday-${dateStr}-${title}`;
};

/**
 * שליפת חגים ישראליים לטווח תאריכים
 * @param {Date} startDate - תאריך התחלה
 * @param {Date} endDate - תאריך סיום
 * @returns {Array} מערך אירועי חגים בפורמט הלוח
 */
export const fetchIsraeliHolidays = (startDate, endDate) => {
    try {
        logger.debug('holidayUtils', 'Fetching holidays', { startDate, endDate });

        const holidays = [];
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();

        // עבור על כל השנים בטווח
        for (let year = startYear; year <= endYear; year++) {
            // קבלת כל האירועים מ-hebcal לשנה זו
            const events = HebrewCalendar.calendar({
                year,
                isHebrewYear: false, // שנה גרגוריאנית
                location: ISRAEL_LOCATION,
                il: true, // ישראל (לא גולה)
                candlelighting: false,
                sedrot: false,
                omer: false,
                noHolidays: false,
                noMinorFast: true, // דילוג על צומות קטנים
                noRoshChodesh: true, // דילוג על ראש חודש
                noSpecialShabbat: true, // דילוג על שבתות מיוחדות
                noModern: false // כולל חגים מודרניים
            });

            // סינון ומיפוי אירועים
            for (const event of events) {
                const eventDesc = event.getDesc('en');
                const holidayConfig = HOLIDAYS_CONFIG[eventDesc];

                // רק חגים שמוגדרים בקונפיגורציה שלנו
                if (!holidayConfig) continue;

                const eventDate = event.getDate().greg();

                // בדיקה שהחג בטווח התאריכים המבוקש
                if (eventDate < startDate || eventDate > endDate) continue;

                // יצירת תאריך התחלה (00:00)
                const eventStart = new Date(eventDate);
                eventStart.setHours(0, 0, 0, 0);

                // יצירת תאריך סיום (יום אחד אחרי - exclusive לאירועי all-day)
                const eventEnd = new Date(eventStart);
                eventEnd.setDate(eventEnd.getDate() + 1);

                holidays.push({
                    id: generateHolidayId(eventStart, holidayConfig.hebrew),
                    title: holidayConfig.hebrew,
                    start: eventStart,
                    end: eventEnd,
                    allDay: true,
                    isHoliday: true,
                    holidayType: holidayConfig.type,
                    readOnly: true
                });
            }
        }

        // הסרת כפילויות (חג יכול להופיע פעמיים אם יש שני שמות לאותו יום)
        const uniqueHolidays = holidays.reduce((acc, holiday) => {
            const existingIndex = acc.findIndex(h =>
                h.start.getTime() === holiday.start.getTime() &&
                h.title === holiday.title
            );
            if (existingIndex === -1) {
                acc.push(holiday);
            }
            return acc;
        }, []);

        logger.debug('holidayUtils', 'Fetched holidays', { count: uniqueHolidays.length });
        return uniqueHolidays;

    } catch (error) {
        logger.error('holidayUtils', 'Error fetching holidays', error);
        return [];
    }
};

/**
 * מחזיר צבע לחג לפי סוגו
 * @param {string} holidayType - סוג החג (MODERN/MAJOR/MINOR)
 * @returns {string} צבע בפורמט HEX
 */
export const getHolidayColor = (holidayType) => {
    return HOLIDAY_COLORS[holidayType] || HOLIDAY_COLORS.MINOR;
};
