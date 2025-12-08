import { format, parse, startOfWeek as dateFnsStartOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { dateFnsLocalizer } from 'react-big-calendar';

// לוקליזציה עברית
export const locales = { 'he': he };

export const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date) => dateFnsStartOfWeek(date, { weekStartsOn: 0 }),
    getDay,
    locales,
});

// תרגום תוויות לעברית
export const hebrewMessages = {
    week: 'שבוע',
    work_week: 'שבוע עבודה',
    day: 'יום',
    month: 'חודש',
    previous: 'קודם',
    next: 'הבא',
    today: 'היום',
    agenda: 'סדר יום',
    date: 'תאריך',
    time: 'שעה',
    event: 'אירוע',
    allDay: 'כל היום',
    noEventsInRange: 'אין אירועים בטווח זה',
    showMore: total => `+ עוד ${total}`,
};

// יצירת רשימת שעות בקפיצות של 15 דקות
export const generateTimeOptions = () => {
    const times = [];
    for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 60; j += 15) {
            const hour = i.toString().padStart(2, '0');
            const minute = j.toString().padStart(2, '0');
            const label = `${hour}:${minute}`;
            times.push({ value: label, label: label });
        }
    }
    return times;
};

export const timeOptions = generateTimeOptions();

// יצירת רשימת שעות בקפיצות של 30 דקות
// minTime ו-maxTime בפורמט "HH:mm" (למשל "06:00", "20:00")
export const generateTimeOptions30Minutes = (minTime = "00:00", maxTime = "23:30") => {
    const times = [];
    
    // המרת minTime ו-maxTime לדקות
    const [minHours, minMinutes] = minTime.split(':').map(Number);
    const [maxHours, maxMinutes] = maxTime.split(':').map(Number);
    const minTotalMinutes = minHours * 60 + minMinutes;
    const maxTotalMinutes = maxHours * 60 + maxMinutes;
    
    for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 60; j += 30) {
            const totalMinutes = i * 60 + j;
            
            // סינון לפי הטווח
            if (totalMinutes >= minTotalMinutes && totalMinutes <= maxTotalMinutes) {
                const hour = i.toString().padStart(2, '0');
                const minute = j.toString().padStart(2, '0');
                const label = `${hour}:${minute}`;
                times.push({ value: label, label: label });
            }
        }
    }
    return times;
};

export const timeOptions30Minutes = generateTimeOptions30Minutes();

// יצירת רשימת משכי זמן בקפיצות של 30 דקות (מ-00:30 ומעלה)
export const generateDurationOptions30Minutes = () => {
    const durations = [];
    // מ-30 דקות עד 12 שעות
    for (let i = 0; i <= 12; i++) {
        for (let j = 0; j < 60; j += 30) {
            if (i === 0 && j === 0) continue; // דילוג על 00:00
            const hour = i.toString().padStart(2, '0');
            const minute = j.toString().padStart(2, '0');
            const label = `${hour}:${minute}`;
            durations.push({ value: label, label: label });
        }
    }
    return durations;
};

export const durationOptions30Minutes = generateDurationOptions30Minutes();

// פונקציה שמעגלת Date object ל-30 דקות הקרוב
export const roundToNearest30Minutes = (date) => {
    if (!date || !(date instanceof Date)) return date;
    
    const rounded = new Date(date);
    const minutes = rounded.getMinutes();
    const roundedMinutes = minutes < 30 ? 0 : 30;
    
    rounded.setMinutes(roundedMinutes);
    rounded.setSeconds(0);
    rounded.setMilliseconds(0);
    
    return rounded;
};

// ברירות מחדל לטווח שעות
export const DEFAULT_MIN_TIME = new Date(1970, 1, 1, 6, 0, 0); // 06:00
export const DEFAULT_MAX_TIME = new Date(1970, 1, 1, 22, 0, 0); // 22:00

// פורמטים מותאמים לשעון 24 שעות
export const formats = {
    // עיצוב השעה בציר הצד (09:00, 10:00)
    timeGutterFormat: (date, culture, localizer) =>
        localizer.format(date, 'HH:mm', culture),
    
    // עיצוב טווח שעות של אירוע (09:00 - 10:00)
    eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
        `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,
    
    // עיצוב כותרת סדר היום (Agenda)
    agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
        `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,
    
    // עיצוב כותרת יום (יום ראשון 23/11)
    dayHeaderFormat: (date, culture, localizer) =>
        localizer.format(date, 'EEEE dd/MM', culture),
};

