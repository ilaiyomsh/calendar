import React, { useState, useRef } from 'react';
import styles from './MonthlyBattery.module.css';

const MonthlyBattery = ({
    breakdown = [],
    totalHours = 0,
    targetHours = 182.5,
    loading = false
}) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const batteryRef = useRef(null);

    const percentage = targetHours > 0 ? Math.round((totalHours / targetHours) * 100) : 0;
    const fillPercent = Math.min(percentage, 100);

    return (
        <div className={styles.container}>
            {/* הבטרייה */}
            <div
                className={styles.batteryWrapper}
                ref={batteryRef}
                onMouseEnter={() => setShowTooltip(true)}
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
