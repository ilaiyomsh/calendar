/**
 * פונקציות אגרגציה לדשבורד - Pure functions, ללא React
 * מחשבות סטטיסטיקות, קיבוץ לפי גרנולריות, ונתוני עוגה
 */

import { startOfWeek, format, getISOWeek } from 'date-fns';
import { he } from 'date-fns/locale';

/**
 * חילוץ שעות מאירוע דשבורד
 * @param {Object} event - DashboardEvent
 * @returns {number}
 */
export const getEventHours = (event) => {
    return event?.hours || 0;
};

/**
 * חישוב סטטיסטיקות כלליות
 * @param {Array} events - רשימת DashboardEvent
 * @returns {{ totalHours: number, billableHours: number, nonBillableHours: number, billablePercent: number }}
 */
export const calcStats = (events) => {
    if (!events || events.length === 0) {
        return { totalHours: 0, billableHours: 0, nonBillableHours: 0, billablePercent: 0 };
    }

    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;

    for (const event of events) {
        const hours = getEventHours(event);
        totalHours += hours;
        if (event.isBillable) {
            billableHours += hours;
        } else {
            nonBillableHours += hours;
        }
    }

    const billablePercent = totalHours > 0
        ? Math.round((billableHours / totalHours) * 100)
        : 0;

    return {
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        nonBillableHours: Math.round(nonBillableHours * 100) / 100,
        billablePercent
    };
};

/**
 * קיבוץ אירועים לפי גרנולריות זמן
 * @param {Array} events - רשימת DashboardEvent
 * @param {'day'|'week'|'month'|'year'} granularity
 * @returns {Array<{ key: string, label: string, hours: number }>}
 */
export const groupByGranularity = (events, granularity) => {
    if (!events || events.length === 0) return [];

    const groups = {};

    for (const event of events) {
        const date = event.date;
        if (!date) continue;

        let key, label;

        switch (granularity) {
            case 'day': {
                const d = String(date.getDate()).padStart(2, '0');
                const m = String(date.getMonth() + 1).padStart(2, '0');
                key = `${date.getFullYear()}-${m}-${d}`;
                label = `${d}/${m}`;
                break;
            }
            case 'week': {
                const weekStart = startOfWeek(date, { weekStartsOn: 0 });
                const weekNum = getISOWeek(date);
                const yr = String(date.getFullYear()).slice(-2);
                key = `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
                label = `W${weekNum}'${yr}`;
                break;
            }
            case 'month': {
                const m = String(date.getMonth() + 1).padStart(2, '0');
                key = `${date.getFullYear()}-${m}`;
                label = `${m}/${String(date.getFullYear()).slice(-2)}`;
                break;
            }
            case 'year': {
                key = String(date.getFullYear());
                label = key;
                break;
            }
            default:
                continue;
        }

        if (!groups[key]) {
            groups[key] = { key, label, hours: 0 };
        }
        groups[key].hours += getEventHours(event);
    }

    // מיון לפי key כרונולוגי
    return Object.values(groups)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(g => ({ ...g, hours: Math.round(g.hours * 100) / 100 }));
};

/**
 * בניית נתונים לתרשים עוגה
 * @param {Array} events - רשימת DashboardEvent (כבר מסוננים לקטגוריה)
 * @param {'billable'|'nonBillable'} type - סוג הקיבוץ
 * @returns {Array<{ name: string, value: number, color: string }>}
 */
export const buildPieData = (events, type) => {
    if (!events || events.length === 0) return [];

    const groups = {};

    for (const event of events) {
        // קיבוץ לפי לייבל — billable: stageLabel, nonBillable: nonBillableType
        const groupKey = type === 'nonBillable'
            ? (event.nonBillableType || 'אחר')
            : (event.stageLabel || event.eventTypeLabel || 'לחיוב');
        const color = type === 'nonBillable'
            ? (event.nonBillableColor || event.eventTypeColor || '#0073ea')
            : (event.stageColor || event.eventTypeColor || '#0073ea');

        if (!groups[groupKey]) {
            groups[groupKey] = { name: groupKey, value: 0, color };
        }
        groups[groupKey].value += getEventHours(event);
    }

    return Object.values(groups)
        .map(g => ({ ...g, value: Math.round(g.value * 100) / 100 }))
        .sort((a, b) => b.value - a.value);
};

