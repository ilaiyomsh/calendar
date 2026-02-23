import { describe, it, expect, vi, beforeEach } from 'vitest';


vi.mock('../../contexts/SettingsContext', () => ({
    STRUCTURE_MODES: {
        PROJECT_ONLY: 'project_only',
        PROJECT_WITH_STAGE: 'project_with_stage',
        PROJECT_WITH_TASKS: 'project_with_tasks',
        PROJECT_WITH_TASKS_AND_STAGE: 'project_with_tasks_and_stage'
    },
    FIELD_MODES: {
        REQUIRED: 'required',
        OPTIONAL: 'optional',
        HIDDEN: 'hidden'
    },
    TOGGLE_MODES: {
        VISIBLE: 'visible',
        HIDDEN: 'hidden'
    },
    DEFAULT_FIELD_CONFIG: {
        task: 'hidden',
        stage: 'hidden',
        notes: 'hidden',
        billableToggle: 'visible',
        nonBillableType: 'required'
    }
}));

import { validateSettings, formatValidationMessage } from '../settingsValidator';
import { STRUCTURE_MODES, DEFAULT_FIELD_CONFIG } from '../../contexts/SettingsContext';

// fieldConfig מתאים ל-structureMode (לתאימות בטסטים)
const fieldConfigForMode = (mode) => {
    const fc = { ...DEFAULT_FIELD_CONFIG };
    if (mode === STRUCTURE_MODES.PROJECT_WITH_TASKS) {
        fc.task = 'required';
    } else if (mode === STRUCTURE_MODES.PROJECT_WITH_STAGE) {
        fc.stage = 'required';
    }
    return fc;
};

