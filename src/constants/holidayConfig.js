/**
 * הגדרות חגים ישראליים
 * רשימת החגים שיוצגו בלוח השנה וצבעיהם
 */

// סוגי חגים וצבעיהם
export const HOLIDAY_TYPES = {
    MODERN: 'MODERN',   // חגים מודרניים (יום העצמאות, יום הזיכרון וכו')
    MAJOR: 'MAJOR',     // חגים דתיים מרכזיים (ראש השנה, יום כיפור וכו')
    MINOR: 'MINOR'      // חגים קטנים (חנוכה, פורים וכו')
};

// צבעים לכל סוג חג
export const HOLIDAY_COLORS = {
    [HOLIDAY_TYPES.MODERN]: '#0073ea',   // כחול Monday
    [HOLIDAY_TYPES.MAJOR]: '#784bd1',    // סגול
    [HOLIDAY_TYPES.MINOR]: '#9cd326'     // ירוק
};

// רשימת החגים שיוצגו (מפתחות מ-hebcal עם תרגום לעברית)
export const HOLIDAYS_CONFIG = {
    // חגים מודרניים - ישראליים
    'Yom HaShoah': {
        hebrew: 'יום השואה',
        type: HOLIDAY_TYPES.MODERN
    },
    'Yom HaZikaron': {
        hebrew: 'יום הזיכרון',
        type: HOLIDAY_TYPES.MODERN
    },
    'Yom HaAtzma\'ut': {
        hebrew: 'יום העצמאות',
        type: HOLIDAY_TYPES.MODERN
    },
    'Yom Yerushalayim': {
        hebrew: 'יום ירושלים',
        type: HOLIDAY_TYPES.MODERN
    },

    // חגים דתיים מרכזיים
    'Rosh Hashana': {
        hebrew: 'ראש השנה',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Rosh Hashana I': {
        hebrew: 'ראש השנה א\'',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Rosh Hashana II': {
        hebrew: 'ראש השנה ב\'',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Yom Kippur': {
        hebrew: 'יום כיפור',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Sukkot': {
        hebrew: 'סוכות',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Sukkot I': {
        hebrew: 'סוכות א\'',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Sukkot II': {
        hebrew: 'סוכות ב\'',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Sukkot VII (Hoshana Raba)': {
        hebrew: 'הושענא רבא',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Shmini Atzeret': {
        hebrew: 'שמיני עצרת',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Simchat Torah': {
        hebrew: 'שמחת תורה',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Pesach': {
        hebrew: 'פסח',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Pesach I': {
        hebrew: 'פסח א\'',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Pesach VII': {
        hebrew: 'שביעי של פסח',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Shavuot': {
        hebrew: 'שבועות',
        type: HOLIDAY_TYPES.MAJOR
    },
    'Shavuot I': {
        hebrew: 'שבועות',
        type: HOLIDAY_TYPES.MAJOR
    },

    // חגים קטנים
    'Chanukah': {
        hebrew: 'חנוכה',
        type: HOLIDAY_TYPES.MINOR
    },
    'Chanukah: 1 Candle': {
        hebrew: 'חנוכה - נר ראשון',
        type: HOLIDAY_TYPES.MINOR
    },
    'Chanukah: 8 Candles': {
        hebrew: 'חנוכה - נר שמיני',
        type: HOLIDAY_TYPES.MINOR
    },
    'Chanukah: 8th Day': {
        hebrew: 'זאת חנוכה',
        type: HOLIDAY_TYPES.MINOR
    },
    'Purim': {
        hebrew: 'פורים',
        type: HOLIDAY_TYPES.MINOR
    },
    'Shushan Purim': {
        hebrew: 'שושן פורים',
        type: HOLIDAY_TYPES.MINOR
    },
    'Tu BiShvat': {
        hebrew: 'ט״ו בשבט',
        type: HOLIDAY_TYPES.MINOR
    },
    'Lag BaOmer': {
        hebrew: 'ל״ג בעומר',
        type: HOLIDAY_TYPES.MINOR
    },
    'Tu B\'Av': {
        hebrew: 'ט״ו באב',
        type: HOLIDAY_TYPES.MINOR
    },
    'Tish\'a B\'Av': {
        hebrew: 'תשעה באב',
        type: HOLIDAY_TYPES.MINOR
    }
};

// רשימת שמות חגים ב-hebcal שנרצה לכלול
export const INCLUDED_HOLIDAYS = Object.keys(HOLIDAYS_CONFIG);
