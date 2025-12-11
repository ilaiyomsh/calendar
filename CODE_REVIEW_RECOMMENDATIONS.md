# המלצות לשיפור וניקוי קוד

## סקירה כללית

מסמך זה מכיל המלצות לשיפור וניקוי הקוד שנמצאו במהלך סקירת קוד מקיפה של האפליקציה.

**תאריך סקירה**: 2024
**מספר קבצים שנסקרו**: 58
**סטטוס**: בסקירה

---

## קוד לא בשימוש

### פונקציות לא בשימוש
_יועדכן במהלך הסקירה_

### Imports לא בשימוש
_יועדכן במהלך הסקירה_

### Exports לא בשימוש
_יועדכן במהלך הסקירה_

### קבצים לא בשימוש
_יועדכן במהלך הסקירה_

---

## כפילויות

### קוד כפול

#### useProducts.js ו-useProductsMultiple.js
- **בעיה**: יש כפילות בלוגיקה של `fetchForCustomer` בין שני ה-hooks
- **קוד דומה**:
  - `useProducts.js:78-134` - `fetchForCustomer`
  - `useProductsMultiple.js:22-72` - `fetchForCustomer`
- **השפעה**: תחזוקה כפולה, עלול להוביל לחוסר עקביות
- **המלצה**: לשקול איחוד הלוגיקה לפונקציה משותפת ב-`mondayApi.js` או hook משותף
- **מיקום**: `src/hooks/useProducts.js`, `src/hooks/useProductsMultiple.js`
- **חומרה**: בינונית

#### calculateDropdownPosition - כפילות ב-5 רכיבים
- **בעיה**: אותה פונקציה מופיעה ב-5 רכיבים שונים:
  - `ProductSelect.jsx`
  - `StageSelect.jsx`
  - `TimeSelect.jsx`
  - `SearchableSelect.jsx`
  - `MultiSelect.jsx`
- **השפעה**: תחזוקה כפולה, עלול להוביל לחוסר עקביות
- **המלצה**: לחלץ ל-hook מותאם אישית: `useDropdownPosition`
- **מיקום**: כל ה-Select components
- **חומרה**: בינונית

#### useEffect לטיפול ב-scroll/resize - כפילות
- **בעיה**: אותו useEffect מופיע ב-5 רכיבים שונים (כל ה-Select components)
- **השפעה**: תחזוקה כפולה
- **המלצה**: לחלץ ל-hook מותאם אישית: `useDropdownPosition`
- **מיקום**: כל ה-Select components
- **חומרה**: בינונית

#### useEffect לטיפול ב-click outside - כפילות
- **בעיה**: אותו useEffect מופיע ב-5 רכיבים שונים (כל ה-Select components)
- **השפעה**: תחזוקה כפולה
- **המלצה**: לחלץ ל-hook מותאם אישית: `useClickOutside`
- **מיקום**: כל ה-Select components
- **חומרה**: בינונית

### פונקציות דומות

#### ProductSelect, StageSelect, TimeSelect - כפילות לוגיקה
- **בעיה**: שלושת הרכיבים חולקים לוגיקה דומה:
  - `calculateDropdownPosition` - זהה בכל שלושת הרכיבים
  - `useEffect` לטיפול ב-scroll/resize - זהה
  - `useEffect` לטיפול ב-click outside - זהה
  - מבנה dropdown דומה
- **השפעה**: תחזוקה כפולה, עלול להוביל לחוסר עקביות
- **המלצה**: לחלץ לוגיקה משותפת ל-hook מותאם אישית או רכיב בסיסי `BaseSelect`
- **מיקום**: 
  - `src/components/ProductSelect/ProductSelect.jsx`
  - `src/components/StageSelect/StageSelect.jsx`
  - `src/components/TimeSelect/TimeSelect.jsx`
- **חומרה**: בינונית

#### SearchableSelect ו-MultiSelect - כפילות לוגיקה
- **בעיה**: שני הרכיבים חולקים לוגיקה דומה:
  - `calculateDropdownPosition` - זהה
  - `useEffect` לטיפול ב-scroll/resize - זהה
  - `useEffect` לטיפול ב-click outside - זהה
  - מבנה dropdown דומה
