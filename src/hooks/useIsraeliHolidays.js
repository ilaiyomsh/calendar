/**
 * Hook לניהול חגים ישראליים
 * מספק cache לפי שנה למניעת חישובים מיותרים
 */

import { useState, useCallback, useRef } from 'react';
import { fetchIsraeliHolidays } from '../utils/holidayUtils';
import logger from '../utils/logger';

/**
 * Hook לטעינת וניהול חגים ישראליים
 * @returns {Object} - holidays: מערך החגים, loadHolidays: פונקציית טעינה
 */
export const useIsraeliHolidays = () => {
    const [holidays, setHolidays] = useState([]);

    // Cache לפי שנה - מונע טעינה חוזרת לאותה שנה
    const yearCacheRef = useRef(new Map());

    /**
     * טעינת חגים לטווח תאריכים
     * @param {Date} startDate - תאריך התחלה
     * @param {Date} endDate - תאריך סיום
     */
    const loadHolidays = useCallback((startDate, endDate) => {
        if (!startDate || !endDate) {
            logger.warn('useIsraeliHolidays', 'Missing start or end date');
            return;
        }

        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        const cache = yearCacheRef.current;

        // בדיקה אם כל השנים כבר ב-cache
        let allYearsCached = true;
        for (let year = startYear; year <= endYear; year++) {
            if (!cache.has(year)) {
                allYearsCached = false;
                break;
            }
        }

        // אם כל השנים ב-cache, נשתמש בנתונים הקיימים
        if (allYearsCached) {
            const cachedHolidays = [];
            for (let year = startYear; year <= endYear; year++) {
                cachedHolidays.push(...cache.get(year));
            }

            // סינון לטווח המבוקש
            const filteredHolidays = cachedHolidays.filter(h =>
                h.start >= startDate && h.start <= endDate
            );

            setHolidays(filteredHolidays);
            logger.debug('useIsraeliHolidays', 'Using cached holidays', {
                count: filteredHolidays.length,
                years: `${startYear}-${endYear}`
            });
            return;
        }

        // טעינת חגים חדשים
        logger.debug('useIsraeliHolidays', 'Loading holidays', { startYear, endYear });

        // הרחבת הטווח לשנים מלאות כדי למלא את ה-cache
        const extendedStart = new Date(startYear, 0, 1);
        const extendedEnd = new Date(endYear, 11, 31);

        const newHolidays = fetchIsraeliHolidays(extendedStart, extendedEnd);

        // עדכון ה-cache לפי שנים
        for (let year = startYear; year <= endYear; year++) {
            const yearHolidays = newHolidays.filter(h =>
                h.start.getFullYear() === year
            );
            cache.set(year, yearHolidays);
        }

        // סינון לטווח המבוקש
        const filteredHolidays = newHolidays.filter(h =>
            h.start >= startDate && h.start <= endDate
        );

        setHolidays(filteredHolidays);
        logger.debug('useIsraeliHolidays', 'Loaded holidays', {
            count: filteredHolidays.length,
            cachedYears: Array.from(cache.keys())
        });
    }, []);

    /**
     * ניקוי ה-cache
     */
    const clearCache = useCallback(() => {
        yearCacheRef.current.clear();
        setHolidays([]);
        logger.debug('useIsraeliHolidays', 'Cache cleared');
    }, []);

    return {
        holidays,
        loadHolidays,
        clearCache
    };
};

export default useIsraeliHolidays;
