import { describe, it, expect, vi, beforeEach } from 'vitest';

// מוק ל-hebcal/core
vi.mock('@hebcal/core', () => {
    const mockEvents = [];
    return {
        HebrewCalendar: {
            calendar: vi.fn(() => mockEvents)
        },
        Location: {
            lookup: vi.fn(() => ({}))
        },
        __setMockEvents: (events) => {
            mockEvents.length = 0;
            mockEvents.push(...events);
        },
        __getMockEvents: () => mockEvents
    };
});


// מוק ל-holidayConfig
vi.mock('../../constants/holidayConfig', () => ({
    HOLIDAYS_CONFIG: {
        'Yom Kippur': { hebrew: 'יום כיפור', type: 'MAJOR' },
        'Purim': { hebrew: 'פורים', type: 'MINOR' },
        'Yom HaAtzma\'ut': { hebrew: 'יום העצמאות', type: 'MODERN' },
        'Pesach I': { hebrew: 'פסח א\'', type: 'MAJOR' }
    },
    HOLIDAY_COLORS: {
        MODERN: '#0073ea',
        MAJOR: '#784bd1',
        MINOR: '#9cd326'
    }
}));

import { fetchIsraeliHolidays, getHolidayColor } from '../holidayUtils';
import { HebrewCalendar } from '@hebcal/core';

// עזר: יוצר אירוע hebcal מדומה
function createMockHebcalEvent(desc, date) {
    return {
        getDesc: () => desc,
        getDate: () => ({
            greg: () => new Date(date)
        })
    };
}

