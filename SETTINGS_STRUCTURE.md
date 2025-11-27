# מבנה הגדרות האפליקציה - יומן דיווח שעות

## סקירה כללית

האפליקציה משתמשת במבנה הגדרות מפורט שמאפשר קישור בין לוח דיווח שעות נוכחי ללוח חיצוני (לדוגמה: לוח לקוחות).

---

## מבנה customSettings

```javascript
{
  // === לוח חיצוני ===
  connectedBoardId: string | null,     // ID של הלוח החיצוני לשיוך אייטמים
  peopleColumnId: string | null,       // ID של עמודת people בלוח החיצוני
  
  // === לוח נוכחי (context.boardId) ===
  dateColumnId: string | null,         // ID של עמודת Date למועד התחלה
  durationColumnId: string | null,     // ID של עמודת Hour למשך זמן
  projectColumnId: string | null,      // ID של עמודת Connected Board
  
  // === הגדרות נוספות ===
  showRedCircle: boolean               // הצגת עיגול אדום ליד כפתור ההגדרות
}
```

---

## תיאור השדות

### 1. לוח חיצוני (connectedBoardId)
- **סוג**: Board ID
- **תיאור**: לוח ממנו נבחר אייטמים לשיוך לאירועים
- **דוגמה**: לוח לקוחות, לוח פרויקטים
- **שימוש**: כאשר משתמש יוצר אירוע חדש, הוא יכול לבחור אייטם מהלוח הזה לשיוך

### 2. עמודת לשיוך (peopleColumnId)
- **סוג**: Column ID (type: people)
- **תיאור**: עמודה בלוח החיצוני המכילה רשימת אנשים
- **שימוש**: מסננת אייטמים - רק אייטמים שבהם המשתמש המחובר מופיע בעמודה זו יוצגו לבחירה
- **לוגיקה**: אם המשתמש לא מופיע בעמודת ה-people של אייטם, האייטם לא יוצג לו

### 3. עמודת תאריך התחלה (dateColumnId)
- **סוג**: Column ID (type: date)
- **תיאור**: עמודה בלוח הנוכחי שמאחסנת את מועד תחילת האירוע
- **שימוש**: כשמוסיפים אירוע בלוח השנה, התאריך והשעה יישמרו בעמודה זו

### 4. עמודת משך זמן (durationColumnId)
- **סוג**: Column ID (type: hour)
- **תיאור**: עמודה בלוח הנוכחי שמאחסנת את משך האירוע
- **שימוש**: הפרש הזמן בין תחילת האירוע לסיומו יישמר בעמודה זו

### 5. עמודת פרויקט (projectColumnId)
- **סוג**: Column ID (type: board_relation)
- **תיאור**: עמודת connected board שמקשרת בין הלוח הנוכחי ללוח החיצוני
- **דרישה**: עמודה זו חייבת להיות מוגדרת לקשר ספציפית ללוח שנבחר ב-connectedBoardId
- **שימוש**: יוצרת את הקישור בין רשומת הדיווח לאייטם בלוח החיצוני

---

## זרימת עבודה

### בהגדרת האפליקציה:

1. **בחירת לוח חיצוני** (connectedBoardId)
   - משתמש בוחר לוח מתוך כל הלוחות במרחב העבודה
   - מפעיל טעינה של עמודות people מהלוח

2. **בחירת עמודת people** (peopleColumnId)
   - מציג רק עמודות מסוג "people" מהלוח שנבחר
   - שדה זה פעיל רק אם נבחר לוח

3. **בחירת עמודות מהלוח הנוכחי**:
   - **עמודת תאריך**: מציג רק עמודות מסוג "date"
   - **עמודת משך זמן**: מציג רק עמודות מסוג "hour"
   - **עמודת פרויקט**: מציג רק עמודות מסוג "board_relation" שמקושרות ללוח החיצוני

### ביצירת אירוע חדש:

