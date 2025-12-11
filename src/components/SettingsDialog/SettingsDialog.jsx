import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '@vibe/core';
import SearchableSelect from './SearchableSelect';
import MultiSelect from './MultiSelect';
import SettingsAccordion from './SettingsAccordion';
import SettingsSection from './SettingsSection';
import SettingsTabs from './SettingsTabs';
import { useSettingsValidation } from './useSettingsValidation';
import logger from '../../utils/logger';
import styles from './SettingsDialog.module.css';

export default function SettingsDialog({ monday, onClose, context }) {
  const { customSettings, updateSettings } = useSettings();
  
  // State - לוח חיצוני
  const [boards, setBoards] = useState([]);
  const [peopleColumns, setPeopleColumns] = useState([]);
  const [connectedBoardId, setConnectedBoardId] = useState('');
  const [peopleColumnIds, setPeopleColumnIds] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingPeopleColumns, setLoadingPeopleColumns] = useState(false);
  
  // State - לוח נוכחי (עמודות)
  const [dateColumns, setDateColumns] = useState([]);
  const [durationColumns, setDurationColumns] = useState([]);
  const [projectColumns, setProjectColumns] = useState([]);
  const [reporterColumns, setReporterColumns] = useState([]);
  const [statusColumns, setStatusColumns] = useState([]);
  const [stageColumns, setStageColumns] = useState([]);
  const [dateColumnId, setDateColumnId] = useState('');
  const [durationColumnId, setDurationColumnId] = useState('');
  const [projectColumnId, setProjectColumnId] = useState('');
  const [reporterColumnId, setReporterColumnId] = useState('');
  const [statusColumnId, setStatusColumnId] = useState('');
  const [eventTypeStatusColumnId, setEventTypeStatusColumnId] = useState('');
  const [stageColumnId, setStageColumnId] = useState('');
  const [loadingCurrentBoardColumns, setLoadingCurrentBoardColumns] = useState(false);
  
  // State - לוח מוצרים
  const [productBoards, setProductBoards] = useState([]);
  const [productsCustomerColumns, setProductsCustomerColumns] = useState([]);
  const [currentBoardProductColumns, setCurrentBoardProductColumns] = useState([]);
  const [productsBoardId, setProductsBoardId] = useState('');
  const [productsCustomerColumnId, setProductsCustomerColumnId] = useState('');
  const [productColumnId, setProductColumnId] = useState('');
  const [loadingProductsColumns, setLoadingProductsColumns] = useState(false);
  
  // State - שעות עבודה
  const [workDayStart, setWorkDayStart] = useState('06:00');
  const [workDayEnd, setWorkDayEnd] = useState('20:00');

  // חישוב הגדרות נוכחיות ל-validation
  const currentSettings = {
    connectedBoardId,
    peopleColumnIds,
    dateColumnId,
    durationColumnId,
    projectColumnId,
    reporterColumnId,
    statusColumnId,
    eventTypeStatusColumnId,
    stageColumnId,
    productsBoardId,
    productsCustomerColumnId,
    productColumnId,
    workDayStart,
    workDayEnd
  };

  const { errors, isValid, getFieldError } = useSettingsValidation(currentSettings, context);

  // בדיקה אם קטגוריה הוגדרה במלואה
  const isExternalBoardComplete = connectedBoardId && peopleColumnIds.length > 0;
  const isCurrentBoardComplete = context?.boardId && dateColumnId && durationColumnId && projectColumnId && reporterColumnId && eventTypeStatusColumnId;
  const isProductsComplete = productsCustomerColumnId && productsBoardId && productColumnId;
  const isWorkHoursComplete = workDayStart && workDayEnd;

  // טעינת הגדרות שמורות בעלייה
  useEffect(() => {
    fetchBoards();
    
    // טעינת הגדרות לוח חיצוני
    if (customSettings.connectedBoardId) {
      setConnectedBoardId(customSettings.connectedBoardId);
      fetchPeopleColumns(customSettings.connectedBoardId);
      fetchCustomerProductsColumns(customSettings.connectedBoardId);
    }
    if (customSettings.peopleColumnIds && Array.isArray(customSettings.peopleColumnIds)) {
      setPeopleColumnIds(customSettings.peopleColumnIds);
    } else if (customSettings.peopleColumnId) {
      // תמיכה ב-backward compatibility - אם יש peopleColumnId ישן, להמיר ל-array
      setPeopleColumnIds([customSettings.peopleColumnId]);
    }
    
    // טעינת הגדרות לוח נוכחי
    if (context?.boardId) {
      // נטען את העמודות עם הפילטרים הנכונים אם יש הגדרות שמורות
      const filterByConnectedBoard = customSettings.connectedBoardId || null;
      const filterByProductBoard = customSettings.productsBoardId || null;
      fetchCurrentBoardColumns(context.boardId, filterByConnectedBoard, filterByProductBoard);
    }
    
    if (customSettings.dateColumnId) {
      setDateColumnId(customSettings.dateColumnId);
    }
    if (customSettings.durationColumnId) {
      setDurationColumnId(customSettings.durationColumnId);
    }
    if (customSettings.projectColumnId) {
      setProjectColumnId(customSettings.projectColumnId);
    }
    if (customSettings.reporterColumnId) {
      setReporterColumnId(customSettings.reporterColumnId);
    }
    if (customSettings.statusColumnId) {
      setStatusColumnId(customSettings.statusColumnId);
    } else {
      // אם אין עמודת סטטוס, נגדיר לריק (אופציה "ללא")
      setStatusColumnId('');
    }
    if (customSettings.eventTypeStatusColumnId) {
      setEventTypeStatusColumnId(customSettings.eventTypeStatusColumnId);
    } else {
      setEventTypeStatusColumnId('');
    }
    if (customSettings.stageColumnId) {
      setStageColumnId(customSettings.stageColumnId);
    } else {
      setStageColumnId('');
    }
    
    // טעינת הגדרות מוצרים
    if (customSettings.productsCustomerColumnId && customSettings.connectedBoardId) {
      setProductsCustomerColumnId(customSettings.productsCustomerColumnId);
      // נטען את לוחות המוצרים מהעמודה שנבחרה
      extractProductBoardsFromColumn(customSettings.productsCustomerColumnId, customSettings.connectedBoardId).then(() => {
        // אחרי שטענו את לוחות המוצרים, נבחר את הלוח השמור
        if (customSettings.productsBoardId) {
          setProductsBoardId(customSettings.productsBoardId);
        }
      });
    } else if (customSettings.productsBoardId) {
      setProductsBoardId(customSettings.productsBoardId);
    }
    if (customSettings.productColumnId) {
      setProductColumnId(customSettings.productColumnId);
    }
    
    // טעינת הגדרות שעות עבודה
    if (customSettings.workDayStart) {
      setWorkDayStart(customSettings.workDayStart);
    }
    if (customSettings.workDayEnd) {
      setWorkDayEnd(customSettings.workDayEnd);
    }
  }, []);

  // שליפת רשימת לוחות
  const fetchBoards = async () => {
    setLoadingBoards(true);
    try {
      const res = await monday.api(`query { boards(limit: 500) { id name } }`);
      if (res.data && res.data.boards) {
        setBoards(res.data.boards);
      }
    } catch (err) {
      // לוג שגיאה קריטי - נשאר פעיל גם בפרודקשן
      logger.error('SettingsDialog', 'Error fetching boards', err);
    } finally {
      setLoadingBoards(false);
    }
  };

  // שליפת עמודות מסוג "people" מהלוח החיצוני
  const fetchPeopleColumns = async (boardId) => {
    if (!boardId) return;
    setLoadingPeopleColumns(true);
    setPeopleColumns([]);
    try {
      const res = await monday.api(`query { boards(ids: [${boardId}]) { columns { id title type } } }`);
      // לוגים להערה - ניתן להפעיל לצורך דיבוג
      // console.log("query: ", `query { boards(ids: [${boardId}]) { columns { id title type } } }`);
      // console.log("response: ", res);
      if (res.data && res.data.boards && res.data.boards[0]) {
        const cols = res.data.boards[0].columns
          .filter(col => col.type === 'people')
          .map(col => ({ id: col.id, name: col.title }));
        setPeopleColumns(cols);
      }
    } catch (err) {
      // לוג שגיאה קריטי - נשאר פעיל גם בפרודקשן
      logger.error('SettingsDialog', 'Error fetching people columns', err);
    } finally {
      setLoadingPeopleColumns(false);
    }
  };

  // שליפת עמודות connected board מלוח הלקוחות (עמודות מוצרים)
  const fetchCustomerProductsColumns = async (boardId) => {
    if (!boardId) {
      setProductsCustomerColumns([]);
      return;
    }
    setLoadingProductsColumns(true);
    try {
      const res = await monday.api(`query { boards(ids: [${boardId}]) { columns { id title type settings_str } } }`);
      if (res.data && res.data.boards && res.data.boards[0]) {
        const cols = res.data.boards[0].columns;
        
        // עמודות Connected Board (עמודות מוצרים בלוח לקוחות)
        const connectCols = cols
          .filter(col => col.type === 'board_relation')
          .map(col => ({ id: col.id, name: col.title, settings_str: col.settings_str }));
        setProductsCustomerColumns(connectCols);
      } else {
        // לוג להערה - ניתן להפעיל לצורך דיבוג
        // logger.warn('SettingsDialog', 'No boards found in response');
        setProductsCustomerColumns([]);
      }
    } catch (err) {
      // לוג שגיאה קריטי - נשאר פעיל גם בפרודקשן
      logger.error('SettingsDialog', 'Error fetching customer products columns', err);
      setProductsCustomerColumns([]);
    } finally {
      setLoadingProductsColumns(false);
    }
  };
  
  // חילוץ לוחות מוצרים מעמודה שנבחרה
  const extractProductBoardsFromColumn = async (columnId, boardId = null) => {
    const targetBoardId = boardId || connectedBoardId;
    if (!columnId || !targetBoardId) return;
    
    try {
      const res = await monday.api(`query { boards(ids: [${targetBoardId}]) { columns(ids: ["${columnId}"]) { id title type settings_str } } }`);
      if (res.data?.boards?.[0]?.columns?.[0]) {
        const column = res.data.boards[0].columns[0];
        try {
          const settings = JSON.parse(column.settings_str || '{}');
          const boardIds = settings.boardIds || [];
          
          // שליפת פרטי הלוחות
          if (boardIds.length > 0) {
            const boardsQuery = `query { boards(ids: [${boardIds.join(',')}]) { id name } }`;
            const boardsRes = await monday.api(boardsQuery);
            if (boardsRes.data?.boards) {
              const boardsList = boardsRes.data.boards.map(b => ({ id: b.id, name: b.name }));
              setProductBoards(boardsList);
            }
          } else {
            setProductBoards([]);
          }
        } catch (e) {
          // לוג שגיאה קריטי - נשאר פעיל גם בפרודקשן
          logger.error('SettingsDialog', 'Error parsing column settings', e);
          setProductBoards([]);
        }
      }
    } catch (err) {
      // לוג שגיאה קריטי - נשאר פעיל גם בפרודקשן
      logger.error('SettingsDialog', 'Error extracting product boards from column', err);
      setProductBoards([]);
    }
  };

  // שליפת עמודות מהלוח הנוכחי
  const fetchCurrentBoardColumns = async (boardId, filterByConnectedBoard = null, filterByProductBoard = null) => {
    if (!boardId) return;
    setLoadingCurrentBoardColumns(true);
    try {
      const res = await monday.api(`query { boards(ids: [${boardId}]) { columns { id title type settings_str } } }`);
      if (res.data && res.data.boards && res.data.boards[0]) {
        const columns = res.data.boards[0].columns;
        
        // עמודות Date
        const dateCols = columns
          .filter(col => col.type === 'date')
          .map(col => ({ id: col.id, name: col.title }));
        setDateColumns(dateCols);
        
        // עמודות Numbers (למשך זמן בשעות עשרוניות)
        const durationCols = columns
          .filter(col => col.type === 'numbers')
          .map(col => ({ id: col.id, name: col.title }));
        setDurationColumns(durationCols);
        
        // עמודות Connected Board שמקשרות ללוח החיצוני שנבחר (לקוח)
        const projectCols = columns
          .filter(col => {
            if (col.type !== 'board_relation') return false;
            if (filterByConnectedBoard) {
              try {
                const settings = JSON.parse(col.settings_str || '{}');
                return settings.boardIds && settings.boardIds.includes(parseInt(filterByConnectedBoard));
              } catch {
                return false;
              }
            }
            return true;
          })
          .map(col => ({ id: col.id, name: col.title }));
        setProjectColumns(projectCols);
        
        // עמודות Connected Board שמקשרות ללוח המוצרים שנבחר
        const productCols = columns
          .filter(col => {
            if (col.type !== 'board_relation') return false;
            if (filterByProductBoard) {
              try {
                const settings = JSON.parse(col.settings_str || '{}');
                return settings.boardIds && settings.boardIds.includes(parseInt(filterByProductBoard));
              } catch {
                return false;
              }
            }
            return true;
          })
          .map(col => ({ id: col.id, name: col.title }));
        setCurrentBoardProductColumns(productCols);
        
        // עמודות People (למדווח)
        const peopleCols = columns
          .filter(col => col.type === 'people')
          .map(col => ({ id: col.id, name: col.title }));
        setReporterColumns(peopleCols);
        
        // עמודות Status (לצביעת אירועים)
        const statusCols = columns
          .filter(col => col.type === 'status')
          .map(col => ({ id: col.id, name: col.title }));
        // הוספת אופציה "ללא" בתחילת הרשימה (רק עבור עמודת סטטוס רגילה)
        setStatusColumns([
          { id: '', name: 'ללא עמודת סטטוס' },
          ...statusCols
        ]);
        
        // עמודות Status ו-Dropdown (לשלב)
        const stageCols = columns
          .filter(col => col.type === 'status' || col.type === 'dropdown')
          .map(col => ({ id: col.id, name: col.title }));
        setStageColumns(stageCols);
      }
    } catch (err) {
      // לוג שגיאה קריטי - נשאר פעיל גם בפרודקשן
      logger.error('SettingsDialog', 'Error fetching current board columns', err);
    } finally {
      setLoadingCurrentBoardColumns(false);
    }
  };

  // טיפול בשינוי לוח חיצוני (לקוח)
  const handleConnectedBoardChange = (newBoardId) => {
    setConnectedBoardId(newBoardId);
    setPeopleColumnIds([]);
    setProductsCustomerColumnId('');
    setProductsBoardId('');
    setProductColumnId('');
    
    if (newBoardId) {
      fetchPeopleColumns(newBoardId);
      fetchCustomerProductsColumns(newBoardId); // טעינת עמודות מוצרים בלוח לקוחות
      if (context?.boardId) {
        fetchCurrentBoardColumns(context.boardId, newBoardId, productsBoardId);
      }
    } else {
      setPeopleColumns([]);
      setProductsCustomerColumns([]);
      setProductBoards([]);
    }
  };
  
  // טיפול בשינוי לוח מוצרים
  const handleProductsBoardChange = (newBoardId) => {
    setProductsBoardId(newBoardId);
    setProductColumnId('');
    
    if (newBoardId && context?.boardId) {
      fetchCurrentBoardColumns(context.boardId, connectedBoardId, newBoardId);
    } else {
      setCurrentBoardProductColumns([]);
    }
  };
  
  // טיפול בשינוי עמודת מוצרים בלוח לקוחות
  const handleProductsCustomerColumnChange = async (newColumnId) => {
    setProductsCustomerColumnId(newColumnId);
    setProductsBoardId(''); // איפוס לוח מוצרים
    setProductColumnId(''); // איפוס עמודת מוצר בלוח הנוכחי
    
    if (newColumnId) {
      // חילוץ לוחות מוצרים מהעמודה שנבחרה
      await extractProductBoardsFromColumn(newColumnId);
    } else {
      setProductBoards([]);
    }
  };
  
  // טיפול בשינוי עמודת מוצר בלוח הנוכחי
  const handleProductColumnChange = (newColumnId) => {
    setProductColumnId(newColumnId);
  };

  // טיפול בשינוי עמודות people (בחירה מרובה)
  const handlePeopleColumnsChange = (newColumnIds) => {
    setPeopleColumnIds(newColumnIds);
  };

  // טיפול בשינוי עמודות הלוח הנוכחי
  const handleDateColumnChange = (newColumnId) => {
    setDateColumnId(newColumnId);
  };

  const handleDurationColumnChange = (newColumnId) => {
    setDurationColumnId(newColumnId);
  };

  const handleProjectColumnChange = (newColumnId) => {
    setProjectColumnId(newColumnId);
  };

  const handleReporterColumnChange = (newColumnId) => {
    setReporterColumnId(newColumnId);
  };

  const handleStatusColumnChange = (newColumnId) => {
    setStatusColumnId(newColumnId);
  };

  const handleStageColumnChange = (newColumnId) => {
    setStageColumnId(newColumnId);
  };

  const handleEventTypeStatusColumnChange = async (newColumnId) => {
    setEventTypeStatusColumnId(newColumnId);
    
    // אם נבחרה עמודה, נעדכן את התוויות שלה
    if (newColumnId && context?.boardId) {
      try {
        // שליפת revision של העמודה
        const columnQuery = `query {
          boards(ids: [${context.boardId}]) {
            columns(ids: ["${newColumnId}"]) {
              id
              revision
              settings
            }
          }
        }`;
        
        const columnRes = await monday.api(columnQuery);
        const column = columnRes.data?.boards?.[0]?.columns?.[0];
        
        if (!column) {
          // לוג שגיאה קריטי - נשאר פעיל גם בפרודקשן
          logger.error('SettingsDialog', 'Column not found');
          return;
        }
        
        const revision = column.revision;
        
        // עדכון התוויות של העמודה
        const updateMutation = `mutation {
          update_status_column(
            board_id: ${context.boardId}
            id: "${newColumnId}"
            revision: "${revision}"
            settings: {
              labels: [
                { color: grass_green, label: "חופשה", index: 0 },
                { color: stuck_red, label: "מחלה", index: 1 },
                { color: river, label: "מילואים", index: 2 },
                { color: bright_blue, label: "שעתי", index: 3 }
              ]
            }
          ) {
            id
          }
        }`;
        
        await monday.api(updateMutation);
        // לוג להערה - ניתן להפעיל לצורך דיבוג
        // logger.info('SettingsDialog', 'Status column labels updated successfully');
      } catch (error) {
        // לוג שגיאה קריטי - נשאר פעיל גם בפרודקשן
        logger.error('SettingsDialog', 'Error updating status column labels', error);
        alert('שגיאה בעדכון תוויות עמודת הסטטוס. אנא ודא שיש לך הרשאות מתאימות.');
      }
    }
  };

  // שמירה סופית
  const handleSave = async () => {
    if (!isValid) {
      const errorMessages = Object.values(errors).join('\n');
      alert(`יש לתקן את השגיאות הבאות לפני שמירה:\n\n${errorMessages}`);
      return;
    }

    const success = await updateSettings({ 
      connectedBoardId: connectedBoardId || null,
      peopleColumnIds: peopleColumnIds.length > 0 ? peopleColumnIds : [],
      dateColumnId: dateColumnId || null,
      durationColumnId: durationColumnId || null,
      projectColumnId: projectColumnId || null,
      reporterColumnId: reporterColumnId || null,
      statusColumnId: statusColumnId || null,
      eventTypeStatusColumnId: eventTypeStatusColumnId || null,
      stageColumnId: stageColumnId || null,
      productsBoardId: productsBoardId || null,
      productsCustomerColumnId: productsCustomerColumnId || null,
      productColumnId: productColumnId || null,
      workDayStart: workDayStart || '06:00',
      workDayEnd: workDayEnd || '20:00'
    });

    if (success) {
      alert('ההגדרות נשמרו בהצלחה');
      onClose();
    } else {
      alert('שגיאה בשמירת ההגדרות');
    }
  };

  // רכיב שדה עם שגיאה
  const FieldWrapper = ({ children, error, label, required, description }) => (
    <div className={styles.fieldWrapper}>
      <label className={styles.fieldLabel}>
        {label} {required && <span className={styles.required}>*</span>}
      </label>
      {description && <p className={styles.fieldDescription}>{description}</p>}
      {children}
      {error && <p className={styles.fieldError}>{error}</p>}
    </div>
  );

  return (
    <>
      {/* תוכן גלילתי */}
      <div className={styles.content}>
        <SettingsTabs defaultTab="info">
          {/* טאב הגדרות מידע */}
          <div data-tab-id="info">
            <SettingsAccordion defaultOpen={[]}>
              {/* קטגוריה 1: לוח לקוחות */}
              <SettingsSection
                id="customers"
                title="לוח לקוחות"
                isComplete={isExternalBoardComplete}
                description="הגדרת לוח הלקוחות ועמודת השיוך למשתמש"
              >
            <FieldWrapper
              label="לוח לחיבור"
              required
              description="לוח ממנו נבחר אייטמים לשיוך (לדוגמה: לוח לקוחות)"
              error={getFieldError('connectedBoardId')}
            >
              <SearchableSelect 
                options={boards}
                value={connectedBoardId}
                onChange={handleConnectedBoardChange}
                placeholder="בחר לוח..."
                isLoading={loadingBoards}
              />
            </FieldWrapper>

            <FieldWrapper
              label="עמודות לשיוך (אנשים) *"
              required
              description="עמודות לפי המשתמש בלוח החיצוני - רק אייטמים שבהם המשתמש מופיע באחת מהעמודות יוצגו"
              error={getFieldError('peopleColumnIds')}
            >
              <div className={connectedBoardId ? '' : styles.disabled}>
                <MultiSelect 
                  options={peopleColumns}
                  value={peopleColumnIds}
                  onChange={handlePeopleColumnsChange}
                  placeholder="בחר עמודות אנשים..."
                  isLoading={loadingPeopleColumns}
                  disabled={!connectedBoardId}
                />
                {connectedBoardId && !loadingPeopleColumns && peopleColumns.length === 0 && (
                  <p className={styles.warning}>
                    ⚠️ לא נמצאו עמודות מסוג "people" בלוח זה
                  </p>
                )}
              </div>
            </FieldWrapper>
          </SettingsSection>

              {/* קטגוריה 2: לוח מוצרים */}
              <SettingsSection
                id="products"
                title="הגדרות לוח מוצרים"
                isComplete={isProductsComplete}
                description="הגדרת לוח המוצרים ועמודות הקישור (חובה)"
              >
                <FieldWrapper
                  label="עמודת מוצרים בלוח לקוחות"
                  required
                  description="עמודת Connected Board בלוח הלקוחות שמקשרת לקוח למוצרים"
                  error={getFieldError('productsCustomerColumnId')}
                >
                  <div className={connectedBoardId ? '' : styles.disabled}>
                    <SearchableSelect 
                      options={productsCustomerColumns}
                      value={productsCustomerColumnId}
                      onChange={handleProductsCustomerColumnChange}
                      placeholder="בחר עמודת מוצרים..."
                      isLoading={loadingProductsColumns}
                      disabled={!connectedBoardId}
                      showSearch={false}
                    />
                    {connectedBoardId && !loadingProductsColumns && productsCustomerColumns.length === 0 && (
                      <p className={styles.warning}>
                        ⚠️ לא נמצאו עמודות מסוג "connected board" בלוח זה
                      </p>
                    )}
                  </div>
                </FieldWrapper>

                {productsCustomerColumnId && (
                  <FieldWrapper
                    label="לוח מוצרים"
                    required
                    description="לוח המוצרים - נחלץ מהעמודה שנבחרה"
                    error={getFieldError('productsBoardId')}
                  >
                    <SearchableSelect 
                      options={productBoards}
                      value={productsBoardId}
                      onChange={handleProductsBoardChange}
                      placeholder="בחר לוח מוצרים..."
                      isLoading={loadingProductsColumns}
                      disabled={!productsCustomerColumnId}
                      showSearch={false}
                    />
                    {productsCustomerColumnId && productBoards.length === 0 && (
                      <p className={styles.warning}>
                        ⚠️ לא נמצאו לוחות מוצרים בעמודה שנבחרה
                      </p>
                    )}
                  </FieldWrapper>
                )}

                {productsBoardId && (
                  <FieldWrapper
                    label="עמודת קישור למוצר בלוח הנוכחי"
                    required
                    description="עמודת Connected Board בלוח דיווחי השעות שמקשרת דיווח למוצר"
                    error={getFieldError('productColumnId')}
                  >
                    <div className={context?.boardId ? '' : styles.disabled}>
                      <SearchableSelect 
                        options={currentBoardProductColumns}
                        value={productColumnId}
                        onChange={handleProductColumnChange}
                        placeholder="בחר עמודת מוצר..."
                        isLoading={loadingCurrentBoardColumns}
                        disabled={!context?.boardId || !productsBoardId}
                        showSearch={false}
                      />
                      {context?.boardId && !loadingCurrentBoardColumns && currentBoardProductColumns.length === 0 && (
                        <p className={styles.warning}>
                          ⚠️ לא נמצאו עמודות מסוג "connected board" המקושרות ללוח מוצרים
                        </p>
                      )}
                    </div>
                  </FieldWrapper>
                )}
              </SettingsSection>

              {/* קטגוריה 3: לוח נוכחי */}
              <SettingsSection
                id="current"
                title="הגדרות לוח דיווח שעות (נוכחי)"
                isComplete={isCurrentBoardComplete}
                description="הגדרת עמודות בלוח דיווחי השעות"
              >
            {!context?.boardId && (
              <p className={styles.warning}>
                ⚠️ לא נמצא לוח נוכחי - אנא פתח את האפליקציה מתוך לוח
              </p>
            )}

            <FieldWrapper
              label="עמודת תאריך התחלה"
              required
              description="עמודת Date בלוח הנוכחי למועד תחילת האירוע"
              error={getFieldError('dateColumnId')}
            >
              <div className={context?.boardId ? '' : styles.disabled}>
                <SearchableSelect 
                  options={dateColumns}
                  value={dateColumnId}
                  onChange={handleDateColumnChange}
                  placeholder="בחר עמודת תאריך..."
                  isLoading={loadingCurrentBoardColumns}
                  disabled={!context?.boardId}
                  showSearch={false}
                />
                {context?.boardId && !loadingCurrentBoardColumns && dateColumns.length === 0 && (
                  <p className={styles.warning}>
                    ⚠️ לא נמצאו עמודות מסוג "date" בלוח זה
                  </p>
                )}
              </div>
            </FieldWrapper>

            <FieldWrapper
              label="עמודת משך זמן"
              required
              description="עמודת Numbers בלוח הנוכחי למשך האירוע בשעות"
              error={getFieldError('durationColumnId')}
            >
              <div className={context?.boardId ? '' : styles.disabled}>
                <SearchableSelect 
                  options={durationColumns}
                  value={durationColumnId}
                  onChange={handleDurationColumnChange}
                  placeholder="בחר עמודת משך זמן..."
                  isLoading={loadingCurrentBoardColumns}
                  disabled={!context?.boardId}
                  showSearch={false}
                />
                {context?.boardId && !loadingCurrentBoardColumns && durationColumns.length === 0 && (
                  <p className={styles.warning}>
                    ⚠️ לא נמצאו עמודות מסוג "numbers" בלוח זה
                  </p>
                )}
              </div>
            </FieldWrapper>

            <FieldWrapper
              label="עמודת קישור לפרויקט"
              required
              description="עמודת Connected Board שמקשרת ללוח החיצוני"
              error={getFieldError('projectColumnId')}
            >
              <div className={context?.boardId ? '' : styles.disabled}>
                <SearchableSelect 
                  options={projectColumns}
                  value={projectColumnId}
                  onChange={handleProjectColumnChange}
                  placeholder="בחר עמודת קישור..."
                  isLoading={loadingCurrentBoardColumns}
                  disabled={!context?.boardId}
                  showSearch={false}
                />
                {context?.boardId && !loadingCurrentBoardColumns && projectColumns.length === 0 && (
                  <p className={styles.warning}>
                    ⚠️ לא נמצאו עמודות מסוג "connected board" {connectedBoardId && "המקושרות ללוח שנבחר"}
                  </p>
                )}
              </div>
            </FieldWrapper>

            <FieldWrapper
              label="עמודת מדווח"
              required
              description="עמודת People למשתמש שיצר את הדיווח (מדווח)"
              error={getFieldError('reporterColumnId')}
            >
              <div className={context?.boardId ? '' : styles.disabled}>
                <SearchableSelect 
                  options={reporterColumns}
                  value={reporterColumnId}
                  onChange={handleReporterColumnChange}
                  placeholder="בחר עמודת מדווח..."
                  isLoading={loadingCurrentBoardColumns}
                  disabled={!context?.boardId}
                  showSearch={false}
                />
                {context?.boardId && !loadingCurrentBoardColumns && reporterColumns.length === 0 && (
                  <p className={styles.warning}>
                    ⚠️ לא נמצאו עמודות מסוג "people" בלוח זה
                  </p>
                )}
              </div>
            </FieldWrapper>

            <FieldWrapper
              label="עמודת סטטוס"
              description="עמודת Status לצביעת אירועים לפי צבע הסטטוס"
            >
              <div className={context?.boardId ? '' : styles.disabled}>
                <SearchableSelect 
                  options={statusColumns}
                  value={statusColumnId}
                  onChange={handleStatusColumnChange}
                  placeholder="בחר עמודת סטטוס..."
                  isLoading={loadingCurrentBoardColumns}
                  disabled={!context?.boardId}
                  showSearch={false}
                />
                {context?.boardId && !loadingCurrentBoardColumns && statusColumns.length === 0 && (
                  <p className={styles.warning}>
                    ⚠️ לא נמצאו עמודות מסוג "status" בלוח זה
                  </p>
                )}
              </div>
            </FieldWrapper>

            <FieldWrapper
              label="עמודת סטטוס לסוג דיווח"
              required
              description="עמודת Status להגדרת סוג הדיווח. בחירה בעמודה תשנה את ההגדרות שלה"
              error={getFieldError('eventTypeStatusColumnId')}
            >
              <div className={context?.boardId ? '' : styles.disabled}>
                <SearchableSelect 
                  options={statusColumns.filter(col => col.id !== '')}
                  value={eventTypeStatusColumnId}
                  onChange={handleEventTypeStatusColumnChange}
                  placeholder="בחר עמודת סטטוס לסוג דיווח..."
                  isLoading={loadingCurrentBoardColumns}
                  disabled={!context?.boardId}
                  showSearch={false}
                />
                {context?.boardId && !loadingCurrentBoardColumns && statusColumns.filter(col => col.id !== '').length === 0 && (
                  <p className={styles.warning}>
                    ⚠️ לא נמצאו עמודות מסוג "status" בלוח זה
                  </p>
                )}
              </div>
            </FieldWrapper>

            <FieldWrapper
              label="עמודת שלב"
              required={productColumnId ? true : false}
              description="עמודת Status או Dropdown לשלב. חובה אם יש הגדרת מוצר"
              error={getFieldError('stageColumnId')}
            >
              <div className={context?.boardId ? '' : styles.disabled}>
                <SearchableSelect 
                  options={stageColumns}
                  value={stageColumnId}
                  onChange={handleStageColumnChange}
                  placeholder="בחר עמודת שלב..."
                  isLoading={loadingCurrentBoardColumns}
                  disabled={!context?.boardId}
                  showSearch={false}
                />
                {context?.boardId && !loadingCurrentBoardColumns && stageColumns.length === 0 && (
                  <p className={styles.warning}>
                    ⚠️ לא נמצאו עמודות מסוג "status" או "dropdown" בלוח זה
                  </p>
                )}
              </div>
            </FieldWrapper>
          </SettingsSection>
            </SettingsAccordion>
          </div>

          {/* טאב הגדרות יומן */}
          <div data-tab-id="calendar">
            <SettingsAccordion defaultOpen={[]}>
              {/* קטגוריה: שעות עבודה */}
              <SettingsSection
                id="workHours"
                title="הגדרות שעות עבודה"
                isComplete={isWorkHoursComplete}
                description="הגדרת שעות תחילה וסיום של יום העבודה בלוח"
              >
                <FieldWrapper
                  label="שעת תחילת יום עבודה"
                  description="השעה שבה מתחיל יום העבודה בלוח (פורמט: HH:mm)"
                  error={getFieldError('workHours')}
                >
                  <input
                    type="time"
                    value={workDayStart}
                    onChange={(e) => setWorkDayStart(e.target.value)}
                    className={styles.timeInput}
                  />
                </FieldWrapper>

                <FieldWrapper
                  label="שעת סיום יום עבודה"
                  description="השעה שבה מסתיים יום העבודה בלוח (פורמט: HH:mm)"
                >
                  <input
                    type="time"
                    value={workDayEnd}
                    onChange={(e) => setWorkDayEnd(e.target.value)}
                    className={styles.timeInput}
                  />
                </FieldWrapper>
              </SettingsSection>
            </SettingsAccordion>
          </div>
        </SettingsTabs>
      </div>

      {/* כפתורים קבועים */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <Button
            kind="tertiary"
            size="small"
            onClick={() => alert(`ההגדרות הנוכחיות:\n${JSON.stringify(currentSettings, null, 2)}`)}
          >
            🖨️ הדפס הגדרות
          </Button>
        </div>

        <div className={styles.footerRight}>
          <Button 
            kind="secondary"
            onClick={onClose}
          >
            ביטול
          </Button>
          
          <Button 
            kind="primary"
            onClick={handleSave}
            disabled={!isValid}
          >
            שמור
          </Button>
        </div>
      </div>
    </>
  );
}

