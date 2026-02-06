import React, { createContext, useState, useEffect, useContext } from 'react';
import logger from '../utils/logger';

// יצירת Context
const SettingsContext = createContext(null);

// מצבי מבנה הדיווח
export const STRUCTURE_MODES = {
  PROJECT_ONLY: 'PROJECT_ONLY',                           // רמה 1 בלבד - פרויקט
  PROJECT_WITH_STAGE: 'PROJECT_WITH_STAGE',               // רמה 1 + סיווג (סטטוס)
  PROJECT_WITH_TASKS: 'PROJECT_WITH_TASKS'                // רמה 1 + משימות (Items)
};

// ברירות מחדל להגדרות
const DEFAULT_SETTINGS = {
  // --- הגדרות מבנה (Structure) ---
  structureMode: STRUCTURE_MODES.PROJECT_WITH_STAGE,  // ברירת מחדל: פרויקט + סיווג
  enableNotes: true,                                   // אפשר הוספת מלל חופשי
  showHolidays: true,                                  // הצג חגים ישראליים בלוח
  
  // --- לוח פרויקטים (רמה 1) ---
  connectedBoardId: null,           // לוח הפרויקטים
  peopleColumnIds: [],              // עמודות people לסינון לפי משתמש
  
  // פילטר סטטוס לפרויקטים
  projectStatusFilterEnabled: false,
  projectStatusColumnId: null,
  projectActiveStatusValues: [],
  
  // --- לוח משימות (רמה 2 - רק במצבי TASKS) ---
  tasksBoardId: null,               // לוח המשימות
  tasksProjectColumnId: null,       // עמודת Connect Boards בלוח פרויקטים שמקשרת למשימות
  
  // פילטר סטטוס למשימות
  taskStatusFilterEnabled: false,
  taskStatusColumnId: null,
  taskActiveStatusValues: [],
  
  // --- לוח הקצאות (Assignments) - אופציונלי ---
  useAssignmentsMode: false,          // האם להשתמש בלוח הקצאות למשיכת פרויקטים
  assignmentsBoardId: null,           // לוח ההקצאות
  assignmentPersonColumnId: null,     // עמודת People בלוח הקצאות
  assignmentStartDateColumnId: null,  // עמודת Date להתחלת ההקצאה
  assignmentEndDateColumnId: null,    // עמודת Date לסיום ההקצאה
  assignmentProjectLinkColumnId: null, // עמודת Connect Boards לקישור לפרויקט

  // --- לוח דיווחי שעות ---
  useCurrentBoardForReporting: true, // האם להשתמש בלוח הנוכחי לדיווחים (ברירת מחדל: כן)
  timeReportingBoardId: null,        // מזהה לוח דיווחי שעות (אם לא משתמשים בלוח הנוכחי)
  dateColumnId: null,               // עמודת Date למועד התחלה
  endTimeColumnId: null,            // עמודת Date לזמן סיום (אופציונלי)
  durationColumnId: null,           // עמודת Numbers למשך זמן בשעות
  projectColumnId: null,            // עמודת Connected Board לקישור לפרויקט
  taskColumnId: null,               // עמודת Connected Board לקישור למשימה (רק במצבי TASKS)
  assignmentColumnId: null,         // עמודת Connected Board לקישור להקצאה (רק במצב הקצאות)
  reporterColumnId: null,           // עמודת People למדווח
  eventTypeStatusColumnId: null,    // עמודת Status לסוג האירוע (לחיוב/לא לחיוב)
  nonBillableStatusColumnId: null,  // עמודת Status לסוגי "לא לחיוב"
  stageColumnId: null,              // עמודת Status/Dropdown לסיווג (רק במצבי STAGE)
  notesColumnId: null,              // עמודת Text להערות חופשיות (רק אם enableNotes)

  // --- אירועים זמניים ---
  // לייבל "זמני" בעמודת סוג דיווח מסמן אירוע זמני/מתוכנן
  // כל לייבל אחר (שעתי, חופשה, מחלה, מילואים) מסמן אירוע קבוע
  // בעת המרה - המשתמש בוחר את סוג האירוע והסיווג בטופס
  showTemporaryEvents: true,     // האם להציג אירועים זמניים בלוח

  // --- מיפוי סוגי דיווח ---
  eventTypeMapping: null,          // { 'labelName': 'category', ... } - מיפוי לייבלים לקטגוריות
  eventTypeLabelColors: null,      // { 'labelName': '#hex', ... } - צבעי הלייבלים מ-Monday

  // --- Filter Configuration ---
  filterProjectsBoardId: null,   // לוח שממנו נטען רשימת הפרויקטים לפילטר
  filterEmployeesBoardId: null,  // לוח שממנו נטען רשימת העובדים לפילטר
  filterEmployeesColumnId: null  // עמודת People בלוח העובדים
};

