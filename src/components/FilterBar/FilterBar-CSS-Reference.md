# FilterBar.module.css - Full Reference Guide

Complete CSS architecture for a **split-column filter dropdown** component. Designed for RTL (Hebrew) Monday.com apps using CSS Modules. Follows Monday.com Vibe Design System color palette.

---

## Visual Structure

```
┌─────────────────────────────────────────────────┐
│  [🔍 סינון  (2)  ▾]   ← Trigger Button         │
└─────────────────────────────────────────────────┘
         │
         ▼  (opens dropdown below)
┌─────────────────────────────────────────────────┐
│  אנשים           (1)  │  פרויקטים         (1)  │  ← Column Headers
│───────────────────────│─────────────────────────│
│  🔎 חיפוש...          │  🔎 חיפוש...            │  ← Search Inputs
│───────────────────────│─────────────────────────│
│  ☑ שם עובד 1          │  ☐ פרויקט א             │  ← Options List
│  ☐ שם עובד 2          │  ☑ פרויקט ב             │     (scrollable)
│  ☐ שם עובד 3          │  ☐ פרויקט ג             │
│                       │  ☐ פרויקט ד             │
│───────────────────────┴─────────────────────────│
│           [ נקה בחירה ]                          │  ← Footer (conditional)
└─────────────────────────────────────────────────┘
```

---

## CSS Classes Map → JSX Usage

| CSS Class | JSX Element | Purpose |
|-----------|-------------|---------|
| `.filterContainer` | `<div>` wrapper | Root container, sets `position: relative` for dropdown positioning |
| `.trigger` | `<button>` | The pill-shaped trigger button |
| `.triggerActive` | `<button>` (added) | Blue highlight when filter is active |
| `.triggerOpen` | `<button>` (added) | Blue border when dropdown is open |
| `.triggerText` | `<span>` | The "סינון" label text |
| `.filterIcon` | `<Filter>` icon | Filter icon (lucide-react) |
| `.badge` | `<span>` | Total selection count pill (e.g., "2") |
| `.chevron` | `<ChevronDown>` icon | Dropdown arrow |
| `.chevronOpen` | `<ChevronDown>` (added) | Rotates arrow 180deg when open |
| `.dropdown` | `<div>` | The floating dropdown panel |
| `.columns` | `<div>` | Flex container for two-column layout |
| `.divider` | `<div>` | Vertical 1px line between columns |
| `.column` | `<div>` | Each filter category column |
| `.columnHeader` | `<div>` | Sticky header with title + count badge |
| `.columnBadge` | `<span>` | Per-column selection count |
| `.searchContainer` | `<div>` | Search input wrapper |
| `.searchIcon` | `<Search>` icon | Magnifying glass inside search input |
| `.searchInput` | `<input>` | Text search field |
| `.optionsList` | `<div>` | Scrollable list of checkbox options |
| `.option` | `<div>` | Single option row (checkbox + label) |
| `.optionSelected` | `<div>` (added) | Blue-tinted background for selected items |
| `.checkbox` | `<input type="checkbox">` | Styled native checkbox |
| `.optionName` | `<span>` | Option label text (truncated with ellipsis) |
| `.noResults` | `<div>` | "No results" empty state message |
| `.loading` | `<div>` | "Loading..." state message |
| `.footer` | `<div>` | Bottom bar with clear button |
| `.clearButton` | `<button>` | Red "Clear selection" button |

---

## Section-by-Section Breakdown

### 1. Root Container (`.filterContainer`)

```css
.filterContainer {
    position: relative;    /* Anchor point for the absolute-positioned dropdown */
    direction: rtl;        /* Hebrew/RTL text direction */
}
```

**Why `position: relative`**: The dropdown uses `position: absolute` and positions itself relative to this container. Without this, the dropdown would position relative to the nearest positioned ancestor (possibly the page body).

**For LTR apps**: Remove `direction: rtl`.

---

### 2. Trigger Button (`.trigger`)

