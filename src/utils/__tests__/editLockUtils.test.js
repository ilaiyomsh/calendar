import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    EDIT_LOCK_MODES,
    EDIT_LOCK_LABELS,
    isEventLocked
} from '../editLockUtils';

describe('editLockUtils', () => {

    // === קבועים ===

    describe('EDIT_LOCK_MODES', () => {
        it('מכיל את כל המצבים', () => {
            expect(EDIT_LOCK_MODES.NONE).toBe('none');
            expect(EDIT_LOCK_MODES.TWO_DAYS).toBe('two_days');
            expect(EDIT_LOCK_MODES.CURRENT_WEEK).toBe('current_week');
            expect(EDIT_LOCK_MODES.CURRENT_MONTH).toBe('current_month');
        });
    });

    describe('EDIT_LOCK_LABELS', () => {
        it('מכיל תוויות עבריות לכל מצב', () => {
            expect(EDIT_LOCK_LABELS[EDIT_LOCK_MODES.NONE]).toBeDefined();
            expect(EDIT_LOCK_LABELS[EDIT_LOCK_MODES.TWO_DAYS]).toBeDefined();
            expect(EDIT_LOCK_LABELS[EDIT_LOCK_MODES.CURRENT_WEEK]).toBeDefined();
            expect(EDIT_LOCK_LABELS[EDIT_LOCK_MODES.CURRENT_MONTH]).toBeDefined();
        });
    });

    // === NONE mode ===

    describe('NONE mode', () => {
        it('לעולם לא נעול', () => {
            const event = { start: new Date(2020, 0, 1) }; // שנה ישנה
            expect(isEventLocked(event, EDIT_LOCK_MODES.NONE)).toEqual({
                locked: false,
                reason: ''
            });
        });

        it('lockMode null = לא נעול', () => {
            const event = { start: new Date() };
            expect(isEventLocked(event, null).locked).toBe(false);
        });

        it('lockMode undefined = לא נעול', () => {
            const event = { start: new Date() };
            expect(isEventLocked(event, undefined).locked).toBe(false);
        });
    });

    // === TWO_DAYS mode ===

    describe('TWO_DAYS mode', () => {
        let realDateNow;

        beforeEach(() => {
            // קיבוע "היום" ל-15 בפברואר 2026
            realDateNow = vi.spyOn(Date, 'now');
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 15, 12, 0, 0));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('אירוע מהיום - לא נעול', () => {
            const event = { start: new Date(2026, 1, 15, 9, 0) };
            expect(isEventLocked(event, EDIT_LOCK_MODES.TWO_DAYS).locked).toBe(false);
        });

        it('אירוע מאתמול - לא נעול (יום 1)', () => {
            const event = { start: new Date(2026, 1, 14, 9, 0) };
            expect(isEventLocked(event, EDIT_LOCK_MODES.TWO_DAYS).locked).toBe(false);
        });

        it('אירוע מלפני יומיים - נעול', () => {
            const event = { start: new Date(2026, 1, 13, 9, 0) };
            const result = isEventLocked(event, EDIT_LOCK_MODES.TWO_DAYS);
            expect(result.locked).toBe(true);
            expect(result.reason).toContain('יומיים');
        });

        it('אירוע מלפני שבוע - נעול', () => {
            const event = { start: new Date(2026, 1, 8, 9, 0) };
            expect(isEventLocked(event, EDIT_LOCK_MODES.TWO_DAYS).locked).toBe(true);
        });

        it('אירוע עתידי - לא נעול', () => {
            const event = { start: new Date(2026, 1, 20, 9, 0) };
            expect(isEventLocked(event, EDIT_LOCK_MODES.TWO_DAYS).locked).toBe(false);
        });

        it('event.start null - לא נעול', () => {
            expect(isEventLocked({ start: null }, EDIT_LOCK_MODES.TWO_DAYS).locked).toBe(false);
        });
    });

    // === CURRENT_WEEK mode ===

    describe('CURRENT_WEEK mode', () => {
        beforeEach(() => {
            // 15 בפברואר 2026 = יום ראשון
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 15, 12, 0, 0));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('אירוע מהשבוע הנוכחי - לא נעול', () => {
            // 15/2/2026 = ראשון. שבוע: 15-21
            const event = { start: new Date(2026, 1, 17, 10, 0) }; // שלישי
            expect(isEventLocked(event, EDIT_LOCK_MODES.CURRENT_WEEK).locked).toBe(false);
        });

        it('אירוע ביום ראשון (תחילת שבוע) - לא נעול', () => {
            const event = { start: new Date(2026, 1, 15, 0, 1) };
            expect(isEventLocked(event, EDIT_LOCK_MODES.CURRENT_WEEK).locked).toBe(false);
        });

        it('אירוע ביום שבת (סוף שבוע) - לא נעול', () => {
            const event = { start: new Date(2026, 1, 21, 20, 0) };
            expect(isEventLocked(event, EDIT_LOCK_MODES.CURRENT_WEEK).locked).toBe(false);
        });

        it('אירוע משבוע שעבר - נעול', () => {
            const event = { start: new Date(2026, 1, 14, 10, 0) }; // שבת שעברה
            const result = isEventLocked(event, EDIT_LOCK_MODES.CURRENT_WEEK);
            expect(result.locked).toBe(true);
            expect(result.reason).toContain('שבוע');
        });

        it('אירוע משבוע הבא - נעול', () => {
            const event = { start: new Date(2026, 1, 22, 10, 0) }; // ראשון הבא
            expect(isEventLocked(event, EDIT_LOCK_MODES.CURRENT_WEEK).locked).toBe(true);
        });

        it('event.start null - לא נעול', () => {
            expect(isEventLocked({ start: null }, EDIT_LOCK_MODES.CURRENT_WEEK).locked).toBe(false);
        });
    });

    // === CURRENT_MONTH mode ===

    describe('CURRENT_MONTH mode', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 15, 12, 0, 0)); // פברואר 2026
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('אירוע מהחודש הנוכחי - לא נעול', () => {
            const event = { start: new Date(2026, 1, 1) };
            expect(isEventLocked(event, EDIT_LOCK_MODES.CURRENT_MONTH).locked).toBe(false);
        });

        it('אירוע ביום האחרון של החודש - לא נעול', () => {
            const event = { start: new Date(2026, 1, 28) };
            expect(isEventLocked(event, EDIT_LOCK_MODES.CURRENT_MONTH).locked).toBe(false);
        });

        it('אירוע מחודש שעבר - נעול', () => {
            const event = { start: new Date(2026, 0, 31) }; // ינואר
            const result = isEventLocked(event, EDIT_LOCK_MODES.CURRENT_MONTH);
            expect(result.locked).toBe(true);
            expect(result.reason).toContain('חודש');
        });

        it('אירוע מחודש הבא - נעול', () => {
            const event = { start: new Date(2026, 2, 1) }; // מרץ
            expect(isEventLocked(event, EDIT_LOCK_MODES.CURRENT_MONTH).locked).toBe(true);
        });

        it('אירוע מאותו חודש בשנה אחרת - נעול', () => {
            const event = { start: new Date(2025, 1, 15) }; // פברואר 2025
            expect(isEventLocked(event, EDIT_LOCK_MODES.CURRENT_MONTH).locked).toBe(true);
        });

        it('event.start null - לא נעול', () => {
            expect(isEventLocked({ start: null }, EDIT_LOCK_MODES.CURRENT_MONTH).locked).toBe(false);
        });
    });

    // === Default mode ===

    describe('unknown mode', () => {
        it('מצב לא מוכר - לא נעול', () => {
            const event = { start: new Date(2020, 0, 1) };
            expect(isEventLocked(event, 'unknown_mode').locked).toBe(false);
        });
    });
});
