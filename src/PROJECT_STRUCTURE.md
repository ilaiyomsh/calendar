# מבנה הפרויקט - יומן דיווח שעות

## סקירה כללית
אפליקציה ליצירת ולניהול יומן שעות משולב עם Monday.com, המאפשרת גרירה ושחרור של אירועים, בחירת תאריכים ושעות, וחיבור לאייטמים מלוחות Monday.

## מבנה התיקיות

```
src/
├── components/              # רכיבי React לשימוש חוזר
│   ├── CustomDatePicker.jsx  # בורר תאריכים מותאם אישית
│   └── EventModal.jsx         # חלון ליצירת אירוע חדש
│
├── constants/              # קבועים והגדרות
│   └── calendarConfig.js    # הגדרות לוח שנה, לוקליזציה, אופציות שעות
│
├── utils/                  # פונקציות עזר
│   └── mondayApi.js         # פונקציות לעבודה עם Monday API
│
├── MondayCalendar.jsx      # קומפוננטת הלוח הראשית
├── App.jsx                 # נקודת הכניסה לאפליקציה
├── index.jsx               # רינדור React
├── init.js                 # אתחול
├── calendar-custom.css     # עיצוב מותאם ללוח
└── index.css               # עיצוב כללי
```

## רכיבים עיקריים

### `MondayCalendar.jsx`
הקומפוננטה הראשית המנהלת את:
- הצגת לוח השנה עם אירועים
- גרירה ושחרור של אירועים
- פתיחת modal ליצירת אירועים
- ניהול state כללי
- אינטגרציה עם Monday API

### `components/EventModal.jsx`
חלון מודאלי ליצירת אירוע חדש, כולל:
- בחירת שעת התחלה וסיום
- בחירת תאריך
- בחירת אייטם מלוח Monday
- אימות טופס

### `components/CustomDatePicker.jsx`
בורר תאריכים מותאם אישית עם:
- תצוגה חודשית
- ניווט בין חודשים
- היילייט של התאריך הנבחר
- תמיכה בעברית (RTL)

### `constants/calendarConfig.js`
קובץ קבועים המכיל:
- `localizer` - הגדרות לוקליזציה עברית
- `hebrewMessages` - תרגומים לעברית
- `timeOptions` - רשימת שעות בקפיצות של 15 דקות
- ברירות מחדל לטווח שעות

### `utils/mondayApi.js`
פונקציות עזר ל-Monday API:
- `parseTimeString` - המרת מחרוזת שעה ל-Date
- `fetchColumnSettings` - אחזור הגדרות עמודה
- `fetchAllBoardItems` - אחזור כל האייטמים מלוח (עם pagination)
- `createBoardItem` - יצירת אייטם חדש עם ערכי עמודות
- `fetchEventsFromBoard` - שליפת אירועים מהלוח

### `utils/mondayColumns.js`
ניהול מיפוי ופרסור של עמודות Monday:
- `getColumnIds` - חילוץ מזהי עמודות מההגדרות
- `parseDateColumn` - פרסור עמודת תאריך + זמן
- `parseHourColumn` - פרסור עמודת משך זמן
- `parseBoardRelationColumn` - פרסור עמודת קישור ללוח
- `mapItemToEvent` - המרת אייטם Monday לאירוע בלוח
- `buildColumnValues` - בניית JSON לערכי עמודות
- `buildFetchEventsQuery` - בניית query לשליפת אירועים

## תלויות עיקריות
- `react-big-calendar` - קומפוננטת לוח שנה
- `date-fns` - עבודה עם תאריכים
- `@vibe/core` - רכיבי UI של Monday
- `monday-sdk-js` - SDK של Monday

## זרימת עבודה

### טעינת אירועים מ-Monday
1. **אתחול**: טעינת context והגדרות מ-Monday
2. **חילוץ מזהי עמודות**: זיהוי עמודות תאריך, משך זמן ו-board relation
3. **שליפת אירועים**: query עם סינון לפי טווח תאריכים
4. **מיפוי**: המרת items ל-events (חישוב שעת סיום מתאריך + משך)
5. **תצוגה**: הצגת אירועים בלוח

### יצירת אירוע חדש
1. **לחיצה על סלוט ריק**: פתיחת Modal
2. **בחירת פרטים**: תאריך, שעות, אייטם מקושר
3. **חישוב משך זמן**: אוטומטי לפי תאריך התחלה וסיום
4. **בניית column_values**: JSON עם כל הערכים
5. **שליחה ל-Monday**: mutation create_item
6. **עדכון UI**: הוספת האירוע ללוח (Optimistic UI)

## הערות לפיתוח
- כל ה-state מנוהל ב-`MondayCalendar.jsx`
- רכיבים מקבלים props ו-callbacks
- פונקציות Monday API מבודדות ב-`utils/mondayApi.js`
- עיצוב מותאם ב-`calendar-custom.css`

