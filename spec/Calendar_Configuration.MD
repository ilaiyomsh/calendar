מדריך להגדרת יומן מותאם אישית (React Big Calendar)

מסמך זה מסביר כיצד להגדיר את הספרייה react-big-calendar לעמידה בדרישות הספציפיות: תצוגה בעברית, שעון 24 שעות, טווח שעות מוגבל ומרווחים של 15 דקות.

1. הגדרת שפה ותחילת שבוע (Localization)

כדי שהימים והחודשים יהיו בעברית והשבוע יתחיל ביום ראשון, אנו משתמשים ב-date-fns עם ה-Locale הישראלי (he).

import he from 'date-fns/locale/he';
const locales = { 'he': he };
const localizer = dateFnsLocalizer({ ..., locales });
// בקומפוננטה:
<Calendar culture='he' ... />


2. שעון 24 שעות (Formats)

כברירת מחדל, הספרייה משתמשת בפורמט AM/PM. כדי לשנות זאת, עלינו לדרוס את אובייקט ה-formats.

const formats = {
  // עיצוב השעה בציר הצד (09:00, 10:00)
  timeGutterFormat: (date, culture, localizer) =>
    localizer.format(date, 'HH:mm', culture),

  // עיצוב טווח שעות של אירוע (09:00 - 10:00)
  eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
    `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,

  // עיצוב כותרת סדר היום (Agenda)
  agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
    `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,
};


3. הגבלת שעות (Min/Max)

כדי להציג רק את השעות 06:00 עד 20:00, אנו משתמשים ב-Props min ו-max. חשוב לציין שהם מקבלים אובייקט Date (התאריך לא משנה, רק השעה).

const minTime = new Date();
minTime.setHours(6, 0, 0); // 06:00

const maxTime = new Date();
maxTime.setHours(20, 0, 0); // 20:00


4. מרווחים של רבע שעה (Step & Timeslots)

step={15}: קובע שכל משבצת גובה מייצגת 15 דקות.

timeslots={4}: קובע כמה משבצות כאלו נכנסות בשעה אחת (אופציונלי, משפיע על קווי הרשת). במקרה של רבע שעה, נהוג להשתמש ב-4 (כדי לראות קו כל שעה) או 2.

5. תצוגות (Views)

כדי להגביל את התצוגות האפשריות, אנו מעבירים מערך ל-views.
לגבי "תצוגת 3 ימים": הספרייה לא תומכת בכך ישירות "מהקופסה" (ללא כתיבת רכיב View מותאם אישית מורכב), לכן בדוגמה נשתמש ב-Week, Month ו-Day.

// הגבלת התצוגות בתפריט
views={['month', 'week', 'day']}


6. תיבת אירועים יומיים (All Day)

זוהי ברירת המחדל של הספרייה. כל אירוע שמוגדר כ-allDay: true או שאין לו שעה מוגדרת, יופיע בסטריפ העליון מעל השעות.