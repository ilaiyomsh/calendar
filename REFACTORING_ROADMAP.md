# Refactoring Roadmap

## Executive Summary

This document outlines a prioritized refactoring plan based on the codebase audit. Recommendations are categorized by impact and effort, with "Quick Wins" that can be implemented immediately and longer-term improvements.

---

## Critical Issues

### 1. God Component: MondayCalendar.jsx (1551 lines)

**Problem**: Single component handles too many responsibilities:
- Calendar rendering
- 10+ modal state variables
- Event handlers for drag/drop/resize
- Multi-select logic
- All-day event creation (100+ lines)
- Holiday integration
- Settings validation

**Impact**:
- Difficult to maintain and test
- High cognitive load for developers
- Changes risk unintended side effects

**Recommended Split**:

```
MondayCalendar.jsx (1551 lines)
    │
    └─▶ Split into:
        │
        ├── MondayCalendar.jsx (~300 lines)
        │   - Calendar rendering only
        │   - Compose child components
        │
        ├── hooks/useCalendarHandlers.js (~200 lines)
        │   - onEventDrop, onEventResize
        │   - onSelectSlot, onDragStart
        │
        ├── hooks/useMultiSelect.js (~100 lines)
        │   - selectedEventIds state
        │   - Ctrl/Cmd key tracking
        │   - handleDuplicateSelected, handleDeleteSelected
        │
        ├── hooks/useEventModals.js (~150 lines)
        │   - Modal state (isOpen, eventToEdit, etc.)
        │   - Open/close handlers
        │
        ├── components/AllDayEventHandler.jsx (~200 lines)
        │   - handleCreateAllDayEvent logic
        │   - All-day specific mutations
        │
        └── hooks/useCalendarSetup.js (~100 lines)
            - minTime/maxTime configuration
            - Scroll to 8:00 logic
```

---

## Quick Wins (Low Effort, High Value)

### QW-1: Remove Duplicate setEvents Call

**File**: `src/hooks/useMondayEvents.js:276-280`

**Problem**: `setEvents(mappedEvents)` is called twice at the end of `loadEvents`.

```javascript
// Lines 276-280 - DUPLICATE
setEvents(mappedEvents);
logger.functionEnd('useMondayEvents.loadEvents', { count: mappedEvents.length });

setEvents(mappedEvents);  // <-- Remove this duplicate
logger.functionEnd('useMondayEvents.loadEvents', { count: mappedEvents.length });
```

**Fix**: Remove the duplicate call (lines 279-280).

---

### QW-2: Extract Calendar Configuration Constants

**File**: `src/MondayCalendar.jsx`

**Problem**: Configuration scattered throughout component.

**Current**:
```javascript
// Line 46
const SCROLL_TO_TIME = new Date(1970, 1, 1, 8, 0, 0);

// Lines 80-88 - Inside component
const minTime = useMemo(() => getTodayWithTime(0, 0), []);
const maxTime = useMemo(() => { ... }, []);
```

**Fix**: Move to `constants/calendarConfig.jsx`:
```javascript
export const CALENDAR_DEFAULTS = {
  SCROLL_TO_TIME: new Date(1970, 1, 1, 8, 0, 0),
  MIN_HOUR: 0,
  MAX_HOUR: 23,
  STEP_MINUTES: 15,
  TIMESLOTS_PER_HOUR: 4,
  WORK_WEEK_DAYS: [0, 1, 2, 3, 4] // Sunday-Thursday
};
```

---

### QW-3: Remove console.log Debugging Statements

**File**: `src/MondayCalendar.jsx:654-664`

**Problem**: Debug console.log statements left in production code.

```javascript
// Lines 654-664 - Should use logger instead
console.log('🔍 onSelectSlot DEBUG:', { ... });
console.log('🔍 isAllDayClick:', isAllDayClick);
console.log('🔍 Opening AllDayModal with date:', start?.toString());
```

**Fix**: Replace with `logger.debug()` calls or remove entirely.

---

### QW-4: Simplify Repeated Error Handling Pattern

