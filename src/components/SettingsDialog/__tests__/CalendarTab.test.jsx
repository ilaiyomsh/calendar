import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarTab from '../CalendarTab';

describe('CalendarTab', () => {
    const defaultSettings = {
        showHolidays: true,
        showTemporaryEvents: true,
        monthlyHoursTarget: 182.5,
        weeklyHoursTarget: null,
        workdayLength: 8.5,
    };

    // C1: צ'קבוקס חגים
    it('מציג צ\'קבוקס חגים ישראליים — מסומן כברירת מחדל', () => {
        const onChange = vi.fn();
        render(<CalendarTab settings={defaultSettings} onChange={onChange} />);
        expect(screen.getByText('הצג חגים ישראליים')).toBeInTheDocument();
    });

    it('כיבוי חגים שולח showHolidays: false', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<CalendarTab settings={defaultSettings} onChange={onChange} />);

        const checkboxes = screen.getAllByRole('checkbox');
        // הראשון הוא חגים
        await user.click(checkboxes[0]);
        expect(onChange).toHaveBeenCalledWith({ showHolidays: false });
    });

    // C2: צ'קבוקס אירועים זמניים
    it('מציג צ\'קבוקס אירועים זמניים', () => {
        render(<CalendarTab settings={defaultSettings} onChange={vi.fn()} />);
        expect(screen.getByText('הצג אירועים זמניים בלוח')).toBeInTheDocument();
    });

    it('כיבוי אירועים זמניים שולח showTemporaryEvents: false', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<CalendarTab settings={defaultSettings} onChange={onChange} />);

        const checkboxes = screen.getAllByRole('checkbox');
        // השני הוא אירועים זמניים
        await user.click(checkboxes[1]);
        expect(onChange).toHaveBeenCalledWith({ showTemporaryEvents: false });
    });

    // C4-C6: יעדי שעות
    it('מציג שדות יעד שעות', () => {
        render(<CalendarTab settings={defaultSettings} onChange={vi.fn()} />);
        expect(screen.getByText('יעד שעות חודשי')).toBeInTheDocument();
        expect(screen.getByText('יעד שעות בחודש')).toBeInTheDocument();
        expect(screen.getByText('יעד שעות בשבוע')).toBeInTheDocument();
        expect(screen.getByText('אורך יום עבודה (שעות)')).toBeInTheDocument();
    });

    it('שינוי יעד שעות חודשי', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<CalendarTab settings={defaultSettings} onChange={onChange} />);

        const inputs = screen.getAllByRole('spinbutton');
        // הראשון הוא יעד חודשי
        await user.clear(inputs[0]);
        await user.type(inputs[0], '200');
        // onChange נקרא עם הערך החדש
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(lastCall).toHaveProperty('monthlyHoursTarget');
    });

    // showHolidays=false — צ'קבוקס לא מסומן
    it('showHolidays=false — צ\'קבוקס לא מסומן', () => {
        render(<CalendarTab settings={{ ...defaultSettings, showHolidays: false }} onChange={vi.fn()} />);
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes[0]).not.toBeChecked();
    });

    // showTemporaryEvents=false — צ'קבוקס לא מסומן
    it('showTemporaryEvents=false — צ\'קבוקס לא מסומן', () => {
        render(<CalendarTab settings={{ ...defaultSettings, showTemporaryEvents: false }} onChange={vi.fn()} />);
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes[1]).not.toBeChecked();
    });
});