```css
.trigger {
    display: flex !important;       /* Override any parent framework styles */
    flex-direction: row;            /* Icon + text + badge + chevron in a row */
    align-items: center;
    justify-content: center;
    gap: 8px;                       /* Space between inner elements */

    height: 36px;                   /* Match Monday.com toolbar button height */
    padding: 0 16px;
    min-width: fit-content;         /* Prevent button from being squished */

    background: #ffffff;
    border: 1px solid #E0E0E0;
    border-radius: 50px !important; /* Pill shape */

    font-size: 14px;
    font-weight: 500;
    color: #323338;                 /* Monday.com primary text color */
    white-space: nowrap;            /* Prevent text wrapping */

    cursor: pointer;
    transition: all 0.2s ease-in-out;
}
```

**Key decisions**:
- `!important` on `display: flex` and `border-radius`: Prevents Monday.com SDK or parent CSS from overriding. Necessary inside Monday.com board views.
- `border-radius: 50px`: Creates a pill shape regardless of button width.
- `height: 36px`: Matches other toolbar buttons (week view, navigation arrows).
- `#323338`: Monday.com's standard dark text color.

**For your app**: Adjust `height` to match your toolbar. Remove `!important` if no framework conflicts.

---

### 3. Button States

```css
/* Hover - subtle gray */
.trigger:hover {
    background-color: #f5f6f8;
    border-color: #c0c0c0;
}

/* Active Filter - blue theme (Monday.com primary) */
.triggerActive {
    background-color: #e5f3ff;     /* Light blue background */
    border-color: #0073ea;         /* Monday.com primary blue */
    color: #0073ea;                /* Blue text */
}

.triggerActive:hover {
    background-color: #cce5ff;     /* Slightly darker blue on hover */
    border-color: #0073ea;
}

/* Dropdown Open - just blue border */
.triggerOpen {
    border-color: #0073ea;
}
```

**State logic in JSX**:
```jsx
const triggerClasses = [
    styles.trigger,                              // Always
    hasActiveFilter ? styles.triggerActive : '',  // When filters are selected
    isOpen ? styles.triggerOpen : ''              // When dropdown is visible
].filter(Boolean).join(' ');
```

**Color palette**:
| Color | Usage | Monday.com token |
|-------|-------|-----------------|
| `#0073ea` | Primary blue (active state) | `--primary-color` |
| `#e5f3ff` | Light blue background | Active button fill |
| `#cce5ff` | Medium blue (active hover) | Active button hover |
| `#f5f6f8` | Light gray (default hover) | `--ui-border-color` area |
| `#323338` | Dark text | `--primary-text-color` |
| `#E0E0E0` | Border gray | Default border |

---

### 4. Inner Button Elements

```css
/* Filter icon (lucide-react <Filter>) */
.filterIcon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;        /* Never shrink the icon */
    font-size: 16px;
    color: #676879;        /* Monday.com secondary text color */
    transition: color 0.2s ease;
}

/* Icon turns blue when filter is active */
.triggerActive .filterIcon {
    color: #0073ea;
}

/* Badge showing total count (e.g., "3") */
.badge {
    background-color: #2563eb;    /* Tailwind blue-600 */
    color: white;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;          /* Pill badge */
    min-width: 18px;              /* Ensures round shape for single digit */
    text-align: center;
    margin: 0 -4px;               /* Negative margin pulls badge closer */
}

/* Chevron arrow */
.chevron {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #676879;
    transition: transform 0.2s ease;
}

/* Rotate 180deg when dropdown is open */
.chevronOpen {
    transform: rotate(180deg);
}

/* Chevron turns blue when active */
.triggerActive .chevron {
    color: #0073ea;
}
```

**Badge rendering logic**: Only shown when `totalCount > 0`:
```jsx
{totalCount > 0 && <span className={styles.badge}>{totalCount}</span>}
```

---

### 5. Dropdown Panel (`.dropdown`)

