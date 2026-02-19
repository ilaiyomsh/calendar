import { format } from 'date-fns';

/**
 * ייצוא נתוני דשבורד לקובץ CSV
 * @param {import('../hooks/useDashboardData').DashboardEvent[]} filteredEvents
 * @param {Array} reporters - מערך מדווחים { id, name }
 * @param {string} [filename] - שם הקובץ
 */
export function exportDashboardToCsv(filteredEvents, reporters, filename) {
    // מפת שמות מדווחים
    const reporterMap = new Map();
    if (reporters?.length) {
        reporters.forEach(r => {
            reporterMap.set(String(r.id), r.name);
        });
    }

    const headers = ['תאריך', 'מדווח', 'פרויקט', 'משך זמן דיווח', 'לחיוב/לא לחיוב', 'סיווג'];

    const rows = filteredEvents.map(event => [
        event.date ? format(event.date, 'dd/MM/yyyy') : '',
        reporterMap.get(String(event.reporterId)) || '',
        event.projectName || '',
        event.hours ?? '',
        event.isBillable ? 'לחיוב' : 'לא לחיוב',
        event.isBillable ? (event.stageLabel || '') : (event.nonBillableType || '')
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(escapeCsvValue).join(','))
        .join('\n');

    // UTF-8 BOM לתמיכה בעברית באקסל
    const bom = '\ufeff';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `dashboard-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * אסקייפ לערך CSV — עוטף במרכאות אם מכיל פסיקים, מרכאות או שורות חדשות
 */
function escapeCsvValue(value) {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}
