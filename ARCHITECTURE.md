# Architecture Documentation

## Project Overview

**Monday.com Board View Application** - A Hebrew (RTL) calendar interface for reporting work hours, built as a Board View for Monday.com.

### Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 |
| Build Tool | Vite 6.x |
| Calendar | react-big-calendar + Drag-and-Drop addon |
| UI Components | @vibe/core (Monday Design System) |
| Date Handling | date-fns |
| Hebrew Calendar | @hebcal/core |
| Monday Integration | monday-sdk-js, @mondaycom/apps-sdk |
| Styling | CSS Modules + Global CSS |

### Code Statistics

- **Total Source Files**: 88
- **Total Lines of Code**: ~16,371
- **Component Count**: 17 feature components
- **Custom Hooks**: 9
- **Utility Modules**: 8

---

## System Architecture (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Monday.com Platform                          │
│   ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│   │  GraphQL API     │  │  Monday Storage   │  │  Context API    │   │
│   └────────┬─────────┘  └────────┬─────────┘  └───────┬─────────┘   │
│            │                     │                    │             │
└────────────┼─────────────────────┼────────────────────┼─────────────┘
             │                     │                    │
             ▼                     ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Layer                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                         App.jsx                              │   │
│  │  - SettingsProvider (Context)                                │   │
│  │  - ErrorBoundary                                             │   │
│  │  - Global Toast & Modal Management                           │   │
│  └─────────────────────┬───────────────────────────────────────┘   │
│                        │                                            │
│  ┌─────────────────────▼───────────────────────────────────────┐   │
│  │                   MondayCalendar.jsx                         │   │
│  │  - Main calendar view (react-big-calendar)                   │   │
│  │  - Event CRUD operations                                     │   │
│  │  - Drag & Drop handling                                      │   │
│  │  - Multi-select functionality                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                        │                                            │
│  ┌─────────────────────┼─────────────────────────────────────────┐ │
│  │                 Component Layer                                │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐   │ │
│  │  │ EventModal   │ │AllDayModal   │ │ SettingsDialog       │   │ │
│  │  │ (timed)      │ │(sick/leave)  │ │ (multi-tab config)   │   │ │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘   │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐   │ │
│  │  │ CustomEvent  │ │ Toast/Error  │ │ SelectionActionBar   │   │ │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                        │                                            │
│  ┌─────────────────────┼─────────────────────────────────────────┐ │
│  │                  Hooks Layer                                   │ │
│  │  ┌────────────────────┐ ┌─────────────────┐ ┌───────────────┐ │ │
│  │  │ useMondayEvents    │ │ useProjects     │ │ useTasks      │ │ │
│  │  │ (CRUD + pagination)│ │ (project fetch) │ │ (task fetch)  │ │ │
│  │  └────────────────────┘ └─────────────────┘ └───────────────┘ │ │
│  │  ┌────────────────────┐ ┌─────────────────┐ ┌───────────────┐ │ │
│  │  │ useStageOptions    │ │ useToast        │ │ useHolidays   │ │ │
│  │  └────────────────────┘ └─────────────────┘ └───────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                        │                                            │
│  ┌─────────────────────▼─────────────────────────────────────────┐ │
│  │                  Utilities Layer                               │ │
│  │  mondayApi.js    │ errorHandler.js │ durationUtils.js         │ │
│  │  mondayColumns.js│ logger.js       │ settingsValidator.js     │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── index.jsx              # Entry point (13 lines)
├── init.js                # Monday SDK initialization
├── App.jsx                # Root component with providers (170 lines)
├── App.css                # Global app styles
├── MondayCalendar.jsx     # Main calendar component (1551 lines) ⚠️
├── index.css              # Global styles
│
├── components/            # Feature components
│   ├── AllDayEventModal/  # Modal for sick/vacation/reserves
│   ├── ConfirmDialog/     # Reusable confirmation dialog
│   ├── CustomEvent/       # Calendar event renderer
│   ├── ErrorBoundary/     # React error boundary
│   ├── ErrorDetailsModal/ # Detailed error display
│   ├── ErrorToast/        # Error notification with details link
│   ├── EventModal/        # Modal for timed events
│   ├── SelectionActionBar/# Multi-select action bar
│   ├── SettingsDialog/    # Configuration dialog (multi-tab)
│   │   ├── StructureTab.jsx
│   │   ├── MappingTab.jsx
│   │   ├── SearchableSelect.jsx
│   │   └── MultiSelect.jsx
│   ├── SettingsValidationDialog/
│   ├── StageSelect/       # Stage/phase selector
│   ├── TaskSelect/        # Task selector
│   ├── TimeSelect/        # Time picker
│   ├── Toast/             # Toast notification system
│   └── CalendarToolbar.jsx
│
├── contexts/
│   └── SettingsContext.jsx # Global settings state (183 lines)
│
├── hooks/                 # Custom React hooks
│   ├── useMondayEvents.js # Event CRUD operations (721 lines) ⚠️
│   ├── useProjects.js     # Project fetching with caching
│   ├── useTasks.js        # Task fetching by project
│   ├── useTasksMultiple.js# Batch task fetching
│   ├── useStageOptions.js # Stage/status options
│   ├── useNonBillableOptions.js
│   ├── useBoardOwner.js   # Owner status check
│   ├── useToast.js        # Toast management
│   └── useIsraeliHolidays.js # Hebrew calendar holidays
│
├── utils/                 # Pure utility functions
│   ├── mondayApi.js       # GraphQL API functions (1037 lines) ⚠️
│   ├── mondayColumns.js   # Column ID mapping
│   ├── errorHandler.js    # Error parsing & Hebrew messages
│   ├── durationUtils.js   # Time/duration calculations
│   ├── logger.js          # Centralized logging
│   ├── colorUtils.js      # Color utilities
│   ├── holidayUtils.js    # Holiday calculations
│   ├── settingsValidator.js # Settings validation
│   ├── eventTypeValidation.js
│   └── globalErrorHandler.js # Global error capture
│
├── constants/
│   ├── calendarConfig.jsx # Calendar configuration
│   └── holidayConfig.js   # Holiday definitions
│
└── styles/
    └── calendar/          # Calendar-specific styles
        ├── index.css
        ├── components/    # Component-specific overrides
        └── structure/     # Layout styles