```css
.dropdown {
    position: absolute;
    top: calc(100% + 4px);       /* 4px gap below the trigger button */
    right: 0;                     /* Aligned to right edge (RTL) */
    width: 480px;                 /* Fixed width for two columns */
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);  /* Elevation shadow */
    z-index: 1000;                /* Above calendar content */
    animation: dropdownSlide 0.15s ease;
    overflow: hidden;             /* Clip children to border-radius */
}

@keyframes dropdownSlide {
    from {
        opacity: 0;
        transform: translateY(-4px);    /* Slide down 4px */
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

**Key decisions**:
- `right: 0` (for RTL): Aligns dropdown to the right edge of `.filterContainer`. **For LTR**: change to `left: 0`.
- `width: 480px`: Accommodates two 240px columns. Adjust based on content needs.
- `z-index: 1000`: Must be above calendar events (react-big-calendar uses z-index ~1-10 for events).
- `overflow: hidden`: Ensures column headers and footer respect the `border-radius: 8px`.
- `animation`: Subtle 150ms slide-down entrance. Keeps UI feeling responsive.

**For your app**: Adjust `width` based on number of columns and content length. Adjust `z-index` based on your app's stacking context.

---

### 6. Two-Column Layout (`.columns`, `.column`, `.divider`)

```css
/* Horizontal flex container */
.columns {
    display: flex;
    direction: rtl;     /* Right column appears first (people), left column second (projects) */
}

/* Vertical separator line */
.divider {
    width: 1px;
    background-color: #e5e7eb;
    flex-shrink: 0;     /* Never collapse the divider */
}

/* Each column takes equal space */
.column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;       /* Allows text truncation to work inside flex children */
}
```

**`min-width: 0` is critical**: Without it, flex children won't allow text-overflow ellipsis to work. This is a common flexbox gotcha.

**For single-column filter**: Remove `.columns` and `.divider`, use just one `.column`.

**For 3+ columns**: Keep the same pattern, add more `.column` + `.divider` pairs. Increase `.dropdown` width accordingly (e.g., 720px for 3 columns).

---

### 7. Column Header (`.columnHeader`, `.columnBadge`)

```css
.columnHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;   /* Title on right, badge on left (RTL) */
    padding: 12px;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
    background-color: #fafafa;        /* Subtle gray background */
    position: sticky;                  /* Stays visible when scrolling options */
    top: 0;
}

.columnBadge {
    background-color: #dbeafe;        /* Light blue */
    color: #1d4ed8;                   /* Dark blue text */
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
}
```

**`position: sticky`**: The header stays pinned at the top when the options list scrolls. Note: this only works if the parent doesn't have `overflow: hidden` — here the scrolling happens in `.optionsList`, not `.column`, so it works.

---

### 8. Search Input (`.searchContainer`, `.searchInput`, `.searchIcon`)

```css
.searchContainer {
    padding: 8px;
    border-bottom: 1px solid #f3f4f6;
    position: relative;                /* Anchor for the search icon */
}

.searchIcon {
    position: absolute;
    right: 16px;                       /* RTL: icon on the right side */
    top: 50%;
    transform: translateY(-50%);       /* Vertical center */
    color: #9ca3af;                    /* Gray placeholder color */
    pointer-events: none;              /* Clicks pass through to the input */
}

.searchInput {
    width: 100%;
    padding: 8px 10px;
    padding-right: 32px;              /* RTL: space for the icon on right */
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s ease;
    direction: rtl;
}

.searchInput:focus {
    border-color: #3b82f6;            /* Blue focus ring */
}

.searchInput::placeholder {
    color: #9ca3af;
}
```

**For LTR apps**:
- Change `.searchIcon` `right: 16px` → `left: 16px`
- Change `.searchInput` `padding-right: 32px` → `padding-left: 32px`
- Remove `direction: rtl`

**`pointer-events: none`** on the icon: Ensures clicking the icon area focuses the input instead of being blocked.

---

### 9. Options List (`.optionsList`, `.option`, `.optionSelected`)

```css
.optionsList {
    max-height: 200px;     /* Scrollable area - shows ~5-6 items */
    overflow-y: auto;      /* Vertical scroll when content exceeds max-height */
    padding: 4px;
}

