# Refactoring Tasks Plan

## Overview

This document breaks down the refactoring roadmap into actionable tasks with clear acceptance criteria, file locations, and dependencies.

---

## Sprint 1: Quick Wins

**Goal**: Clean up low-hanging fruit with immediate impact
**Estimated Effort**: 2-4 hours total

---

### Task 1.1: Remove Duplicate setEvents Call

| Field | Value |
|-------|-------|
| **ID** | QW-1 |
| **Priority** | P0 - Critical |
| **Effort** | 5 minutes |
| **Risk** | Low |

**File**: `src/hooks/useMondayEvents.js`

**Lines to modify**: 276-280

**Current Code**:
```javascript
setEvents(mappedEvents);
logger.functionEnd('useMondayEvents.loadEvents', { count: mappedEvents.length });

setEvents(mappedEvents);
logger.functionEnd('useMondayEvents.loadEvents', { count: mappedEvents.length });
```

**Action**: Delete lines 279-280 (the duplicate pair)

**Acceptance Criteria**:
- [ ] Only one `setEvents(mappedEvents)` call exists
- [ ] Only one `logger.functionEnd` call exists
- [ ] App loads events correctly after change
- [ ] No console errors

**Test**:
1. Navigate calendar to different weeks
2. Verify events load correctly
3. Check console for errors

---

### Task 1.2: Remove console.log Debug Statements

| Field | Value |
|-------|-------|
| **ID** | QW-3 |
| **Priority** | P1 - High |
| **Effort** | 15 minutes |
| **Risk** | Low |

**File**: `src/MondayCalendar.jsx`

**Locations**:
| Line | Statement |
|------|-----------|
| ~654 | `console.log('🔍 onSelectSlot DEBUG:', {...})` |
| ~665 | `console.log('🔍 isAllDayClick:', isAllDayClick)` |
| ~677 | `console.log('🔍 Opening AllDayModal with date:', ...)` |

**Action**: Either:
- A) Replace with `logger.debug('onSelectSlot', 'message', data)` calls
- B) Remove entirely if not needed for production

**Acceptance Criteria**:
- [ ] No `console.log` statements in `MondayCalendar.jsx`
- [ ] Search codebase: `grep -r "console.log" src/` returns no results
- [ ] Slot selection still works correctly

---

### Task 1.3: Clean Unused Imports

| Field | Value |
|-------|-------|
| **ID** | QW-5 |
| **Priority** | P2 - Medium |
| **Effort** | 30 minutes |
| **Risk** | Low |

**Discovery Command**:
```bash
npx eslint src --rule 'no-unused-vars: warn' --no-eslintrc 2>/dev/null | grep "is defined but never used"
```

**Files to Check** (likely candidates):
- `src/MondayCalendar.jsx` - Large file, likely has unused imports
- `src/hooks/useMondayEvents.js` - Check all imports used
- `src/components/EventModal/EventModal.jsx`

**Action**: Remove unused imports from each file

**Acceptance Criteria**:
- [ ] ESLint reports no unused imports
- [ ] App builds without warnings
- [ ] All features still work

---

### Task 1.4: Extract Calendar Configuration Constants

| Field | Value |
|-------|-------|
| **ID** | QW-2 |
| **Priority** | P2 - Medium |
| **Effort** | 45 minutes |
| **Risk** | Low |

**Source File**: `src/MondayCalendar.jsx`

**Target File**: `src/constants/calendarConfig.jsx` (existing file, add to it)

**Constants to Extract**:

| Current Location | Constant | Value |
|------------------|----------|-------|
| Line 46 | `SCROLL_TO_TIME` | `new Date(1970, 1, 1, 8, 0, 0)` |
| Line 80-88 | Min/Max time logic | 0:00 to 23:59 |
| Line 1471 | `step` | `15` |
| Line 1472 | `timeslots` | `4` |

**New Code to Add** to `calendarConfig.jsx`:
```javascript
export const CALENDAR_DEFAULTS = {
  SCROLL_TO_TIME: new Date(1970, 1, 1, 8, 0, 0),
  MIN_HOUR: 0,
  MAX_HOUR: 23,
  STEP_MINUTES: 15,
  TIMESLOTS_PER_HOUR: 4,
  SLOT_HEIGHT_PX: 10,
  DAY_MIN_HEIGHT_PX: 960,
  WORK_WEEK_DAYS: [0, 1, 2, 3, 4] // Sunday-Thursday (Israel)
};
```

