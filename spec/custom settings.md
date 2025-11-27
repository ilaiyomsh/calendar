# מדריך להוספת Custom Settings (כפתור פנימי)

מדריך זה מסביר כיצד להוסיף ניהול הגדרות פנימי לאפליקציית Monday (שאינו תלוי במסך הקונפיגורציה החיצוני).

## שלב 1: ניהול ה-State באפליקציה הראשית

בקובץ `App.jsx`, עליך להוסיף State שיחזיק את אובייקט ההגדרות ואת מצב הפתיחה של הדיאלוג.

```jsx
const [appSettings, setAppSettings] = useState({ showRedCircle: true }); // ערך ברירת מחדל
const [isSettingsOpen, setIsSettingsOpen] = useState(false);
```

## שלב 2: טעינת הגדרות בעלייה (Load)

השתמש ב-`useEffect` כדי לשלוף את ההגדרות השמורות ממאנדיי ברגע שהאפליקציה נטענת.

```jsx
useEffect(() => {
  monday.get("settings").then((res) => {
    if (res.data) {
      // מיזוג עם ברירת המחדל למקרה שחסרים שדות
      setAppSettings(prev => ({ ...prev, ...res.data }));
    }
  });
}, []);
```

## שלב 3: פונקציית שמירה (Save)

צור פונקציה שמקבלת את ההגדרות החדשות, מעדכנת את ה-UI מיד, ושולחת אותן למאנדיי ברקע.

```jsx
const handleSaveSettings = (newSettings) => {
  setAppSettings(newSettings); // עדכון ה-UI
  monday.set("settings", newSettings); // שמירה בשרת
};
```

## שלב 4: הוספת הכפתור והאינדיקטור ל-Header

הוסף את כפתור ההגדרות (אייקון) לאזור הניווט העליון. השתמש ב-State כדי להציג או להסתיר את העיגול האדום.

```jsx
<div className="relative">
  <button onClick={() => setIsSettingsOpen(true)}>
    <SettingsIcon />
  </button>
  
  {/* תנאי להצגת העיגול האדום */}
  {appSettings.showRedCircle && (
    <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
  )}
</div>
```

## שלב 5: יצירת הדיאלוג (SettingsDialog)

צור רכיב שמקבל את ההגדרות הנוכחיות כ-Prop, ומחזיר את ההגדרות החדשות כשהמשתמש לוחץ "שמור".

## איך לבדוק שזה עובד?

1. לחץ על כפתור ההגדרות ב-Header.
2. כבה את המתג "הצג חיווי התראה".
3. לחץ "שמור".
   - **תוצאה ויזואלית**: העיגול האדום ליד הכפתור ייעלם מיד.
4. לחץ על הכפתור "הדפס הגדרות" (שיצרנו בקוד הדוגמה).
   - **תוצאה לוגית**: תוודא שמוצג alert או לוג בקונסול שמכיל: `{"showRedCircle": false}`.
5. רענן את העמוד (Refresh). ההגדרות אמורות להישמר (העיגול לא יחזור).
