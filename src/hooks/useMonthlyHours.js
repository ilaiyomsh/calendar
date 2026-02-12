import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getEffectiveBoardId } from '../utils/boardIdResolver';
import { getCategory, isTemporaryIndex, isAllDayIndex, getLabelText } from '../utils/eventTypeMapping';
import { parseStatusColumnLabels } from '../utils/eventTypeValidation';
import { toLocalDateFormat } from '../utils/dateFormatters';
import logger from '../utils/logger';

/**
 * Hook לחישוב שעות חודשיות מצטברות לפי סוגי דיווח
 * שולף אירועים של המשתמש הנוכחי לחודש שנבחר ומחשב breakdown
 * שולף צבעים ישירות מהעמודה בכל פעם (לא תלוי ב-labelMeta השמור)
 */
export const useMonthlyHours = (monday, context) => {
    const { customSettings } = useSettings();
    const [breakdown, setBreakdown] = useState([]);
    const [totalHours, setTotalHours] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });

    const effectiveBoardId = useMemo(() =>
        getEffectiveBoardId(customSettings, context),
        [customSettings, context]
    );

    const targetHours = customSettings.monthlyHoursTarget ?? 182.5;
    const workdayLength = customSettings.workdayLength ?? 8.5;
    const mapping = customSettings.eventTypeMapping;
    const labelMeta = customSettings.eventTypeLabelMeta;
    const dateColumnId = customSettings.dateColumnId;
    const durationColumnId = customSettings.durationColumnId;
    const eventTypeColumnId = customSettings.eventTypeStatusColumnId;
    const reporterColumnId = customSettings.reporterColumnId;

    // Ref למניעת race conditions
    const fetchIdRef = useRef(0);

    const fetchMonthlyData = useCallback(async () => {
        if (!effectiveBoardId || !dateColumnId || !durationColumnId || !eventTypeColumnId || !mapping) {
            setBreakdown([]);
            setTotalHours(0);
            return;
        }

        const fetchId = ++fetchIdRef.current;
        setLoading(true);

        try {
            // חישוב טווח תאריכים לחודש שנבחר
            const startDate = new Date(selectedMonth.year, selectedMonth.month, 1);
            const endDate = new Date(selectedMonth.year, selectedMonth.month + 1, 0);
            const fromDateStr = toLocalDateFormat(startDate);
            const toDateStr = toLocalDateFormat(endDate);

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

            // שליפה מקבילה של צבעים ודף ראשון
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
                        boards (ids: [${effectiveBoardId}]) {
                            items_page (
                                limit: 500, cursor: "${cursor}",
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

                    const nextRes = await monday.api(nextQuery);
                    if (fetchId !== fetchIdRef.current) return;

                    const nextPage = nextRes?.data?.boards?.[0]?.items_page;
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

            logger.debug('useMonthlyHours', 'Monthly breakdown computed', {
                month: selectedMonth,
                itemCount: allItems.length,
                total,
                categories: result.length
            });
        } catch (error) {
            logger.error('useMonthlyHours', 'Error fetching monthly data', error);
            if (fetchId === fetchIdRef.current) {
                setBreakdown([]);
                setTotalHours(0);
            }
        } finally {
            if (fetchId === fetchIdRef.current) {
                setLoading(false);
            }
        }
    }, [effectiveBoardId, dateColumnId, durationColumnId, eventTypeColumnId, reporterColumnId, mapping, labelMeta, workdayLength, selectedMonth, monday]);

    // טעינה אוטומטית בשינוי חודש או הגדרות
    useEffect(() => {
        fetchMonthlyData();
    }, [fetchMonthlyData]);

    return {
        breakdown,
        totalHours,
        targetHours,
        loading,
        selectedMonth,
        setSelectedMonth,
        refetch: fetchMonthlyData
    };
};
