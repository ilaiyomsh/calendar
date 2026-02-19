import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { Dropdown } from '@vibe/core';
import SegmentedToggle from './SegmentedToggle';
import DatePickerInput from '../DatePickerInput';
import { formatPeriodLabel } from '../../utils/dateFilterUtils';
import styles from './Dashboard.module.css';

const BILL_OPTIONS = [
    { value: 'all', label: 'הכל' },
    { value: 'billable', label: 'לחיוב' },
    { value: 'nonBillable', label: 'לא לחיוב' }
];

const GRANULARITY_OPTIONS = [
    { value: 'day', label: 'יום' },
    { value: 'week', label: 'שבוע' },
    { value: 'month', label: 'חודש' },
    { value: 'year', label: 'שנה' }
];

const DATE_CONDITIONS = [
    { value: 'week',    label: 'שבוע',          pickers: 'period' },
    { value: 'month',   label: 'חודש',          pickers: 'period' },
    { value: 'year',    label: 'שנה',           pickers: 'period' },
    { value: 'between', label: 'בין תאריכים',  pickers: 2 },
];

/**
 * פאנל פילטרים של הדשבורד — שורה אחת RTL
 */
const DashboardFilterPanel = ({
    // Projects multi-select
    filterProjects,
    loadingFilterProjects,
    selectedProjectIds,
    onProjectChange,
    // Reporters multi-select
    reporters,
    loadingReporters,
    selectedReporterIds,
    onReporterChange,
    // Billable toggle
    billFilter,
    onBillFilterChange,
    // Granularity
    granularity,
    onGranularityChange,
    // Date range
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    // Date condition
    dateCondition,
    onDateConditionChange,
    periodAnchor,
    onPeriodPrev,
    onPeriodNext,
    projectFilterActive
}) => {
    // המרה מ-{ id, name } לפורמט Vibe { value, label }
    const projectOptions = useMemo(() =>
        (filterProjects || []).map(p => ({ value: String(p.id), label: p.name })),
        [filterProjects]
    );
    const reporterOptions = useMemo(() =>
        (reporters || []).map(r => ({ value: String(r.id), label: r.name })),
        [reporters]
    );

    const selectedProjectValues = useMemo(() =>
        projectOptions.filter(o => selectedProjectIds.map(String).includes(o.value)),
        [projectOptions, selectedProjectIds]
    );
    const selectedReporterValues = useMemo(() =>
        reporterOptions.filter(o => selectedReporterIds.map(String).includes(o.value)),
        [reporterOptions, selectedReporterIds]
    );

    const handleProjectChange = useCallback((selected) => {
        onProjectChange(selected ? selected.map(o => o.value) : []);
    }, [onProjectChange]);

    const handleReporterChange = useCallback((selected) => {
        onReporterChange(selected ? selected.map(o => o.value) : []);
    }, [onReporterChange]);

    const conditionConfig = DATE_CONDITIONS.find(c => c.value === dateCondition) || DATE_CONDITIONS[0];
    const [conditionOpen, setConditionOpen] = useState(false);
    const conditionRef = useRef(null);

    // סגירה בקליק חיצוני
    useEffect(() => {
        if (!conditionOpen) return;
        const handleClickOutside = (e) => {
            if (conditionRef.current && !conditionRef.current.contains(e.target)) {
                setConditionOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [conditionOpen]);

    const renderDateArea = () => {
        if (conditionConfig.pickers === 'period') {
            // ניווט תקופתי: ▶ תווית ◀ (RTL — ▶ ימינה = אחורה, ◀ שמאלה = קדימה)
            return (
                <div className={styles.periodNav}>
                    <button
                        className={styles.periodArrow}
                        onClick={onPeriodPrev}
                        aria-label="תקופה קודמת"
                    >
                        ▸
                    </button>
                    <span className={styles.periodLabel}>
                        {formatPeriodLabel(dateCondition, periodAnchor)}
                    </span>
                    <button
                        className={styles.periodArrow}
                        onClick={onPeriodNext}
                        aria-label="תקופה הבאה"
                    >
                        ◂
                    </button>
                </div>
            );
        }

        // ברירת מחדל: שני פיקרים (between)
        return (
            <>
                <DatePickerInput
                    label="מתאריך"
                    date={dateFrom ? new Date(dateFrom + 'T00:00:00') : undefined}
                    onDateChange={(d) => onDateFromChange(d ? format(d, 'yyyy-MM-dd') : dateFrom)}
                />
                <DatePickerInput
                    label="עד תאריך"
                    date={dateTo ? new Date(dateTo + 'T00:00:00') : undefined}
                    onDateChange={(d) => onDateToChange(d ? format(d, 'yyyy-MM-dd') : dateTo)}
                />
            </>
        );
    };

    return (
        <div className={styles.filterPanel}>
            <div className={styles.filterRow}>
                <Dropdown
                    placeholder="פרויקטים"
                    options={projectOptions}
                    value={selectedProjectValues}
                    onChange={handleProjectChange}
                    onClear={() => onProjectChange([])}
                    multi
                    searchable
                    clearable
                    rtl
                    size="small"
                    isLoading={loadingFilterProjects}
                    noOptionsMessage={() => 'לא נמצאו פרויקטים'}
                    className={styles.vibeDropdown}
                />
                <Dropdown
                    placeholder="עובדים"
                    options={reporterOptions}
                    value={selectedReporterValues}
                    onChange={handleReporterChange}
                    onClear={() => onReporterChange([])}
                    multi
                    searchable
                    clearable
                    rtl
                    size="small"
                    isLoading={loadingReporters}
                    noOptionsMessage={() => 'לא נמצאו עובדים'}
                    className={styles.vibeDropdown}
                />

                {/* דרופדאון תנאי תאריך — custom כדי להתאים לעיצוב */}
                <div className={styles.conditionWrapper} ref={conditionRef}>
                    <button
                        type="button"
                        className={`${styles.conditionTrigger} ${conditionOpen ? styles.conditionTriggerOpen : ''}`}
                        onClick={() => setConditionOpen(prev => !prev)}
                    >
                        <span className={styles.conditionTriggerLabel}>{conditionConfig.label}</span>
                        <ChevronDown size={14} className={`${styles.conditionChevron} ${conditionOpen ? styles.conditionChevronOpen : ''}`} />
                    </button>
                    {conditionOpen && (
                        <div className={styles.conditionDropdown}>
                            {DATE_CONDITIONS.map(c => (
                                <div
                                    key={c.value}
                                    className={`${styles.conditionItem} ${c.value === dateCondition ? styles.conditionItemSelected : ''}`}
                                    onClick={() => {
                                        onDateConditionChange(c.value);
                                        setConditionOpen(false);
                                    }}
                                >
                                    {c.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {renderDateArea()}

                {!projectFilterActive && (
                    <SegmentedToggle
                        options={BILL_OPTIONS}
                        selected={billFilter}
                        onChange={onBillFilterChange}
                        ariaLabel="סינון לפי סוג חיוב"
                    />
                )}
                <SegmentedToggle
                    options={GRANULARITY_OPTIONS}
                    selected={granularity}
                    onChange={onGranularityChange}
                    ariaLabel="גרנולריות זמן"
                />
            </div>
        </div>
    );
};

export default DashboardFilterPanel;
