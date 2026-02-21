import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useMondayContext, useMobile } from '../../contexts/MondayContext';
import { getEffectiveBoardId } from '../../utils/boardIdResolver';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useFilterOptions } from '../../hooks/useFilterOptions';
import { format } from 'date-fns';
import { aggregateAll, consolidateBarData } from '../../utils/dashboardAggregation';
import { exportDashboardToCsv } from '../../utils/csvExporter';
import { buildDateFilterRule, getEffectiveDateRange, shiftPeriod } from '../../utils/dateFilterUtils';
import DashboardToolbar from './DashboardToolbar';
import DashboardFilterPanel from './DashboardFilterPanel';
import DashboardStats from './DashboardStats';
import DashboardBarChart from './DashboardBarChart';
import DashboardPieCharts from './DashboardPieCharts';
import StopwatchLoader from '../StopwatchLoader/StopwatchLoader';
import styles from './Dashboard.module.css';
import logger from '../../utils/logger';

/**
 * ברירת מחדל: תחילת וסוף החודש הנוכחי בפורמט YYYY-MM-DD
 */
const getDefaultDateRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
        from: `${year}-${month}-01`,
        to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    };
};

/**
 * דשבורד ראשי - תצוגת ניתוח שעות
 */
const Dashboard = ({ monday, onSwitchToCalendar, onOpenSettings, isOwner }) => {
    const { customSettings } = useSettings();
    const { context } = useMondayContext();
    const isMobile = useMobile();

    const effectiveBoardId = useMemo(() =>
        getEffectiveBoardId(customSettings, context),
        [customSettings, context]
    );

    // State - פילטרים
    const [selectedReporterIds, setSelectedReporterIds] = useState([]);
    const [selectedProjectIds, setSelectedProjectIds] = useState([]);
    const [billFilter, setBillFilter] = useState('all');
    const [granularity, setGranularity] = useState('week');
    const defaultRange = useMemo(() => getDefaultDateRange(), []);
    const [dateFrom, setDateFrom] = useState(defaultRange.from);
    const [dateTo, setDateTo] = useState(defaultRange.to);
    const [dateCondition, setDateCondition] = useState('month');
    const [periodAnchor, setPeriodAnchor] = useState(() => new Date());

    // Hooks
    const { events, loading, error, progress, fetchEvents } = useDashboardData(monday, context);
    const { reporters, loadingReporters, filterProjects, loadingFilterProjects } = useFilterOptions(monday, effectiveBoardId, customSettings);

    // חישוב טווח תאריכים אפקטיבי לפי תנאי
    const isPeriodCondition = dateCondition === 'month' || dateCondition === 'week' || dateCondition === 'year';
    const effectiveDateFrom = isPeriodCondition
        ? format(periodAnchor, 'yyyy-MM-dd')
        : dateFrom;
    const effectiveDateTo = isPeriodCondition
        ? format(periodAnchor, 'yyyy-MM-dd')
        : dateTo;
    const effectiveRange = useMemo(
        () => getEffectiveDateRange(dateCondition, effectiveDateFrom, effectiveDateTo),
        [dateCondition, effectiveDateFrom, effectiveDateTo]
    );

    // בניית חוקי פילטר צד-שרת (GraphQL rules)
    const serverFilterRules = useMemo(() => {
        const rules = [];

        // חוק תאריכים
        if (customSettings?.dateColumnId) {
            rules.push(buildDateFilterRule(
                dateCondition,
                customSettings.dateColumnId,
                effectiveRange.from,
                effectiveRange.to
            ));
        }

        // סינון מדווח ברמת ה-API — פורמט People: "person-{id}"
        if (selectedReporterIds.length > 0 && customSettings?.reporterColumnId) {
            rules.push({
                column_id: customSettings.reporterColumnId,
                compare_value: selectedReporterIds.map(id => `person-${id}`),
                operator: "any_of"
            });
        }

        // סינון פרויקט ברמת ה-API — board_relation + any_of עם מזהים מספריים
        if (selectedProjectIds.length > 0 && customSettings?.projectColumnId) {
            rules.push({
                column_id: customSettings.projectColumnId,
                compare_value: selectedProjectIds.map(id => parseInt(id)),
                operator: "any_of"
            });
        }

        return rules;
    }, [dateCondition, effectiveRange, selectedReporterIds, selectedProjectIds, customSettings?.dateColumnId, customSettings?.reporterColumnId, customSettings?.projectColumnId]);

    // טעינת נתונים כשמשתנה הטווח או הפילטרים — עם debounce של 300ms
    useEffect(() => {
        if (!monday || !effectiveBoardId) return;

        const timer = setTimeout(() => {
            const from = new Date(effectiveRange.from + 'T00:00:00');
            const to = new Date(effectiveRange.to + 'T23:59:59');

            if (isNaN(from.getTime()) || isNaN(to.getTime())) return;

            fetchEvents(from, to, serverFilterRules);
        }, 300);

        return () => clearTimeout(timer);
    }, [effectiveRange, monday, effectiveBoardId, fetchEvents, serverFilterRules]);

    // סינון צד-לקוח
    const specificProjects = selectedProjectIds.length > 0;
    const filteredEvents = useMemo(() => {
        let filtered = events;

        // סינון מדווחים - השוואה כ-string כי Monday API מחזיר ID כ-string וFilterBar מחזיר numbers
        if (selectedReporterIds.length > 0) {
            const reporterStrs = selectedReporterIds.map(id => String(id));
            filtered = filtered.filter(e => e.reporterId && reporterStrs.includes(String(e.reporterId)));
        }

        if (specificProjects) {
            // כשמסננים לפי פרויקט — לא לחיוב לא רלוונטי (אין להם פרויקט)
            const projectStrs = selectedProjectIds.map(id => String(id));
            filtered = filtered.filter(e => e.isBillable && e.projectId && projectStrs.includes(String(e.projectId)));
        } else {
            // סינון סוג חיוב — רק כשלא מסננים לפי פרויקט
            if (billFilter === 'billable') {
                filtered = filtered.filter(e => e.isBillable);
            } else if (billFilter === 'nonBillable') {
                filtered = filtered.filter(e => !e.isBillable);
            }
        }

        return filtered;
    }, [events, selectedReporterIds, selectedProjectIds, specificProjects, billFilter]);

    // אגרגציה משולבת — מעבר יחיד על המערך במקום 4 מעברים נפרדים
    const { stats, barData: rawBarData, billablePieData, nonBillablePieData } = useMemo(
        () => aggregateAll(filteredEvents, granularity),
        [filteredEvents, granularity]
    );

    // איחוד עמודות כשיש יותר מדי
    const barData = useMemo(
        () => consolidateBarData(rawBarData),
        [rawBarData]
    );

    const projectFilterActive = specificProjects;
    const compactMode = projectFilterActive || billFilter !== 'all';

    // שינוי תאריכים עם וולידציה
    const handleDateFromChange = useCallback((value) => {
        if (value <= dateTo) {
            setDateFrom(value);
        } else {
            setDateFrom(value);
            setDateTo(value);
        }
    }, [dateTo]);

    const handleDateToChange = useCallback((value) => {
        if (value >= dateFrom) {
            setDateTo(value);
        } else {
            setDateTo(value);
            setDateFrom(value);
        }
    }, [dateFrom]);

    const handleDateConditionChange = useCallback((newCondition) => {
        setDateCondition(newCondition);
        if (newCondition === 'month' || newCondition === 'week' || newCondition === 'year') {
            setPeriodAnchor(new Date());
        }
    }, []);

    const handlePeriodPrev = useCallback(() => {
        setPeriodAnchor(prev => shiftPeriod(dateCondition, prev, -1));
    }, [dateCondition]);

    const handlePeriodNext = useCallback(() => {
        setPeriodAnchor(prev => shiftPeriod(dateCondition, prev, 1));
    }, [dateCondition]);

    // ייצוא CSV
    const handleExport = useCallback(() => {
        const filename = `dashboard-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        exportDashboardToCsv(filteredEvents, reporters, filename);
    }, [filteredEvents, reporters]);

    // האם במצב טעינה ראשונית (אין נתונים כלל)
    const isInitialLoading = loading && events.length === 0;
    // האם מציג התקדמות (טעינה פעילה — ראשונית או streaming)
    const showProgress = isInitialLoading || progress.hasMore;

    return (
        <div className={styles.dashboard}>
            <DashboardToolbar
                onSwitchToCalendar={onSwitchToCalendar}
                isOwner={isOwner}
                onOpenSettings={onOpenSettings}
                onExport={handleExport}
                exportDisabled={isInitialLoading}
            />

            <div className={styles.content}>
                <DashboardFilterPanel
                    filterProjects={filterProjects}
                    loadingFilterProjects={loadingFilterProjects}
                    selectedProjectIds={selectedProjectIds}
                    onProjectChange={setSelectedProjectIds}
                    reporters={reporters}
                    loadingReporters={loadingReporters}
                    selectedReporterIds={selectedReporterIds}
                    onReporterChange={setSelectedReporterIds}
                    billFilter={billFilter}
                    onBillFilterChange={setBillFilter}
                    granularity={granularity}
                    onGranularityChange={setGranularity}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateFromChange={handleDateFromChange}
                    onDateToChange={handleDateToChange}
                    dateCondition={dateCondition}
                    onDateConditionChange={handleDateConditionChange}
                    periodAnchor={periodAnchor}
                    onPeriodPrev={handlePeriodPrev}
                    onPeriodNext={handlePeriodNext}
                    projectFilterActive={projectFilterActive}
                />

                {/* Progress bar עם שעון עצר — מוצג בטעינה ראשונית ובזמן streaming */}
                {showProgress && (
                    <div className={styles.progressBar}>
                        <div className={styles.progressRow}>
                            <StopwatchLoader size={28} />
                            <div className={styles.progressText}>
                                {progress.loaded === 0
                                    ? '...טוען נתונים'
                                    : `טוען נתונים... ${progress.loaded} רשומות נטענו`}
                            </div>
                        </div>
                        <div className={styles.progressTrack}>
                            <div
                                className={styles.progressFill}
                                style={{ width: `${progress.percent || 0}%` }}
                            />
                        </div>
                    </div>
                )}

                {error ? (
                    <div className={styles.errorState}>{error}</div>
                ) : isInitialLoading ? null : (
                    <>
                        <div className={`${styles.topRow} ${compactMode ? styles.topRowProjectMode : ''}`}>
                            <DashboardStats stats={stats} billFilter={billFilter} projectFilterActive={projectFilterActive} compactMode={compactMode} />
                            <DashboardPieCharts
                                billablePieData={billablePieData}
                                nonBillablePieData={nonBillablePieData}
                                billFilter={billFilter}
                                projectFilterActive={projectFilterActive}
                                compactMode={compactMode}
                            />
                        </div>
                        <DashboardBarChart data={barData} granularity={granularity} isConsolidated={rawBarData.length > barData.length} />
                        <div className={styles.footer}>
                            {filteredEvents.length} רשומות
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