.option {
    display: flex;
    align-items: center;
    gap: 8px;              /* Space between checkbox and label */
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    font-size: 13px;
    color: #374151;
}

.option:hover {
    background-color: #f3f4f6;   /* Light gray hover */
}

.optionSelected {
    background-color: #eff6ff;   /* Very light blue for selected */
}

.optionSelected:hover {
    background-color: #dbeafe;   /* Slightly darker blue on hover */
}
```

**Why `max-height: 200px`**: Prevents the dropdown from growing too tall. With `padding: 8px 12px` per option (~34px height each), this shows about 5-6 options before scrolling.

**For your app**: Adjust `max-height` based on expected item count. 200px works well for 5-20 items. For fewer items, consider removing the max-height.

---

### 10. Checkbox & Option Name

```css
.checkbox {
    width: 16px;
    height: 16px;
    accent-color: #2563eb;  /* Blue checkbox when checked (native CSS) */
    cursor: pointer;
    flex-shrink: 0;         /* Never shrink the checkbox */
}

.optionName {
    overflow: hidden;
    text-overflow: ellipsis;   /* Shows "..." for long names */
    white-space: nowrap;
}
```

**`accent-color`**: Modern CSS property that styles native checkboxes without custom SVGs. Supported in all modern browsers. The checkbox stays native but turns blue when checked.

**`flex-shrink: 0`** on checkbox: Prevents the checkbox from collapsing when the label is very long. The label truncates instead.

---

### 11. Empty & Loading States

```css
.noResults {
    padding: 16px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
}

.loading {
    padding: 16px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
}
```

Both are identical — kept separate for semantic clarity and future independent styling.

**Rendering logic**:
```jsx
{isLoading ? (
    <div className={styles.loading}>טוען...</div>
) : filteredItems.length > 0 ? (
    /* render options */
) : (
    <div className={styles.noResults}>
        {searchTerm ? 'לא נמצאו תוצאות' : 'אין פריטים זמינים'}
    </div>
)}
```

---

### 12. Footer & Clear Button (`.footer`, `.clearButton`)

```css
.footer {
    padding: 12px;
    border-top: 1px solid #f3f4f6;
    background-color: #fafafa;    /* Matches column header background */
}

