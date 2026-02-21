import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './Dashboard.module.css';

const GRANULARITY_LABELS = {
    day: 'יום',
    week: 'שבוע',
    month: 'חודש',
    year: 'שנה'
};

/**
 * תרשים עמודות - שעות לפי גרנולריות
 * @param {{ data: Array, granularity: string }} props
 */
const DashboardBarChart = ({ data, granularity, isConsolidated }) => {
    const granLabel = GRANULARITY_LABELS[granularity] || granularity;
    const title = isConsolidated ? `שעות לפי ${granLabel} (ממוצע)` : `שעות לפי ${granLabel}`;

    if (!data || data.length === 0) {
        return (
            <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>{title}</h3>
                <div className={styles.emptyState}>אין נתונים בטווח שנבחר</div>
            </div>
        );
    }

    return (
        <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>{title}</h3>
            <div className={styles.chartContainer} style={{ direction: 'ltr' }}>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e6e9ef" />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 12, fill: '#676879' }}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: '#676879' }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            cursor={false}
                            formatter={(value) => [`${value} שעות`, 'שעות']}
                            contentStyle={{ direction: 'rtl', borderRadius: 8, border: '1px solid #d0d4e4' }}
                        />
                        <Bar dataKey="hours" fill="#0073ea" radius={[4, 4, 0, 0]} isAnimationActive={data.length <= 20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default React.memo(DashboardBarChart);
