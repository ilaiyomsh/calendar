import React, { useState, useEffect, useRef } from "react";
import { Loader, ChevronDown, Search, X } from "lucide-react";

// --- MOCK Monday SDK ---
const mockMonday = {
  get: (type) => new Promise((resolve) => {
    console.log(`[Mock] Getting ${type}`);
    setTimeout(() => resolve({ data: { boardId: null, columnId: null } }), 500);
  }),
  set: (type, data) => {
    console.log(`[Mock] Setting ${type}:`, data);
  },
  api: (query) => new Promise((resolve) => {
    console.log(`[Mock] API Query: ${query}`);
    setTimeout(() => {
      if (query.includes("boards(limit")) {
        resolve({
          data: {
            boards: [
              { id: "123", name: "ניהול פרויקטים שיווק" },
              { id: "456", name: "מעקב משימות פיתוח" },
              { id: "789", name: "CRM לקוחות" },
              { id: "101", name: "לוח גיוס עובדים" },
              { id: "102", name: "תכנון אסטרטגי 2024" },
              { id: "103", name: "ניהול מדיה חברתית" }
            ]
          }
        });
      } else if (query.includes("columns")) {
        const boardId = query.match(/ids: \[(\d+)\]/)[1];
        const mockColumns = boardId === "123" 
          ? [
              { id: "date4", title: "תאריך יעד", type: "date" },
              { id: "hour", title: "שעות עבודה", type: "hour" },
              { id: "status", title: "סטטוס", type: "color" }
            ]
          : [
              { id: "timeline", title: "ציר זמן", type: "timeline" },
              { id: "numbers", title: "תקציב", type: "numeric" }
            ];
            
        resolve({
          data: {
            boards: [{ columns: mockColumns }]
          }
        });
      }
    }, 600);
  })
};

const monday = mockMonday;

// --- רכיב בחירה עם חיפוש (Searchable Select) ---
const SearchableSelect = ({ options, value, onChange, placeholder, isLoading, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  // סגירת הדרופדאון בלחיצה בחוץ
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
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
    <div className="relative" ref={containerRef}>
      {/* הטריגר (הכפתור הראשי) */}
      <div 
        className={`w-full bg-white border border-gray-300 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors ${disabled ? 'opacity-50 pointer-events-none bg-gray-50' : ''} ${isOpen ? 'ring-2 ring-blue-100 border-blue-500' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`text-sm truncate ${selectedOption ? 'text-gray-900' : 'text-gray-400'}`}>
          {selectedOption ? selectedOption.name : (isLoading ? "טוען..." : placeholder)}
        </span>
        <div className="flex items-center text-gray-400">
            {isLoading ? <Loader className="animate-spin" size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* הרשימה הנפתחת */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          
          {/* שדה החיפוש */}
          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
            <div className="relative">
                <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
                <input 
                    autoFocus
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-md py-2 pr-9 pl-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors"
                    placeholder="חפש ברשימה..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()} // מניעת סגירה בעת הקלדה
                />
            </div>
          </div>

          {/* רשימת האפשרויות */}
          <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                <div
                    key={option.id}
                    className={`p-2 text-sm rounded-md cursor-pointer transition-colors flex items-center justify-between ${value === option.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                    onClick={() => handleSelect(option)}
                >
                    {option.name}
                    {value === option.id && <span className="w-2 h-2 bg-blue-600 rounded-full"></span>}
                </div>
                ))
            ) : (
                <div className="p-4 text-center text-xs text-gray-400">
                    לא נמצאו תוצאות עבור "{searchTerm}"
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function CustomSettings() {
  // --- State ---
  const [boards, setBoards] = useState([]);
  const [columns, setColumns] = useState([]);
  
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState("");
  
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // --- 1. Init ---
  useEffect(() => {
    fetchBoards();

    monday.get("settings").then((res) => {
      if (res.data && res.data.boardId) {
        setSelectedBoardId(res.data.boardId);
        fetchColumns(res.data.boardId);
      }
      if (res.data && res.data.columnId) {
        setSelectedColumnId(res.data.columnId);
      }
    });
  }, []);

  // --- 2. Fetch Boards ---
  const fetchBoards = async () => {
    setLoadingBoards(true);
    try {
      const res = await monday.api(`query { boards(limit: 50) { id name } }`);
      if (res.data && res.data.boards) {
        setBoards(res.data.boards);
      }
    } catch (err) {
      console.error("Error fetching boards:", err);
    } finally {
      setLoadingBoards(false);
    }
  };

  // --- 3. Fetch Columns ---
  const fetchColumns = async (boardId) => {
    if (!boardId) return;
    setLoadingColumns(true);
    setColumns([]); 
    try {
      const res = await monday.api(`query { boards(ids: [${boardId}]) { columns { id title type } } }`);
      if (res.data && res.data.boards && res.data.boards[0]) {
        // מיפוי לפורמט אחיד של name ו-id עבור הרכיב הגנרי
        const formattedCols = res.data.boards[0].columns.map(c => ({
            id: c.id,
            name: `${c.title} (${c.type})`
        }));
        setColumns(formattedCols);
      }
    } catch (err) {
      console.error("Error fetching columns:", err);
    } finally {
      setLoadingColumns(false);
    }
  };

  // --- 4. Save ---
  const saveSettings = (boardId, columnId) => {
    monday.set("settings", { boardId, columnId });
  };

  // --- Handlers ---
  const handleBoardChange = (newBoardId) => {
    setSelectedBoardId(newBoardId);
    setSelectedColumnId("");
    saveSettings(newBoardId, null);

    if (newBoardId) {
      fetchColumns(newBoardId);
    } else {
      setColumns([]);
    }
  };

  const handleColumnChange = (newColumnId) => {
    setSelectedColumnId(newColumnId);
    saveSettings(selectedBoardId, newColumnId);
  };

  return (
    <div className="p-8 max-w-md mx-auto bg-white rounded-xl shadow-md border border-gray-100 font-sans min-h-[400px]" dir="rtl">
      <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">הגדרות מקור נתונים</h3>
      
      <div className="space-y-6">
        {/* שדה 1: בחירת לוח (עם חיפוש) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">בחר לוח:</label>
          <SearchableSelect 
            options={boards}
            value={selectedBoardId}
            onChange={handleBoardChange}
            placeholder="בחר לוח..."
            isLoading={loadingBoards}
          />
        </div>

        {/* שדה 2: בחירת עמודה (גם עם חיפוש, למה לא?) */}
        <div className={`transition-opacity duration-300 ${selectedBoardId ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <label className="block text-sm font-semibold text-gray-700 mb-2">בחר עמודה לניהול זמן:</label>
          <SearchableSelect 
            options={columns}
            value={selectedColumnId}
            onChange={handleColumnChange}
            placeholder="בחר עמודה..."
            isLoading={loadingColumns}
            disabled={!selectedBoardId}
          />
          
          {selectedBoardId && !loadingColumns && columns.length === 0 && (
             <p className="text-xs text-red-500 mt-1">לא נמצאו עמודות מתאימות בלוח זה.</p>
          )}
        </div>
      </div>

      {/* Debug Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded-md border border-gray-200 text-xs text-gray-500 font-mono">
        <p className="font-bold mb-1">נתונים לשמירה (Settings JSON):</p>
        <pre>{JSON.stringify({ boardId: selectedBoardId, columnId: selectedColumnId }, null, 2)}</pre>
      </div>
    </div>
  );
}