**Acceptance Criteria**:
- [ ] Constants moved to `calendarConfig.jsx`
- [ ] `MondayCalendar.jsx` imports from `calendarConfig.jsx`
- [ ] Calendar displays correctly (scroll position, time range)
- [ ] No hardcoded magic numbers in `MondayCalendar.jsx`

---

## Sprint 2: API Layer Cleanup

**Goal**: Reduce code duplication in API layer
**Estimated Effort**: 3-4 hours total
**Dependency**: Sprint 1 completed

---

### Task 2.1: Create API Wrapper Function

| Field | Value |
|-------|-------|
| **ID** | QW-4a |
| **Priority** | P1 - High |
| **Effort** | 1 hour |
| **Risk** | Medium |

**File**: `src/utils/mondayApi.js`

**Action**: Add the following function at the top of the file (after imports):

```javascript
/**
 * Wrapper for Monday API calls with standardized error handling
 * @param {string} functionName - Name of calling function for logging
 * @param {Object} apiRequest - Request details for error context
 * @param {Function} apiCall - Async function that makes the API call
 * @returns {Promise<{response: Object, duration: number}>}
 */
const wrapMondayApiCall = async (functionName, apiRequest, apiCall) => {
    const startTime = Date.now();

    try {
        const response = await apiCall();
        const duration = Date.now() - startTime;

        logger.apiResponse(functionName, response, duration);

        // Check for GraphQL errors (status 200 but with errors array)
        if (response.errors?.length > 0) {
            const firstError = response.errors[0];
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                {
                    response,
                    apiRequest,
                    errorCode: firstError.extensions?.code || null,
                    functionName,
                    duration
                }
            );
        }

        return { response, duration };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.apiError(functionName, error);

        // Re-throw if already a MondayApiError
        if (error instanceof MondayApiError) {
            throw error;
        }

        // Wrap unknown errors
        throw new MondayApiError(
            error.message || 'Unknown error',
            {
                response: error.response || null,
                apiRequest,
                errorCode: error.errorCode || null,
                functionName,
                duration
            }
        );
    }
};
```

**Acceptance Criteria**:
- [ ] Function added to `mondayApi.js`
- [ ] Function is exported (or kept internal if only used in file)
- [ ] Has JSDoc documentation

---

### Task 2.2: Refactor fetchColumnSettings

| Field | Value |
|-------|-------|
| **ID** | QW-4b |
| **Priority** | P1 - High |
| **Effort** | 15 minutes |
| **Risk** | Medium |

**File**: `src/utils/mondayApi.js`

**Function**: `fetchColumnSettings` (lines 54-114)

**Refactored Code**:
```javascript
export const fetchColumnSettings = async (monday, boardId, columnId) => {
    logger.functionStart('fetchColumnSettings', { boardId, columnId });

    const query = `query {
        boards(ids: [${boardId}]) {
            columns(ids: "${columnId}") {
                settings
            }
        }
    }`;

    const apiRequest = {
        query,
        variables: null,
        operationName: extractOperationName(query)
    };

    logger.api('fetchColumnSettings', query);

    const { response } = await wrapMondayApiCall(
        'fetchColumnSettings',
        apiRequest,
        () => monday.api(query)
    );

    const columnSettings = response.data?.boards?.[0]?.columns?.[0]?.settings;
    logger.functionEnd('fetchColumnSettings', { hasSettings: !!columnSettings });

    return columnSettings;
};
```

**Acceptance Criteria**:
- [ ] Function uses `wrapMondayApiCall`
- [ ] Error handling code removed (handled by wrapper)
- [ ] Function still returns correct data
- [ ] Settings dialog still works

---

### Task 2.3: Refactor Remaining API Functions

| Field | Value |
|-------|-------|
| **ID** | QW-4c |
| **Priority** | P1 - High |
| **Effort** | 2 hours |
| **Risk** | Medium |

**File**: `src/utils/mondayApi.js`

**Functions to Refactor** (in order):