**File**: `src/utils/mondayApi.js`

**Problem**: Every API function has identical error handling boilerplate (~15 lines each).

**Current Pattern** (repeated 20+ times):
```javascript
} catch (error) {
    logger.apiError('functionName', error);
    if (error instanceof MondayApiError) throw error;
    throw new MondayApiError(
        error.message || 'Unknown error',
        {
            response: error.response || null,
            apiRequest,
            errorCode: error.errorCode || null,
            functionName: 'functionName',
            duration: Date.now() - (error.startTime || Date.now())
        }
    );
}
```

**Fix**: Create a wrapper function:
```javascript
const wrapMondayApiCall = async (functionName, apiRequest, apiCall) => {
    try {
        const startTime = Date.now();
        const response = await apiCall();
        const duration = Date.now() - startTime;

        logger.apiResponse(functionName, response, duration);

        if (response.errors?.length > 0) {
            const firstError = response.errors[0];
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                {
                    response,
                    apiRequest,
                    errorCode: firstError.extensions?.code,
                    functionName,
                    duration
                }
            );
        }

        return { response, duration };
    } catch (error) {
        logger.apiError(functionName, error);
        if (error instanceof MondayApiError) throw error;
        throw new MondayApiError(error.message || 'Unknown error', {
            response: error.response,
            apiRequest,
            errorCode: error.errorCode,
            functionName
        });
    }
};
```

**Savings**: ~400 lines of code reduction.

---

### QW-5: Clean Up Unused Imports

**Files**: Multiple

Run the following to identify unused imports:
```bash
npx eslint src --rule 'no-unused-vars: error' --no-eslintrc
```

---

## Medium Priority Refactoring

### MP-1: Extract Modal Logic from MondayCalendar

**Effort**: 2-3 hours
**Impact**: Significant reduction in MondayCalendar complexity

Create `hooks/useEventModals.js`:
```javascript
export const useEventModals = () => {
  // Regular event modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState(null);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoadingEventData, setIsLoadingEventData] = useState(false);

  // All-day modal
  const [isAllDayModalOpen, setIsAllDayModalOpen] = useState(false);
  const [pendingAllDayDate, setPendingAllDayDate] = useState(null);
  const [allDayEventToEdit, setAllDayEventToEdit] = useState(null);
  const [isAllDayEditMode, setIsAllDayEditMode] = useState(false);

  const openEventModal = useCallback((slot) => { ... });
  const openAllDayModal = useCallback((date) => { ... });
  const closeAllModals = useCallback(() => { ... });

  return {
    // Event modal
    eventModal: { isOpen: isModalOpen, pendingSlot, eventToEdit, isEditMode, isLoading: isLoadingEventData },
    // All-day modal
    allDayModal: { isOpen: isAllDayModalOpen, date: pendingAllDayDate, eventToEdit: allDayEventToEdit, isEditMode: isAllDayEditMode },
    // Actions
    openEventModal,
    openAllDayModal,
    closeAllModals,
    setEventToEdit,
    setIsLoadingEventData
  };
};
```

---

### MP-2: Consolidate Date Formatting

**Problem**: Date formatting logic duplicated across files.

**Files Affected**:
- `useMondayEvents.js` (lines 311-321)
- `MondayCalendar.jsx` (lines 1139-1142)

**Fix**: Create `utils/dateFormatters.js`:
```javascript
export const toMondayDateFormat = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toMondayTimeFormat = (date) => {
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export const toMondayDateTimeColumn = (date) => ({
  date: toMondayDateFormat(date),
  time: toMondayTimeFormat(date)
});
```

---

### MP-3: Type Safety with JSDoc or TypeScript

**Problem**: No type definitions leads to runtime errors.

**Recommendation**: Add JSDoc types at minimum:

```javascript
/**
 * @typedef {Object} CalendarEvent
 * @property {string} id - Monday item ID
 * @property {string} title - Event title
 * @property {Date} start - Start time
 * @property {Date} end - End time
 * @property {boolean} allDay - Is all-day event
 * @property {string} [mondayItemId] - Monday item ID (same as id)
 * @property {string} [notes] - Event notes
 * @property {string} [projectId] - Linked project ID
 * @property {string} [taskId] - Linked task ID
 * @property {string} [eventType] - Event type label
 */
```

