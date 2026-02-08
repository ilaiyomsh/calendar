# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Monday.com Board View application - a Hebrew (RTL) calendar interface for reporting work hours. Built with React 18 + Vite, integrates with Monday.com boards via GraphQL API.

**Language**: All user-facing text is in Hebrew. Comments are in Hebrew.

## Commands

```bash
pnpm start          # Dev server (port 8301) + tunnel
pnpm run build      # Production build → build/
pnpm run deploy     # Build + push to Monday.com
pnpm run server     # Dev server only
pnpm run expose     # Create tunnel via mapps CLI
pnpm run stop       # Kill dev processes
```

No lint or test commands configured.

## Architecture

### Entry Flow
```
index.html → src/index.jsx → src/init.js (Monday SDK) → App.jsx → MondayCalendar.jsx
```

### Key Files by Size
| File | Lines | Responsibility |
|------|-------|----------------|
| `components/SettingsDialog/MappingTab.jsx` | 1103 | Settings column mapping dialog |
| `MondayCalendar.jsx` | 993 | Main calendar, drag-drop, modals, handlers |
| `components/AllDayEventModal/AllDayEventModal.jsx` | 954 | All-day event create/edit/bulk modal |
| `utils/mondayApi.js` | 878 | All GraphQL queries/mutations |
| `hooks/useMondayEvents.js` | 819 | Event CRUD, pagination, filter rules |
| `components/EventModal/EventModal.jsx` | 552 | Timed event create/edit modal |
| `hooks/useAllDayEvents.js` | 508 | All-day event handlers (separated) |
| `utils/settingsValidator.js` | 348 | Settings validation on startup |
| `utils/errorHandler.js` | 347 | Error processing & logging |
| `components/SettingsDialog/SettingsDialog.jsx` | 303 | Settings dialog with 3 tabs |
| `utils/logger.js` | 298 | Structured logging system |
| `components/SettingsDialog/FiltersTab.jsx` | 277 | Filter source configuration |
| `components/FilterBar/FilterBar.jsx` | 248 | Reporter/project filter dropdowns |
| `hooks/useFilterOptions.js` | 232 | Fetch reporters & projects for filters |
| `hooks/useEventDataLoader.js` | 231 | Lazy load event details for editing |
| `contexts/SettingsContext.jsx` | ~220 | Global settings via React Context |
| `components/SettingsDialog/StructureTab.jsx` | ~200 | Structure mode configuration |
| `components/CalendarToolbar.jsx` | 141 | Toolbar with filter bar integration |
| `hooks/useCalendarFilter.js` | 107 | Filter state & GraphQL rule builder |

### Component Tree
```
App.jsx
├─ SettingsProvider
│  └─ AppContent
│     ├─ MondayCalendar
│     │  ├─ CalendarToolbar
│     │  │  └─ FilterBar
│     │  ├─ DnDCalendar (react-big-calendar)
│     │  ├─ EventModal (timed events)
│     │  ├─ AllDayEventModal (vacations/sick/reserves)
│     │  └─ CustomEvent (event tooltip renderer)
│     ├─ SettingsDialog
│     │  ├─ StructureTab
│     │  ├─ MappingTab
│     │  └─ FiltersTab
│     ├─ ToastContainer
│     └─ ErrorDetailsModal
```

### State Management
- **SettingsContext** - Global settings via React Context, persisted to monday.storage.instance
- **monday.storage.instance** - Persistent settings storage
- **Component state** - Local useState (no Redux/Zustand)

## Event Types

The app handles two event categories:

### Timed Events (שעתי)
- Regular work hour reports
- Have start time, end time, duration in hours
- Billable (לחיוב) or Non-billable (לא לחיוב)
- Temporary (זמני) - placeholder events
- Created via `EventModal`

### All-Day Events (יומי)
- Special types: חופשה (vacation), מחלה (sick), מילואים (reserves)
- Duration in days (not hours)
- No time component, just date
- Supports bulk reporting (multiple days at once)
- Created via `AllDayEventModal`

```javascript
// Check event type
import { isAllDayEventType, ALL_DAY_EVENT_TYPES } from './utils/durationUtils';
// ALL_DAY_EVENT_TYPES = ['חופשה', 'מחלה', 'מילואים']
```

