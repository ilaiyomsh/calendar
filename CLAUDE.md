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
| `MondayCalendar.jsx` | 1551 | Main calendar, drag-drop, modals, handlers |
| `mondayApi.js` | 1037 | All GraphQL queries/mutations |
| `useMondayEvents.js` | 721 | Event CRUD, pagination, column building |
| `EventModal.jsx` | 496 | Timed event create/edit modal |

### State Management
- **SettingsContext** - Global settings via React Context
- **monday.storage.instance** - Persistent settings storage
- **Component state** - Local useState (no Redux/Zustand)

## Event Types

The app handles two event categories:

### Timed Events (שעתי)
- Regular work hour reports
- Have start time, end time, duration in hours
- Billable (לחיוב) or Non-billable (לא לחיוב)
- Created via `EventModal`

### All-Day Events (יומי)
- Special types: חופשה (vacation), מחלה (sick), מילואים (reserves)
- Duration in days (not hours)
- No time component, just date
- Created via `AllDayEventModal`

```javascript
// Check event type
import { isAllDayEventType, ALL_DAY_EVENT_TYPES } from './utils/durationUtils';
// ALL_DAY_EVENT_TYPES = ['חופשה', 'מחלה', 'מילואים']
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

## Key Hooks

### useMondayEvents
```javascript
const {
    events,           // Current events array
    loading,          // Loading state
    loadEvents,       // (startDate, endDate) => void
    createEvent,      // (eventData, start, end) => Promise
    updateEvent,      // (id, eventData, start, end) => Promise
    deleteEvent,      // (id) => Promise
    updateEventPosition,  // (event, newStart, newEnd) => Promise (drag/resize)
    addEvent          // (event) => void - optimistic add to state
} = useMondayEvents(monday, context);
```

### useProjects
```javascript
const { projects, loading, error, refetch } = useProjects();
// Returns projects filtered by peopleColumnIds (assigned to current user)
```

### useTasks
```javascript
const { tasks, loading, fetchForProject, createTask } = useTasks();
// fetchForProject(projectId) - loads tasks linked to project
// createTask(projectId, taskName) - creates new task
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
    fetchCurrentUser,
    MondayApiError  // Custom error class
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

## Monday Column Types

The app maps to these column types in settings:

| Setting Key | Column Type | Purpose |
|-------------|-------------|---------|
| `dateColumnId` | date | Event date + time |
| `durationColumnId` | numbers | Hours (timed) or days (all-day) |
| `projectColumnId` | board_relation | Link to projects board |
| `taskColumnId` | board_relation | Link to tasks board |
| `reporterColumnId` | people | User who reported |
| `eventTypeStatusColumnId` | status | שעתי/לא לחיוב/חופשה/מחלה/מילואים |
| `nonBillableStatusColumnId` | status | Non-billable sub-types |
| `stageColumnId` | status | Stage/classification |
| `notesColumnId` | text | Free-text notes |

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

## Common Pitfalls

1. **Don't use console.log** - Use `logger` instead
2. **All user messages in Hebrew** - Including errors
3. **Validate structure mode** - Before accessing task/stage fields
4. **UTC vs Local time** - Monday API expects UTC for date columns
5. **Exclusive end dates** - react-big-calendar uses exclusive end for all-day events

## Testing Changes

1. Load calendar, navigate between weeks
2. Create timed event (with project/task/stage based on structure mode)
3. Create all-day event (חופשה/מחלה/מילואים)
4. Edit existing event
5. Drag event to new time
6. Resize event
7. Delete event
8. Open settings, change settings, verify changes apply

## Files to Know

| Purpose | Files |
|---------|-------|
| Entry point | `index.jsx`, `App.jsx` |
| Main view | `MondayCalendar.jsx` |
| Settings | `SettingsDialog/`, `SettingsContext.jsx` |
| Event forms | `EventModal/`, `AllDayEventModal/` |
| API calls | `utils/mondayApi.js` |
| Hooks | `hooks/useMondayEvents.js`, `hooks/useProjects.js` |
| Utilities | `utils/durationUtils.js`, `utils/errorHandler.js` |
| Config | `constants/calendarConfig.jsx` |
