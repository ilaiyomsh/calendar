import { describe, it, expect, vi } from 'vitest';


import {
    EVENT_CATEGORIES,
    CATEGORY_LABELS,
    UNMAPPED,
    getCategory,
    getBillableIndex,
    getTemporaryIndex,
    getNonBillableIndexes,
    getAllDayIndexes,
    isBillableIndex,
    isNonBillableIndex,
    isTemporaryIndex,
    isAllDayIndex,
    getLabelText,
    getLabelColor,
    getLabelsByCategory,
    getTimedEventIndex,
    validateMapping,
    createLegacyMapping,
    isLegacyMapping
} from '../eventTypeMapping';

// מיפוי תקין לדוגמה
const VALID_MAPPING = {
    '3': 'billable',
    '0': 'allDay',
    '2': 'allDay',
    '6': 'allDay',
    '101': 'nonBillable',
    '5': 'temporary'
};

// מטא-דאטה של לייבלים
const LABEL_META = {
    '3': { label: 'שעתי', color: '#0086c0' },
    '0': { label: 'חופשה', color: '#fdab3d' },
    '2': { label: 'מחלה', color: '#e2445c' },
    '6': { label: 'מילואים', color: '#037f4c' },
    '101': { label: 'לא לחיוב', color: '#ff7575' },
    '5': { label: 'זמני', color: '#a25ddc' }
};

