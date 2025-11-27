import React, { createContext, useState, useEffect, useContext } from 'react';

// יצירת Context
const SettingsContext = createContext(null);

// ברירות מחדל להגדרות
const DEFAULT_SETTINGS = {
  // לוח חיצוני לשיוך אייטמים (לקוחות)
  connectedBoardId: null,
  
  // עמודת people בלוח החיצוני (לסינון לפי משתמש)
  peopleColumnId: null,
  
  // עמודות בלוח הנוכחי (context.boardId)
  dateColumnId: null,          // עמודת Date למועד התחלה
  durationColumnId: null,      // עמודת Numbers למשך זמן בשעות (עשרוני)
  projectColumnId: null,       // עמודת Connected Board לקישור ללוח החיצוני (לקוח)
  notesColumnId: null,         // עמודת Text להערות חופשיות
  reporterColumnId: null,      // עמודת People למדווח
  
  // הגדרות מוצרים - רמת היררכיה נוספת
  productsBoardId: null,       // מזהה לוח המוצרים
  productsCustomerColumnId: null, // עמודת Connected Board בלוח המוצרים (קישור ללקוח)
  productColumnId: null        // עמודת Connected Board בלוח הנוכחי (קישור למוצר)
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
      console.log('📥 Loaded settings from storage:', result);
      
      if (result.data && result.data.value) {
        const savedSettings = JSON.parse(result.data.value);
        setCustomSettings(prev => ({ ...DEFAULT_SETTINGS, ...savedSettings }));
      }
    } catch (error) {
      console.warn('⚠️ Failed to load settings from storage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // עדכון הגדרות ושמירה ב-Storage
  const updateSettings = async (newSettings) => {
    try {
      const updatedSettings = { ...customSettings, ...newSettings };
      setCustomSettings(updatedSettings);
      
      await monday.storage.instance.setItem('customSettings', JSON.stringify(updatedSettings));
      console.log('💾 Saved settings to storage:', updatedSettings);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      return false;
    }
  };

  // איפוס הגדרות לברירת מחדל
  const resetSettings = async () => {
    try {
      setCustomSettings(DEFAULT_SETTINGS);
      await monday.storage.instance.setItem('customSettings', JSON.stringify(DEFAULT_SETTINGS));
      console.log('🔄 Reset settings to default');
      return true;
    } catch (error) {
      console.error('❌ Failed to reset settings:', error);
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

