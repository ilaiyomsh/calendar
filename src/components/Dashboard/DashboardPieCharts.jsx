import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styles from './Dashboard.module.css';

const DEFAULT_COLORS = ['#0073ea', '#00ca72', '#fdab3d', '#e2445c', '#a25ddc', '#579bfc', '#ff642e'];

/**
 * תרשימי עוגה (דונאט) - התפלגות שעות
 * @param {{ billablePieData: Array, nonBillablePieData: Array, billFilter: string, projectFilterActive: boolean }} props
 */
const DashboardPieCharts = ({ billablePieData, nonBillablePieData, billFilter, projectFilterActive, compactMode }) => {
    const showBillable = billFilter !== 'nonBillable';
    const showNonBillable = !projectFilterActive && billFilter !== 'billable';
    const singlePie = compactMode || (showBillable !== showNonBillable);

    return (
        <div className={styles.sectionCard}>
            <div className={singlePie ? styles.pieChartsRowSingle : styles.pieChartsRow}>
                {showBillable ? (
                    <div className={styles.pieSection}>
                        <h3 className={styles.chartTitle}>התפלגות שעות לחיוב</h3>
                        {billablePieData && billablePieData.length > 0 ? (
                            <MemoizedPieChartDonut data={billablePieData} />
                        ) : (
                            <div className={styles.emptyState}>אין נתוני שעות לחיוב</div>
                        )}
                    </div>
                ) : null}

                {showNonBillable ? (
                    <div className={styles.pieSection}>
                        <h3 className={styles.chartTitle}>התפלגות שעות לא לחיוב</h3>
                        {nonBillablePieData && nonBillablePieData.length > 0 ? (
                            <MemoizedPieChartDonut data={nonBillablePieData} />
                        ) : (
                            <div className={styles.emptyState}>אין נתוני שעות לא לחיוב</div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

/**
 * תרשים דונאט פנימי
 */
const PieChartDonut = ({ data }) => {
    return (
        <div style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        dataKey="value"
                        nameKey="name"
                        paddingAngle={2}
                        isAnimationActive={data.length <= 10}
                    >
                        {data.map((entry, index) => (
                            <Cell key={entry.name} fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(value, name) => [`${value} שעות`, name]}
                        contentStyle={{ direction: 'rtl', borderRadius: 8, border: '1px solid #d0d4e4' }}
                    />
                    <Legend
                        formatter={(value) => <span style={{ direction: 'rtl', fontSize: 12, color: '#676879' }}>{value}</span>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

const MemoizedPieChartDonut = React.memo(PieChartDonut);
export default React.memo(DashboardPieCharts);
