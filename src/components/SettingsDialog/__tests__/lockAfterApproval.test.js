import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isEventLocked, EDIT_LOCK_MODES } from '../../../utils/editLockUtils';

/**
 * בדיקות lockAfterApproval
 * הלוגיקה נמצאת ב-MondayCalendar.jsx (enrichedEvents useMemo).
 * כאן מדמים את אותה לוגיקה בנפרד לבדיקה.
 */

// שחזור הלוגיקה מ-MondayCalendar.jsx enrichedEvents
function computeEventLock(event, settings, isManager) {
    const lockMode = settings.editLockMode || 'none';
    const managerBypass = isManager;
    const isApprovalEnabled = !!settings.enableApproval;
    const lockAfterApproval = !!settings.lockAfterApproval;

    let lockResult = (!managerBypass && lockMode !== 'none')
        ? isEventLocked(event, lockMode)
        : { locked: false, reason: '' };

    // נעילה לאחר אישור מנהל
    if (!lockResult.locked && lockAfterApproval && isApprovalEnabled && !managerBypass) {
        if (event.isApprovedBillable || event.isApprovedUnbillable) {
            lockResult = { locked: true, reason: 'הדיווח נעול - אושר ע"י מנהל' };
        }
    }

    return lockResult;
}

describe('lockAfterApproval', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 1, 15, 12, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const approvedEvent = {
        start: new Date(2026, 1, 15, 9, 0),
        isApprovedBillable: true,
        isApprovedUnbillable: false,
        isPending: false
    };

    const approvedUnbillableEvent = {
        start: new Date(2026, 1, 15, 9, 0),
        isApprovedBillable: false,
        isApprovedUnbillable: true,
        isPending: false
    };

    const pendingEvent = {
        start: new Date(2026, 1, 15, 9, 0),
        isApprovedBillable: false,
        isApprovedUnbillable: false,
        isPending: true
    };

    const regularEvent = {
        start: new Date(2026, 1, 15, 9, 0),
        isApprovedBillable: false,
        isApprovedUnbillable: false,
        isPending: false
    };

    // L1: enableApproval=true, lockAfterApproval=true, אירוע מאושר
    it('אירוע מאושר (billable) נעול כש-lockAfterApproval פעיל', () => {
        const settings = { enableApproval: true, lockAfterApproval: true, editLockMode: 'none' };
        const result = computeEventLock(approvedEvent, settings, false);
        expect(result.locked).toBe(true);
        expect(result.reason).toContain('אושר');
    });

    // אירוע מאושר (unbillable)
    it('אירוע מאושר (unbillable) נעול כש-lockAfterApproval פעיל', () => {
        const settings = { enableApproval: true, lockAfterApproval: true, editLockMode: 'none' };
        const result = computeEventLock(approvedUnbillableEvent, settings, false);
        expect(result.locked).toBe(true);
        expect(result.reason).toContain('אושר');
    });

    // L2: enableApproval=true, lockAfterApproval=true, אירוע ממתין
    it('אירוע ממתין לא נעול גם כש-lockAfterApproval פעיל', () => {
        const settings = { enableApproval: true, lockAfterApproval: true, editLockMode: 'none' };
        const result = computeEventLock(pendingEvent, settings, false);
        expect(result.locked).toBe(false);
    });

    // L3: enableApproval=true, lockAfterApproval=false, אירוע מאושר
    it('אירוע מאושר לא נעול כש-lockAfterApproval כבוי', () => {
        const settings = { enableApproval: true, lockAfterApproval: false, editLockMode: 'none' };
        const result = computeEventLock(approvedEvent, settings, false);
        expect(result.locked).toBe(false);
    });

    // L4: enableApproval=false, lockAfterApproval=true
    it('lockAfterApproval מתעלם כש-enableApproval כבוי', () => {
        const settings = { enableApproval: false, lockAfterApproval: true, editLockMode: 'none' };
        const result = computeEventLock(approvedEvent, settings, false);
        expect(result.locked).toBe(false);
    });

    // L5: מנהל מורשה — bypass
    it('מנהל מורשה לא נעול גם כש-lockAfterApproval פעיל', () => {
        const settings = { enableApproval: true, lockAfterApproval: true, editLockMode: 'none' };
        const result = computeEventLock(approvedEvent, settings, true);
        expect(result.locked).toBe(false);
    });

    // L6: lockAfterApproval + editLockMode=current_week + אירוע ישן מאושר
    it('editLockMode קודם ל-lockAfterApproval (אירוע ישן מאושר)', () => {
        const oldApprovedEvent = {
            start: new Date(2026, 1, 1, 9, 0), // תחילת חודש — מחוץ לשבוע
            isApprovedBillable: true,
            isApprovedUnbillable: false
        };
        const settings = {
            enableApproval: true,
            lockAfterApproval: true,
            editLockMode: EDIT_LOCK_MODES.CURRENT_WEEK
        };
        const result = computeEventLock(oldApprovedEvent, settings, false);
        expect(result.locked).toBe(true);
        // הסיבה צריכה להיות מ-editLockMode (שבוע), לא מ-lockAfterApproval
        expect(result.reason).toContain('שבוע');
    });

    // L7: משתמש קיים שלא הגדיר lockAfterApproval (undefined)
    it('lockAfterApproval undefined — ברירת מחדל false, לא נועל', () => {
        const settings = { enableApproval: true, editLockMode: 'none' };
        // lockAfterApproval אינו מוגדר כלל
        const result = computeEventLock(approvedEvent, settings, false);
        expect(result.locked).toBe(false);
    });

    // אירוע רגיל (לא מאושר, לא ממתין) לא נעול
    it('אירוע רגיל לא נעול', () => {
        const settings = { enableApproval: true, lockAfterApproval: true, editLockMode: 'none' };
        const result = computeEventLock(regularEvent, settings, false);
        expect(result.locked).toBe(false);
    });

    // lockAfterApproval + editLockMode=none + אירוע מאושר בלוח = נעול
    it('lockAfterApproval פועל גם כש-editLockMode=none', () => {
        const settings = {
            enableApproval: true,
            lockAfterApproval: true,
            editLockMode: EDIT_LOCK_MODES.NONE
        };
        const result = computeEventLock(approvedEvent, settings, false);
        expect(result.locked).toBe(true);
        expect(result.reason).toContain('אושר');
    });
});