| Function | Lines | Complexity |
|----------|-------|------------|
| `fetchAllBoardItems` | 117-246 | High (pagination) |
| `createBoardItem` | 249-317 | Medium |
| `fetchEventsFromBoard` | 320-364 | Low |
| `fetchProjectsForUser` | 367-442 | Medium |
| `findProjectLinkColumn` | 445-496 | Medium |
| `createTask` | 499-553 | Medium |
| `updateItemColumnValues` | 556-597 | Low |
| `fetchCurrentUser` | 600-632 | Low |
| `fetchItemById` | 635-694 | Low |
| `fetchProjectById` | 697-737 | Low |
| `deleteItem` | 739-770 | Low |
| `createEventTypeStatusColumn` | 773-825 | Low |
| `fetchStatusColumnSettings` | 828-871 | Low |
| `fetchStatusColumnsFromBoard` | 874-926 | Medium |
| `fetchItemsStatus` | 980-1036 | Medium |

**Special Case - `fetchAllBoardItems`**: This function has pagination logic. Keep pagination loop, but use wrapper for each API call:
```javascript
const { response } = await wrapMondayApiCall(
    `fetchAllBoardItems (page ${pageCount + 1})`,
    apiRequest,
    () => monday.api(query)
);
```

**Acceptance Criteria**:
- [ ] All 15 functions refactored
- [ ] No duplicate try/catch error handling blocks
- [ ] All API calls go through wrapper
- [ ] All existing functionality works

**Verification Tests**:
1. Load events on calendar
2. Create new event
3. Edit event
4. Delete event
5. Open settings dialog
6. Save settings

---

### Task 2.4: Create Date Formatters Utility

| Field | Value |
|-------|-------|
| **ID** | MP-2 |
| **Priority** | P2 - Medium |
| **Effort** | 30 minutes |
| **Risk** | Low |

**New File**: `src/utils/dateFormatters.js`

**Content**:
```javascript
/**
 * Date formatting utilities for Monday.com API
 */

/**
 * Format date for Monday date column (UTC)
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
export const toMondayDateFormat = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Format time for Monday date column (UTC)
 * @param {Date} date
 * @returns {string} HH:MM:SS
 */
export const toMondayTimeFormat = (date) => {
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

/**
 * Format date and time for Monday date column
 * @param {Date} date
 * @returns {{date: string, time: string}}
 */
export const toMondayDateTimeColumn = (date) => ({
    date: toMondayDateFormat(date),
    time: toMondayTimeFormat(date)
});

/**
 * Format date for local display (Israel timezone)
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
export const toLocalDateFormat = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
```

**Files to Update**:
1. `src/hooks/useMondayEvents.js` - lines 311-321, 582-610
2. `src/MondayCalendar.jsx` - lines 1139-1142

**Acceptance Criteria**:
- [ ] New file created with all formatters
- [ ] `useMondayEvents.js` imports and uses formatters
- [ ] `MondayCalendar.jsx` imports and uses formatters
- [ ] Event creation/editing works correctly
- [ ] All-day events display correct dates

---

## Sprint 3: MondayCalendar Decomposition

**Goal**: Split the God component into manageable pieces
**Estimated Effort**: 6-8 hours total
**Dependency**: Sprint 2 completed

---

### Task 3.1: Extract useEventModals Hook

| Field | Value |
|-------|-------|
| **ID** | MP-1a |
| **Priority** | P1 - High |
| **Effort** | 1.5 hours |
| **Risk** | Medium |

**New File**: `src/hooks/useEventModals.js`

**State to Move from MondayCalendar.jsx**:
| Line | State Variable |
|------|----------------|
| 126 | `isModalOpen` |
| 127 | `pendingSlot` |
| 128 | `newEventTitle` |
| 129 | `selectedItem` |
| 132 | `eventToEdit` |
| 133 | `isEditMode` |
| 134 | `isLoadingEventData` |
| 137 | `isAllDayModalOpen` |
| 138 | `pendingAllDayDate` |
| 139 | `allDayEventToEdit` |
| 140 | `isAllDayEditMode` |

**Handlers to Move**:
| Line | Handler |
|------|---------|
| 718-725 | `handleCloseModal` |
| 727-732 | `handleCloseAllDayModal` |

**Hook Interface**:
```javascript
export const useEventModals = () => {
    // ... all state

    return {
        // Event modal state
        eventModal: {
            isOpen,
            pendingSlot,
            eventToEdit,
            isEditMode,
            isLoading: isLoadingEventData,
            newEventTitle,
            selectedItem
        },
        // All-day modal state
        allDayModal: {
            isOpen: isAllDayModalOpen,
            pendingDate: pendingAllDayDate,
            eventToEdit: allDayEventToEdit,
            isEditMode: isAllDayEditMode
        },
        // Actions
        openEventModal,
        openAllDayModal,
        openEventModalForEdit,
        closeEventModal: handleCloseModal,
        closeAllDayModal: handleCloseAllDayModal,
        // Setters (for external updates)
        setEventToEdit,
        setIsLoadingEventData,
        setNewEventTitle,
        setSelectedItem,
        setPendingSlot
    };
};
```

