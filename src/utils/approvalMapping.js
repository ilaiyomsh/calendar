/**
 * Approval Mapping - מודול מיפוי לעמודת סטטוס אישור מנהל
 * 4 קטגוריות: pending, approved_billable, approved_unbillable, rejected
 *
 * מבנה mapping: { index: 'category', ... }
 * מבנה labelMeta: { index: { label, color }, ... }
 */

import logger from './logger';

// === קבועי קטגוריות ===

export const APPROVAL_CATEGORIES = {
    PENDING: 'pending',                       // ממתין לאישור (בדיוק 1)
    APPROVED_BILLABLE: 'approved_billable',   // מאושר - לחיוב (בדיוק 1)
    APPROVED_UNBILLABLE: 'approved_unbillable', // מאושר - לא לחיוב (בדיוק 1)
    REJECTED: 'rejected'                      // לא מאושר (בדיוק 1)
};

export const APPROVAL_CATEGORY_LABELS = {
    [APPROVAL_CATEGORIES.PENDING]: 'ממתין לאישור',
    [APPROVAL_CATEGORIES.APPROVED_BILLABLE]: 'מאושר - לחיוב',
    [APPROVAL_CATEGORIES.APPROVED_UNBILLABLE]: 'מאושר - לא לחיוב',
    [APPROVAL_CATEGORIES.REJECTED]: 'לא מאושר'
};

export const APPROVAL_UNMAPPED = 'unmapped';
export const APPROVAL_UNMAPPED_LABEL = 'ללא מיפוי';

// === Core Resolvers ===

export const getApprovalCategory = (index, mapping) => {
    if (index == null || !mapping) return null;
    return mapping[String(index)] || null;
};

export const getPendingIndex = (mapping) => {
    if (!mapping) return null;
    const entry = Object.entries(mapping).find(([, cat]) => cat === APPROVAL_CATEGORIES.PENDING);
    return entry ? entry[0] : null;
};

export const getApprovedBillableIndex = (mapping) => {
    if (!mapping) return null;
    const entry = Object.entries(mapping).find(([, cat]) => cat === APPROVAL_CATEGORIES.APPROVED_BILLABLE);
    return entry ? entry[0] : null;
};

export const getApprovedUnbillableIndex = (mapping) => {
    if (!mapping) return null;
    const entry = Object.entries(mapping).find(([, cat]) => cat === APPROVAL_CATEGORIES.APPROVED_UNBILLABLE);
    return entry ? entry[0] : null;
};

export const getRejectedIndex = (mapping) => {
    if (!mapping) return null;
    const entry = Object.entries(mapping).find(([, cat]) => cat === APPROVAL_CATEGORIES.REJECTED);
    return entry ? entry[0] : null;
};

// === Boolean Checkers ===

export const isPendingIndex = (index, mapping) => getApprovalCategory(index, mapping) === APPROVAL_CATEGORIES.PENDING;
export const isApprovedBillableIndex = (index, mapping) => getApprovalCategory(index, mapping) === APPROVAL_CATEGORIES.APPROVED_BILLABLE;
export const isApprovedUnbillableIndex = (index, mapping) => getApprovalCategory(index, mapping) === APPROVAL_CATEGORIES.APPROVED_UNBILLABLE;
// Composite: true for BOTH approved types (for edit lock, opacity)
export const isApprovedIndex = (index, mapping) => {
    const cat = getApprovalCategory(index, mapping);
    return cat === APPROVAL_CATEGORIES.APPROVED_BILLABLE || cat === APPROVAL_CATEGORIES.APPROVED_UNBILLABLE;
};
export const isRejectedIndex = (index, mapping) => getApprovalCategory(index, mapping) === APPROVAL_CATEGORIES.REJECTED;

// === Label Meta Helpers ===

export const getApprovalLabelText = (index, labelMeta) => {
    if (index == null || !labelMeta) return '';
    return labelMeta[String(index)]?.label || '';
};

export const getApprovalLabelColor = (index, labelMeta) => {
    if (index == null || !labelMeta) return '';
    return labelMeta[String(index)]?.color || '';
};

// === Validation ===