describe('eventTypeMapping', () => {

    // === קבועים ===

    describe('EVENT_CATEGORIES', () => {
        it('מכיל את כל הקטגוריות הנדרשות', () => {
            expect(EVENT_CATEGORIES.BILLABLE).toBe('billable');
            expect(EVENT_CATEGORIES.NON_BILLABLE).toBe('nonBillable');
            expect(EVENT_CATEGORIES.TEMPORARY).toBe('temporary');
            expect(EVENT_CATEGORIES.ALL_DAY).toBe('allDay');
        });
    });

    describe('CATEGORY_LABELS', () => {
        it('מכיל תוויות עבריות לכל הקטגוריות', () => {
            expect(CATEGORY_LABELS.billable).toBe('לחיוב');
            expect(CATEGORY_LABELS.nonBillable).toBe('לא לחיוב');
            expect(CATEGORY_LABELS.temporary).toBe('זמני');
            expect(CATEGORY_LABELS.allDay).toBe('יומי');
        });
    });

    // === getCategory ===

    describe('getCategory', () => {
        it('מחזיר קטגוריה נכונה לאינדקס קיים', () => {
            expect(getCategory('3', VALID_MAPPING)).toBe('billable');
            expect(getCategory('0', VALID_MAPPING)).toBe('allDay');
        });

        it('מחזיר null לאינדקס שלא קיים', () => {
            expect(getCategory('999', VALID_MAPPING)).toBe(null);
        });

        it('מחזיר null עבור null index', () => {
            expect(getCategory(null, VALID_MAPPING)).toBe(null);
        });

        it('מחזיר null עבור undefined index', () => {
            expect(getCategory(undefined, VALID_MAPPING)).toBe(null);
        });

        it('מחזיר null עבור mapping null', () => {
            expect(getCategory('3', null)).toBe(null);
        });

        it('ממיר אינדקס מספרי למחרוזת', () => {
            expect(getCategory(3, VALID_MAPPING)).toBe('billable');
        });
    });

    // === getBillableIndex ===

    describe('getBillableIndex', () => {
        it('מחזיר את האינדקס הנכון', () => {
            expect(getBillableIndex(VALID_MAPPING)).toBe('3');
        });

        it('מחזיר null אם אין billable', () => {
            const mapping = { '0': 'allDay', '5': 'temporary' };
            expect(getBillableIndex(mapping)).toBe(null);
        });

        it('מחזיר null עם mapping null', () => {
            expect(getBillableIndex(null)).toBe(null);
        });
    });

    // === getTemporaryIndex ===

    describe('getTemporaryIndex', () => {
        it('מחזיר את האינדקס הנכון', () => {
            expect(getTemporaryIndex(VALID_MAPPING)).toBe('5');
        });

        it('מחזיר null אם אין temporary', () => {
            const mapping = { '3': 'billable', '0': 'allDay' };
            expect(getTemporaryIndex(mapping)).toBe(null);
        });

        it('מחזיר null עם mapping null', () => {
            expect(getTemporaryIndex(null)).toBe(null);
        });
    });

    // === getNonBillableIndexes ===

    describe('getNonBillableIndexes', () => {
        it('מחזיר מערך של כל אינדקסי nonBillable', () => {
            expect(getNonBillableIndexes(VALID_MAPPING)).toEqual(['101']);
        });

        it('מחזיר מספר אינדקסים כשיש כמה', () => {
            const mapping = { ...VALID_MAPPING, '102': 'nonBillable' };
            expect(getNonBillableIndexes(mapping)).toEqual(['101', '102']);
        });

        it('מחזיר מערך ריק אם אין nonBillable', () => {
            const mapping = { '3': 'billable', '0': 'allDay', '5': 'temporary' };
            expect(getNonBillableIndexes(mapping)).toEqual([]);
        });

        it('מחזיר מערך ריק עם mapping null', () => {
            expect(getNonBillableIndexes(null)).toEqual([]);
        });
    });

    // === getAllDayIndexes ===

    describe('getAllDayIndexes', () => {
        it('מחזיר את כל אינדקסי allDay', () => {
            const indexes = getAllDayIndexes(VALID_MAPPING);
            expect(indexes).toContain('0');
            expect(indexes).toContain('2');
            expect(indexes).toContain('6');
            expect(indexes).toHaveLength(3);
        });

        it('מחזיר מערך ריק עם mapping null', () => {
            expect(getAllDayIndexes(null)).toEqual([]);
        });
    });

    // === Boolean Checkers ===

    describe('Boolean Checkers', () => {
        it('isBillableIndex - מזהה נכון', () => {
            expect(isBillableIndex('3', VALID_MAPPING)).toBe(true);
            expect(isBillableIndex('0', VALID_MAPPING)).toBe(false);
        });

        it('isNonBillableIndex - מזהה נכון', () => {
            expect(isNonBillableIndex('101', VALID_MAPPING)).toBe(true);
            expect(isNonBillableIndex('3', VALID_MAPPING)).toBe(false);
        });

        it('isTemporaryIndex - מזהה נכון', () => {
            expect(isTemporaryIndex('5', VALID_MAPPING)).toBe(true);
            expect(isTemporaryIndex('3', VALID_MAPPING)).toBe(false);
        });

        it('isAllDayIndex - מזהה נכון', () => {
            expect(isAllDayIndex('0', VALID_MAPPING)).toBe(true);
            expect(isAllDayIndex('2', VALID_MAPPING)).toBe(true);
            expect(isAllDayIndex('3', VALID_MAPPING)).toBe(false);
        });
    });

    // === Label Meta Helpers ===

    describe('getLabelText', () => {
        it('מחזיר טקסט לייבל נכון', () => {
            expect(getLabelText('3', LABEL_META)).toBe('שעתי');
            expect(getLabelText('0', LABEL_META)).toBe('חופשה');
        });

        it('מחזיר מחרוזת ריקה לאינדקס לא קיים', () => {
            expect(getLabelText('999', LABEL_META)).toBe('');
        });

        it('מחזיר מחרוזת ריקה עם labelMeta null', () => {
            expect(getLabelText('3', null)).toBe('');
        });

        it('מחזיר מחרוזת ריקה עם index null', () => {
            expect(getLabelText(null, LABEL_META)).toBe('');
        });
    });

    describe('getLabelColor', () => {
        it('מחזיר צבע לייבל נכון', () => {
            expect(getLabelColor('0', LABEL_META)).toBe('#fdab3d');
        });

        it('מחזיר מחרוזת ריקה לאינדקס לא קיים', () => {
            expect(getLabelColor('999', LABEL_META)).toBe('');
        });
    });

    describe('getLabelsByCategory', () => {
        it('מחזיר את כל הלייבלים בקטגוריה', () => {
            const labels = getLabelsByCategory('allDay', VALID_MAPPING, LABEL_META);
            expect(labels).toHaveLength(3);
            expect(labels.map(l => l.label)).toContain('חופשה');
            expect(labels.map(l => l.label)).toContain('מחלה');
            expect(labels.map(l => l.label)).toContain('מילואים');
        });

        it('מחזיר מערך ריק לקטגוריה ריקה', () => {
            const mapping = { '3': 'billable' };
            expect(getLabelsByCategory('allDay', mapping, LABEL_META)).toEqual([]);
        });

        it('מחזיר מערך ריק עם mapping null', () => {
            expect(getLabelsByCategory('billable', null, LABEL_META)).toEqual([]);
        });

        it('מחזיר מערך ריק עם labelMeta null', () => {
            expect(getLabelsByCategory('billable', VALID_MAPPING, null)).toEqual([]);
        });
    });

    // === getTimedEventIndex ===

    describe('getTimedEventIndex', () => {
        it('מחזיר billable index כש-isBillable=true', () => {
            expect(getTimedEventIndex(true, VALID_MAPPING)).toBe('3');
        });

        it('מחזיר nonBillable index ראשון כש-isBillable=false', () => {
            expect(getTimedEventIndex(false, VALID_MAPPING)).toBe('101');
        });

        it('מחזיר null כשאין mapping', () => {
            expect(getTimedEventIndex(true, null)).toBe(null);
        });
    });

    // === validateMapping ===

    describe('validateMapping', () => {
        it('מיפוי תקין - isValid=true', () => {
            const result = validateMapping(VALID_MAPPING);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('חסר billable - שגיאה', () => {
            const mapping = { '0': 'allDay', '5': 'temporary' };
            const result = validateMapping(mapping);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('לחיוב'))).toBe(true);
        });

        it('billable כפול - שגיאה', () => {
            const mapping = { '3': 'billable', '4': 'billable', '0': 'allDay', '5': 'temporary' };
            const result = validateMapping(mapping);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('לחיוב'))).toBe(true);
        });

        it('חסר temporary - שגיאה', () => {
            const mapping = { '3': 'billable', '0': 'allDay' };
            const result = validateMapping(mapping);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('זמני'))).toBe(true);
        });

        it('temporary כפול - שגיאה', () => {
            const mapping = { '3': 'billable', '5': 'temporary', '7': 'temporary', '0': 'allDay' };
            const result = validateMapping(mapping);
            expect(result.isValid).toBe(false);
        });

        it('חסר allDay - שגיאה', () => {
            const mapping = { '3': 'billable', '5': 'temporary' };
            const result = validateMapping(mapping);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('יומי'))).toBe(true);
        });

        it('mapping ריק - שגיאה', () => {
            const result = validateMapping({});
            expect(result.isValid).toBe(false);
            expect(result.errors[0]).toContain('מיפוי ריק');
        });

        it('mapping null - שגיאה', () => {
            const result = validateMapping(null);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]).toContain('חסר מיפוי');
        });

        it('mapping לא אובייקט - שגיאה', () => {
            const result = validateMapping('not an object');
            expect(result.isValid).toBe(false);
        });

        it('nonBillable אופציונלי - מיפוי תקין בלעדיו', () => {
            const mapping = { '3': 'billable', '0': 'allDay', '5': 'temporary' };
            const result = validateMapping(mapping);
            expect(result.isValid).toBe(true);
        });
    });

    // === createLegacyMapping ===

    describe('createLegacyMapping', () => {
        it('יוצר מיפוי מלייבלים ידועים', () => {
            const labels = [
                { label: 'שעתי', color: '#0086c0', index: 3 },
                { label: 'לא לחיוב', color: '#ff7575', index: 101 },
                { label: 'זמני', color: '#a25ddc', index: 5 },
                { label: 'חופשה', color: '#fdab3d', index: 0 },
                { label: 'מחלה', color: '#e2445c', index: 2 },
                { label: 'מילואים', color: '#037f4c', index: 6 }
            ];
            const result = createLegacyMapping(labels);
            expect(result).not.toBeNull();
            expect(result.mapping['3']).toBe('billable');
            expect(result.mapping['0']).toBe('allDay');
            expect(result.mapping['5']).toBe('temporary');
            expect(result.labelMeta['3'].label).toBe('שעתי');
        });

        it('מחזיר null עם מערך ריק', () => {
            expect(createLegacyMapping([])).toBe(null);
        });

        it('מחזיר null עם null', () => {
            expect(createLegacyMapping(null)).toBe(null);
        });

        it('מחזיר null אם לא כל הלייבלים הנדרשים קיימים', () => {
            const labels = [
                { label: 'שעתי', color: '#0086c0', index: 3 },
                { label: 'חופשה', color: '#fdab3d', index: 0 }
            ];
            // חסר temporary ו-allDay מספיקים
            expect(createLegacyMapping(labels)).toBe(null);
        });

        it('מונע כפל billable (שעתי + חיוב)', () => {
            const labels = [
                { label: 'שעתי', color: '#0086c0', index: 3 },
                { label: 'חיוב', color: '#0086c0', index: 4 }, // שני billable
                { label: 'זמני', color: '#a25ddc', index: 5 },
                { label: 'חופשה', color: '#fdab3d', index: 0 },
                { label: 'מחלה', color: '#e2445c', index: 2 },
                { label: 'מילואים', color: '#037f4c', index: 6 }
            ];
            const result = createLegacyMapping(labels);
            expect(result).not.toBeNull();
            // רק הראשון (שעתי) צריך להיות ממופה כ-billable
            const billableIndexes = Object.entries(result.mapping)
                .filter(([, cat]) => cat === 'billable');
            expect(billableIndexes).toHaveLength(1);
        });
    });

    // === isLegacyMapping ===

    describe('isLegacyMapping', () => {
        it('מזהה מיפוי בפורמט ישן (מפתחות טקסט)', () => {
            const legacy = { 'שעתי': 'billable', 'חופשה': 'allDay' };
            expect(isLegacyMapping(legacy)).toBe(true);
        });

        it('מזהה מיפוי חדש (מפתחות מספריים)', () => {
            expect(isLegacyMapping(VALID_MAPPING)).toBe(false);
        });

        it('מחזיר false עם null', () => {
            expect(isLegacyMapping(null)).toBe(false);
        });

        it('מחזיר false עם אובייקט ריק', () => {
            expect(isLegacyMapping({})).toBe(false);
        });

        it('מחזיר false עם סוג לא תקין', () => {
            expect(isLegacyMapping('string')).toBe(false);
        });
    });
});