.clearButton {
    width: 100%;
    padding: 8px 12px;
    background-color: #fee2e2;    /* Light red */
    border: 1px solid #fca5a5;    /* Medium red border */
    border-radius: 6px;
    color: #dc2626;               /* Dark red text */
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.clearButton:hover {
    background-color: #fecaca;    /* Darker red on hover */
    border-color: #f87171;
}
```

**Conditional rendering**: Footer only appears when `hasActiveFilter` is true:
```jsx
{hasActiveFilter && (
    <div className={styles.footer}>
        <button className={styles.clearButton} onClick={onClear}>
            נקה בחירה
        </button>
    </div>
)}
```

---

### 13. Custom Scrollbar

```css
.optionsList::-webkit-scrollbar {
    width: 6px;                /* Thin scrollbar */
}

.optionsList::-webkit-scrollbar-track {
    background: #f3f4f6;
    border-radius: 3px;
}

.optionsList::-webkit-scrollbar-thumb {
    background: #d1d5db;      /* Gray thumb */
    border-radius: 3px;
}

.optionsList::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;      /* Darker on hover */
}
```

**Browser support**: WebKit only (Chrome, Safari, Edge). Firefox uses `scrollbar-width: thin` and `scrollbar-color` instead. For cross-browser, add:
```css
.optionsList {
    scrollbar-width: thin;                    /* Firefox */
    scrollbar-color: #d1d5db #f3f4f6;        /* Firefox: thumb track */
}
```

---

### 14. Responsive Design

```css
@media (max-width: 540px) {
    .dropdown {
        width: calc(100vw - 32px);   /* Full width minus padding */
        max-width: 480px;            /* Cap at desktop width */
    }

    .columns {
        flex-direction: column;       /* Stack columns vertically */
    }

    .divider {
        width: 100%;                  /* Horizontal line instead of vertical */
        height: 1px;
    }

    .optionsList {
        max-height: 150px;           /* Shorter scroll area on mobile */
    }
}
```

**Breakpoint 540px**: Chosen because `480px (dropdown) + 32px (margins) + scrollbar` ≈ 540px. Below this, the two-column layout doesn't fit.

**Stacked layout**: On mobile, columns stack vertically — people on top, projects below, with a horizontal divider between them.

---

## Color Reference Table

| Color | Hex | Where Used |
|-------|-----|------------|
| Monday Primary Blue | `#0073ea` | Active trigger border/text, open state |
| Tailwind Blue 600 | `#2563eb` | Badge background, checkbox accent |
| Tailwind Blue 700 | `#1d4ed8` | Column badge text |
| Light Blue BG | `#e5f3ff` | Active trigger background |
| Medium Blue BG | `#cce5ff` | Active trigger hover |
| Very Light Blue | `#eff6ff` | Selected option background |
| Light Blue | `#dbeafe` | Selected option hover, column badge bg |
| Monday Dark Text | `#323338` | Trigger text |
| Gray Text | `#374151` | Column headers, option text |
| Secondary Gray | `#676879` | Icons (filter, chevron) |
| Muted Gray | `#6b7280` | No results, loading text |
| Placeholder Gray | `#9ca3af` | Search placeholder, scrollbar hover |
| Border Gray | `#e5e7eb` | Dropdown border, search input border |
| Light Border | `#f3f4f6` | Column separators, scrollbar track |
| Surface Gray | `#fafafa` | Column header bg, footer bg |
| Hover Gray | `#f5f6f8` | Default trigger hover |
| Default Border | `#E0E0E0` | Trigger button border |
| Red Light | `#fee2e2` | Clear button bg |
| Red Border | `#fca5a5` | Clear button border |
| Red Hover | `#fecaca` | Clear button hover bg |
| Red Hover Border | `#f87171` | Clear button hover border |
| Red Text | `#dc2626` | Clear button text |

---

## Adapting for Another App

### Minimal Changes for LTR App

1. Remove all `direction: rtl`
2. `.dropdown`: change `right: 0` → `left: 0`
3. `.searchIcon`: change `right: 16px` → `left: 16px`
4. `.searchInput`: change `padding-right: 32px` → `padding-left: 32px`

### Single-Column Filter

Remove `.columns`, `.divider`. Use just one `.column` inside `.dropdown`. Reduce `.dropdown` width to `240px-280px`.

### Different Column Count

Each column is `flex: 1` so they auto-divide the space. For 3 columns at 240px each, set `.dropdown { width: 720px }` and add a third `.column` + `.divider`.

### Non-Monday.com Apps

Replace colors:
- `#0073ea` → your primary color
- `#323338` → your text color
- `#676879` → your secondary text color
- Remove `!important` from `.trigger` if no framework conflicts

### Props Interface (from FilterBar.jsx)

```jsx
<FilterBar
    reporters={[{id: 1, name: 'John'}]}         // Left column items
    projects={[{id: 'p1', name: 'Project A'}]}  // Right column items
    selectedReporterIds={[1]}                     // Selected left column IDs
    selectedProjectIds={['p1']}                   // Selected right column IDs
    onReporterChange={(ids) => {}}                // Left column change callback
    onProjectChange={(ids) => {}}                 // Right column change callback
    onClear={() => {}}                            // Clear all selections
    hasActiveFilter={true}                        // Any filter active?
    isLoadingReporters={false}                    // Left column loading state
    isLoadingProjects={false}                     // Right column loading state
/>
```
