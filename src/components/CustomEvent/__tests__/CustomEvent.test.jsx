import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomEvent from '../CustomEvent';

// אירוע שעתי בסיסי
const timedEvent = {
    title: 'פגישת צוות',
    start: new Date(2026, 1, 15, 10, 0),
    end: new Date(2026, 1, 15, 12, 0),
    allDay: false,
    projectId: '123'
};

// אירוע יומי (חופשה)
const allDayEvent = {
    title: 'חופשה',
    start: new Date(2026, 1, 15),
    end: new Date(2026, 1, 16),
    allDay: true,
    eventType: 'חופשה'
};

describe('CustomEvent', () => {

    // === רינדור בסיסי ===

    it('מציג את כותרת האירוע', () => {
        render(<CustomEvent event={timedEvent} />);
        expect(screen.getByText('פגישת צוות')).toBeInTheDocument();
    });

    it('מציג טווח שעות לאירוע שעתי', () => {
        render(<CustomEvent event={timedEvent} />);
        // RTL: end - start
        expect(screen.getByText('12:00 - 10:00')).toBeInTheDocument();
    });

    it('לא מציג שעות לאירוע יומי', () => {
        render(<CustomEvent event={allDayEvent} />);
        expect(screen.queryByText(/\d{2}:\d{2} - \d{2}:\d{2}/)).not.toBeInTheDocument();
    });

    // === הערות ===

    it('מציג הערות לאירוע שעתי', () => {
        render(<CustomEvent event={{ ...timedEvent, notes: 'הערה חשובה' }} />);
        expect(screen.getByText('הערה חשובה')).toBeInTheDocument();
    });

    it('לא מציג הערות לאירוע יומי', () => {
        render(<CustomEvent event={{ ...allDayEvent, notes: 'הערה' }} />);
        expect(screen.queryByText('הערה')).not.toBeInTheDocument();
    });

    // === CSS Classes ===

    it('מוסיף class לאירוע יומי', () => {
        const { container } = render(<CustomEvent event={allDayEvent} />);
        expect(container.firstChild.className).toContain('gc-event-allday');
    });

    it('לא מוסיף class allDay לאירוע שעתי', () => {
        const { container } = render(<CustomEvent event={timedEvent} />);
        expect(container.firstChild.className).not.toContain('gc-event-allday');
    });

    it('מוסיף class לאירוע קצר (30 דקות או פחות)', () => {
        const shortEvent = {
            ...timedEvent,
            end: new Date(2026, 1, 15, 10, 30) // 30 דקות
        };
        const { container } = render(<CustomEvent event={shortEvent} />);
        expect(container.firstChild.className).toContain('gc-event-short');
    });

    it('לא מוסיף class short לאירוע ארוך', () => {
        const { container } = render(<CustomEvent event={timedEvent} />);
        expect(container.firstChild.className).not.toContain('gc-event-short');
    });

    it('מוסיף class לאירוע נבחר', () => {
        const { container } = render(
            <CustomEvent event={{ ...timedEvent, isSelected: true }} />
        );
        expect(container.firstChild.className).toContain('gc-event-selected');
    });

    it('מוסיף class לחג', () => {
        const { container } = render(
            <CustomEvent event={{ ...timedEvent, isHoliday: true, holidayType: 'MAJOR' }} />
        );
        expect(container.firstChild.className).toContain('gc-event-holiday');
    });

    it('מוסיף class לאירוע מתוכנן', () => {
        const { container } = render(
            <CustomEvent event={{ ...timedEvent, isTemporary: true }} />
        );
        expect(container.firstChild.className).toContain('gc-event-temporary');
    });

    it('מוסיף class לאירוע שנבחר לאישור', () => {
        const { container } = render(
            <CustomEvent event={{ ...timedEvent, isApprovalSelected: true }} />
        );
        expect(container.firstChild.className).toContain('gc-event-approval-selected');
    });

    // === סטטוס אישור ===

    it('מציג X אדום לאירוע שנדחה', () => {
        render(<CustomEvent event={{ ...timedEvent, isRejected: true }} />);
        expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('לא מציג X כשלא נדחה', () => {
        render(<CustomEvent event={timedEvent} />);
        expect(screen.queryByText('✕')).not.toBeInTheDocument();
    });

    it('מציג checkbox ריק במצב בחירה לאישור', () => {
        render(
            <CustomEvent event={{
                ...timedEvent,
                isInApprovalSelection: true,
                isApprovalSelected: false
            }} />
        );
        // ☐ = \u2610
        expect(screen.getByText('\u2610')).toBeInTheDocument();
    });

    it('מציג checkbox מסומן כשנבחר לאישור', () => {
        render(
            <CustomEvent event={{
                ...timedEvent,
                isInApprovalSelection: true,
                isApprovalSelected: true
            }} />
        );
        // ☑ = \u2611
        expect(screen.getByText('\u2611')).toBeInTheDocument();
    });

    it('לא מציג checkbox כשלא במצב בחירה', () => {
        render(<CustomEvent event={timedEvent} />);
        expect(screen.queryByText('\u2610')).not.toBeInTheDocument();
        expect(screen.queryByText('\u2611')).not.toBeInTheDocument();
    });

    // === סגנונות ===

    it('מחיל opacity חצי שקוף לאירוע ממתין', () => {
        const { container } = render(
            <CustomEvent event={{ ...timedEvent, isPending: true }} />
        );
        expect(container.firstChild.style.opacity).toBe('0.5');
    });

    it('מחיל opacity מלא לאירוע רגיל', () => {
        const { container } = render(
            <CustomEvent event={timedEvent} />
        );
        expect(container.firstChild.style.opacity).toBe('1');
    });

    it('מחיל רקע שקוף לאירוע מתוכנן', () => {
        const { container } = render(
            <CustomEvent event={{ ...timedEvent, isTemporary: true }} />
        );
        expect(container.firstChild.style.backgroundColor).toBe('transparent');
    });

    it('מחיל רקע צבעוני לאירוע רגיל', () => {
        const { container } = render(
            <CustomEvent event={timedEvent} />
        );
        // צבע מבוסס על projectId, צריך להיות hex
        expect(container.firstChild.style.backgroundColor).not.toBe('transparent');
        expect(container.firstChild.style.backgroundColor).toBeTruthy();
    });
});