- **השפעה**: תחזוקה כפולה
- **המלצה**: לחלץ לוגיקה משותפת ל-hook מותאם אישית או רכיב בסיסי
- **מיקום**: 
  - `src/components/SettingsDialog/SearchableSelect.jsx`
  - `src/components/SettingsDialog/MultiSelect.jsx`
- **חומרה**: בינונית

### לוגיקה משוכפלת

#### useMondayEvents.js - חישובי UTC
- **בעיה**: חישובי UTC מופיעים ב-`buildColumnValues` ו-`updateEventPosition`
- **קוד**:
  ```javascript
  // buildColumnValues (שורה 357-365)
  const utcYear = startTime.getUTCFullYear();
  // ...
  
  // updateEventPosition (שורה 589-597)
  const utcYear = newStart.getUTCFullYear();
  // ...
  ```
- **המלצה**: לחלץ לפונקציה עזר: `formatDateTimeToUTC(date)`
- **מיקום**: `src/hooks/useMondayEvents.js:357-365, 589-597`
- **חומרה**: נמוכה - שיפור קוד

#### AllDayEventModal - חישובי זמן
- **בעיה**: פונקציות `parseTime`, `formatTime`, `addTime` מופיעות ב-`AllDayEventModal`
- **השפעה**: לוגיקה שיכולה להיות משותפת
- **המלצה**: לשקול להעביר ל-`calendarConfig.js` או utils
- **מיקום**: `src/components/AllDayEventModal/AllDayEventModal.jsx:77-93`
- **חומרה**: נמוכה

---

## נקודות כשל

### טיפול בשגיאות
_יועדכן במהלך הסקירה_

### Null/Undefined Checks
_יועדכן במהלך הסקירה_

### Edge Cases
_יועדכן במהלך הסקירה_

### Async/Await Handling
_יועדכן במהלך הסקירה_

---

## עיצוב לא בשימוש

### CSS Classes לא בשימוש

#### App.css
- **בעיה**: Classes לא בשימוש - `.app-header`, `.header-container`, `.header-container h1`, `.header-actions`
- **קוד**: `src/App.css:10-36`
- **השפעה**: לא משפיע על הטמעה - זה קוד מיותר
- **המלצה**: להסיר את ה-classes שלא בשימוש
- **חומרה**: נמוכה