export const validateApprovalMapping = (mapping) => {
    const errors = [];

    if (!mapping || typeof mapping !== 'object') {
        return { isValid: false, errors: ['חסר מיפוי סטטוס אישור'] };
    }

    const entries = Object.entries(mapping);
    if (entries.length === 0) {
        return { isValid: false, errors: ['מיפוי ריק - יש לשייך לייבלים לקטגוריות'] };
    }

    // בדיקת pending - בדיוק 1
    const pendingCount = entries.filter(([, cat]) => cat === APPROVAL_CATEGORIES.PENDING).length;
    if (pendingCount === 0) {
        errors.push('חסר לייבל "ממתין לאישור" - יש לשייך בדיוק לייבל אחד');
    } else if (pendingCount > 1) {
        errors.push('ניתן לשייך רק לייבל אחד לקטגוריית "ממתין לאישור"');
    }

    // בדיקת approved_billable - בדיוק 1
    const approvedBillableCount = entries.filter(([, cat]) => cat === APPROVAL_CATEGORIES.APPROVED_BILLABLE).length;
    if (approvedBillableCount === 0) {
        errors.push('חסר לייבל "מאושר - לחיוב" - יש לשייך בדיוק לייבל אחד');
    } else if (approvedBillableCount > 1) {
        errors.push('ניתן לשייך רק לייבל אחד לקטגוריית "מאושר - לחיוב"');
    }

    // בדיקת approved_unbillable - בדיוק 1
    const approvedUnbillableCount = entries.filter(([, cat]) => cat === APPROVAL_CATEGORIES.APPROVED_UNBILLABLE).length;
    if (approvedUnbillableCount === 0) {
        errors.push('חסר לייבל "מאושר - לא לחיוב" - יש לשייך בדיוק לייבל אחד');
    } else if (approvedUnbillableCount > 1) {
        errors.push('ניתן לשייך רק לייבל אחד לקטגוריית "מאושר - לא לחיוב"');
    }

    // בדיקת rejected - בדיוק 1
    const rejectedCount = entries.filter(([, cat]) => cat === APPROVAL_CATEGORIES.REJECTED).length;
    if (rejectedCount === 0) {
        errors.push('חסר לייבל "לא מאושר" - יש לשייך בדיוק לייבל אחד');
    } else if (rejectedCount > 1) {
        errors.push('ניתן לשייך רק לייבל אחד לקטגוריית "לא מאושר"');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

// === Auto-Migration ===

const KNOWN_APPROVAL_LABELS = {
    'ממתין': APPROVAL_CATEGORIES.PENDING,
    'ממתין לאישור': APPROVAL_CATEGORIES.PENDING,
    'pending': APPROVAL_CATEGORIES.PENDING,
    'מאושר': APPROVAL_CATEGORIES.APPROVED_BILLABLE,       // backward compat: old "מאושר" → billable
    'מאושר - לחיוב': APPROVAL_CATEGORIES.APPROVED_BILLABLE,
    'approved': APPROVAL_CATEGORIES.APPROVED_BILLABLE,
    'מאושר - לא לחיוב': APPROVAL_CATEGORIES.APPROVED_UNBILLABLE,
    'לא מאושר': APPROVAL_CATEGORIES.REJECTED,
    'נדחה': APPROVAL_CATEGORIES.REJECTED,
    'rejected': APPROVAL_CATEGORIES.REJECTED
};

export const createAutoApprovalMapping = (availableLabels) => {
    if (!availableLabels || availableLabels.length === 0) return null;

    const mapping = {};
    const labelMeta = {};
    let matched = 0;

    for (const labelObj of availableLabels) {
        const labelName = labelObj.label;
        const index = String(labelObj.index);
        const category = KNOWN_APPROVAL_LABELS[labelName];
        if (category) {
            // בדיקה שלא כבר יש קטגוריה זו ממופה
            if (Object.values(mapping).includes(category)) {
                continue;
            }
            mapping[index] = category;
            labelMeta[index] = { label: labelName, color: labelObj.color || '' };
            matched++;
        }
    }

    const validation = validateApprovalMapping(mapping);
    if (validation.isValid) {
        logger.info('approvalMapping', 'Auto-mapping succeeded', { matched, total: availableLabels.length });
        return { mapping, labelMeta };
    }

    logger.warn('approvalMapping', 'Auto-mapping failed validation', { errors: validation.errors, matched });
    return null;
};

/**
 * מיגרציה של מיפוי ישן (3 קטגוריות) ל-4 קטגוריות
 * ממיר 'approved' → 'approved_billable'
 * @param {Object} mapping - מיפוי קיים
 * @returns {Object|null} מיפוי מעודכן אם בוצע שינוי, null אם לא נדרש
 */
export const migrateApprovalMapping = (mapping) => {
    if (!mapping || typeof mapping !== 'object') return null;

    let changed = false;
    const newMapping = { ...mapping };

    for (const [index, category] of Object.entries(newMapping)) {
        if (category === 'approved') {
            newMapping[index] = APPROVAL_CATEGORIES.APPROVED_BILLABLE;
            changed = true;
            logger.info('approvalMapping', `Migrated index ${index} from 'approved' to 'approved_billable'`);
        }
    }

    if (changed) {
        return newMapping;
    }

    return null;
};
