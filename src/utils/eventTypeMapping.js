/**
 * Event Type Mapping - מודול ליבה למיפוי סוגי דיווח
 * כל קובץ אחר מייבא מכאן את הפונקציות לזיהוי קטגוריית אירוע
 *
 * מבנה mapping: { 'labelName': 'category', ... }
 * דוגמה: { 'שעתי': 'billable', 'לא לחיוב': 'nonBillable', 'זמני': 'temporary', 'חופשה': 'allDay', 'מחלה': 'allDay', 'מילואים': 'allDay' }
 */

import logger from './logger';

// === קבועי קטגוריות ===

export const EVENT_CATEGORIES = {
    BILLABLE: 'billable',           // בדיוק 1 לייבל - אירוע שעתי לחיוב
    NON_BILLABLE: 'nonBillable',    // ללא הגבלה - אירוע שעתי לא לחיוב
    TEMPORARY: 'temporary',          // בדיוק 1 לייבל - אירוע זמני/מתוכנן
    ALL_DAY: 'allDay'               // לפחות 1 לייבל - אירוע יומי (חופשה/מחלה/מילואים)
};

// תוויות עבריות לקטגוריות - לשימוש בממשק ההגדרות
export const CATEGORY_LABELS = {
    [EVENT_CATEGORIES.BILLABLE]: 'לחיוב',
    [EVENT_CATEGORIES.NON_BILLABLE]: 'לא לחיוב',
    [EVENT_CATEGORIES.TEMPORARY]: 'זמני',
    [EVENT_CATEGORIES.ALL_DAY]: 'יומי'
};

// קטגוריה ללא מיפוי
export const UNMAPPED = 'unmapped';
export const UNMAPPED_LABEL = 'ללא מיפוי';

// === Core Resolvers ===

/**
 * מחזיר את הקטגוריה של לייבל
 * @param {string} label - שם הלייבל
 * @param {Object} mapping - מיפוי { label: category }
 * @returns {string|null} - קטגוריה או null
 */
export const getCategory = (label, mapping) => {
    if (!label || !mapping) return null;
    return mapping[label] || null;
};

/**
 * מחזיר את הלייבל של קטגוריית billable (בדיוק 1)
 * @param {Object} mapping
 * @returns {string|null}
 */
export const getBillableLabel = (mapping) => {
    if (!mapping) return null;
    const entry = Object.entries(mapping).find(([, cat]) => cat === EVENT_CATEGORIES.BILLABLE);
    return entry ? entry[0] : null;
};

/**
 * מחזיר את הלייבל של קטגוריית temporary (בדיוק 1)
 * @param {Object} mapping
 * @returns {string|null}
 */
export const getTemporaryLabel = (mapping) => {
    if (!mapping) return null;
    const entry = Object.entries(mapping).find(([, cat]) => cat === EVENT_CATEGORIES.TEMPORARY);
    return entry ? entry[0] : null;
};

/**
 * מחזיר את כל הלייבלים של קטגוריית nonBillable
 * @param {Object} mapping
 * @returns {string[]}
 */
export const getNonBillableLabels = (mapping) => {
    if (!mapping) return [];
    return Object.entries(mapping)
        .filter(([, cat]) => cat === EVENT_CATEGORIES.NON_BILLABLE)
        .map(([label]) => label);
};

/**
 * מחזיר את כל הלייבלים של קטגוריית allDay
 * @param {Object} mapping
 * @returns {string[]}
 */
export const getAllDayLabels = (mapping) => {
    if (!mapping) return [];
    return Object.entries(mapping)
        .filter(([, cat]) => cat === EVENT_CATEGORIES.ALL_DAY)
        .map(([label]) => label);
};

// === Boolean Checkers ===

export const isBillableLabel = (label, mapping) => getCategory(label, mapping) === EVENT_CATEGORIES.BILLABLE;
export const isNonBillableLabel = (label, mapping) => getCategory(label, mapping) === EVENT_CATEGORIES.NON_BILLABLE;
export const isTemporaryLabel = (label, mapping) => getCategory(label, mapping) === EVENT_CATEGORIES.TEMPORARY;
export const isAllDayLabel = (label, mapping) => getCategory(label, mapping) === EVENT_CATEGORIES.ALL_DAY;