```

---

## Data Flow

### 1. Event Loading Flow

```
User navigates calendar
        │
        ▼
handleRangeChange (MondayCalendar)
        │
        ▼
loadEvents (useMondayEvents hook)
        │
        ├── Build GraphQL query with:
        │   - Date range filter
        │   - Monday filter (from context)
        │   - Search term
        │
        ▼
monday.api() → GraphQL Endpoint
        │
        ▼
Pagination loop (500 items/page)
        │
        ▼
Map items to event objects
        │
        ▼
setEvents() → State update → Calendar re-render
```

### 2. Event Creation Flow

```
User selects slot
        │
        ▼
onSelectSlot (MondayCalendar)
        │
        ├── Determine event type (allDay vs timed)
        ├── Validate (not future time)
        │
        ▼
Open Modal (EventModal or AllDayEventModal)
        │
        ▼
User fills form → Submit
        │
        ▼
handleCreateEvent / handleCreateAllDayEvent
        │
        ├── Build column values
        ├── Calculate employee cost (if enabled)
        │
        ▼
createBoardItem (mondayApi.js)
        │
        ▼
addEvent() → Optimistic UI update
```

### 3. Settings Flow

```
App Startup
    │
    ▼
SettingsProvider loads from monday.storage
    │
    ├── Migration of legacy keys
    ├── Auto-detect structure mode
    │
    ▼
Settings available via useSettings() hook
    │
    ▼
User opens SettingsDialog
    │
    ├── StructureTab - Choose hierarchy mode
    ├── MappingTab - Map column IDs
    │
    ▼