### Event Type Labels
```javascript
import { REQUIRED_EVENT_TYPE_LABELS, TEMPORARY_EVENT_LABEL } from './utils/eventTypeValidation';
// REQUIRED_EVENT_TYPE_LABELS = ['חופשה', 'מחלה', 'מילואים', 'שעתי', 'לא לחיוב', 'זמני']
// TEMPORARY_EVENT_LABEL = 'זמני'
```

## Structure Modes

The app supports 4 hierarchy configurations in SettingsContext:

```javascript
import { STRUCTURE_MODES } from './contexts/SettingsContext';

STRUCTURE_MODES.PROJECT_ONLY              // Projects only
STRUCTURE_MODES.PROJECT_WITH_STAGE        // Projects + stage status column
STRUCTURE_MODES.PROJECT_WITH_TASKS        // Projects + linked tasks board
STRUCTURE_MODES.PROJECT_WITH_TASKS_AND_STAGE  // Full: Projects + Tasks + Stage
```

## Board ID Resolution

The app supports flexible board targeting via `boardIdResolver.js`:

```javascript
import { getEffectiveBoardId, hasValidReportingBoard, isCustomObjectMode } from './utils/boardIdResolver';

// Logic:
// 1. useCurrentBoardForReporting=true AND context.boardId exists → context.boardId
// 2. timeReportingBoardId is set → timeReportingBoardId
// 3. Fallback → context.boardId (backward compatibility)
```

## Key Hooks

### useMondayEvents
```javascript
const {
    events,               // Current events array
    loading,              // Loading state
    loadEvents,           // (startDate, endDate) => void
    createEvent,          // (eventData, start, end) => Promise
    updateEvent,          // (id, eventData, start, end) => Promise
    deleteEvent,          // (id) => Promise
    updateEventPosition,  // (event, newStart, newEnd) => Promise (drag/resize)
    addEvent              // (event) => void - optimistic add to state
} = useMondayEvents(monday, context);
// Supports custom filter rules from useCalendarFilter
// Pagination with cursor handling
// Filter rule conversion: rulesToGraphQL()
```

### useAllDayEvents
```javascript
const {
    handleCreateAllDayEvent,   // Create vacation/sick/reserves
    handleUpdateAllDayEvent,   // Update existing all-day event
    handleDeleteAllDayEvent    // Delete all-day event
} = useAllDayEvents(/* dependencies */);
// Handles bulk reporting (multiple days at once)
// Uses calculateEndDateFromDays() for day-based duration
```

### useCalendarFilter
```javascript
const {
    selectedReporterIds,       // Selected reporter user IDs
    selectedProjectIds,        // Selected project IDs
    setSelectedReporterIds,    // Update reporter filter
    setSelectedProjectIds,     // Update project filter
    filterRules,               // GraphQL-ready filter rules
    hasActiveFilter             // Boolean: any filter active?
} = useCalendarFilter();
```

### useFilterOptions
```javascript
const {
    reporters,          // Available reporters for filter
    filterProjects,     // Available projects for filter
    loadingReporters,   // Loading state
    loadingProjects     // Loading state
} = useFilterOptions();
// Fetches from employees board or reporting board
// Supports deduplication and pagination
```

### useEventDataLoader
```javascript
const { loadEventData } = useEventDataLoader();
// Lazy loads full event data when editing
// Extracts: project, task, notes, stage, billing info
// Uses linked_items with fallback to parsed values
```

### useProjects
```javascript
const { projects, loading, error, refetch } = useProjects();
// Returns projects filtered by peopleColumnIds (assigned to current user)
// Supports assignments mode (useAssignmentsMode setting)
```

### useTasks
```javascript
const { tasks, loading, fetchForProject, createTask } = useTasks();
// fetchForProject(projectId) - loads tasks linked to project
// createTask(projectId, taskName) - creates new task
```

### useNonBillableOptions
```javascript
const { nonBillableOptions, loading } = useNonBillableOptions();
// Loads billable sub-type options from status column
```

### useStageOptions
```javascript
const { stageOptions, loading } = useStageOptions();
// Loads stage/classification options from status column
```

### useEventModals
```javascript
const {
    // Modal states and handlers for EventModal and AllDayEventModal
    // Handles convert mode for temporary events
} = useEventModals();
```

