# תוכנית בדיקות - Calendar App

## מצב נוכחי
- **0 בדיקות** בפרויקט
- ~40 קבצי utility, ~20 hooks, ~15 components
- הרבה לוגיקה קריטית: חישובי תאריכים, GraphQL queries, טרנספורמציית נתונים
- שגיאות שקטות (silent failures) הן הסיכון הגדול ביותר

## Stack טכנולוגי
- **Vitest** - תואם Vite, מהיר, אפס קונפיגורציה כמעט
- **React Testing Library** + **@testing-library/jest-dom** - בדיקות קומפוננטות
- **@testing-library/user-event** - סימולציית אינטראקציות משתמש
- **jsdom** - סביבת דפדפן וירטואלית

## מבנה תיקיות
```
src/
├── __mocks__/                    # מוקים גלובליים
│   └── mondaySdk.js              # מוק ל-Monday SDK
├── utils/
│   └── __tests__/                # בדיקות ליחידות utility
│       ├── durationUtils.test.js
│       ├── boardIdResolver.test.js
│       ├── eventTypeMapping.test.js
│       ├── dateFormatters.test.js
│       ├── colorUtils.test.js
│       └── eventTypeValidation.test.js
├── hooks/
│   └── __tests__/                # בדיקות ל-hooks
│       ├── useCalendarFilter.test.js
│       └── useEventModals.test.js
└── setupTests.js                 # Setup גלובלי
```

---

## שלב 1: תשתית + Utility Tests (הנוכחי)

### 1A: התקנה וקונפיגורציה
- התקנת dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- קונפיגורציית Vitest ב-`vite.config.js` (הוספת בלוק `test`)
- יצירת `src/setupTests.js` עם import של `@testing-library/jest-dom`
- עדכון scripts ב-`package.json`: `"test": "vitest"`, `"test:run": "vitest run"`
- עדכון CLAUDE.md עם פקודות הבדיקה

### 1B: בדיקות Pure Utility Functions
פונקציות טהורות - **ללא מוקים**, ROI הכי גבוה:

#### `durationUtils.test.js` (~15 בדיקות)
קובץ קריטי - חישובי משך שגויים = דיווח שעות שגוי בפרודקשן

| בדיקה | מה מונע |
|-------|---------|
| `calculateDaysDiff` - אותו תאריך = מינימום 1 | באג של 0 ימים חופשה |
| `calculateDaysDiff` - הפרש תקין (3 ימים) | חישוב שגוי |
| `calculateDaysDiff` - end לפני start (abs) | שגיאה בגרירת אירוע |
| `calculateEndDateFromDays` - 1 יום | תאריך סיום שגוי |
| `calculateEndDateFromDays` - 3 ימים | חישוב bulk שגוי |
| `calculateEndDateFromDays` - אפס ימים = מינימום 1 | exclusive end נכון |
| `parseDuration` - שעתי (hours) | פרסור משך שגוי |
| `parseDuration` - יומי (days) | סוג יחידה שגוי |
| `parseDuration` - ערך 0 ביומי = 1 | חופשה של 0 ימים |
| `parseDuration` - מחרוזת במקום מספר | crash |
| `formatDurationForSave` - שעות (עשרוני) | שמירה שגויה ב-Monday |
| `formatDurationForSave` - ימים (שלם) | שמירה שגויה ב-Monday |

#### `boardIdResolver.test.js` (~12 בדיקות)
לוגיקת fallback - באג כאן = האפליקציה כותבת ללוח הלא נכון

| בדיקה | מה מונע |
|-------|---------|
| `getEffectiveBoardId` - useCurrentBoard=true + context | כתיבה ללוח שגוי |
| `getEffectiveBoardId` - useCurrentBoard=false + timeReportingBoardId | fallback שגוי |
| `getEffectiveBoardId` - fallback ל-context.boardId | אפליקציה ללא לוח |
| `getEffectiveBoardId` - הכל null = null | crash |
| `hasValidReportingBoard` - יש לוח = true | אפליקציה לא עולה |
| `hasValidReportingBoard` - אין לוח = false | שגיאות שקטות |
| `isCustomObjectMode` - ללא context.boardId | מצב Custom Object לא מזוהה |
| `isCustomObjectMode` - עם context.boardId = false | מצב רגיל מזוהה כ-Custom |

#### `eventTypeMapping.test.js` (~20 בדיקות)
מיפוי סוגי אירועים - באג כאן = אירועים מסווגים לא נכון