updateSettings() → monday.storage.setItem()
```

---

## Settings Structure Modes

The app supports 4 hierarchy configurations:

| Mode | Description | Fields Used |
|------|-------------|-------------|
| `PROJECT_ONLY` | Projects only | `projectColumnId` |
| `PROJECT_WITH_STAGE` | Projects + status classification | `projectColumnId`, `stageColumnId` |
| `PROJECT_WITH_TASKS` | Projects + linked tasks board | `projectColumnId`, `taskColumnId` |
| `PROJECT_WITH_TASKS_AND_STAGE` | Full hierarchy | All above |

---

## Key Component Responsibilities

### MondayCalendar.jsx (1551 lines)

**Current Responsibilities** (should be split):
- Calendar rendering and configuration
- Event handlers (drag, drop, resize, click)
- All modal state management
- Multi-select logic
- All-day event creation logic
- Holiday integration
- Settings validation
- Toast notifications

### useMondayEvents.js (721 lines)

**Responsibilities**:
- Event CRUD operations
- Optimistic updates with rollback
- Pagination handling
- Column value building
- Employee hourly rate calculation

### mondayApi.js (1037 lines)

**Responsibilities**:
- All GraphQL queries and mutations
- Error wrapping with MondayApiError
- Logging of API calls
- Response parsing

---

## Error Handling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Sources                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ API Errors  │  │ React Errors│  │ Unhandled Promises  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Error Processing                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ parseMondayError (errorHandler.js)                    │   │
│  │ - Map error codes to Hebrew messages                  │   │
│  │ - Determine if retryable                              │   │
│  │ - Capture full error context                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    User Presentation                         │
│  ┌─────────────────┐  ┌───────────────────────────────────┐ │
│  │ ErrorToast      │  │ ErrorDetailsModal                 │ │
│  │ (brief message) │  │ (full JSON for debugging)         │ │
│  └─────────────────┘  └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## External Dependencies Map

```
Application
    │
    ├── Monday Platform
    │   ├── monday-sdk-js (API calls)
    │   ├── monday.storage (settings persistence)
    │   └── monday.get('context') (board/user info)
    │
    ├── UI Framework
    │   ├── @vibe/core (buttons, inputs, modals)
    │   └── @vibe/icons (icon set)
    │
    ├── Calendar
    │   └── react-big-calendar
    │       └── withDragAndDrop (addon)
    │
    ├── Date/Time
    │   ├── date-fns (date manipulation)
    │   └── @hebcal/core (Hebrew calendar)
    │
    └── Icons
        └── lucide-react
```

---

## State Management

| State Type | Location | Scope |
|------------|----------|-------|
| Settings | SettingsContext | Global |
| Events | useMondayEvents | Page |
| Projects | useProjects | Page |
| Tasks | useTasks | Component |
| Modal State | MondayCalendar | Component |
| Toast Queue | useToast | Page |
| Multi-select | MondayCalendar | Component |

---

## Performance Considerations

1. **Pagination**: Events fetched in pages of 500 to avoid API limits
2. **Optimistic Updates**: UI updates before API confirmation (with rollback)
3. **Memo/Callback**: Heavy use of `useCallback` and `useMemo` for render optimization
4. **Lazy Loading**: Tasks loaded only when project selected

---

## Security Notes

- No direct REST API calls - all through Monday SDK
- No sensitive data stored client-side (uses monday.storage)
- Column IDs validated before use
- Input sanitization for GraphQL queries via variables

---

## Files Requiring Attention

| File | Lines | Issue |
|------|-------|-------|
| `MondayCalendar.jsx` | 1551 | God component - needs splitting |
| `mondayApi.js` | 1037 | Many repetitive error handling blocks |
| `useMondayEvents.js` | 721 | Large hook - could be split |
| `SettingsDialog.jsx` | ~400 | Complex, but manageable |

---

*Document generated: January 2026*
*Last audit: January 2026*