// Provider Component
export function SettingsProvider({ monday, children }) {
  const [customSettings, setCustomSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // טעינת הגדרות מ-Monday Storage בעלייה
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await monday.storage.instance.getItem('customSettings');
      
      if (result.data && result.data.value) {
        const savedSettings = JSON.parse(result.data.value);
        
        // מיגרציה של מפתחות ישנים לחדשים (תאימות לאחור)
        const migratedSettings = { ...savedSettings };
        
        // מיגרציה של שמות ישנים (products -> tasks)
        if (savedSettings.productsBoardId && !savedSettings.tasksBoardId) {
          migratedSettings.tasksBoardId = savedSettings.productsBoardId;
        }
        if (savedSettings.productsCustomerColumnId && !savedSettings.tasksProjectColumnId) {
          migratedSettings.tasksProjectColumnId = savedSettings.productsCustomerColumnId;
        }
        if (savedSettings.productColumnId && !savedSettings.taskColumnId) {
          migratedSettings.taskColumnId = savedSettings.productColumnId;
        }
        
        // זיהוי אוטומטי של structureMode אם לא קיים
        if (!savedSettings.structureMode) {
          migratedSettings.structureMode = detectStructureMode(migratedSettings);
          logger.info('SettingsContext', 'Auto-detected structureMode', { mode: migratedSettings.structureMode });
        }
        
        // מיגרציה של useStageField ל-structureMode
        if (savedSettings.useStageField !== undefined && !savedSettings.structureMode) {
          // אם יש משימות, זה PROJECT_WITH_TASKS
          // אם אין משימות ויש stage, זה PROJECT_WITH_STAGE
          // אם אין משימות ואין stage, זה PROJECT_ONLY
        }
        
        // הסרת שדות ישנים שכבר לא בשימוש
        delete migratedSettings.useStageField;
        delete migratedSettings.useEmployeeCost;
        delete migratedSettings.employeesBoardId;
        delete migratedSettings.employeesPersonColumnId;
        delete migratedSettings.employeesHourlyRateColumnId;
        delete migratedSettings.totalCostColumnId;
        delete migratedSettings.productsBoardId;
        delete migratedSettings.productsCustomerColumnId;
        delete migratedSettings.productColumnId;
        
        setCustomSettings(prev => ({ ...DEFAULT_SETTINGS, ...migratedSettings }));
      }
    } catch (error) {
      logger.error('SettingsContext', 'Failed to load settings from storage', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // זיהוי אוטומטי של structureMode לפי הגדרות קיימות
  const detectStructureMode = (settings) => {
    const hasTasks = settings.tasksBoardId || settings.taskColumnId || settings.tasksProjectColumnId;
    const hasStage = settings.stageColumnId;
    const useStageField = settings.useStageField !== false; // ברירת מחדל true
    
    if (hasTasks) {
      return STRUCTURE_MODES.PROJECT_WITH_TASKS;
    } else if (hasStage && useStageField) {
      return STRUCTURE_MODES.PROJECT_WITH_STAGE;
    } else {
      return STRUCTURE_MODES.PROJECT_ONLY;
    }
  };

  // עדכון הגדרות ושמירה ב-Storage
  const updateSettings = async (newSettings) => {
    try {
      const updatedSettings = { ...customSettings, ...newSettings };
      setCustomSettings(updatedSettings);
      
      await monday.storage.instance.setItem('customSettings', JSON.stringify(updatedSettings));
      return true;
    } catch (error) {
      logger.error('SettingsContext', 'Failed to save settings', error);
      return false;
    }
  };

  // איפוס הגדרות לברירת מחדל
  const resetSettings = async () => {
    try {
      setCustomSettings(DEFAULT_SETTINGS);
      await monday.storage.instance.setItem('customSettings', JSON.stringify(DEFAULT_SETTINGS));
      return true;
    } catch (error) {
      logger.error('SettingsContext', 'Failed to reset settings', error);
      return false;
    }
  };

  const value = {
    customSettings,
    updateSettings,
    resetSettings,
    isLoading
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// Custom Hook לשימוש ב-Context
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

export default SettingsContext;