#### בדיקה נדרשת
- **בעיה**: צריך לבדוק את כל קבצי CSS modules אם יש classes/styles לא בשימוש
- **השפעה**: קוד מיותר, עלול להגדיל את גודל ה-bundle
- **המלצה**: להריץ כלי לזיהוי CSS לא בשימוש (purgecss, uncss, וכו')
- **חומרה**: נמוכה

### Styles לא בשימוש

#### calendar-custom.css - Hardcoded z-index
- **בעיה**: Hardcoded z-index values: `10002`, `10003`
- **קוד**: `src/calendar-custom.css:28-63`
- **השפעה**: עלול להיות בעייתי אם יש רכיבים אחרים עם z-index גבוה
- **המלצה**: לשקול שימוש ב-CSS variables או constants
- **חומרה**: נמוכה

#### AllDayEventModal.module.css
- **בעיה**: קובץ כבד מאוד - 529 שורות
- **השפעה**: עלול להכיל styles לא בשימוש
- **המלצה**: לבדוק אם יש styles לא בשימוש
- **חומרה**: נמוכה

---

## ערכים קבועים

### Hardcoded IDs
_יועדכן במהלך הסקירה_

### Hardcoded Board IDs
_יועדכן במהלך הסקירה_

### Hardcoded Column IDs
_יועדכן במהלך הסקירה_

### Hardcoded Strings

#### CustomEvent.jsx
- **בעיה**: Hardcoded strings: `'מחלה'`, `'חופשה'`, `'מילואים'`
- **קוד**: `src/components/CustomEvent/CustomEvent.jsx:9`
- **השפעה**: לא משפיע על הטמעה - זה לוגיקה פנימית
- **המלצה**: לשקול להעביר ל-constants
- **חומרה**: נמוכה

#### CalendarToolbar.jsx
- **בעיה**: Hardcoded messages object
- **קוד**: `src/components/CalendarToolbar.jsx:65-70`
- **השפעה**: לא משפיע על הטמעה - זה תרגום פנימי
- **המלצה**: תקין - זה תרגום פנימי
- **חומרה**: אין

#### Toast.jsx
- **בעיה**: Hardcoded icons
- **קוד**: `src/components/Toast/Toast.jsx:26-31`
- **השפעה**: לא משפיע על הטמעה
- **המלצה**: לשקול להעביר ל-constants
- **חומרה**: נמוכה

#### mondayColumns.js - Typos בהגדרות
- **בעיה**: שימוש ב-`settings.daurtion` (typo) במקום `settings.duration`
- **קוד**: `src/utils/mondayColumns.js:26-28`
  ```javascript
  if (settings.daurtion) { // שים לב לאיות המקורי בהגדרות
      columnIds.duration = Object.keys(settings.daurtion)[0];
  }
  ```
- **השפעה**: לא משפיע על הטמעה - זה backward compatibility
- **המלצה**: לשקול לתקן את ה-typo בהגדרות או להוסיף fallback
- **חומרה**: נמוכה

#### mondayColumns.js - Typo נוסף
- **בעיה**: שימוש ב-`settings.perent_item_board` (typo) במקום `settings.parent_item_board`
- **קוד**: `src/utils/mondayColumns.js:31-33`
  ```javascript
  if (settings.perent_item_board) {
      columnIds.connectedItem = Object.keys(settings.perent_item_board)[0];
  }
  ```
- **השפעה**: לא משפיע על הטמעה - זה backward compatibility
- **המלצה**: לשקול לתקן את ה-typo בהגדרות או להוסיף fallback
- **חומרה**: נמוכה

### Magic Numbers

#### MondayCalendar.jsx
- **שורה 368**: `86400000` - 24 שעות במילישניות
  - **השפעה**: לא משפיע על הטמעה - זה constant מתמטי
  - **המלצה**: לשקול להגדיר כ-constant: `const MILLISECONDS_IN_24_HOURS = 24 * 60 * 60 * 1000;`
  - **מיקום**: `src/MondayCalendar.jsx:368`

#### MondayCalendar.jsx - חישובי זמן
- **שורה 383, 557, 579**: `30 * 60 * 1000` - 30 דקות במילישניות
  - **השפעה**: לא משפיע על הטמעה - זה constant מתמטי
  - **המלצה**: לשקול להגדיר כ-constant: `const MIN_DURATION_MS = 30 * 60 * 1000;`
  - **מיקום**: `src/MondayCalendar.jsx:383, 557, 579`

#### vite.config.js
- **Port 8301**: hardcoded ב-`vite.config.js`
  - **השפעה**: לא משפיע על הטמעה - זה port של dev server
  - **המלצה**: אין צורך לשנות

#### package.json
- **Scripts לא בשימוש**: `test`, `eject` מ-react-scripts
  - **השפעה**: לא משפיע על הטמעה
  - **המלצה**: אפשר להסיר אם לא בשימוש

---

## בעיות React ספציפיות

### Dependency Arrays

#### Missing Dependencies

##### MondayCalendar.jsx - useEffect (שורה 142)
- **בעיה**: `useEffect` תלוי ב-`loadEvents` אבל `loadEvents` לא ב-dependency array
- **קוד**:
  ```javascript
  useEffect(() => {
      if (context?.boardId && customSettings?.dateColumnId) {
          // ...
          loadEvents(startOfWeek, endOfWeek);
      }
  }, [context?.boardId, customSettings?.dateColumnId, loadEvents]);
  ```
- **הערה**: למעשה `loadEvents` כן ב-dependencies, אבל צריך לבדוק אם הוא מוגדר כ-`useCallback` עם dependencies נכונים
- **מיקום**: `src/MondayCalendar.jsx:142`
- **חומרה**: בינונית - עלול לגרום ל-stale closure

##### useMondayEvents.js - loadEvents (שורה 333)
- **בעיה**: `loadEvents` תלוי ב-`buildAllRules` ו-`rulesToGraphQL` אבל הם לא ב-dependency array של `loadEvents`
- **קוד**:
  ```javascript
  const loadEvents = useCallback(async (startDate, endDate) => {
      // ...
      const allRules = buildAllRules(fromDateStr, toDateStr, currentFilter);
      const rulesGraphQL = rulesToGraphQL(allRules);
      // ...
  }, [context, customSettings, monday, currentFilter, buildAllRules, rulesToGraphQL]);
  ```
- **הערה**: למעשה `buildAllRules` ו-`rulesToGraphQL` כן ב-dependencies - תקין
- **מיקום**: `src/hooks/useMondayEvents.js:333`
- **חומרה**: נמוכה - תלוי ב-`buildAllRules` ו-`rulesToGraphQL` שהם `useCallback` עם dependencies נכונים

##### useMondayEvents.js - updateEvent, deleteEvent, updateEventPosition
- **בעיה**: תלויים ב-`events` ב-state, מה שעלול לגרום ל-re-renders מיותרים
- **קוד**:
  ```javascript
  const updateEvent = useCallback(async (eventId, eventData, startTime, endTime) => {
      const previousEvents = [...events]; // תלוי ב-events
      // ...
  }, [context, customSettings, monday, events, buildColumnValues]);
  ```
- **המלצה**: לשקול שימוש ב-functional update: `setEvents(prev => ...)` במקום תלות ב-`events`
- **מיקום**: `src/hooks/useMondayEvents.js:531, 562, 640`
- **חומרה**: בינונית - עלול לגרום ל-re-renders מיותרים

##### EventModal.jsx - useEffect (שורה 116)
- **בעיה**: dependency array ארוך מאוד עם nested properties
- **קוד**:
  ```javascript
  useEffect(() => {
      // ...
  }, [isOpen, isEditMode, eventToEdit, localCustomers, setSelectedItem, customSettings.productsCustomerColumnId, fetchForCustomer]);
  ```
- **הערה**: `setSelectedItem` יכול להיות function חדש בכל render אם הוא prop
- **המלצה**: לבדוק אם `setSelectedItem` צריך להיות ב-dependencies
- **מיקום**: `src/components/EventModal/EventModal.jsx:116`
- **חומרה**: נמוכה

##### EventModal.jsx - useEffect (שורה 133)
- **בעיה**: dependency array עם nested properties
- **קוד**:
  ```javascript
  useEffect(() => {
      // ...
  }, [selectedItem, isCreatingProduct, customSettings.productsCustomerColumnId, fetchForCustomer, isEditMode]);
  ```
- **הערה**: `fetchForCustomer` הוא function מ-hook - צריך להיות stable
- **מיקום**: `src/components/EventModal/EventModal.jsx:133`
- **חומרה**: נמוכה

##### AllDayEventModal.jsx - useEffect (שורה 141)
- **בעיה**: dependency array עם `refetchCustomers`
- **קוד**:
  ```javascript
  useEffect(() => {
      // ...
  }, [isOpen, isEditMode, eventToEdit, refetchCustomers]);
  ```
- **הערה**: `refetchCustomers` הוא function מ-hook - צריך להיות stable
- **מיקום**: `src/components/AllDayEventModal/AllDayEventModal.jsx:141`
- **חומרה**: נמוכה

#### Stale Closures

##### useMondayEvents.js - loadEvents
- **בעיה פוטנציאלית**: `loadEvents` תלוי ב-`currentFilter` אבל `currentFilter` משתנה דרך listener
- **קוד**: `src/hooks/useMondayEvents.js:333`
- **הערה**: למעשה זה תקין - `currentFilter` ב-state ו-`loadEvents` מתעדכן כשהוא משתנה
- **חומרה**: אין

##### MondayCalendar.jsx - useEffect (שורה 142)
- **בעיה פוטנציאלית**: `loadEvents` ב-dependency array, אבל `loadEvents` משתנה כש-`currentFilter` משתנה
- **קוד**: `src/MondayCalendar.jsx:142-156`
- **הערה**: זה תקין - `loadEvents` מתעדכן כש-`currentFilter` משתנה
- **חומרה**: אין

#### Empty Dependency Arrays

##### App.jsx - useEffect (שורה 20)
- **קוד**: `useEffect(() => {...}, [])`
- **הערה**: תקין - טעינה חד-פעמית של context
- **מיקום**: `src/App.jsx:20`

##### SettingsContext.jsx - useEffect (שורה 41)
- **קוד**: `useEffect(() => { loadSettings(); }, [])`
- **הערה**: תקין - טעינה חד-פעמית של הגדרות
- **מיקום**: `src/contexts/SettingsContext.jsx:41`

##### MondayCalendar.jsx - useEffect (שורה 106)
- **קוד**: `useEffect(() => {...}, [])`
- **הערה**: תקין - טעינה חד-פעמית של context
- **מיקום**: `src/MondayCalendar.jsx:106`

### Prop Drilling

#### Prop Drilling עמוק

##### EventModal
- **בעיה**: מקבל הרבה props מ-`MondayCalendar` (13 props)
- **Props**: `isOpen`, `onClose`, `pendingSlot`, `onCreate`, `eventToEdit`, `isEditMode`, `onUpdate`, `onDelete`, `selectedItem`, `setSelectedItem`, `monday`, ועוד
- **השפעה**: קשה לתחזוקה, עלול לגרום ל-re-renders מיותרים
- **המלצה**: לשקול שימוש ב-Context או state management library
- **מיקום**: `src/components/EventModal/EventModal.jsx`
- **חומרה**: בינונית

##### AllDayEventModal
- **בעיה**: מקבל הרבה props מ-`MondayCalendar` (9 props)
- **השפעה**: קשה לתחזוקה
- **המלצה**: לשקול שימוש ב-Context
- **מיקום**: `src/components/AllDayEventModal/AllDayEventModal.jsx`
- **חומרה**: בינונית

#### המלצות לשימוש ב-Context
- **המלצה**: לשקול יצירת `ModalContext` לניהול state של modals
- **יתרונות**: הפחתת prop drilling, קל יותר לתחזוקה
- **חומרה**: נמוכה - שיפור ארכיטקטורה

### Re-renders

#### רכיבים שצריכים memoization

##### MondayCalendar.jsx
- **בעיה**: רכיב כבד מאוד (951 שורות) ללא `React.memo`
- **השפעה**: עלול לגרום ל-re-renders מיותרים
- **המלצה**: לשקול wrap של הרכיב ב-`React.memo` אם הוא מקבל props שלא משתנים לעיתים קרובות
- **מיקום**: `src/MondayCalendar.jsx`

##### EventModal
- **בעיה**: רכיב כבד (395 שורות) ללא `React.memo`
- **השפעה**: עלול לגרום ל-re-renders מיותרים
- **המלצה**: לשקול wrap ב-`React.memo` עם custom comparison function
- **מיקום**: `src/components/EventModal/EventModal.jsx`
- **חומרה**: בינונית

##### AllDayEventModal
- **בעיה**: רכיב כבד מאוד (955 שורות) ללא `React.memo`
- **השפעה**: עלול לגרום ל-re-renders מיותרים
- **המלצה**: לשקול wrap ב-`React.memo` עם custom comparison function
- **מיקום**: `src/components/AllDayEventModal/AllDayEventModal.jsx`
- **חומרה**: בינונית

##### SettingsDialog
- **בעיה**: רכיב כבד מאוד (928 שורות) ללא `React.memo`
- **השפעה**: עלול לגרום ל-re-renders מיותרים
- **המלצה**: לשקול wrap ב-`React.memo`
- **מיקום**: `src/components/SettingsDialog/SettingsDialog.jsx`
- **חומרה**: בינונית

##### CustomToolbarWithProps
- **בעיה**: `useCallback` עם הרבה dependencies
- **השפעה**: עלול ליצור פונקציה חדשה בכל render אם dependencies משתנים
- **המלצה**: לבדוק אם כל ה-dependencies באמת נדרשים
- **מיקום**: `src/MondayCalendar.jsx:625`

#### חישובים כבדים שצריכים useMemo

##### MondayCalendar.jsx
- **בעיה**: חישוב `minTime` ו-`maxTime` בכל render
- **השפעה**: חישוב מיותר אם `customSettings.workDayStart/End` לא משתנים
- **המלצה**: לעטוף ב-`useMemo` עם dependency על `customSettings.workDayStart` ו-`customSettings.workDayEnd`
- **מיקום**: `src/MondayCalendar.jsx:43-49`

##### boardItems
- **בעיה**: `customers.map()` בכל render
- **השפעה**: יצירת מערך חדש בכל render
- **המלצה**: לעטוף ב-`useMemo` עם dependency על `customers`
- **מיקום**: `src/MondayCalendar.jsx:74-77`

#### Props/State שגורמים ל-re-renders מיותרים
_יועדכן במהלך הסקירה_

---

## בעיות Monday SDK

### טיפול בשגיאות API

#### קריאות API ללא טיפול בשגיאות
- **מצב**: ✅ כל הפונקציות ב-`mondayApi.js` עם try-catch
- **מיקום**: `src/utils/mondayApi.js`
- **הערה**: כל 13 הפונקציות מטפלות בשגיאות כראוי

#### Edge Cases לא מטופלים

##### mondayApi.js - Network Disconnections
- **בעיה**: אין retry logic לניתוקי רשת
- **השפעה**: קריאות API עלולות להיכשל בניתוקי רשת זמניים
- **המלצה**: לשקול הוספת retry logic עם exponential backoff
- **מיקום**: `src/utils/mondayApi.js`
- **חומרה**: בינונית

##### mondayApi.js - Timeout Errors
- **בעיה**: אין timeout handling
- **השפעה**: קריאות API עלולות להיתקע ללא הגבלת זמן
- **המלצה**: לשקול הוספת timeout ל-calls
- **מיקום**: `src/utils/mondayApi.js`
- **חומרה**: נמוכה

##### mondayApi.js - Rate Limiting
- **בעיה**: אין טיפול ב-rate limiting
- **השפעה**: עלול להיחסם על ידי Monday API
- **המלצה**: לשקול הוספת rate limiting או queue
- **מיקום**: `src/utils/mondayApi.js`
- **חומרה**: נמוכה

##### mondayApi.js - Empty Responses
- **מצב**: ✅ טיפול טוב - כל הפונקציות בודקות `response.data`
- **דוגמה**: `fetchAllBoardItems` בודק `itemsPage` לפני שימוש
- **מיקום**: `src/utils/mondayApi.js`

##### mondayApi.js - Invalid Responses
- **מצב**: ✅ טיפול טוב - `createBoardItem` בודק `response.errors`
- **מיקום**: `src/utils/mondayApi.js:166-168, 201-203`

#### Complexity Budget Exceeded

##### mondayApi.js - fetchAllBoardItems
- **בעיה**: Pagination עם limit 100 - עלול להיות כבד עם הרבה אייטמים
- **השפעה**: עלול לחרוג מ-Complexity Budget עם לוחות גדולים
- **המלצה**: לשקול הגדלת limit או הוספת timeout
- **מיקום**: `src/utils/mondayApi.js:46-127`
- **חומרה**: נמוכה - limit 100 הוא סביר

##### useMondayEvents.js - loadEvents
- **בעיה**: Pagination עם limit 500 - עלול להיות כבד
- **השפעה**: עלול לחרוג מ-Complexity Budget עם הרבה אירועים
- **המלצה**: limit 500 הוא סביר, אבל צריך לבדוק ב-production
- **מיקום**: `src/hooks/useMondayEvents.js:126`
- **חומרה**: נמוכה

### Performance

#### Queries כבדים
_יועדכן במהלך הסקירה_

#### מקרים שצריכים Pagination
_יועדכן במהלך הסקירה_

#### מקרים שצריכים Caching
_יועדכן במהלך הסקירה_

#### Queries מיותרים
_יועדכן במהלך הסקירה_

### Memory Leaks

#### Listeners ללא Cleanup

##### useMondayEvents.js - monday.listen
- **מצב**: ✅ יש cleanup - `unsubscribeFilter()` ב-return של useEffect
- **קוד**: `src/hooks/useMondayEvents.js:25-44`
- **הערה**: תקין - יש cleanup function
- **מיקום**: `src/hooks/useMondayEvents.js:42-44`

#### Subscriptions ללא Cleanup
- **מצב**: ✅ אין subscriptions ללא cleanup
- **הערה**: כל ה-listeners עם cleanup

---

## בעיות Security

### חשיפת מידע רגיש

#### לוגים עם מידע רגיש

##### logger.js - API Queries
- **בעיה**: `logger.api` מדפיס את ה-query המלא, שעלול להכיל IDs רגישים (board IDs, item IDs, column IDs)
- **קוד**: `src/utils/logger.js:163-173`
- **דוגמה**: 
  ```javascript
  logger.api('fetchProductsForCustomer', query);
  // מדפיס: query { items(ids: [123456789]) { ... } }
  ```
- **השפעה**: בפרודקשן לא מוצג (רק ERROR), אבל בפיתוח מוצג
- **המלצה**: לשקול להסיר או להסוות IDs רגישים מהלוגים בפיתוח
- **חומרה**: נמוכה - רק בפיתוח

##### logger.js - API Responses
- **בעיה**: `logger.apiResponse` מדפיס את ה-response המלא, שעלול להכיל נתונים רגישים
- **קוד**: `src/utils/logger.js:178-187`
- **השפעה**: בפרודקשן לא מוצג (רק ERROR), אבל בפיתוח מוצג
- **המלצה**: תקין - זה בפיתוח בלבד
- **חומרה**: נמוכה

##### logger.js - Error Stack Traces
- **בעיה**: `logger.error` ו-`logger.apiError` מדפיסים stack traces
- **קוד**: 
  - `src/utils/logger.js:154-156` - `logger.error`
  - `src/utils/logger.js:200-201` - `logger.apiError`
- **השפעה**: בפרודקשן מוצג (ERROR level) - עלול לחשוף מבנה פנימי
- **המלצה**: לשקול להסיר stack traces בפרודקשן או להסוות אותם
- **חומרה**: בינונית

##### logger.js - Error Messages
- **בעיה**: הודעות שגיאה עלולות להכיל מידע רגיש (IDs, נתונים)
- **קוד**: `src/utils/logger.js:148-158, 193-204`
- **השפעה**: בפרודקשן מוצג (ERROR level)
- **המלצה**: לוודא שהודעות שגיאה לא חושפות מידע רגיש
- **חומרה**: בינונית

#### console.log שנשכחו

##### logger.js
- **שורה 92, 94**: `console.log` פעיל - זה בסדר, זה חלק ממערכת הלוגים
- **שורה 155**: `console.error` פעיל - זה בסדר, זה חלק ממערכת הלוגים
- **שורה 167, 169, 182, 184**: `console.log` פעיל - זה בסדר, זה חלק ממערכת הלוגים
- **שורה 196, 198, 201**: `console.error` פעיל - זה בסדר, זה חלק ממערכת הלוגים
- **הערה**: כל ה-console.log/error ב-`logger.js` הם חלק ממערכת הלוגים - זה תקין

##### mondayApi.js
- **שורה 152-154, 190**: `console.log` מוערים (commented out) - ✅ תקין
- **המלצה**: אפשר להסיר את השורות המוערות אם לא נדרשות

##### SettingsDialog.jsx
- **שורה 183-184**: `console.log` מוערים (commented out) - ✅ תקין
- **המלצה**: אפשר להסיר את השורות המוערות אם לא נדרשות

#### הודעות שגיאה חושפניות
_יועדכן במהלך הסקירה_

#### Stack Traces בפרודקשן
_יועדכן במהלך הסקירה_

---

## המלצות כלליות

### שיפור ארכיטקטורה
_יועדכן במהלך הסקירה_

### שיפור ביצועים
_יועדכן במהלך הסקירה_

### שיפור תחזוקה
_יועדכן במהלך הסקירה_

## סיכום כללי

### סטטיסטיקות
- **סה"כ קבצים נסקרו**: 31+ קבצים
- **קטגוריות נסקרו**: 10 (A-J)
- **ממצאים עיקריים**:
  - **כפילויות**: 5 מקרים עיקריים
  - **Dependency Arrays**: 3 מקרים שצריך לבדוק
  - **Re-renders**: 4 רכיבים שצריכים memoization
  - **Security**: 4 מקרים
  - **Monday SDK**: 3 מקרים
  - **Hardcoded Values**: 5 מקרים
  - **CSS לא בשימוש**: 1 קובץ

### עדיפויות תיקון

#### עדיפות גבוהה
1. **useMondayEvents.js** - Hook כבד מאוד (661 שורות) - לשקול פיצול
2. **AllDayEventModal.jsx** - רכיב כבד מאוד (955 שורות) - לשקול פיצול
3. **SettingsDialog.jsx** - רכיב כבד מאוד (928 שורות) - לשקול פיצול
4. **useMondayEvents.js** - תלות ב-`events` ב-state - לשקול functional updates

#### עדיפות בינונית
1. **כפילויות ב-Select components** - לחלץ ל-hook משותף
2. **Prop drilling** - לשקול Context
3. **React.memo** - להוסיף לרכיבים כבדים
4. **Network retry logic** - להוסיף ל-mondayApi

#### עדיפות נמוכה
1. **Hardcoded strings** - להעביר ל-constants
2. **CSS לא בשימוש** - להסיר
3. **Inline styles** - להעביר ל-CSS modules
4. **Console.log מוערים** - להסיר

---

*מסמך זה עודכן כחלק מסקירת קוד מקיפה*

