import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettingsValidation } from '../useSettingsValidation';

// הגדרות בסיסיות תקינות (מינימום חובה)
const validSettings = {
    structureMode: 'PROJECT_ONLY',
    fieldConfig: {
        task: 'hidden',
        stage: 'hidden',
        notes: 'hidden',
        billableToggle: 'visible',
        nonBillableType: 'required',
    },
    useCurrentBoardForReporting: true,
    connectedBoardId: 'board1',
    peopleColumnIds: ['person1'],
    dateColumnId: 'date1',
    endTimeColumnId: 'endDate1',
    durationColumnId: 'dur1',
    projectColumnId: 'proj1',
    reporterColumnId: 'rep1',
    eventTypeStatusColumnId: 'status1',
    nonBillableStatusColumnId: 'nb1',
    eventTypeMapping: {
        '0': 'hourly',
        '1': 'vacation',
        '2': 'sick',
        '3': 'reserves',
        '4': 'non_billable',
        '5': 'temporary',
    },
    enableApproval: false,
};

const context = { boardId: '12345' };

describe('useSettingsValidation — approval', () => {

    // כש-enableApproval כבוי — אין שגיאות approval
    it('enableApproval=false — אין שגיאות אישור', () => {
        const { result } = renderHook(() =>
            useSettingsValidation({ ...validSettings, enableApproval: false }, context)
        );
        expect(result.current.errors.approvalStatusColumnId).toBeUndefined();
        expect(result.current.errors.approvalStatusMapping).toBeUndefined();
    });

    // כש-enableApproval פעיל — חובה עמודת סטטוס אישור
    it('enableApproval=true ללא approvalStatusColumnId — שגיאה', () => {
        const { result } = renderHook(() =>
            useSettingsValidation({
                ...validSettings,
                enableApproval: true,
                approvalStatusColumnId: null,
            }, context)
        );
        expect(result.current.errors.approvalStatusColumnId).toBeDefined();
        expect(result.current.isValid).toBe(false);
    });

    // כש-enableApproval פעיל + עמודה + ללא מיפוי — שגיאה
    it('enableApproval=true עם approvalStatusColumnId ללא מיפוי — שגיאה', () => {
        const { result } = renderHook(() =>
            useSettingsValidation({
                ...validSettings,
                enableApproval: true,
                approvalStatusColumnId: 'approval_col',
                approvalStatusMapping: null,
            }, context)
        );
        expect(result.current.errors.approvalStatusMapping).toBeDefined();
    });

    // כש-enableApproval פעיל + עמודה + מיפוי ריק — שגיאה
    it('enableApproval=true עם מיפוי ריק — שגיאה', () => {
        const { result } = renderHook(() =>
            useSettingsValidation({
                ...validSettings,
                enableApproval: true,
                approvalStatusColumnId: 'approval_col',
                approvalStatusMapping: {},
            }, context)
        );
        expect(result.current.errors.approvalStatusMapping).toBeDefined();
    });

    // כש-enableApproval פעיל + עמודה + מיפוי תקין — אין שגיאה
    it('enableApproval=true עם מיפוי תקין — ללא שגיאות', () => {
        const { result } = renderHook(() =>
            useSettingsValidation({
                ...validSettings,
                enableApproval: true,
                approvalStatusColumnId: 'approval_col',
                approvalStatusMapping: {
                    '0': 'pending',
                    '1': 'approved',
                    '2': 'rejected',
                },
            }, context)
        );
        expect(result.current.errors.approvalStatusColumnId).toBeUndefined();
        expect(result.current.errors.approvalStatusMapping).toBeUndefined();
    });

    // מיפוי לא תקין — חסר pending
    it('מיפוי חסר pending — שגיאה', () => {
        const { result } = renderHook(() =>
            useSettingsValidation({
                ...validSettings,
                enableApproval: true,
                approvalStatusColumnId: 'approval_col',
                approvalStatusMapping: {
                    '1': 'approved',
                    '2': 'rejected',
                },
            }, context)
        );
        expect(result.current.errors.approvalStatusMapping).toBeDefined();
    });

    // שגיאות approval ממופות ל-tab 'additional' (נבדק ב-SettingsDialog)
    it('מפתחות שגיאה של approval נמצאים בתשובה', () => {
        const { result } = renderHook(() =>
            useSettingsValidation({
                ...validSettings,
                enableApproval: true,
                approvalStatusColumnId: null,
                approvalStatusMapping: null,
            }, context)
        );
        expect('approvalStatusColumnId' in result.current.errors).toBe(true);
    });
});