**Acceptance Criteria**:
- [ ] Hook file created with all modal state
- [ ] `MondayCalendar.jsx` uses the hook
- [ ] All modal open/close functionality works
- [ ] Edit mode works for both event types
- [ ] State properly passed to modal components

---

### Task 3.2: Extract useMultiSelect Hook

| Field | Value |
|-------|-------|
| **ID** | MP-1b |
| **Priority** | P1 - High |
| **Effort** | 1 hour |
| **Risk** | Low |

**New File**: `src/hooks/useMultiSelect.js`

**State to Move from MondayCalendar.jsx**:
| Line | Variable |
|------|----------|
| 143 | `selectedEventIds` |
| 144 | `isCtrlPressed` |
| 145 | `isProcessingBulk` |

**Logic to Move**:
| Lines | Description |
|-------|-------------|
| 148-178 | Keyboard event listeners (Ctrl/Cmd, ESC) |
| 886-889 | `handleClearSelection` |
| 892-934 | `handleDuplicateSelected` |
| 937-970 | `handleDeleteSelected` |

**Hook Interface**:
```javascript
export const useMultiSelect = (events, createEvent, deleteEvent, showSuccess, showErrorWithDetails) => {
    const [selectedEventIds, setSelectedEventIds] = useState(new Set());
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);

    // Keyboard listeners for Ctrl/Cmd + ESC
    useEffect(() => { ... }, [selectedEventIds.size]);

    const toggleSelection = useCallback((eventId) => { ... }, []);
    const clearSelection = useCallback(() => { ... }, []);
    const duplicateSelected = useCallback(async () => { ... }, [...]);
    const deleteSelected = useCallback(async () => { ... }, [...]);

    return {
        selectedEventIds,
        isCtrlPressed,
        isProcessingBulk,
        toggleSelection,
        clearSelection,
        duplicateSelected,
        deleteSelected
    };
};
```

**Acceptance Criteria**:
- [ ] Hook file created
- [ ] Ctrl+Click selection works
- [ ] ESC clears selection
- [ ] Duplicate selected works
- [ ] Delete selected works
- [ ] Selection action bar displays correctly

---

### Task 3.3: Extract useCalendarHandlers Hook

| Field | Value |
|-------|-------|
| **ID** | MP-1c |
| **Priority** | P1 - High |
| **Effort** | 1.5 hours |
| **Risk** | Medium |

**New File**: `src/hooks/useCalendarHandlers.js`

**Handlers to Move from MondayCalendar.jsx**:
| Lines | Handler | Description |
|-------|---------|-------------|
| 335-364 | `onDragStart` | Prevents scroll during all-day drag |
| 367-408 | `onEventDrop` | Handles event drop after drag |
| 411-430 | `onEventResize` | Handles event resize |
| 650-714 | `onSelectSlot` | Handles slot selection/click |
| 593-647 | `handleEventClick` | Handles event click |
| 1031-1056 | `handleRangeChange` | Handles calendar navigation |

**Dependencies**: This hook needs access to:
- `updateEventPosition` (from useMondayEvents)
- `showSuccess`, `showWarning`, `showError`, `showErrorWithDetails` (from useToast)
- Modal actions (from useEventModals)
- Multi-select state (from useMultiSelect)
- `loadEvents`, `loadHolidays`

**Hook Interface**:
```javascript
export const useCalendarHandlers = ({
    updateEventPosition,
    toast,
    modals,
    multiSelect,
    loadEvents,
    loadHolidays,
    loadEventDataForEdit,
    customSettings
}) => {
    const scrollLockRef = useRef(null);

    const onDragStart = useCallback(({ event }) => { ... }, []);
    const onEventDrop = useCallback(async ({ event, start, end, isAllDay }) => { ... }, [...]);
    const onEventResize = useCallback(async ({ event, start, end }) => { ... }, [...]);
    const onSelectSlot = useCallback(async ({ start, end, slots, allDay, action }) => { ... }, [...]);
    const handleEventClick = useCallback(async (event) => { ... }, [...]);
    const handleRangeChange = useCallback((range) => { ... }, [...]);

    return {
        onDragStart,
        onEventDrop,
        onEventResize,
        onSelectSlot,
        handleEventClick,
        handleRangeChange
    };
};
```