### useToast
```javascript
const {
    toasts,
    showSuccess,    // (message) => void
    showError,      // (message) => void
    showWarning,    // (message) => void
    showErrorWithDetails,  // (error, context) => void - with details modal
    removeToast
} = useToast();
```

## API Layer

All Monday API calls go through `src/utils/mondayApi.js`.

### Key Functions
```javascript
import {
    createBoardItem,
    deleteItem,
    updateItemColumnValues,
    fetchProjectsForUser,
    fetchItemById,
    fetchProjectById,
    fetchCurrentUser,
    fetchActiveAssignments,        // For assignments mode
    fetchConnectedBoardsFromColumn, // Dynamic board discovery
    fetchUniquePeopleFromBoard,    // People extraction for filters
    fetchItemsStatus,              // Batch status fetching
    MondayApiError                 // Custom error class
} from './utils/mondayApi';
```

### Error Handling Pattern
```javascript
try {
    await someApiCall();
} catch (error) {
    showErrorWithDetails(error, { functionName: 'myFunction' });
    logger.error('Module', 'Error message', error);
}
```

Errors are wrapped in `MondayApiError` with:
- `response` - Full API response
- `apiRequest` - Query/variables sent
- `errorCode` - Monday error code
- `functionName` - Where error occurred
- `duration` - Request duration ms

### API Wrapper
```javascript
// All API calls use this wrapper for consistent error handling
wrapMondayApiCall(functionName, apiRequest, apiCall)
```

## Settings

### Board Configuration
```javascript
connectedBoardId              // Projects board (Level 1)
tasksBoardId                  // Tasks/products board (Level 2)
useCurrentBoardForReporting   // Use board context vs custom board ID
timeReportingBoardId          // Custom reporting board (if not using context)
useAssignmentsMode            // Alternative: fetch from assignments board
assignmentsBoardId            // Assignments board
assignmentPersonColumnId      // Person column in assignments
assignmentStartDateColumnId   // Start date in assignments
assignmentEndDateColumnId     // End date in assignments
assignmentProjectLinkColumnId // Project link column in assignments
```

### Filter Configuration
```javascript
filterProjectsBoardId         // Board to load projects from (for filter)
filterEmployeesBoardId        // Optional: dedicated employees board
filterEmployeesColumnId       // People column in employees board
```

### Column Mappings
| Setting Key | Column Type | Purpose |
|-------------|-------------|---------|
| `dateColumnId` | date | Event date + time |
| `durationColumnId` | numbers | Hours (timed) or days (all-day) |
| `projectColumnId` | board_relation | Link to projects board |
| `taskColumnId` | board_relation | Link to tasks board |
| `reporterColumnId` | people | User who reported |
| `eventTypeStatusColumnId` | status | שעתי/לא לחיוב/חופשה/מחלה/מילואים/זמני |
| `nonBillableStatusColumnId` | status | Non-billable sub-types |
| `stageColumnId` | status | Stage/classification |
| `notesColumnId` | text | Free-text notes |
| `endTimeColumnId` | date | End time for events |

### Validation
```javascript
import { validateEventTypeColumn, getRequiredSettings } from './utils/settingsValidator';

validateEventTypeColumn(settings)                      // Checks for all 6 required labels
getRequiredSettings(structureMode, useAssignmentsMode) // Dynamic requirements
```

## Logging

Use logger instead of console.log:

```javascript
import logger from './utils/logger';

logger.debug('Module', 'Debug message', data);
logger.info('Module', 'Info message', data);
logger.warn('Module', 'Warning', data);
logger.error('Module', 'Error', errorObject);

// API-specific
logger.api('functionName', query, variables);
logger.apiResponse('functionName', response, duration);
logger.apiError('functionName', error);

// Function tracing
logger.functionStart('functionName', params);
logger.functionEnd('functionName', result);
```

Production: Only ERROR level shown.
Enable debug in production console: `window.enableDebugLogs()`

## Component Patterns

### Folder Structure
```
src/components/ComponentName/
├── ComponentName.jsx
├── ComponentName.module.css
└── index.js  // export { default } from './ComponentName'
```

### CSS Modules
```javascript
import styles from './ComponentName.module.css';
<div className={styles.container}>
```

### Modal Pattern
Modals receive `isOpen`, `onClose` and render `null` if not open:
```javascript
if (!isOpen) return null;
return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className={styles.modal}>...</div>
    </div>
);
```