// === Helpers ===

/**
 * מחזיר את הלייבל המתאים לאירוע שעתי (לחיוב או לא)
 * @param {boolean} isBillable
 * @param {Object} mapping
 * @returns {string}
 */
export const getTimedEventLabel = (isBillable, mapping) => {
    if (!mapping) return isBillable ? 'שעתי' : 'לא לחיוב'; // legacy fallback
    if (isBillable) {
        return getBillableLabel(mapping) || 'שעתי';
    }
    const nbLabels = getNonBillableLabels(mapping);
    return nbLabels[0] || 'לא לחיוב';
};

// === Validation ===

/**
 * בדיקת תקינות מיפוי
 * @param {Object} mapping
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export const validateMapping = (mapping) => {
    const errors = [];

    if (!mapping || typeof mapping !== 'object') {
        return { isValid: false, errors: ['חסר מיפוי סוגי דיווח'] };
    }

    const entries = Object.entries(mapping);
    if (entries.length === 0) {
        return { isValid: false, errors: ['מיפוי ריק - יש לשייך לייבלים לקטגוריות'] };
    }

    // בדיקת billable - בדיוק 1
    const billableCount = entries.filter(([, cat]) => cat === EVENT_CATEGORIES.BILLABLE).length;
    if (billableCount === 0) {
        errors.push('חסר לייבל "לחיוב" - יש לשייך בדיוק לייבל אחד');
    } else if (billableCount > 1) {
        errors.push('ניתן לשייך רק לייבל אחד לקטגוריית "לחיוב"');
    }

    // בדיקת temporary - בדיוק 1
    const temporaryCount = entries.filter(([, cat]) => cat === EVENT_CATEGORIES.TEMPORARY).length;
    if (temporaryCount === 0) {
        errors.push('חסר לייבל "זמני" - יש לשייך בדיוק לייבל אחד');
    } else if (temporaryCount > 1) {
        errors.push('ניתן לשייך רק לייבל אחד לקטגוריית "זמני"');
    }

    // בדיקת allDay - לפחות 1
    const allDayCount = entries.filter(([, cat]) => cat === EVENT_CATEGORIES.ALL_DAY).length;
    if (allDayCount === 0) {
        errors.push('חסר לייבל "יומי" - יש לשייך לפחות לייבל אחד');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

// === Auto-Migration ===

// לייבלים ידועים בעברית למיפוי אוטומטי
const KNOWN_HEBREW_LABELS = {
    'שעתי': EVENT_CATEGORIES.BILLABLE,
    'לא לחיוב': EVENT_CATEGORIES.NON_BILLABLE,
    'זמני': EVENT_CATEGORIES.TEMPORARY,
    'חופשה': EVENT_CATEGORIES.ALL_DAY,
    'מחלה': EVENT_CATEGORIES.ALL_DAY,
    'מילואים': EVENT_CATEGORIES.ALL_DAY
};

/**
 * ניסיון מיפוי אוטומטי לפי לייבלים עבריים ידועים
 * @param {Array<{label: string, color: string}>} availableLabels - הלייבלים מהעמודה
 * @returns {{ mapping: Object, colors: Object }|null} - מיפוי או null אם לא הצליח
 */
export const createLegacyMapping = (availableLabels) => {
    if (!availableLabels || availableLabels.length === 0) return null;

    const mapping = {};
    const colors = {};
    let matched = 0;

    for (const labelObj of availableLabels) {
        const labelName = labelObj.label;
        const category = KNOWN_HEBREW_LABELS[labelName];
        if (category) {
            mapping[labelName] = category;
            if (labelObj.color) {
                colors[labelName] = labelObj.color;
            }
            matched++;
        }
    }

    // בדיקה שהמיפוי תקין
    const validation = validateMapping(mapping);
    if (validation.isValid) {
        logger.info('eventTypeMapping', 'Auto-migration succeeded', { matched, total: availableLabels.length });
        return { mapping, colors };
    }

    logger.warn('eventTypeMapping', 'Auto-migration failed validation', { errors: validation.errors, matched });
    return null;
};
