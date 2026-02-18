import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getEffectiveBoardId } from '../utils/boardIdResolver';
import { getCategory, isTemporaryIndex, isAllDayIndex, getLabelText } from '../utils/eventTypeMapping';
import { parseStatusColumnLabels } from '../utils/eventTypeValidation';
import { toLocalDateFormat } from '../utils/dateFormatters';
import logger from '../utils/logger';

/**
 * Hook לחישוב שעות לפי טווח התצוגה הנוכחי בלוח
 * מקבל viewRange (start, end) ו-calendarView ומחשב breakdown + יעד דינמי
 */
export const useMonthlyHours = (monday, context, viewRange, calendarView) => {
    const { customSettings } = useSettings();
    const [breakdown, setBreakdown] = useState([]);
    const [totalHours, setTotalHours] = useState(0);
    const [loading, setLoading] = useState(false);

    const effectiveBoardId = useMemo(() =>
        getEffectiveBoardId(customSettings, context),
        [customSettings, context]
    );

    const monthlyTarget = customSettings.monthlyHoursTarget ?? 182.5;
    const weeklyTarget = customSettings.weeklyHoursTarget ?? (monthlyTarget / 4.33);
    const workdayLength = customSettings.workdayLength ?? 8.5;
    const mapping = customSettings.eventTypeMapping;
    const labelMeta = customSettings.eventTypeLabelMeta;
    const dateColumnId = customSettings.dateColumnId;
    const durationColumnId = customSettings.durationColumnId;
    const eventTypeColumnId = customSettings.eventTypeStatusColumnId;
    const reporterColumnId = customSettings.reporterColumnId;

    // חישוב יעד דינמי לפי סוג תצוגה
    const targetHours = useMemo(() => {
        if (calendarView === 'month') return monthlyTarget;
        if (calendarView === 'day') return weeklyTarget / 5;
        // week, work_week, three_day
        return weeklyTarget;
    }, [calendarView, monthlyTarget, weeklyTarget]);

    // ייצוב ה-viewRange כדי למנוע רינדורים מיותרים
    const rangeStart = viewRange?.start?.getTime() || 0;
    const rangeEnd = viewRange?.end?.getTime() || 0;

    // Ref למניעת race conditions
    const fetchIdRef = useRef(0);

    const fetchData = useCallback(async () => {
        if (!effectiveBoardId || !dateColumnId || !durationColumnId || !eventTypeColumnId || !mapping || !rangeStart || !rangeEnd) {
            setBreakdown([]);
            setTotalHours(0);
            return;
        }

        const fetchId = ++fetchIdRef.current;
        setLoading(true);

        try {
            const fromDateStr = toLocalDateFormat(viewRange.start);
            const toDateStr = toLocalDateFormat(viewRange.end);

            // בניית חוקי סינון
            const rules = [
                `{ column_id: "${dateColumnId}", compare_value: ["${fromDateStr}", "${toDateStr}"], operator: between }`
            ];

            if (reporterColumnId) {
                rules.push(
                    `{ column_id: "${reporterColumnId}", compare_value: ["assigned_to_me"], operator: any_of }`
                );
            }

            const rulesStr = rules.join(',\n');

            // שליפה מקבילה: אירועים + צבעי עמודה
            const colorsQuery = `query {
                boards (ids: [${effectiveBoardId}]) {
                    columns (ids: ["${eventTypeColumnId}"]) {
                        settings_str
                    }
                }
            }`;

            const firstPageQuery = `query {
                boards (ids: [${effectiveBoardId}]) {
                    items_page (
                        limit: 500,
                        query_params: {
                            rules: [${rulesStr}],
                            operator: and
                        }
                    ) {
                        cursor
                        items {
                            id
                            column_values (ids: ["${eventTypeColumnId}", "${durationColumnId}"]) {
                                id
                                value
                            }
                        }
                    }
                }
            }`;

            const [colorsRes, firstPageRes] = await Promise.all([
                monday.api(colorsQuery),
                monday.api(firstPageQuery)
            ]);

            if (fetchId !== fetchIdRef.current) return;

            // בניית מפת צבעים מהעמודה
            const freshColorMap = {};
            const settingsStr = colorsRes?.data?.boards?.[0]?.columns?.[0]?.settings_str;
            if (settingsStr) {
                const columnLabels = parseStatusColumnLabels(settingsStr);
                for (const lbl of columnLabels) {
                    freshColorMap[String(lbl.index)] = lbl.color || '';
                }
            }

            // איסוף כל הפריטים (עם pagination)
            let allItems = [];
            const firstPage = firstPageRes?.data?.boards?.[0]?.items_page;
            if (firstPage) {
                allItems = firstPage.items || [];
                let cursor = firstPage.cursor;

                while (cursor) {
                    const nextQuery = `query {
                        next_items_page (
                            limit: 500, cursor: "${cursor}"
                        ) {
                            cursor
                            items {
                                id
                                column_values (ids: ["${eventTypeColumnId}", "${durationColumnId}"]) {
                                    id
                                    value
                                }
                            }
                        }
                    }`;

                    const nextRes = await monday.api(nextQuery);
                    if (fetchId !== fetchIdRef.current) return;

                    const nextPage = nextRes?.data?.next_items_page;
                    if (!nextPage) break;

                    allItems = allItems.concat(nextPage.items || []);
                    cursor = nextPage.cursor;
                }
            }

            // חישוב שעות לפי אינדקס
            const hoursByIndex = {};

            for (const item of allItems) {
                let eventTypeIndex = null;
                let durationValue = 0;

                for (const col of item.column_values) {
                    if (col.id === eventTypeColumnId && col.value) {
                        try {
                            const parsed = JSON.parse(col.value);
                            eventTypeIndex = parsed?.index != null ? String(parsed.index) : null;
                        } catch { /* ignore */ }
                    }
                    if (col.id === durationColumnId && col.value) {
                        try {
                            const parsed = JSON.parse(col.value);
                            durationValue = parseFloat(parsed) || 0;
                        } catch {
                            durationValue = parseFloat(col.value) || 0;
                        }
                    }
                }

                if (eventTypeIndex == null) continue;
                if (isTemporaryIndex(eventTypeIndex, mapping)) continue;

                let hours;
                if (isAllDayIndex(eventTypeIndex, mapping)) {
                    const days = Math.max(1, Math.round(durationValue));
                    hours = days * workdayLength;
                } else {
                    hours = durationValue;
                }

                if (!hoursByIndex[eventTypeIndex]) {
                    hoursByIndex[eventTypeIndex] = 0;
                }
                hoursByIndex[eventTypeIndex] += hours;
            }

            // בניית breakdown - צבע מהעמודה, fallback ל-labelMeta
            const result = Object.entries(hoursByIndex).map(([index, hours]) => ({
                index,
                label: getLabelText(index, labelMeta) || `לייבל ${index}`,
                color: freshColorMap[index] || labelMeta?.[index]?.color || '#c4c4c4',
                category: getCategory(index, mapping) || 'unknown',
                hours: Math.round(hours * 10) / 10
            }));

            const categoryOrder = { billable: 0, nonBillable: 1, allDay: 2 };
            result.sort((a, b) => (categoryOrder[a.category] ?? 3) - (categoryOrder[b.category] ?? 3));

            const total = result.reduce((sum, item) => sum + item.hours, 0);

            if (fetchId === fetchIdRef.current) {
                setBreakdown(result);
                setTotalHours(Math.round(total * 10) / 10);
            }

            logger.debug('useMonthlyHours', 'View range breakdown computed', {
                calendarView,
                itemCount: allItems.length,
                total,
                categories: result.length
            });
        } catch (error) {
            logger.error('useMonthlyHours', 'Error fetching data', error);
            if (fetchId === fetchIdRef.current) {
                setBreakdown([]);
                setTotalHours(0);
            }
        } finally {
            if (fetchId === fetchIdRef.current) {
                setLoading(false);
            }
        }
    }, [effectiveBoardId, dateColumnId, durationColumnId, eventTypeColumnId, reporterColumnId, mapping, labelMeta, workdayLength, rangeStart, rangeEnd, monday]);

    // טעינה אוטומטית בשינוי טווח או הגדרות
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        breakdown,
        totalHours,
        targetHours,
        loading,
        refetch: fetchData
    };
};
