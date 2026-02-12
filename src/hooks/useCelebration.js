/**
 * Hook לחגיגות קונפטי באבני דרך יומיות
 * - דיווח ראשון ביום
 * - 4 שעות מדווחות
 * - 8 שעות מדווחות (יום מלא)
 */

import { useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';

/**
 * חישוב סך שעות מדווחות ליום מסוים (אירועים שעתיים בלבד)
 * @param {Array} events - מערך האירועים
 * @param {Date} date - התאריך לבדיקה
 * @returns {{ hours: number, count: number }}
 */
const getTimedHoursForDate = (events, date) => {
    const dateStr = date.toDateString();
    let hours = 0;
    let count = 0;

    for (const event of events) {
        if (event.allDay || event.isTemporary || event.isHoliday) continue;
        if (event.start.toDateString() !== dateStr) continue;

        count++;
        hours += (event.end - event.start) / 3600000; // ms → שעות
    }

    return { hours, count };
};

/**
 * ירי קונפטי בעוצמה מותאמת
 */
const fireCelebration = (intensity) => {
    const defaults = {
        origin: { y: 0.7 },
        zIndex: 9999,
        disableForReducedMotion: true,
    };

    switch (intensity) {
        case 'small':
            confetti({ ...defaults, particleCount: 50, spread: 55 });
            break;
        case 'medium':
            confetti({ ...defaults, particleCount: 100, spread: 70 });
            break;
        case 'big':
            // ירי כפול משני הצדדים
            confetti({ ...defaults, particleCount: 100, spread: 70, origin: { x: 0.3, y: 0.7 } });
            confetti({ ...defaults, particleCount: 100, spread: 70, origin: { x: 0.7, y: 0.7 } });
            break;
    }
};

export const useCelebration = (events, showSuccess) => {
    // שמירת snapshot של שעות לפני יצירת אירוע
    const beforeStateRef = useRef(null);

    /**
     * לכידת מצב השעות לפני יצירת אירוע חדש
     * @param {Date} eventDate - תאריך האירוע שעומד להיווצר
     */
    const captureBeforeState = useCallback((eventDate) => {
        const { hours, count } = getTimedHoursForDate(events, eventDate);
        beforeStateRef.current = { hours, count, dateStr: eventDate.toDateString() };
    }, [events]);

    /**
     * בדיקה אם חציית אבן דרך והפעלת חגיגה
     * @param {Date} eventDate - תאריך האירוע שנוצר
     */
    const checkCelebration = useCallback((eventDate) => {
        const before = beforeStateRef.current;
        if (!before || before.dateStr !== eventDate.toDateString()) return;

        const after = getTimedHoursForDate(events, eventDate);

        // דיווח ראשון ביום
        if (before.count === 0 && after.count > 0) {
            fireCelebration('small');
            showSuccess('!יאללה, התחלנו! המשך כך');
            beforeStateRef.current = null;
            return;
        }

        // 8 שעות — בדיקה לפני 4 שעות כי שניהם יכולים להתקיים
        if (before.hours < 8 && after.hours >= 8) {
            fireCelebration('big');
            showSuccess('!יום מלא דווח — כל הכבוד');
            beforeStateRef.current = null;
            return;
        }

        // 4 שעות
        if (before.hours < 4 && after.hours >= 4) {
            fireCelebration('medium');
            showSuccess('!חצי יום — אתה על זה');
            beforeStateRef.current = null;
            return;
        }

        beforeStateRef.current = null;
    }, [events, showSuccess]);

    return { captureBeforeState, checkCelebration };
};