describe('settingsValidator', () => {

    // === formatValidationMessage ===

    describe('formatValidationMessage', () => {
        it('מחזיר null כשהאימות תקין', () => {
            expect(formatValidationMessage({ isValid: true })).toBeNull();
        });

        it('מציג הגדרות חסרות', () => {
            const result = formatValidationMessage({
                isValid: false,
                missingSettings: [
                    { key: 'dateColumnId', label: 'עמודת תאריך התחלה' },
                    { key: 'projectColumnId', label: 'עמודת פרויקט' }
                ],
                missingBoards: [],
                missingColumns: []
            });

            expect(result).toContain('הגדרות חסרות');
            expect(result).toContain('עמודת תאריך התחלה');
            expect(result).toContain('עמודת פרויקט');
        });

        it('מציג לוחות לא נמצאו', () => {
            const result = formatValidationMessage({
                isValid: false,
                missingSettings: [],
                missingBoards: [
                    { key: 'connectedBoardId', label: 'לוח פרויקטים', boardId: '123' }
                ],
                missingColumns: []
            });

            expect(result).toContain('לוחות לא נמצאו');
            expect(result).toContain('לוח פרויקטים');
        });

        it('מציג עמודות לא נמצאו', () => {
            const result = formatValidationMessage({
                isValid: false,
                missingSettings: [],
                missingBoards: [],
                missingColumns: [
                    { columnId: 'col1', settingKey: 'dateColumnId', label: 'עמודת תאריך התחלה' }
                ]
            });

            expect(result).toContain('עמודות לא נמצאו בלוח');
            expect(result).toContain('עמודת תאריך התחלה');
        });

        it('מציג שילוב של כל סוגי הבעיות', () => {
            const result = formatValidationMessage({
                isValid: false,
                missingSettings: [{ key: 'a', label: 'הגדרה א' }],
                missingBoards: [{ key: 'b', label: 'לוח ב', boardId: '1' }],
                missingColumns: [{ columnId: 'c', settingKey: 'd', label: 'עמודה ג' }]
            });

            expect(result).toContain('הגדרות חסרות');
            expect(result).toContain('לוחות לא נמצאו');
            expect(result).toContain('עמודות לא נמצאו בלוח');
        });
    });

    // === validateSettings ===

    describe('validateSettings', () => {
        let mockMonday;

        beforeEach(() => {
            mockMonday = {
                api: vi.fn().mockResolvedValue({
                    data: {
                        boards: [{
                            id: '123',
                            name: 'Test Board',
                            columns: [
                                { id: 'date_col', title: 'Date' },
                                { id: 'end_col', title: 'End' },
                                { id: 'dur_col', title: 'Duration' },
                                { id: 'proj_col', title: 'Project' },
                                { id: 'rep_col', title: 'Reporter' },
                                { id: 'type_col', title: 'Type' },
                                { id: 'notes_col', title: 'Notes' }
                            ]
                        }]
                    }
                })
            };
        });

        it('מחזיר isValid=false כשאין settings', async () => {
            const result = await validateSettings(mockMonday, null, '123');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('לא נמצאו הגדרות מותאמות');
        });

        it('מחזיר isValid=true כשכל ההגדרות תקינות', async () => {
            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_ONLY,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_ONLY),
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col',
                connectedBoardId: '456'
            };

            const result = await validateSettings(mockMonday, settings, '123');
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('מזהה הגדרות חסרות', async () => {
            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_ONLY,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_ONLY),
                // חסרים: dateColumnId, endTimeColumnId, durationColumnId, projectColumnId, reporterColumnId
                connectedBoardId: '456'
            };

            const result = await validateSettings(mockMonday, settings, '123');
            expect(result.isValid).toBe(false);
            expect(result.missingSettings.length).toBeGreaterThan(0);
        });

        it('דורש tasksBoardId ו-taskColumnId במצב PROJECT_WITH_TASKS', async () => {
            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_WITH_TASKS,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_WITH_TASKS),
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col',
                connectedBoardId: '456'
                // חסרים: tasksBoardId, taskColumnId
            };

            const result = await validateSettings(mockMonday, settings, '123');
            expect(result.isValid).toBe(false);
            const missingKeys = result.missingSettings.map(s => s.key);
            expect(missingKeys).toContain('tasksBoardId');
            expect(missingKeys).toContain('taskColumnId');
        });

        it('דורש stageColumnId במצב PROJECT_WITH_STAGE', async () => {
            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_WITH_STAGE,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_WITH_STAGE),
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col',
                connectedBoardId: '456'
                // חסר: stageColumnId
            };

            const result = await validateSettings(mockMonday, settings, '123');
            expect(result.isValid).toBe(false);
            const missingKeys = result.missingSettings.map(s => s.key);
            expect(missingKeys).toContain('stageColumnId');
        });

        it('לא דורש connectedBoardId במצב Assignments', async () => {
            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_ONLY,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_ONLY),
                useAssignmentsMode: true,
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col'
            };

            const result = await validateSettings(mockMonday, settings, '123');
            // לא צריך connectedBoardId, אז ההגדרות הנדרשות תקינות
            expect(result.missingSettings.find(s => s.key === 'connectedBoardId')).toBeUndefined();
        });

        it('מזהה לוח פרויקטים שלא קיים', async () => {
            mockMonday.api.mockResolvedValue({
                data: { boards: [] } // לוח לא נמצא
            });

            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_ONLY,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_ONLY),
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col',
                connectedBoardId: '999'
            };

            const result = await validateSettings(mockMonday, settings, '123');
            expect(result.isValid).toBe(false);
            expect(result.missingBoards.length).toBeGreaterThan(0);
        });

        it('מזהה עמודות חסרות בלוח', async () => {
            // הלוח מחזיר רק חלק מהעמודות
            mockMonday.api.mockResolvedValue({
                data: {
                    boards: [{
                        id: '123',
                        name: 'Test Board',
                        columns: [
                            { id: 'date_col', title: 'Date' }
                            // חסרות: end_col, dur_col, proj_col, rep_col
                        ]
                    }]
                }
            });

            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_ONLY,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_ONLY),
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col',
                connectedBoardId: '456'
            };

            const result = await validateSettings(mockMonday, settings, '123');
            expect(result.isValid).toBe(false);
            expect(result.missingColumns.length).toBeGreaterThan(0);
        });

        it('מוסיף אזהרה כשאין eventTypeStatusColumnId', async () => {
            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_ONLY,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_ONLY),
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col',
                connectedBoardId: '456'
            };

            const result = await validateSettings(mockMonday, settings, '123');
            expect(result.warnings.some(w => w.includes('סוג דיווח'))).toBe(true);
        });

        it('מוסיף אזהרה כשיש eventTypeStatus אבל אין mapping', async () => {
            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_ONLY,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_ONLY),
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col',
                connectedBoardId: '456',
                eventTypeStatusColumnId: 'type_col'
                // חסר: eventTypeMapping
            };

            const result = await validateSettings(mockMonday, settings, '123');
            expect(result.warnings.some(w => w.includes('מיפוי סוגי דיווח'))).toBe(true);
        });

        it('מוסיף אזהרה כש-notes פעיל ללא notesColumnId', async () => {
            const fc = fieldConfigForMode(STRUCTURE_MODES.PROJECT_ONLY);
            fc.notes = 'optional';
            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_ONLY,
                fieldConfig: fc,
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col',
                connectedBoardId: '456'
                // חסר: notesColumnId
            };

            const result = await validateSettings(mockMonday, settings, '123');
            expect(result.warnings.some(w => w.includes('הערות'))).toBe(true);
        });

        it('לא בודק עמודות אם אין currentBoardId', async () => {
            const settings = {
                structureMode: STRUCTURE_MODES.PROJECT_ONLY,
                fieldConfig: fieldConfigForMode(STRUCTURE_MODES.PROJECT_ONLY),
                dateColumnId: 'date_col',
                endTimeColumnId: 'end_col',
                durationColumnId: 'dur_col',
                projectColumnId: 'proj_col',
                reporterColumnId: 'rep_col',
                connectedBoardId: '456'
            };

            const result = await validateSettings(mockMonday, settings, null);
            // ללא currentBoardId, לא בודק עמודות - רק הגדרות
            expect(result.missingColumns).toHaveLength(0);
        });
    });
});
