import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from '@vibe/core';

// רכיב בחירה עם חיפוש מובנה (Searchable Select)
const SearchableSelect = ({ options, value, onChange, placeholder, isLoading, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  // סגירת הדרופדאון בלחיצה מחוץ לרכיב
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm(""); // איפוס חיפוש בסגירה
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // סינון האפשרויות לפי החיפוש
  const filteredOptions = options.filter(option => 
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(o => o.id === value);

  const handleSelect = (option) => {
    onChange(option.id);
    setIsOpen(false);
    setSearchTerm(""); // איפוס החיפוש לאחר בחירה
  };

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      {/* הטריגר (הכפתור הראשי) */}
      <div 
        style={{
          width: "90%",
          backgroundColor: disabled ? "#f6f7fb" : "#ffffff",
          border: isOpen ? "1px solid #0073e6" : "1px solid #d0d4e4",
          borderRadius: "4px",
          padding: "10px 32px 10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "all 0.2s",
          boxShadow: isOpen ? "0 0 0 3px rgba(0, 115, 230, 0.1)" : "none"
        }}
        onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
      >
        <span style={{
          fontSize: "14px",
          color: selectedOption ? "#323338" : "#676879",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>
          {selectedOption ? selectedOption.name : (isLoading ? "טוען..." : placeholder)}
        </span>
        <div style={{ color: "#676879", fontSize: "12px" }}>
          {isLoading ? "⏳" : (isOpen ? "▲" : "▼")}
        </div>
      </div>

      {/* הרשימה הנפתחת */}
      {isOpen && !disabled && (
        <div style={{
          position: "absolute",
          zIndex: 10010,
          width: "100%",
          marginTop: "4px",
          backgroundColor: "#ffffff",
          border: "1px solid #d0d4e4",
          borderRadius: "4px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          maxHeight: "240px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}>
          
          {/* שדה החיפוש */}
          <div style={{ 
            padding: "8px", 
            borderBottom: "1px solid #e6e9ef",
            backgroundColor: "#ffffff",
            width: "90%",
          }}>
            <div style={{ position: 'relative' }}>
              <input 
                autoFocus
                type="text"
                style={{
                  width: "100%",
                  backgroundColor: "#f6f7fb",
                  border: "1px solid #d0d4e4",
                  borderRadius: "4px",
                  padding: "8px 32px 8px 12px",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
                placeholder="חפש ברשימה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#676879",
                fontSize: "14px",
                pointerEvents: "none"
              }}>
                🔍
              </div>
            </div>
          </div>

          {/* רשימת האפשרויות */}
          <div style={{ 
            overflowY: "auto", 
            flex: 1,
            padding: "4px"
          }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  style={{
                    padding: "8px 12px",
                    fontSize: "14px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "background-color 0.15s",
                    backgroundColor: value === option.id ? "#e3f2fd" : "transparent",
                    color: value === option.id ? "#0073e6" : "#323338",
                    fontWeight: value === option.id ? "500" : "normal",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={(e) => {
                    if (value !== option.id) {
                      e.currentTarget.style.backgroundColor = "#f6f7fb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (value !== option.id) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {option.name}
                  {value === option.id && (
                    <span style={{
                      width: "8px",
                      height: "8px",
                      backgroundColor: "#0073e6",
                      borderRadius: "50%"
                    }}></span>
                  )}
                </div>
              ))
            ) : (
              <div style={{
                padding: "16px",
                textAlign: "center",
                fontSize: "12px",
                color: "#676879"
              }}>
                לא נמצאו תוצאות עבור "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function SettingsDialog({ monday, onClose, context }) {
  const { customSettings, updateSettings } = useSettings();
  
  // State - לוח חיצוני
  const [boards, setBoards] = useState([]);
  const [peopleColumns, setPeopleColumns] = useState([]);
  const [connectedBoardId, setConnectedBoardId] = useState('');
  const [peopleColumnId, setPeopleColumnId] = useState('');
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingPeopleColumns, setLoadingPeopleColumns] = useState(false);
  
  // State - לוח נוכחי (עמודות)
  const [dateColumns, setDateColumns] = useState([]);
  const [durationColumns, setDurationColumns] = useState([]);
  const [projectColumns, setProjectColumns] = useState([]);
  const [textColumns, setTextColumns] = useState([]);
  const [reporterColumns, setReporterColumns] = useState([]);
  const [dateColumnId, setDateColumnId] = useState('');
  const [durationColumnId, setDurationColumnId] = useState('');
  const [projectColumnId, setProjectColumnId] = useState('');
  const [notesColumnId, setNotesColumnId] = useState('');
  const [reporterColumnId, setReporterColumnId] = useState('');
  const [loadingCurrentBoardColumns, setLoadingCurrentBoardColumns] = useState(false);
  
  // State - לוח מוצרים
  const [productBoards, setProductBoards] = useState([]);
  const [productsCustomerColumns, setProductsCustomerColumns] = useState([]);
  const [productConnectColumns, setProductConnectColumns] = useState([]);
  const [currentBoardProductColumns, setCurrentBoardProductColumns] = useState([]);
  const [productsBoardId, setProductsBoardId] = useState('');
  const [productsCustomerColumnId, setProductsCustomerColumnId] = useState('');
  const [productColumnId, setProductColumnId] = useState('');
  const [loadingProductsColumns, setLoadingProductsColumns] = useState(false);

  // טעינת הגדרות שמורות בעלייה
  useEffect(() => {
    fetchBoards();
    
    // טעינת הגדרות לוח חיצוני
    if (customSettings.connectedBoardId) {
      setConnectedBoardId(customSettings.connectedBoardId);
      fetchPeopleColumns(customSettings.connectedBoardId);
    }
    if (customSettings.peopleColumnId) {
      setPeopleColumnId(customSettings.peopleColumnId);
    }
    
    // טעינת הגדרות לוח נוכחי
    if (context?.boardId) {
      fetchCurrentBoardColumns(context.boardId);
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
    if (customSettings.notesColumnId) {
      setNotesColumnId(customSettings.notesColumnId);
    }
    if (customSettings.reporterColumnId) {
      setReporterColumnId(customSettings.reporterColumnId);
    }
    
    // טעינת הגדרות מוצרים
    if (customSettings.productsBoardId) {
      setProductsBoardId(customSettings.productsBoardId);
      fetchProductsColumns(customSettings.productsBoardId);
    }
    if (customSettings.productsCustomerColumnId) {
      setProductsCustomerColumnId(customSettings.productsCustomerColumnId);
    }
    if (customSettings.productColumnId) {
      setProductColumnId(customSettings.productColumnId);
    }
  }, []);

  // שליפת רשימת לוחות
  const fetchBoards = async () => {
    setLoadingBoards(true);
    try {
      const res = await monday.api(`query { boards(limit: 100) { id name } }`);
      if (res.data && res.data.boards) {
        setBoards(res.data.boards);
      }
    } catch (err) {
      console.error('Error fetching boards:', err);
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
      if (res.data && res.data.boards && res.data.boards[0]) {
        const cols = res.data.boards[0].columns
          .filter(col => col.type === 'people')
          .map(col => ({ id: col.id, name: col.title }));
        setPeopleColumns(cols);
      }
    } catch (err) {
      console.error('Error fetching people columns:', err);
    } finally {
      setLoadingPeopleColumns(false);
    }
  };

  // שליפת עמודות מלוח המוצרים (Connected Board + לקוח)
  const fetchProductsColumns = async (boardId) => {
    if (!boardId) return;
    setLoadingProductsColumns(true);
    try {
      const res = await monday.api(`query { boards(ids: [${boardId}]) { columns { id title type } } }`);
      if (res.data && res.data.boards && res.data.boards[0]) {
        const cols = res.data.boards[0].columns;
        
        // עמודות Connected Board
        const connectCols = cols
          .filter(col => col.type === 'board_relation')
          .map(col => ({ id: col.id, name: col.title }));
        setProductConnectColumns(connectCols);
        
        // עמודות ללקוח
        const customerCols = connectCols; // בדרך כלל מאותה סוג
        setProductsCustomerColumns(customerCols);
      }
    } catch (err) {
      console.error('Error fetching products columns:', err);
    } finally {
      setLoadingProductsColumns(false);
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
            // אם יש לוח חיצוני נבחר, סנן רק עמודות שמקשרות אליו
            if (filterByConnectedBoard) {
              try {
                const settings = JSON.parse(col.settings_str || '{}');
                return settings.boardIds && settings.boardIds.includes(parseInt(filterByConnectedBoard));
              } catch {
                return false;
              }
            }
            return true; // אם אין לוח נבחר, הצג את כל עמודות ה-connected board
          })
          .map(col => ({ id: col.id, name: col.title }));
        setProjectColumns(projectCols);
        
        // עמודות Connected Board שמקשרות ללוח המוצרים שנבחר
        const productCols = columns
          .filter(col => {
            if (col.type !== 'board_relation') return false;
            // אם יש לוח מוצרים נבחר, סנן רק עמודות שמקשרות אליו
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
        
        // עמודות Text (להערות חופשיות)
        const textCols = columns
          .filter(col => col.type === 'text')
          .map(col => ({ id: col.id, name: col.title }));
        setTextColumns(textCols);
        
        // עמודות People (למדווח)
        const peopleCols = columns
          .filter(col => col.type === 'people')
          .map(col => ({ id: col.id, name: col.title }));
        setReporterColumns(peopleCols);
      }
    } catch (err) {
      console.error('Error fetching current board columns:', err);
    } finally {
      setLoadingCurrentBoardColumns(false);
    }
  };

  // טיפול בשינוי לוח חיצוני (לקוח)
  const handleConnectedBoardChange = (newBoardId) => {
    setConnectedBoardId(newBoardId);
    setPeopleColumnId(''); // איפוס עמודת people
    
    if (newBoardId) {
      fetchPeopleColumns(newBoardId);
      // רענון עמודות הפרויקט בלוח הנוכחי (לסנן לפי הלוח החיצוני החדש)
      if (context?.boardId) {
        fetchCurrentBoardColumns(context.boardId, newBoardId, productsBoardId);
      }
    } else {
      setPeopleColumns([]);
    }
  };
  
  // טיפול בשינוי לוח מוצרים
  const handleProductsBoardChange = (newBoardId) => {
    setProductsBoardId(newBoardId);
    setProductsCustomerColumnId(''); // איפוס עמודות
    setProductColumnId('');
    
    if (newBoardId) {
      fetchProductsColumns(newBoardId);
      // רענון עמודות המוצרים בלוח הנוכחי (לסנן לפי לוח המוצרים החדש)
      if (context?.boardId) {
        fetchCurrentBoardColumns(context.boardId, connectedBoardId, newBoardId);
      }
    } else {
      setProductsCustomerColumns([]);
      setProductConnectColumns([]);
      setCurrentBoardProductColumns([]);
    }
  };
  
  // טיפול בשינוי עמודת לקוח בלוח המוצרים
  const handleProductsCustomerColumnChange = (newColumnId) => {
    setProductsCustomerColumnId(newColumnId);
  };
  
  // טיפול בשינוי עמודת מוצר בלוח הנוכחי
  const handleProductColumnChange = (newColumnId) => {
    setProductColumnId(newColumnId);
  };

  // טיפול בשינוי עמודת people
  const handlePeopleColumnChange = (newColumnId) => {
    setPeopleColumnId(newColumnId);
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

  const handleNotesColumnChange = (newColumnId) => {
    setNotesColumnId(newColumnId);
  };

  const handleReporterColumnChange = (newColumnId) => {
    setReporterColumnId(newColumnId);
  };

  // שמירה סופית
  const handleSave = async () => {
    await updateSettings({ 
      connectedBoardId: connectedBoardId || null,
      peopleColumnId: peopleColumnId || null,
      dateColumnId: dateColumnId || null,
      durationColumnId: durationColumnId || null,
      projectColumnId: projectColumnId || null,
      notesColumnId: notesColumnId || null,
      reporterColumnId: reporterColumnId || null,
      productsBoardId: productsBoardId || null,
      productsCustomerColumnId: productsCustomerColumnId || null,
      productColumnId: productColumnId || null
    });
    onClose();
  };

  return (
    <>
      {/* תוכן גלילתי */}
      <div className="settings-dialog" style={{ 
        padding: "20px", 
        flex: 1, 
        overflowY: "auto",
        overflowX: "hidden"
      }}>
        
        <h3 style={{ 
          fontSize: "16px", 
          fontWeight: "600", 
          color: "#323338",
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "2px solid #e6e9ef"
        }}>
          הגדרות לוח חיצוני
        </h3>

        {/* 1. בחירת לוח לחיבור */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            לוח לחיבור <span style={{ color: "#d83a52" }}>*</span>
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            לוח ממנו נבחר אייטמים לשיוך (לדוגמה: לוח לקוחות)
          </p>
          <SearchableSelect 
            options={boards}
            value={connectedBoardId}
            onChange={handleConnectedBoardChange}
            placeholder="בחר לוח..."
            isLoading={loadingBoards}
          />
        </div>

        {/* 2. בחירת עמודת אנשים */}
        <div style={{ 
          marginBottom: "20px",
          opacity: connectedBoardId ? 1 : 0.4,
          pointerEvents: connectedBoardId ? 'auto' : 'none',
          transition: "opacity 0.3s"
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            עמודת לשיוך (אנשים) <span style={{ color: "#d83a52" }}>*</span>
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            עמודה לפי המשתמש בלוח החיצוני - רק אייטמים שבהם המשתמש מופיע יוצגו
          </p>
          <SearchableSelect 
            options={peopleColumns}
            value={peopleColumnId}
            onChange={handlePeopleColumnChange}
            placeholder="בחר עמודת אנשים..."
            isLoading={loadingPeopleColumns}
            disabled={!connectedBoardId}
          />
          {connectedBoardId && !loadingPeopleColumns && peopleColumns.length === 0 && (
            <p style={{ fontSize: "11px", color: "#d83a52", marginTop: "6px" }}>
              ⚠️ לא נמצאו עמודות מסוג "people" בלוח זה
            </p>
          )}
        </div>

        <h3 style={{ 
          fontSize: "16px", 
          fontWeight: "600", 
          color: "#323338",
          marginTop: "24px",
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "2px solid #e6e9ef"
        }}>
          הגדרות לוח נוכחי
        </h3>

        {!context?.boardId && (
          <p style={{ fontSize: "12px", color: "#d83a52", marginBottom: "16px" }}>
            ⚠️ לא נמצא לוח נוכחי - אנא פתח את האפליקציה מתוך לוח
          </p>
        )}

        {/* 3. עמודת תאריך */}
        <div style={{ 
          marginBottom: "20px",
          opacity: context?.boardId ? 1 : 0.4,
          pointerEvents: context?.boardId ? 'auto' : 'none'
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            עמודת תאריך התחלה <span style={{ color: "#d83a52" }}>*</span>
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            עמודת Date בלוח הנוכחי למועד תחילת האירוע
          </p>
          <SearchableSelect 
            options={dateColumns}
            value={dateColumnId}
            onChange={handleDateColumnChange}
            placeholder="בחר עמודת תאריך..."
            isLoading={loadingCurrentBoardColumns}
            disabled={!context?.boardId}
          />
          {context?.boardId && !loadingCurrentBoardColumns && dateColumns.length === 0 && (
            <p style={{ fontSize: "11px", color: "#d83a52", marginTop: "6px" }}>
              ⚠️ לא נמצאו עמודות מסוג "date" בלוח זה
            </p>
          )}
        </div>

        {/* 4. עמודת משך זמן */}
        <div style={{ 
          marginBottom: "20px",
          opacity: context?.boardId ? 1 : 0.4,
          pointerEvents: context?.boardId ? 'auto' : 'none'
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            עמודת משך זמן <span style={{ color: "#d83a52" }}>*</span>
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            עמודת Hour בלוח הנוכחי למשך האירוע
          </p>
          <SearchableSelect 
            options={durationColumns}
            value={durationColumnId}
            onChange={handleDurationColumnChange}
            placeholder="בחר עמודת משך זמן..."
            isLoading={loadingCurrentBoardColumns}
            disabled={!context?.boardId}
          />
          {context?.boardId && !loadingCurrentBoardColumns && durationColumns.length === 0 && (
            <p style={{ fontSize: "11px", color: "#d83a52", marginTop: "6px" }}>
              ⚠️ לא נמצאו עמודות מסוג "hour" בלוח זה
            </p>
          )}
        </div>

        {/* 5. עמודת פרויקט (Connected Board) */}
        <div style={{ 
          marginBottom: "20px",
          opacity: context?.boardId ? 1 : 0.4,
          pointerEvents: context?.boardId ? 'auto' : 'none'
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            עמודת קישור לפרויקט <span style={{ color: "#d83a52" }}>*</span>
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            עמודת Connected Board שמקשרת ללוח החיצוני
          </p>
          <SearchableSelect 
            options={projectColumns}
            value={projectColumnId}
            onChange={handleProjectColumnChange}
            placeholder="בחר עמודת קישור..."
            isLoading={loadingCurrentBoardColumns}
            disabled={!context?.boardId}
          />
          {context?.boardId && !loadingCurrentBoardColumns && projectColumns.length === 0 && (
            <p style={{ fontSize: "11px", color: "#d83a52", marginTop: "6px" }}>
              ⚠️ לא נמצאו עמודות מסוג "connected board" {connectedBoardId && "המקושרות ללוח שנבחר"}
            </p>
          )}
        </div>

        {/* 6. עמודת הערות (Text) */}
        <div style={{ 
          marginBottom: "20px",
          opacity: context?.boardId ? 1 : 0.4,
          pointerEvents: context?.boardId ? 'auto' : 'none'
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            עמודת הערות
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            עמודת Text להערות חופשיות על האירוע
          </p>
          <SearchableSelect 
            options={textColumns}
            value={notesColumnId}
            onChange={handleNotesColumnChange}
            placeholder="בחר עמודת הערות..."
            isLoading={loadingCurrentBoardColumns}
            disabled={!context?.boardId}
          />
          {context?.boardId && !loadingCurrentBoardColumns && textColumns.length === 0 && (
            <p style={{ fontSize: "11px", color: "#d83a52", marginTop: "6px" }}>
              ⚠️ לא נמצאו עמודות מסוג "text" בלוח זה
            </p>
          )}
        </div>

        {/* 7. עמודת מדווח (People) */}
        <div style={{ 
          marginBottom: "20px",
          opacity: context?.boardId ? 1 : 0.4,
          pointerEvents: context?.boardId ? 'auto' : 'none'
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            עמודת מדווח
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            עמודת People למשתמש שיצר את הדיווח (מדווח)
          </p>
          <SearchableSelect 
            options={reporterColumns}
            value={reporterColumnId}
            onChange={handleReporterColumnChange}
            placeholder="בחר עמודת מדווח..."
            isLoading={loadingCurrentBoardColumns}
            disabled={!context?.boardId}
          />
          {context?.boardId && !loadingCurrentBoardColumns && reporterColumns.length === 0 && (
            <p style={{ fontSize: "11px", color: "#d83a52", marginTop: "6px" }}>
              ⚠️ לא נמצאו עמודות מסוג "people" בלוח זה
            </p>
          )}
        </div>

        <h3 style={{ 
          fontSize: "16px", 
          fontWeight: "600", 
          color: "#323338",
          marginTop: "24px",
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "2px solid #e6e9ef"
        }}>
          הגדרות מוצרים
        </h3>

        {/* 1. בחירת לוח מוצרים */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            לוח מוצרים <span style={{ color: "#d83a52" }}>*</span>
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            לוח המוצרים - ממנו נבחרים מוצרים לשיוך בדיווחים
          </p>
          <SearchableSelect 
            options={productBoards.length > 0 ? productBoards : productBoards.length === 0 ? boards : []}
            value={productsBoardId}
            onChange={handleProductsBoardChange}
            placeholder="בחר לוח מוצרים..."
            isLoading={loadingBoards}
          />
        </div>

        {/* 2. עמודת קישור ללקוח בלוח המוצרים */}
        <div style={{ 
          marginBottom: "20px",
          opacity: productsBoardId ? 1 : 0.4,
          pointerEvents: productsBoardId ? 'auto' : 'none',
          transition: "opacity 0.3s"
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            עמודת קישור ללקוח בלוח המוצרים <span style={{ color: "#d83a52" }}>*</span>
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            עמודת Connected Board בלוח המוצרים שמקשרת מוצר ללקוח
          </p>
          <SearchableSelect 
            options={productsCustomerColumns}
            value={productsCustomerColumnId}
            onChange={handleProductsCustomerColumnChange}
            placeholder="בחר עמודת קישור..."
            isLoading={loadingProductsColumns}
            disabled={!productsBoardId}
          />
          {productsBoardId && !loadingProductsColumns && productsCustomerColumns.length === 0 && (
            <p style={{ fontSize: "11px", color: "#d83a52", marginTop: "6px" }}>
              ⚠️ לא נמצאו עמודות מסוג "connected board" בלוח זה
            </p>
          )}
        </div>

        {/* 3. עמודת קישור למוצר בלוח הנוכחי */}
        <div style={{ 
          marginBottom: "20px",
          opacity: context?.boardId ? 1 : 0.4,
          pointerEvents: context?.boardId ? 'auto' : 'none'
        }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "13px", 
            fontWeight: "600",
            color: "#323338"
          }}>
            עמודת קישור למוצר בלוח הנוכחי <span style={{ color: "#d83a52" }}>*</span>
          </label>
          <p style={{ fontSize: "11px", color: "#676879", marginBottom: "8px" }}>
            עמודת Connected Board בלוח דיווחי השעות שמקשרת דיווח למוצר
          </p>
          <SearchableSelect 
            options={currentBoardProductColumns}
            value={productColumnId}
            onChange={handleProductColumnChange}
            placeholder="בחר עמודת מוצר..."
            isLoading={loadingCurrentBoardColumns}
            disabled={!context?.boardId}
          />
          {context?.boardId && !loadingCurrentBoardColumns && currentBoardProductColumns.length === 0 && (
            <p style={{ fontSize: "11px", color: "#d83a52", marginTop: "6px" }}>
              ⚠️ לא נמצאו עמודות מסוג "connected board" {productsBoardId && "המקושרות ללוח מוצרים"}
            </p>
          )}
        </div>
      </div>

      {/* כפתורים קבועים */}
      <div style={{ 
        display: "flex", 
        gap: "8px", 
        justifyContent: "flex-end",
        padding: "16px 20px",
        borderTop: "1px solid #e0e0e0",
        backgroundColor: "#fafbfc",
        flexShrink: 0
      }}>
        <div style={{ marginRight: "auto" }}>
          <Button
            kind="tertiary"
            size="small"
            onClick={() => alert(`ההגדרות הנוכחיות:\n${JSON.stringify(customSettings, null, 2)}`)}
          >
            🖨️ הדפס הגדרות
          </Button>
        </div>

        <Button 
          kind="secondary"
          onClick={onClose}
        >
          ביטול
        </Button>
        
        <Button 
          kind="primary"
          onClick={handleSave}
        >
          שמור
        </Button>
      </div>
    </>
  );
}