**Acceptance Criteria**:
- [ ] Hook file created
- [ ] Drag and drop works
- [ ] Event resize works
- [ ] Slot selection opens correct modal
- [ ] Event click opens edit modal
- [ ] Calendar navigation loads events

---

### Task 3.4: Extract useCalendarSetup Hook

| Field | Value |
|-------|-------|
| **ID** | MP-1d |
| **Priority** | P2 - Medium |
| **Effort** | 30 minutes |
| **Risk** | Low |

**New File**: `src/hooks/useCalendarSetup.js`

**Logic to Move**:
| Lines | Description |
|-------|-------------|
| 73-77 | `getTodayWithTime` helper |
| 80-88 | `minTime`, `maxTime` memos |
| 94-123 | Scroll to 8:00 effect |

**Hook Interface**:
```javascript
export const useCalendarSetup = () => {
    const calendarContainerRef = useRef(null);

    const minTime = useMemo(() => { ... }, []);
    const maxTime = useMemo(() => { ... }, []);

    // Auto-scroll to 8:00 on mount
    useEffect(() => { ... }, []);

    return {
        calendarContainerRef,
        minTime,
        maxTime
    };
};
```

**Acceptance Criteria**:
- [ ] Hook file created
- [ ] Calendar displays 0:00-23:59 range
- [ ] Scrolls to 8:00 on load

---

### Task 3.5: Refactor MondayCalendar.jsx

| Field | Value |
|-------|-------|
| **ID** | MP-1e |
| **Priority** | P1 - High |
| **Effort** | 2 hours |
| **Risk** | High |
| **Dependency** | Tasks 3.1-3.4 |

**Goal**: Reduce `MondayCalendar.jsx` from 1551 lines to ~400 lines

**New Structure**:
```javascript
export default function MondayCalendar({ monday, onOpenSettings }) {
    const { customSettings } = useSettings();

    // Setup hook
    const { calendarContainerRef, minTime, maxTime } = useCalendarSetup();

    // Modal management
    const modals = useEventModals();

    // Toast notifications
    const toast = useToast();

    // Multi-select
    const multiSelect = useMultiSelect(events, createEvent, deleteEvent, toast.showSuccess, toast.showErrorWithDetails);

    // Core data
    const { events, loading, loadEvents, createEvent, updateEvent, deleteEvent, updateEventPosition, addEvent } = useMondayEvents(monday, context);
    const { projects, loading: isLoadingProjects } = useProjects();
    const { holidays, loadHolidays } = useIsraeliHolidays();

    // Calendar handlers
    const handlers = useCalendarHandlers({
        updateEventPosition,
        toast,
        modals,
        multiSelect,
        loadEvents,
        loadHolidays,
        customSettings
    });

    // ... remaining render logic (~300 lines)
}
```

**Acceptance Criteria**:
- [ ] `MondayCalendar.jsx` under 500 lines
- [ ] All existing functionality works
- [ ] No regression in user experience
- [ ] Code is more readable and maintainable

---

## Sprint 4: Quality & Documentation

**Goal**: Improve code quality and documentation
**Estimated Effort**: 4-5 hours total
**Dependency**: Sprint 3 completed

---

### Task 4.1: Add JSDoc Types to Hooks

| Field | Value |
|-------|-------|
| **ID** | MP-3a |
| **Priority** | P2 - Medium |
| **Effort** | 1.5 hours |
| **Risk** | Low |

**Files to Document**:
1. `src/hooks/useMondayEvents.js`
2. `src/hooks/useEventModals.js`
3. `src/hooks/useMultiSelect.js`
4. `src/hooks/useCalendarHandlers.js`

**Example Type Definitions** (add to top of files or new `types.js`):
```javascript
/**
 * @typedef {Object} CalendarEvent
 * @property {string} id
 * @property {string} title
 * @property {Date} start
 * @property {Date} end
 * @property {boolean} allDay
 * @property {string} [mondayItemId]
 * @property {string} [notes]
 * @property {string} [projectId]
 * @property {string} [taskId]
 * @property {string} [eventType]
 * @property {number} [durationDays]
 * @property {boolean} [isHoliday]
 * @property {boolean} [isSelected]
 */

/**
 * @typedef {Object} EventModalState
 * @property {boolean} isOpen
 * @property {Object|null} pendingSlot
 * @property {CalendarEvent|null} eventToEdit
 * @property {boolean} isEditMode
 * @property {boolean} isLoading
 */
```