1. המערכת שולפת אייטמים מהלוח החיצוני (connectedBoardId)
2. מסננת אייטמים לפי עמודת ה-people (peopleColumnId) - רק אייטמים שבהם המשתמש מופיע
3. משתמש בוחר אייטם מהרשימה המסוננת
4. יוצרת רשומה חדשה בלוח הנוכחי עם:
   - תאריך התחלה בעמודת dateColumnId
   - משך זמן בעמודת durationColumnId
   - קישור לאייטם בעמודת projectColumnId

---

## שמירה ואחזור

### שמירה
הגדרות נשמרות ב-Monday Storage במפתח `customSettings`:
```javascript
await monday.storage.instance.setItem('customSettings', JSON.stringify(settings));
```

### אחזור
הגדרות נטענות בעליית האפליקציה:
```javascript
const result = await monday.storage.instance.getItem('customSettings');
const settings = JSON.parse(result.data.value);
```

---

## אימות נתונים

לפני שמירת הגדרות, יש לוודא:

1. ✅ נבחר לוח חיצוני (connectedBoardId)
2. ✅ נבחרה עמודת people בלוח החיצוני (peopleColumnId)
3. ✅ נבחרו כל 3 העמודות בלוח הנוכחי:
   - dateColumnId
   - durationColumnId
   - projectColumnId
4. ✅ עמודת הפרויקט (projectColumnId) אכן מקושרת ללוח החיצוני

---

## דוגמה למבנה מלא

```javascript
{
  connectedBoardId: "123456789",
  peopleColumnId: "people",
  dateColumnId: "date4",
  durationColumnId: "hour",
  projectColumnId: "connect_boards",
  showRedCircle: true
}
```

---

## UI של מסך ההגדרות

המסך מחולק ל-2 קטגוריות:

### 📋 הגדרות לוח חיצוני
1. לוח לחיבור (SearchableSelect עם חיפוש)
2. עמודת לשיוך - אנשים (SearchableSelect עם חיפוש)

### 📋 הגדרות לוח נוכחי
3. עמודת תאריך התחלה (SearchableSelect עם חיפוש)
4. עמודת משך זמן (SearchableSelect עם חיפוש)
5. עמודת קישור לפרויקט (SearchableSelect עם חיפוש)

כל שדה כולל:
- תווית מתארת
- תיאור קצר מתחת לתווית
- רכיב SearchableSelect עם חיפוש מובנה
- הודעת שגיאה אם אין אפשרויות מתאימות

---

## שיקולים טכניים

### Context
- `context.boardId` - ID של הלוח הנוכחי (נדרש לטעינת עמודות הלוח הנוכחי)
- נטען באמצעות `monday.get('context')`

### סינון עמודות Connected Board
עמודות ה-connected board מסוננות לפי `settings_str`:
```javascript
const settings = JSON.parse(col.settings_str);
const isLinked = settings.boardIds && 
                 settings.boardIds.includes(parseInt(connectedBoardId));
```

### מצבי טעינה
- `loadingBoards` - טעינת לוחות
- `loadingPeopleColumns` - טעינת עמודות people
- `loadingCurrentBoardColumns` - טעינת עמודות הלוח הנוכחי

---

## שגיאות אפשריות

| שגיאה | פתרון |
|-------|--------|
| לא נמצאו עמודות people | יש ליצור עמודת people בלוח החיצוני |
| לא נמצאו עמודות date | יש ליצור עמודת date בלוח הנוכחי |
| לא נמצאו עמודות hour | יש ליצור עמודת hour בלוח הנוכחי |
| לא נמצאו עמודות connected board | יש ליצור עמודת connected board המקושרת ללוח החיצוני |
| אין context.boardId | יש לפתוח את האפליקציה מתוך לוח |

---

## גרסה
- תאריך יצירה: נובמבר 2024
- גרסה: 1.0
- מפתח: AI Assistant