---

## Low Priority / Future Improvements

### LP-1: State Management Upgrade

**Current**: React Context + local state
**Problem**: Props drilling, complex state updates

**Options**:
1. **Zustand** - Lightweight, minimal boilerplate
2. **Jotai** - Atomic state, good for derived state
3. **Keep Context** - If complexity doesn't increase

**Recommendation**: Consider Zustand if adding more global state.

---

### LP-2: Test Coverage

**Current State**: No tests
**Recommendation**: Add tests in priority order:

1. **Unit Tests** (utils/):
   - `durationUtils.js` - Critical calculations
   - `errorHandler.js` - Error parsing
   - `mondayColumns.js` - Column mapping

2. **Hook Tests**:
   - `useMondayEvents` - Mock monday.api
   - `useProjects` - Mock API responses

3. **Component Tests**:
   - `EventModal` - Form validation
   - `TimeSelect` - Time selection

---

### LP-3: Bundle Size Optimization

**Current**: All dependencies loaded upfront

**Recommendations**:
1. Analyze bundle with `vite-plugin-visualizer`
2. Lazy load modals: `React.lazy(() => import('./SettingsDialog'))`
3. Tree-shake date-fns (import only needed functions)

---

## Dead Code Candidates

### Files Possibly Unused

Based on git status showing deletions not committed:

| File | Status | Action |
|------|--------|--------|
| `src/calendar-custom.css` | Deleted in git | Verify and commit deletion |
| `src/constants/calendarConfig.js` | Deleted, replaced by .jsx | Remove |
| `src/components/ProductSelect/` | Deleted | Verify unused, commit deletion |
| `src/hooks/useProducts.js` | Deleted | Verify unused, commit deletion |
| `src/hooks/useCustomers.js` | Deleted | Verify unused, commit deletion |
| `api_scema.json` | Deleted | Commit deletion |

---

## Refactoring Priority Matrix

```
                    High Impact
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    │  QW-4 (API Error)  │  MP-1 (Modals)     │
    │  QW-1 (Duplicate)  │  God Component     │
    │                    │  Split             │
    │                    │                    │
Low ├────────────────────┼────────────────────┤ High
Effort                   │                    Effort
    │                    │                    │
    │  QW-2 (Constants)  │  LP-1 (State Mgmt) │
    │  QW-3 (console.log)│  LP-2 (Tests)      │
    │  QW-5 (Imports)    │                    │
    │                    │                    │
    └────────────────────┼────────────────────┘
                         │
                    Low Impact
```

---

## Implementation Order

### Sprint 1: Quick Wins
1. [x] QW-1: Remove duplicate setEvents
2. [ ] QW-3: Remove console.log statements
3. [ ] QW-5: Clean unused imports
4. [ ] QW-2: Extract calendar constants

### Sprint 2: API Layer Cleanup
1. [ ] QW-4: Create wrapMondayApiCall helper
2. [ ] Refactor all 20+ API functions to use wrapper
3. [ ] MP-2: Create date formatters utility

### Sprint 3: MondayCalendar Decomposition
1. [ ] Extract useEventModals hook
2. [ ] Extract useMultiSelect hook
3. [ ] Extract useCalendarHandlers hook
4. [ ] Create AllDayEventHandler component

### Sprint 4: Quality & Docs
1. [ ] Add JSDoc types to hooks
2. [ ] Add unit tests for utils
3. [ ] Commit dead code deletions

---

## Metrics for Success

| Metric | Before | Target |
|--------|--------|--------|
| MondayCalendar.jsx lines | 1551 | < 400 |
| mondayApi.js lines | 1037 | < 700 |
| Duplicate code blocks | ~20 | 0 |
| console.log statements | 3+ | 0 |
| Test coverage | 0% | > 50% (utils) |

---

*Document generated: January 2026*
*Review cycle: Monthly*
