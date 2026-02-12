import React, { useState, useRef, useEffect } from 'react';
import { DropdownChevronDown } from "@vibe/icons";
import styles from './MonthlyBattery.module.css';

// שמות חודשים בעברית
const HEBREW_MONTHS = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

/**
 * יצירת רשימת 12 החודשים האחרונים
 */
const getLast12Months = () => {
    const now = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            label: `${HEBREW_MONTHS[d.getMonth()]} ${d.getFullYear()}`
        });
    }
    return months;
};

const MonthlyBattery = ({
    breakdown = [],
    totalHours = 0,
    targetHours = 182.5,
    loading = false,
    selectedMonth,
    onMonthChange
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const dropdownRef = useRef(null);
    const batteryRef = useRef(null);

    const percentage = targetHours > 0 ? Math.round((totalHours / targetHours) * 100) : 0;
    const fillPercent = Math.min(percentage, 100);

    const monthLabel = selectedMonth
        ? `${HEBREW_MONTHS[selectedMonth.month]} ${selectedMonth.year}`
        : '';

    const months = getLast12Months();

    // סגירת dropdown בלחיצה מחוץ לרכיב
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMonthSelect = (month) => {
        onMonthChange?.({ year: month.year, month: month.month });
        setIsDropdownOpen(false);
    };

    return (
        <div className={styles.container}>
            {/* בורר חודש */}
            <div className={styles.monthSelector} ref={dropdownRef}>
                <button
                    type="button"
                    className={styles.monthButton}
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                >
                    <span className={styles.monthName}>{monthLabel}</span>
                    <DropdownChevronDown size="16" />
                </button>

                {isDropdownOpen && (
                    <div className={styles.monthDropdown}>
                        {months.map((m) => {
                            const isSelected = selectedMonth &&
                                m.year === selectedMonth.year &&
                                m.month === selectedMonth.month;
                            return (
                                <button
                                    key={`${m.year}-${m.month}`}
                                    type="button"
                                    className={`${styles.monthOption} ${isSelected ? styles.monthOptionSelected : ''}`}
                                    onClick={() => handleMonthSelect(m)}
                                >
                                    {m.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* הבטרייה */}
            <div
                className={styles.batteryWrapper}
                ref={batteryRef}
                onMouseEnter={() => { if (!isDropdownOpen) setShowTooltip(true); }}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <div className={styles.batteryTrack}>
                    {loading ? (
                        <div className={styles.batteryLoading} />
                    ) : (
                        <div className={styles.batteryFill} style={{ width: `${fillPercent}%` }}>
                            {breakdown.map((item) => {
                                const segmentPercent = targetHours > 0
                                    ? (item.hours / targetHours) * 100
                                    : 0;
                                if (segmentPercent <= 0) return null;
                                return (
                                    <div
                                        key={item.index}
                                        className={styles.batterySegment}
                                        style={{
                                            width: `${(item.hours / totalHours) * 100}%`,
                                            backgroundColor: item.color
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* אחוז */}
                <span className={styles.percentText}>
                    {loading ? '...' : `${percentage}%`}
                </span>

                {/* Tooltip */}
                {showTooltip && !loading && breakdown.length > 0 && (
                    <div className={styles.tooltip}>
                        {breakdown.map((item) => (
                            <div key={item.index} className={styles.tooltipRow}>
                                <span
                                    className={styles.tooltipDot}
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className={styles.tooltipLabel}>{item.label}</span>
                                <span className={styles.tooltipHours}>{item.hours} שעות</span>
                            </div>
                        ))}
                        <div className={styles.tooltipDivider} />
                        <div className={styles.tooltipTotal}>
                            <span>סה״כ</span>
                            <span>{totalHours} / {targetHours} שעות</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MonthlyBattery;