| בדיקה | מה מונע |
|-------|---------|
| `getCategory` - אינדקס תקין | זיהוי שגוי של סוג אירוע |
| `getCategory` - null/undefined inputs | crash |
| `getBillableIndex` - מחזיר את האינדקס הנכון | אירוע לחיוב לא מזוהה |
| `getTemporaryIndex` - מחזיר את האינדקס הנכון | אירוע זמני לא מזוהה |
| `getAllDayIndexes` - מחזיר כל האינדקסים | חופשה/מחלה לא מזוהים |
| `getNonBillableIndexes` - מחזיר כל האינדקסים | לא לחיוב לא מזוהה |
| Boolean checkers: `isBillableIndex`, `isAllDayIndex` וכו' | סיווג שגוי |
| `getLabelText` / `getLabelColor` - שליפת מטא נכונה | תצוגה שגויה |
| `getLabelsByCategory` - סינון נכון | רשימת אפשרויות שגויה |
| `validateMapping` - מיפוי תקין | הגדרות שגויות מתקבלות |
| `validateMapping` - חסר billable | שגיאה לא מזוהה |
| `validateMapping` - כפול billable | סיווג דו-משמעי |
| `validateMapping` - חסר allDay | אירועים יומיים לא עובדים |
| `validateMapping` - mapping ריק | crash |
| `createLegacyMapping` - מיגרציה אוטומטית מלייבלים ידועים | שדרוג שובר הגדרות |
| `isLegacyMapping` - זיהוי פורמט ישן | מיגרציה לא מופעלת |

#### `dateFormatters.test.js` (~10 בדיקות)
פורמוט תאריכים - באג כאן = תאריך שגוי נשלח ל-Monday API

| בדיקה | מה מונע |
|-------|---------|
| `toMondayDateFormat` - פורמט YYYY-MM-DD | שמירה שגויה |
| `toMondayTimeFormat` - פורמט HH:MM:SS | שעה שגויה |
| `formatDateHebrew` - תצוגה עברית | תאריך מוצג לא נכון |
| UTC vs local edge cases | שעון קיץ/חורף |

#### `eventTypeValidation.test.js` (~10 בדיקות)

| בדיקה | מה מונע |
|-------|---------|
| `parseStatusColumnLabels` - מערך לייבלים | פרסור שגוי מ-API |
| `parseStatusColumnLabels` - אובייקט (פורמט ישן) | תאימות לאחור נשברת |
| `parseStatusColumnLabels` - מחרוזת JSON | פרסור נכשל |
| `parseStatusColumnLabels` - לייבלים מושבתים מסוננים | לייבל מחוק עדיין מופיע |
| `validateEventTypeColumn` - כל הלייבלים קיימים | ולידציה שגויה |
| `validateEventTypeColumn` - לייבלים חסרים | אפליקציה עולה עם הגדרות שבורות |

---

## סיכום שלב 1

| מה | כמות בדיקות | מה מונע |
|----|------------|---------|
| `durationUtils` | ~15 | דיווח שעות/ימים שגוי |
| `boardIdResolver` | ~12 | כתיבה ללוח הלא נכון |
| `eventTypeMapping` | ~20 | סיווג אירועים שגוי |
| `dateFormatters` | ~10 | תאריכים שגויים ב-API |
| `eventTypeValidation` | ~10 | הגדרות שבורות מתקבלות |
| **סה"כ** | **~67** | **הבאגים הכי נפוצים** |

**הרציונל:** כל הפונקציות האלה הן pure functions - קלות לבדיקה, אין צורך במוקים, ומכסות את הלוגיקה הקריטית ביותר (חישובים, ולידציות, מיפויים). באג בכל אחת מהן מתפשט לכל האפליקציה.

---

## שלבים עתידיים (לא מיושמים עכשיו)

### שלב 2: Hooks פשוטים
- `useCalendarFilter` - בניית filter rules
- `useEventModals` - ניהול מצב מודלים
- `useMultiSelect` - לוגיקת בחירה מרובה

### שלב 3: API Layer + Error Handling
- מוק ל-Monday SDK
- `mondayApi.js` - שאילתות GraphQL
- `errorHandler.js` - פרסור שגיאות

### שלב 4: Hooks מורכבים
- `useMondayEvents` - טעינת אירועים + pagination
- `useAllDayEvents` - אירועים יומיים + bulk
- `useFilterOptions` - טעינת אפשרויות פילטר

### שלב 5: Component Tests
- `EventModal` - טפסים + ולידציה
- `AllDayEventModal` - דיווח bulk
- `FilterBar` - פילטרים

### שלב 6: CI/CD
- GitHub Actions workflow
- בדיקות אוטומטיות על כל push/PR
