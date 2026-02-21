/**
 * Hook לשליפת נתונים לדשבורד
 * מבוסס על דפוס useMondayEvents - pagination + מיפוי לאירועים קלים
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getEffectiveBoardId } from '../utils/boardIdResolver';
import { isAllDayIndex, isTemporaryIndex, isBillableIndex, getLabelText, getLabelColor } from '../utils/eventTypeMapping';
import { toLocalDateFormat } from '../utils/dateFormatters';
import logger from '../utils/logger';

/**
 * @typedef {Object} DashboardEvent
 * @property {string} id
 * @property {number|null} reporterId
 * @property {string|null} projectId
 * @property {string|null} projectName
 * @property {number} hours
 * @property {boolean} isBillable
 * @property {string} eventTypeIndex
 * @property {string} eventTypeLabel
 * @property {string} eventTypeColor
 * @property {string} nonBillableType
 * @property {Date} date
 */

/**
 * Hook לשליפת נתוני דשבורד
 * @param {Object} monday - Monday SDK instance
 * @param {Object} context - Monday context
 * @returns {{ events: DashboardEvent[], loading: boolean, error: string|null, fetchEvents: Function }}
 */
export const useDashboardData = (monday, context) => {
    const { customSettings } = useSettings();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // התקדמות טעינה: כמה פריטים נטענו עד כה + אחוז
    const [progress, setProgress] = useState({ loaded: 0, hasMore: false, percent: 0 });

    const effectiveBoardId = useMemo(() =>
        getEffectiveBoardId(customSettings, context),
        [customSettings, context]
    );

    // חילוץ שדות settings ספציפיים למניעת refetch מיותרים
    const dateColumnId = customSettings?.dateColumnId;
    const durationColumnId = customSettings?.durationColumnId;
    const eventTypeStatusColumnId = customSettings?.eventTypeStatusColumnId;
    const projectColumnId = customSettings?.projectColumnId;
    const reporterColumnId = customSettings?.reporterColumnId;
    const nonBillableStatusColumnId = customSettings?.nonBillableStatusColumnId;
    const stageColumnId = customSettings?.stageColumnId;
    const eventTypeMapping = customSettings?.eventTypeMapping;
    const eventTypeLabelColors = customSettings?.eventTypeLabelColors;

    // AbortController לביטול fetch ישן כשמשתנה הטווח
    const abortRef = useRef(null);

    // Cache פשוט — מפתח = "from|to|rules" → תוצאות
    const cacheRef = useRef(new Map());

    /**
     * שליפת אירועים בטווח תאריכים
     * @param {Date} dateFrom
     * @param {Date} dateTo
     * @param {Array} [customFilterRules] - חוקי פילטר אופציונליים
     */
    const fetchEvents = useCallback(async (dateFrom, dateTo, customFilterRules = []) => {
        if (!effectiveBoardId || !dateColumnId || !durationColumnId) {
            logger.warn('useDashboardData', 'Missing board ID or settings');
            return;
        }

        // בדיקת cache — אם יש תוצאות מהירות, הצג מיד
        const cacheKey = `${toLocalDateFormat(dateFrom)}|${toLocalDateFormat(dateTo)}|${JSON.stringify(customFilterRules)}`;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            setEvents(cached);
            setProgress({ loaded: cached.length, hasMore: false, percent: 100 });
            setLoading(false);
            setError(null);
            logger.info('useDashboardData', 'Served from cache', { count: cached.length });
            return;
        }

        // ביטול fetch קודם אם עדיין רץ
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);
        setProgress({ loaded: 0, hasMore: true, percent: 0 });

        try {
            logger.functionStart('useDashboardData.fetchEvents', { dateFrom, dateTo });

            const fromDateStr = toLocalDateFormat(dateFrom);
            const toDateStr = toLocalDateFormat(dateTo);

            // בניית חוקי פילטר — חוק תאריכים מגיע מבחוץ דרך customFilterRules
            const rules = [...(customFilterRules || [])];

            const rulesGraphQL = rules.map(rule => {
                const compareValue = JSON.stringify(rule.compare_value);
                return `{
                    column_id: "${rule.column_id}",
                    compare_value: ${compareValue},
                    operator: ${rule.operator}
                }`;
            }).join(',\n');

            // בניית רשימת עמודות נדרשות בלבד (חסכון של 60-70% ב-payload)
            const neededColumnIds = [
                dateColumnId,
                durationColumnId,
                eventTypeStatusColumnId,
                projectColumnId,
                reporterColumnId,
                nonBillableStatusColumnId,
                stageColumnId
            ].filter(Boolean);
            const columnIdsStr = neededColumnIds.map(id => `"${id}"`).join(', ');

            // שאילתת עמוד ראשון - items_page עם query_params
            const itemsFragment = `
                cursor
                items {
                    id
                    column_values(ids: [${columnIdsStr}]) {
                        id
                        value
                        ... on DateValue {
                            date
                            time
                        }
                        ... on PeopleValue {
                            persons_and_teams {
                                id
                                kind
                            }
                        }
                        ... on StatusValue {
                            id
                            index
                            label
                            text
                            label_style {
                                color
                            }
                        }
                        ... on BoardRelationValue {
                            linked_items {
                                id
                                name
                            }
                        }
                    }
                }`;

            const firstPageQuery = `query {
                boards (ids: [${effectiveBoardId}]) {
                    items_page (
                        limit: 500,
                        query_params: {
                            rules: [${rulesGraphQL}],
                            operator: and
                        }
                    ) {
                        ${itemsFragment}
                    }
                }
            }`;


            // מיפוי פריט בודד לאירוע דשבורד
            const mapping = eventTypeMapping;
            const labelMeta = eventTypeLabelColors;

            const mapItem = (item) => {
                const dateColumn = item.column_values.find(col => col.id === dateColumnId);
                if (!dateColumn?.date) return null;

                const [year, month, day] = dateColumn.date.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                if (isNaN(date.getTime())) return null;

                const typeColumn = eventTypeStatusColumnId
                    ? item.column_values.find(col => col.id === eventTypeStatusColumnId)
                    : null;
                const eventTypeIndex = typeColumn?.index ?? null;

                if (isAllDayIndex(eventTypeIndex, mapping)) return null;
                if (isTemporaryIndex(eventTypeIndex, mapping)) return null;

                const durationColumn = item.column_values.find(col => col.id === durationColumnId);
                let hours = 0;
                if (durationColumn?.value) {
                    try {
                        const parsed = JSON.parse(durationColumn.value);
                        hours = parseFloat(parsed) || 0;
                    } catch {
                        hours = parseFloat(durationColumn.value) || 0;
                    }
                } else if (durationColumn?.text) {
                    hours = parseFloat(durationColumn.text) || 0;
                }

                const reporterColumn = reporterColumnId
                    ? item.column_values.find(col => col.id === reporterColumnId)
                    : null;
                const reporterId = reporterColumn?.persons_and_teams?.[0]?.id || null;

                const projectColumn = projectColumnId
                    ? item.column_values.find(col => col.id === projectColumnId)
                    : null;
                const projectId = projectColumn?.linked_items?.[0]?.id || null;
                const projectName = projectColumn?.linked_items?.[0]?.name || null;

                const nonBillableColumn = nonBillableStatusColumnId
                    ? item.column_values.find(col => col.id === nonBillableStatusColumnId)
                    : null;
                const nonBillableType = nonBillableColumn?.text || nonBillableColumn?.label || '';
                const nonBillableColor = nonBillableColumn?.label_style?.color || null;

                const stageColumn = stageColumnId
                    ? item.column_values.find(col => col.id === stageColumnId)
                    : null;
                const stageLabel = stageColumn?.text || stageColumn?.label || '';
                const stageColor = stageColumn?.label_style?.color || null;

                return {
                    id: item.id,
                    reporterId,
                    projectId,
                    projectName,
                    hours,
                    isBillable: isBillableIndex(eventTypeIndex, mapping),
                    eventTypeIndex: String(eventTypeIndex),
                    eventTypeLabel: getLabelText(eventTypeIndex, labelMeta) || typeColumn?.text || '',
                    eventTypeColor: typeColumn?.label_style?.color || getLabelColor(eventTypeIndex, labelMeta) || '#0073ea',
                    nonBillableType,
                    nonBillableColor,
                    stageLabel,
                    stageColor,
                    date
                };
            };

            // לולאת pagination עם הצגת נתונים חלקיים
            let allDashboardEvents = [];

            // עמוד ראשון
            const firstRes = await monday.api(firstPageQuery);
            if (controller.signal.aborted) return;

            const firstPage = firstRes.data?.boards?.[0]?.items_page;
            if (firstPage?.items) {
                const mapped = firstPage.items.map(mapItem).filter(Boolean);
                allDashboardEvents.push(...mapped);
            }
            let cursor = firstPage?.cursor || null;

            // מעקב עמודים לאחוזי התקדמות
            let pageCount = 1;
            let totalEstimate = cursor ? 3 : 1; // ניחוש ראשוני: אם יש cursor, מניחים ~3 עמודים

            // הצגת תוצאות חלקיות מיד אחרי עמוד ראשון
            if (cursor && allDashboardEvents.length > 0) {
                const percent = Math.round((pageCount / totalEstimate) * 100);
                setEvents([...allDashboardEvents]);
                setProgress({ loaded: allDashboardEvents.length, hasMore: true, percent: Math.min(percent, 90) });
                setLoading(false); // מסיר את הלודר כדי להציג נתונים חלקיים
            }

            // עמודים הבאים - next_items_page (שאילתה נפרדת ברמת root)
            while (cursor && !controller.signal.aborted) {
                const nextQuery = `query {
                    next_items_page (cursor: "${cursor}", limit: 500) {
                        ${itemsFragment}
                    }
                }`;
                const nextRes = await monday.api(nextQuery);
                if (controller.signal.aborted) return;

                const nextPage = nextRes.data?.next_items_page;
                if (nextPage?.items) {
                    const mapped = nextPage.items.map(mapItem).filter(Boolean);
                    allDashboardEvents.push(...mapped);
                    pageCount++;
                    // עדכון הערכה: אם יש עוד cursor, הגדל את הסך הכולל
                    if (nextPage.cursor && pageCount >= totalEstimate) {
                        totalEstimate = pageCount + 1;
                    }
                    const percent = nextPage.cursor
                        ? Math.min(Math.round((pageCount / totalEstimate) * 100), 90)
                        : 100;
                    setEvents([...allDashboardEvents]);
                    setProgress({ loaded: allDashboardEvents.length, hasMore: !!nextPage.cursor, percent });
                }
                cursor = nextPage?.cursor || null;
            }

            if (controller.signal.aborted) return;

            // עדכון סופי + שמירה ב-cache
            setEvents(allDashboardEvents);
            setProgress({ loaded: allDashboardEvents.length, hasMore: false, percent: 100 });

            // שמירה ב-cache (מוגבל ל-10 ערכים למניעת דליפת זיכרון)
            if (cacheRef.current.size >= 10) {
                const firstKey = cacheRef.current.keys().next().value;
                cacheRef.current.delete(firstKey);
            }
            cacheRef.current.set(cacheKey, allDashboardEvents);

            logger.functionEnd('useDashboardData.fetchEvents', { count: allDashboardEvents.length });

        } catch (err) {
            if (controller.signal.aborted) return;
            logger.error('useDashboardData', 'Error fetching dashboard data', err);
            setError('שגיאה בטעינת נתוני הדשבורד');
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [effectiveBoardId, monday, dateColumnId, durationColumnId, eventTypeStatusColumnId,
        projectColumnId, reporterColumnId, nonBillableStatusColumnId, stageColumnId, eventTypeMapping, eventTypeLabelColors]);

    return { events, loading, error, progress, fetchEvents };
};
