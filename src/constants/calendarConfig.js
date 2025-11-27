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

