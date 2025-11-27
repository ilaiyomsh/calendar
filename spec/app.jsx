import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, Views, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';

// ייבוא עיצובים של הספרייה (חובה!)
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// ספריות עזר וזמן
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import he from 'date-fns/locale/he'; // תמיכה בעברית
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft, X, ArrowRight, Settings } from 'lucide-react';

// --- הגדרת ה-Localizer (חיבור date-fns ללוח) ---
const locales = {
  'he': he,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

// --- קבועים ונתונים ---
const EVENT_COLOR = "#0073ea"; 
const SUBJECT_OPTIONS = ["פגישת עבודה", "שיחת לקוח", "זמן מוקד", "ארוחת צהריים", "סיור שטח", "דד-ליין פרויקט", "אחר"];

// --- Mock Data ---
const generateMockEvents = () => {
  const today = new Date();
  today.setHours(0,0,0,0);

  return [
    {
      id: 1,
      title: 'פגישת בוקר',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 15),
      allDay: false,
    },
    {
      id: 2,
      title: 'יום חופש',
      start: today,
      end: today,
      allDay: true,
    }
  ];
};

// --- רכיב דיאלוג ליצירת אירוע ---
const EventDialog = ({ isOpen, onClose, onSave, initialData }) => {
    const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
    const [startStr, setStartStr] = useState("10:00");
    const [endStr, setEndStr] = useState("11:00");
    const [baseDate, setBaseDate] = useState(new Date());

    // עדכון הדיאלוג כשנפתח עם נתונים חדשים
    React.useEffect(() => {
        if (isOpen && initialData) {
            setBaseDate(initialData.start);
            // המרה לשעות בפורמט HH:mm
            setStartStr(format(initialData.start, 'HH:mm'));
            setEndStr(format(initialData.end, 'HH:mm'));
        }
    }, [isOpen, initialData]);

    const handleSave = () => {
        const [sH, sM] = startStr.split(':').map(Number);
        const [eH, eM] = endStr.split(':').map(Number);

        const finalStart = new Date(baseDate);
        finalStart.setHours(sH, sM, 0, 0);

        const finalEnd = new Date(baseDate);
        finalEnd.setHours(eH, eM, 0, 0);

        // תיקון אם הסיום לפני ההתחלה
        if (finalEnd <= finalStart) {
            finalEnd.setTime(finalStart.getTime() + 60*60*1000);
        }

        onSave(subject, finalStart, finalEnd);
        onClose();
    };

    if (!isOpen) return null;

    const dateDisplay = baseDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-200" style={{zIndex: 1000}}>
            <div className="bg-white rounded-xl shadow-2xl w-[400px] p-0 overflow-hidden flex flex-col" dir="rtl">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">אירוע חדש</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full"><X size={20} /></button>
                </div>
                
                <div className="p-6 flex flex-col gap-6">
                    {/* סטריפ בחירת זמנים */}
                    <div className="bg-gray-100 rounded-lg p-2 flex items-center justify-between px-4 h-14">
                        <div className="flex items-center gap-2 text-gray-700 text-lg font-medium flex-1">
                            <input 
                                type="time" 
                                value={startStr}
                                onChange={(e) => setStartStr(e.target.value)}
                                className="bg-transparent border-none p-0 w-16 focus:ring-0 cursor-pointer font-mono font-semibold hover:text-blue-600"
                            />
                            <ArrowRight size={16} className="text-gray-400 mx-1" />
                            <input 
                                type="time" 
                                value={endStr}
                                onChange={(e) => setEndStr(e.target.value)}
                                className="bg-transparent border-none p-0 w-16 focus:ring-0 cursor-pointer font-mono font-semibold hover:text-blue-600"
                            />
                        </div>
                        <div className="w-px h-8 bg-gray-300 mx-4"></div>
                        <div className="text-gray-500 text-sm font-medium whitespace-nowrap">{dateDisplay}</div>
                    </div>

                    {/* בחירת נושא */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">נושא האירוע</label>
                        <select 
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
                        >
                            {SUBJECT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-100">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg">ביטול</button>
                    <button onClick={handleSave} className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">שמור אירוע</button>
                </div>
            </div>
        </div>
    );
};

// --- App Component ---
export default function App() {
  const [events, setEvents] = useState(generateMockEvents());
  const [view, setView] = useState(Views.WEEK);
  const [date, setDate] = useState(new Date());
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [slotData, setSlotData] = useState(null);

  // --- הגדרות הלוח (מרווחים, שעות, פורמטים) ---
  
  // 1. הגבלת שעות (06:00 - 20:00)
  const { min, max } = useMemo(() => {
      const today = new Date();
      const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 6, 0, 0);
      const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0, 0);
      return { min: minDate, max: maxDate };
  }, []);

  // 2. פורמטים מותאמים ל-24 שעות
  const formats = useMemo(() => ({
    timeGutterFormat: (date, culture, localizer) => localizer.format(date, 'HH:mm', culture),
    eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
      `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,
    agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
      `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`,
    dayHeaderFormat: (date, culture, localizer) =>
      localizer.format(date, 'EEEE dd/MM', culture),
  }), []);

  // --- Handlers ---

  const onEventResize = ({ event, start, end }) => {
    setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, start, end } : ev));
  };

  const onEventDrop = ({ event, start, end }) => {
    setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, start, end } : ev));
  };

  // לחיצה על משבצת ריקה פותחת את הדיאלוג
  const handleSelectSlot = useCallback(({ start, end }) => {
      setSlotData({ start, end });
      setIsDialogOpen(true);
  }, []);

  const handleCreateEvent = (title, start, end) => {
      const newEvent = {
          id: Math.random(),
          title,
          start,
          end,
          allDay: false
      };
      setEvents([...events, newEvent]);
  };

  // ניווט חיצוני (Header)
  const handleNavigate = (action) => {
      let newDate = new Date(date);
      if (action === 'TODAY') newDate = new Date();
      else if (action === 'NEXT') {
          if (view === Views.WEEK) newDate.setDate(date.getDate() + 7);
          else if (view === Views.DAY) newDate.setDate(date.getDate() + 1);
          else if (view === Views.MONTH) newDate.setMonth(date.getMonth() + 1);
      } else if (action === 'PREV') {
          if (view === Views.WEEK) newDate.setDate(date.getDate() - 7);
          else if (view === Views.DAY) newDate.setDate(date.getDate() - 1);
          else if (view === Views.MONTH) newDate.setMonth(date.getMonth() - 1);
      }
      setDate(newDate);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 font-sans text-gray-800 rtl" dir="rtl">
      
      {/* Custom Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 shadow-sm flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow"><CalendarIcon size={22} /></div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">יומן שעות</h1>
        </div>

        <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button onClick={() => handleNavigate('NEXT')} className="p-2 hover:bg-white rounded-md shadow-sm"><ChevronRight size={20} /></button>
            <span className="px-4 font-bold text-lg min-w-[180px] text-center">
                {date.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => handleNavigate('PREV')} className="p-2 hover:bg-white rounded-md shadow-sm"><ChevronLeft size={20} /></button>
            <button onClick={() => handleNavigate('TODAY')} className="mr-2 px-3 py-1 text-sm font-medium hover:bg-white rounded-md">היום</button>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            {[Views.MONTH, Views.WEEK, Views.DAY].map(v => (
                <button 
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                >
                    {v === 'month' ? 'חודש' : v === 'week' ? 'שבוע' : 'יום'}
                </button>
            ))}
        </div>
      </div>

      {/* Calendar Container */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full bg-white rounded-xl shadow border border-gray-200">
            {/* הוספת מחלקת CSS מותאמת אישית כדי לעצב את הלוח */}
            <style>{`
                .rbc-calendar { direction: rtl; font-family: inherit; }
                .rbc-header { padding: 8px; font-weight: 600; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
                .rbc-today { background-color: #eff6ff; }
                .rbc-event { background-color: #0073ea; border: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .rbc-time-slot { font-size: 12px; }
                .rbc-current-time-indicator { background-color: #ef4444; }
                .rbc-time-view .rbc-header { border-bottom: 1px solid #e5e7eb; }
                .rbc-timeslot-group { border-bottom: 1px solid #f3f4f6; }
            `}</style>

            <DnDCalendar
                localizer={localizer}
                events={events}
                
                // הגדרות לוקליזציה
                culture='he'
                rtl={true}
                
                // הגדרות זמנים
                step={15} // מרווחים של 15 דקות
                timeslots={2} // חלוקה בתוך השעה
                min={min} // 06:00
                max={max} // 20:00
                formats={formats} // 24 שעות
                
                // ניהול State
                defaultView={Views.WEEK}
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                
                // תצוגות מותרות
                views={[Views.MONTH, Views.WEEK, Views.DAY]}
                
                // גרירה ושחרור
                resizable
                onEventDrop={onEventDrop}
                onEventResize={onEventResize}
                
                // יצירת אירוע
                selectable
                onSelectSlot={handleSelectSlot}
                
                // תרגום הודעות פנימיות
                messages={{
                    allDay: 'כל היום',
                    previous: 'הקודם',
                    next: 'הבא',
                    today: 'היום',
                    month: 'חודש',
                    week: 'שבוע',
                    day: 'יום',
                    agenda: 'סדר יום',
                    date: 'תאריך',
                    time: 'שעה',
                    event: 'אירוע',
                    noEventsInRange: 'אין אירועים בטווח זה',
                }}
            />
        </div>
      </div>

      <EventDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        onSave={handleCreateEvent}
        initialData={slotData}
      />
    </div>
  );
}