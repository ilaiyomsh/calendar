/**
 * Event Type Mapping - מודול ליבה למיפוי סוגי דיווח
 * כל קובץ אחר מייבא מכאן את הפונקציות לזיהוי קטגוריית אירוע
 *
 * מבנה mapping: { index: 'category', ... }  (מפתח = אינדקס הלייבל בעמודת Status)
 * מבנה labelMeta: { index: { label: string, color: string }, ... }
 * דוגמה: mapping = { '3': 'billable', '0': 'allDay', '2': 'allDay', '6': 'allDay', '101': 'nonBillable' }
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
 * מחזיר את הקטגוריה של אינדקס לייבל
 * @param {number|string} index - אינדקס הלייבל
 * @param {Object} mapping - מיפוי { index: category }
 * @returns {string|null} - קטגוריה או null
 */
export const getCategory = (index, mapping) => {
    if (index == null || !mapping) return null;
    return mapping[String(index)] || null;
};

/**
 * מחזיר את האינדקס של קטגוריית billable (בדיוק 1)
 * @param {Object} mapping
 * @returns {string|null} - אינדקס כ-string או null
 */
export const getBillableIndex = (mapping) => {
    if (!mapping) return null;
    const entry = Object.entries(mapping).find(([, cat]) => cat === EVENT_CATEGORIES.BILLABLE);
    return entry ? entry[0] : null;
};

/**
 * מחזיר את האינדקס של קטגוריית temporary (בדיוק 1)
 * @param {Object} mapping
 * @returns {string|null}
 */
export const getTemporaryIndex = (mapping) => {
    if (!mapping) return null;
    const entry = Object.entries(mapping).find(([, cat]) => cat === EVENT_CATEGORIES.TEMPORARY);
    return entry ? entry[0] : null;
};

/**
 * מחזיר את כל האינדקסים של קטגוריית nonBillable
 * @param {Object} mapping
 * @returns {string[]}
 */
export const getNonBillableIndexes = (mapping) => {
    if (!mapping) return [];
    return Object.entries(mapping)
        .filter(([, cat]) => cat === EVENT_CATEGORIES.NON_BILLABLE)
        .map(([index]) => index);
};

/**
 * מחזיר את כל האינדקסים של קטגוריית allDay
 * @param {Object} mapping
 * @returns {string[]}
 */
export const getAllDayIndexes = (mapping) => {
    if (!mapping) return [];
    return Object.entries(mapping)
        .filter(([, cat]) => cat === EVENT_CATEGORIES.ALL_DAY)
        .map(([index]) => index);
};

// === Boolean Checkers (by index) ===

export const isBillableIndex = (index, mapping) => getCategory(index, mapping) === EVENT_CATEGORIES.BILLABLE;
export const isNonBillableIndex = (index, mapping) => getCategory(index, mapping) === EVENT_CATEGORIES.NON_BILLABLE;
export const isTemporaryIndex = (index, mapping) => getCategory(index, mapping) === EVENT_CATEGORIES.TEMPORARY;
export const isAllDayIndex = (index, mapping) => getCategory(index, mapping) === EVENT_CATEGORIES.ALL_DAY;

// === Label Meta Helpers ===

/**
 * שליפת טקסט הלייבל לפי אינדקס
 * @param {number|string} index
 * @param {Object} labelMeta - { index: { label, color } }
 * @returns {string}
 */
export const getLabelText = (index, labelMeta) => {
    if (index == null || !labelMeta) return '';
    return labelMeta[String(index)]?.label || '';
};

/**
 * שליפת צבע הלייבל לפי אינדקס
 * @param {number|string} index
 * @param {Object} labelMeta - { index: { label, color } }
 * @returns {string}
 */
export const getLabelColor = (index, labelMeta) => {
    if (index == null || !labelMeta) return '';
    return labelMeta[String(index)]?.color || '';
};

/**
 * שליפת טקסטים של כל הלייבלים בקטגוריה מסוימת
 * @param {string} category - קטגוריה
 * @param {Object} mapping
 * @param {Object} labelMeta
 * @returns {Array<{index: string, label: string, color: string}>}
 */
export const getLabelsByCategory = (category, mapping, labelMeta) => {
    if (!mapping || !labelMeta) return [];
    return Object.entries(mapping)
        .filter(([, cat]) => cat === category)
        .map(([index]) => ({
            index,
            label: getLabelText(index, labelMeta),
            color: getLabelColor(index, labelMeta)
        }));
};

// === Helpers ===

/**
 * מחזיר את האינדקס המתאים לאירוע שעתי (לחיוב או לא)
 * @param {boolean} isBillable
 * @param {Object} mapping
 * @returns {string|null} - אינדקס או null אם אין mapping
 */
export const getTimedEventIndex = (isBillable, mapping) => {
    if (!mapping) return null;
    if (isBillable) {
        return getBillableIndex(mapping);
    }
    const nbIndexes = getNonBillableIndexes(mapping);
    return nbIndexes[0] || null;
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
    'חיוב': EVENT_CATEGORIES.BILLABLE,
    'לא לחיוב': EVENT_CATEGORIES.NON_BILLABLE,
    'זמני': EVENT_CATEGORIES.TEMPORARY,
    'חופשה': EVENT_CATEGORIES.ALL_DAY,
    'מחלה': EVENT_CATEGORIES.ALL_DAY,
    'מילואים': EVENT_CATEGORIES.ALL_DAY
};

/**
 * ניסיון מיפוי אוטומטי לפי לייבלים עבריים ידועים
 * שומר mapping לפי index (לא לפי טקסט)
 * @param {Array<{label: string, color: string, index: number}>} availableLabels - הלייבלים מהעמודה
 * @returns {{ mapping: Object, labelMeta: Object }|null} - מיפוי או null אם לא הצליח
 */
export const createLegacyMapping = (availableLabels) => {
    if (!availableLabels || availableLabels.length === 0) return null;

    const mapping = {};
    const labelMeta = {};
    let matched = 0;

    for (const labelObj of availableLabels) {
        const labelName = labelObj.label;
        const index = String(labelObj.index);
        const category = KNOWN_HEBREW_LABELS[labelName];
        if (category) {
            // בדיקה שלא כבר יש billable ממופה (כי 'שעתי' ו-'חיוב' שניהם BILLABLE)
            if (category === EVENT_CATEGORIES.BILLABLE && Object.values(mapping).includes(EVENT_CATEGORIES.BILLABLE)) {
                continue;
            }
            mapping[index] = category;
            labelMeta[index] = { label: labelName, color: labelObj.color || '' };
            matched++;
        }
    }

    // בדיקה שהמיפוי תקין
    const validation = validateMapping(mapping);
    if (validation.isValid) {
        logger.info('eventTypeMapping', 'Auto-migration succeeded', { matched, total: availableLabels.length });
        return { mapping, labelMeta };
    }

    logger.warn('eventTypeMapping', 'Auto-migration failed validation', { errors: validation.errors, matched });
    return null;
};

/**
 * בדיקה אם mapping הוא בפורמט ישן (מפתחות הם טקסט ולא אינדקסים)
 * @param {Object} mapping
 * @returns {boolean}
 */
export const isLegacyMapping = (mapping) => {
    if (!mapping || typeof mapping !== 'object') return false;
    const keys = Object.keys(mapping);
    if (keys.length === 0) return false;
    // אם המפתח הראשון הוא לא מספר - זה פורמט ישן
    return isNaN(Number(keys[0]));
};