describe('holidayUtils', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // === getHolidayColor ===

    describe('getHolidayColor', () => {
        it('מחזיר צבע לחג מודרני', () => {
            expect(getHolidayColor('MODERN')).toBe('#0073ea');
        });

        it('מחזיר צבע לחג מרכזי', () => {
            expect(getHolidayColor('MAJOR')).toBe('#784bd1');
        });

        it('מחזיר צבע לחג קטן', () => {
            expect(getHolidayColor('MINOR')).toBe('#9cd326');
        });

        it('מחזיר צבע ברירת מחדל (MINOR) לסוג לא מוכר', () => {
            expect(getHolidayColor('UNKNOWN')).toBe('#9cd326');
        });

        it('מחזיר צבע ברירת מחדל ל-undefined', () => {
            expect(getHolidayColor(undefined)).toBe('#9cd326');
        });
    });

    // === fetchIsraeliHolidays ===

    describe('fetchIsraeliHolidays', () => {
        it('מחזיר מערך ריק כשאין חגים מוגדרים', () => {
            HebrewCalendar.calendar.mockReturnValue([]);
            const result = fetchIsraeliHolidays(
                new Date(2026, 0, 1),
                new Date(2026, 11, 31)
            );
            expect(result).toEqual([]);
        });

        it('מחזיר חגים שמוגדרים בקונפיגורציה', () => {
            HebrewCalendar.calendar.mockReturnValue([
                createMockHebcalEvent('Yom Kippur', '2026-10-03'),
                createMockHebcalEvent('Purim', '2026-03-05')
            ]);

            const result = fetchIsraeliHolidays(
                new Date(2026, 0, 1),
                new Date(2026, 11, 31)
            );

            expect(result).toHaveLength(2);

            const kippur = result.find(h => h.title === 'יום כיפור');
            expect(kippur).toBeDefined();
            expect(kippur.allDay).toBe(true);
            expect(kippur.isHoliday).toBe(true);
            expect(kippur.readOnly).toBe(true);
            expect(kippur.holidayType).toBe('MAJOR');

            const purim = result.find(h => h.title === 'פורים');
            expect(purim).toBeDefined();
            expect(purim.holidayType).toBe('MINOR');
        });

        it('מסנן חגים שלא בקונפיגורציה', () => {
            HebrewCalendar.calendar.mockReturnValue([
                createMockHebcalEvent('Yom Kippur', '2026-10-03'),
                createMockHebcalEvent('Rosh Chodesh Adar', '2026-02-20') // לא בקונפיגורציה
            ]);

            const result = fetchIsraeliHolidays(
                new Date(2026, 0, 1),
                new Date(2026, 11, 31)
            );

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('יום כיפור');
        });

        it('מסנן חגים שמחוץ לטווח התאריכים', () => {
            HebrewCalendar.calendar.mockReturnValue([
                createMockHebcalEvent('Yom Kippur', '2026-10-03'),
                createMockHebcalEvent('Purim', '2026-03-05')
            ]);

            // טווח מצומצם - רק מרץ
            const result = fetchIsraeliHolidays(
                new Date(2026, 2, 1),
                new Date(2026, 2, 31)
            );

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('פורים');
        });

        it('מייצר ID ייחודי לכל חג', () => {
            HebrewCalendar.calendar.mockReturnValue([
                createMockHebcalEvent('Purim', '2026-03-05')
            ]);

            const result = fetchIsraeliHolidays(
                new Date(2026, 0, 1),
                new Date(2026, 11, 31)
            );

            expect(result[0].id).toMatch(/^holiday-/);
            expect(result[0].id).toContain('פורים');
        });

        it('תאריך סיום הוא יום אחד אחרי ההתחלה (exclusive)', () => {
            HebrewCalendar.calendar.mockReturnValue([
                createMockHebcalEvent('Purim', '2026-03-05')
            ]);

            const result = fetchIsraeliHolidays(
                new Date(2026, 0, 1),
                new Date(2026, 11, 31)
            );

            const holiday = result[0];
            const startDay = holiday.start.getDate();
            const endDay = holiday.end.getDate();
            expect(endDay - startDay).toBe(1);
        });

        it('מסיר כפילויות (אותו תאריך ושם)', () => {
            HebrewCalendar.calendar.mockReturnValue([
                createMockHebcalEvent('Purim', '2026-03-05'),
                createMockHebcalEvent('Purim', '2026-03-05') // כפילות
            ]);

            const result = fetchIsraeliHolidays(
                new Date(2026, 0, 1),
                new Date(2026, 11, 31)
            );

            expect(result).toHaveLength(1);
        });

        it('טווח מרובה שנים - קורא calendar לכל שנה', () => {
            HebrewCalendar.calendar.mockReturnValue([]);

            fetchIsraeliHolidays(
                new Date(2025, 0, 1),
                new Date(2027, 11, 31)
            );

            // 3 שנים: 2025, 2026, 2027
            expect(HebrewCalendar.calendar).toHaveBeenCalledTimes(3);
        });

        it('מעביר il: true (ישראל, לא גולה)', () => {
            HebrewCalendar.calendar.mockReturnValue([]);

            fetchIsraeliHolidays(
                new Date(2026, 0, 1),
                new Date(2026, 11, 31)
            );

            const calledWith = HebrewCalendar.calendar.mock.calls[0][0];
            expect(calledWith.il).toBe(true);
            expect(calledWith.isHebrewYear).toBe(false);
        });

        it('מחזיר מערך ריק בשגיאה', () => {
            HebrewCalendar.calendar.mockImplementation(() => {
                throw new Error('hebcal error');
            });

            const result = fetchIsraeliHolidays(
                new Date(2026, 0, 1),
                new Date(2026, 11, 31)
            );

            expect(result).toEqual([]);
        });

        it('שעות התחלה מאופסות ל-00:00', () => {
            HebrewCalendar.calendar.mockReturnValue([
                createMockHebcalEvent('Purim', '2026-03-05T15:30:00')
            ]);

            const result = fetchIsraeliHolidays(
                new Date(2026, 0, 1),
                new Date(2026, 11, 31)
            );

            expect(result[0].start.getHours()).toBe(0);
            expect(result[0].start.getMinutes()).toBe(0);
        });
    });
});