**Acceptance Criteria**:
- [ ] All public functions have JSDoc comments
- [ ] Type definitions exist for main data structures
- [ ] IDE shows type hints

---

### Task 4.2: Add Unit Tests for Utilities

| Field | Value |
|-------|-------|
| **ID** | LP-2a |
| **Priority** | P2 - Medium |
| **Effort** | 2 hours |
| **Risk** | Low |

**Setup Required**:
```bash
pnpm add -D vitest @testing-library/react
```

**Files to Test** (priority order):
1. `src/utils/durationUtils.js`
2. `src/utils/dateFormatters.js`
3. `src/utils/errorHandler.js`

**Example Test File** (`src/utils/__tests__/durationUtils.test.js`):
```javascript
import { describe, it, expect } from 'vitest';
import { parseDuration, calculateEndDateFromDays, formatDurationForSave } from '../durationUtils';

describe('parseDuration', () => {
    it('returns hours for hourly events', () => {
        expect(parseDuration(2.5, 'שעתי')).toEqual({ value: 2.5, unit: 'hours' });
    });

    it('returns days for sick leave', () => {
        expect(parseDuration(3, 'מחלה')).toEqual({ value: 3, unit: 'days' });
    });
});

describe('calculateEndDateFromDays', () => {
    it('calculates end date correctly', () => {
        const start = new Date(2024, 0, 1); // Jan 1
        const end = calculateEndDateFromDays(start, 3);
        expect(end.getDate()).toBe(4); // Jan 4
    });
});
```

**Acceptance Criteria**:
- [ ] Test framework configured
- [ ] Tests pass for `durationUtils.js`
- [ ] Tests pass for `dateFormatters.js`
- [ ] Tests pass for `errorHandler.js`
- [ ] Can run tests with `pnpm test`

---

### Task 4.3: Commit Dead Code Deletions

| Field | Value |
|-------|-------|
| **ID** | DC-1 |
| **Priority** | P3 - Low |
| **Effort** | 30 minutes |
| **Risk** | Low |

**Files to Verify and Commit Deletion**:

| File | Action |
|------|--------|
| `src/calendar-custom.css` | Verify unused → git add |
| `src/constants/calendarConfig.js` | Verify replaced by .jsx → git add |
| `src/components/ProductSelect/` | Verify unused → git add |
| `src/hooks/useProducts.js` | Verify unused → git add |
| `src/hooks/useCustomers.js` | Verify unused → git add |
| `api_scema.json` | Verify unused → git add |
| `CODE_STRUCTURE.md` | Verify replaced → git add |
| `package-lock.json` | Using pnpm → git add |

**Verification Command**:
```bash
# Search for imports of deleted files
grep -r "calendar-custom" src/
grep -r "ProductSelect" src/
grep -r "useProducts" src/
grep -r "useCustomers" src/
```

**Acceptance Criteria**:
- [ ] All deleted files verified as unused
- [ ] Changes staged and committed
- [ ] Git status clean

---

## Summary Checklist

### Sprint 1: Quick Wins
- [ ] Task 1.1: Remove duplicate setEvents
- [ ] Task 1.2: Remove console.log statements
- [ ] Task 1.3: Clean unused imports
- [ ] Task 1.4: Extract calendar constants

### Sprint 2: API Layer
- [ ] Task 2.1: Create wrapMondayApiCall
- [ ] Task 2.2: Refactor fetchColumnSettings
- [ ] Task 2.3: Refactor all API functions
- [ ] Task 2.4: Create date formatters

### Sprint 3: Component Split
- [ ] Task 3.1: Extract useEventModals
- [ ] Task 3.2: Extract useMultiSelect
- [ ] Task 3.3: Extract useCalendarHandlers
- [ ] Task 3.4: Extract useCalendarSetup
- [ ] Task 3.5: Refactor MondayCalendar.jsx

### Sprint 4: Quality
- [ ] Task 4.1: Add JSDoc types
- [ ] Task 4.2: Add unit tests
- [ ] Task 4.3: Commit dead code deletions

---

**Total Estimated Effort**: 15-20 hours
**Recommended Pace**: 1 sprint per week

---

*Document created: January 2026*