## Calendar Configuration

Located in `src/constants/calendarConfig.jsx`:

```javascript
import { localizer, hebrewMessages, formats, WorkWeekView } from './constants/calendarConfig';

// Time utilities
import { roundToNearest15Minutes, timeOptions15Minutes } from './constants/calendarConfig';
```

Work week: Sunday-Thursday (Israel standard)

## Duration Handling

Duration is polymorphic based on event type:

```javascript
import {
    isAllDayEventType,     // (eventType) => boolean
    parseDuration,         // (value, eventType) => { value, unit: 'hours'|'days' }
    formatDurationForSave, // (value, eventType) => string
    calculateEndDateFromDays,  // (start, days) => Date (exclusive end)
    calculateDaysDiff      // (start, end) => number
} from './utils/durationUtils';
```

## Data Flow

```
MondayCalendar.jsx
├─ useSettings() → customSettings (global)
├─ useProjects() → projects list (regular or assignments mode)
├─ useCalendarFilter() → filter state + GraphQL rules
├─ useFilterOptions() → reporters + filterProjects for dropdowns
├─ useMondayEvents(settings + filterRules) → events
│  └─ Applies filters internally via GraphQL rules
├─ useEventModals() → modal states
├─ useAllDayEvents() → all-day event handlers
├─ useEventDataLoader() → lazy load event details on edit
│
└─ CalendarToolbar
   └─ FilterBar
      ├─ reporters (from useFilterOptions)
      ├─ filterProjects (from useFilterOptions)
      └─ onReporterChange, onProjectChange callbacks
```

### Hook Dependency Graph
```
useCalendarFilter (independent)
    ↓
useMondayEvents (consumes filter rules)
    ↓
EventModal / AllDayEventModal (consume events)

useFilterOptions → FilterBar (filter dropdowns)
useEventDataLoader → edit modals (lazy data loading)
useProjects → EventModal (project selector)
useNonBillableOptions / useStageOptions → EventModal (dropdown options)
```

## Common Pitfalls

1. **Don't use console.log** - Use `logger` instead
2. **All user messages in Hebrew** - Including errors
3. **Validate structure mode** - Before accessing task/stage fields
4. **UTC vs Local time** - Monday API expects UTC for date columns
5. **Exclusive end dates** - react-big-calendar uses exclusive end for all-day events
6. **Board ID resolution** - Always use `getEffectiveBoardId()` instead of hardcoding board IDs
7. **Assignments mode** - Check `useAssignmentsMode` before assuming project source
8. **Event type labels** - All 6 required labels must exist in the status column

## Testing Changes

1. Load calendar, navigate between weeks
2. Create timed event (with project/task/stage based on structure mode)
3. Create all-day event (חופשה/מחלה/מילואים)
4. Create bulk all-day events (multiple days)
5. Edit existing event (verify lazy loading of event data)
6. Drag event to new time
7. Resize event
8. Delete event
9. Use filter bar - filter by reporter, by project
10. Open settings, change settings, verify changes apply
11. Test structure mode changes in Settings > Structure tab
12. Test column mapping in Settings > Mapping tab
13. Test filter configuration in Settings > Filters tab

## Files to Know

| Purpose | Files |
|---------|-------|
| Entry point | `index.jsx`, `App.jsx` |
| Main view | `MondayCalendar.jsx` |
| Settings | `SettingsDialog/`, `SettingsContext.jsx` |
| Event forms | `EventModal/`, `AllDayEventModal/` |
| Filtering | `FilterBar/`, `hooks/useCalendarFilter.js`, `hooks/useFilterOptions.js` |
| API calls | `utils/mondayApi.js` |
| Board resolution | `utils/boardIdResolver.js` |
| Event hooks | `hooks/useMondayEvents.js`, `hooks/useAllDayEvents.js`, `hooks/useEventDataLoader.js` |
| Data hooks | `hooks/useProjects.js`, `hooks/useNonBillableOptions.js`, `hooks/useStageOptions.js` |
| Validation | `utils/settingsValidator.js`, `utils/eventTypeValidation.js` |
| Utilities | `utils/durationUtils.js`, `utils/errorHandler.js` |
| Config | `constants/calendarConfig.jsx` |