/**
 * אגרגציה משולבת — מעבר יחיד על המערך
 * מחשב stats + פיצול billable/nonBillable + קיבוץ גרנולריות + pie data בבת אחת
 * @param {Array} events - רשימת DashboardEvent מסוננת
 * @param {'day'|'week'|'month'|'year'} granularity
 * @returns {{ stats, barData, billablePieData, nonBillablePieData }}
 */
export const aggregateAll = (events, granularity) => {
    if (!events || events.length === 0) {
        return {
            stats: { totalHours: 0, billableHours: 0, nonBillableHours: 0, billablePercent: 0 },
            barData: [],
            billablePieData: [],
            nonBillablePieData: []
        };
    }

    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;
    const granularityGroups = {};
    const billablePieGroups = {};
    const nonBillablePieGroups = {};

    for (const event of events) {
        const hours = event?.hours || 0;
        totalHours += hours;

        // פיצול billable / non-billable + pie groups
        if (event.isBillable) {
            billableHours += hours;
            // קיבוץ לפי stageLabel (עמודת סיווג) עם צבע מהעמודה, fallback ל-eventTypeLabel
            const groupKey = event.stageLabel || event.eventTypeLabel || 'לחיוב';
            const color = event.stageColor || event.eventTypeColor || '#0073ea';
            if (!billablePieGroups[groupKey]) {
                billablePieGroups[groupKey] = { name: groupKey, value: 0, color };
            }
            billablePieGroups[groupKey].value += hours;
        } else {
            nonBillableHours += hours;
            // קיבוץ לפי nonBillableType עם צבע מעמודת nonBillableStatus
            const groupKey = event.nonBillableType || 'אחר';
            const color = event.nonBillableColor || event.eventTypeColor || '#0073ea';
            if (!nonBillablePieGroups[groupKey]) {
                nonBillablePieGroups[groupKey] = { name: groupKey, value: 0, color };
            }
            nonBillablePieGroups[groupKey].value += hours;
        }

        // קיבוץ גרנולריות
        const date = event.date;
        if (!date) continue;

        let key, label;
        switch (granularity) {
            case 'day': {
                const d = String(date.getDate()).padStart(2, '0');
                const m = String(date.getMonth() + 1).padStart(2, '0');
                key = `${date.getFullYear()}-${m}-${d}`;
                label = `${d}/${m}`;
                break;
            }
            case 'week': {
                const weekStart = startOfWeek(date, { weekStartsOn: 0 });
                const weekNum = getISOWeek(date);
                const yr = String(date.getFullYear()).slice(-2);
                key = `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
                label = `W${weekNum}'${yr}`;
                break;
            }
            case 'month': {
                const m = String(date.getMonth() + 1).padStart(2, '0');
                key = `${date.getFullYear()}-${m}`;
                label = `${m}/${String(date.getFullYear()).slice(-2)}`;
                break;
            }
            case 'year': {
                key = String(date.getFullYear());
                label = key;
                break;
            }
            default:
                continue;
        }
        if (!granularityGroups[key]) {
            granularityGroups[key] = { key, label, hours: 0 };
        }
        granularityGroups[key].hours += hours;
    }

    const billablePercent = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;
    const round2 = v => Math.round(v * 100) / 100;

    return {
        stats: {
            totalHours: round2(totalHours),
            billableHours: round2(billableHours),
            nonBillableHours: round2(nonBillableHours),
            billablePercent
        },
        barData: Object.values(granularityGroups)
            .sort((a, b) => a.key.localeCompare(b.key))
            .map(g => ({ ...g, hours: round2(g.hours) })),
        billablePieData: Object.values(billablePieGroups)
            .map(g => ({ ...g, value: round2(g.value) }))
            .sort((a, b) => b.value - a.value),
        nonBillablePieData: Object.values(nonBillablePieGroups)
            .map(g => ({ ...g, value: round2(g.value) }))
            .sort((a, b) => b.value - a.value)
    };
};
