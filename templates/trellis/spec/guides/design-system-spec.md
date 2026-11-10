# Design System & UI Specification

> **Durable Contract**: This file specifies the design system rules, tokens, typography, colors, layout standards, and the 6 mandatory UI states for this project.
> AI coding assistants must strictly read and adhere to these specifications when implementing user interfaces.

---

## 1. Color Palette & Semantic Tokens

| Token | CSS Variable / Utility | Hex / HSL Value | Usage |
|---|---|---|---|
| `color-bg-app` | `--background` | `hsl(0 0% 100%)` / dark: `hsl(222 47% 11%)` | Main application background |
| `color-bg-surface` | `--card` / `--surface` | `hsl(0 0% 98%)` / dark: `hsl(217 33% 17%)` | Cards, modals, elevated surfaces |
| `color-primary` | `--primary` | `hsl(221 83% 53%)` | Primary CTA buttons, active tabs, brand accents |
| `color-primary-fg` | `--primary-foreground`| `hsl(210 40% 98%)` | Text on primary color |
| `color-secondary` | `--secondary` | `hsl(210 40% 96%)` | Secondary action buttons, badge backgrounds |
| `color-border` | `--border` | `hsl(214 32% 91%)` / dark: `hsl(217 33% 25%)` | Card borders, table dividers, input borders |
| `color-text-main` | `--foreground` | `hsl(222 47% 11%)` / dark: `hsl(210 40% 98%)` | Headings, primary text |
| `color-text-muted` | `--muted-foreground` | `hsl(215 16% 47%)` | Subtitles, helper text, placeholders |
| `color-destructive` | `--destructive` | `hsl(0 84% 60%)` | Delete actions, error banners, validation alerts |

*Rule:* Never hardcode random HEX codes in component files. Always use project tokens or CSS variables.

---

## 2. Typography & Scale

- **Font Family (Sans):** Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Font Family (Mono):** "JetBrains Mono", Fira Code, monospace

| Scale | Size | Weight | Line Height | Elements / Classes |
|---|---|---|---|---|
| **Display** | 32px - 36px | Bold (700) | 1.2 | Page title / Hero text (`text-3xl font-bold`) |
| **Heading 2** | 24px | Semibold (600) | 1.25 | Section headers, modal titles (`text-2xl font-semibold`) |
| **Heading 3** | 18px - 20px | Semibold (600) | 1.3 | Card headers, table titles (`text-lg font-semibold`) |
| **Body (Regular)**| 14px - 16px | Normal (400) | 1.5 | Paragraphs, table cells, form labels (`text-sm font-normal`) |
| **Caption / Meta**| 12px | Medium (500) | 1.4 | Badges, timestamps, helper text (`text-xs text-muted`) |

---

## 3. Spacing, Elevation & Radii

- **Base Spacing Grid:** 4px (4px, 8px, 12px, 16px, 24px, 32px, 48px)
- **Border Radius:**
  - `radius-sm`: 4px (`rounded-sm` - badges, tooltips)
  - `radius-md`: 8px (`rounded-md` - inputs, buttons, dropdowns)
  - `radius-lg`: 12px (`rounded-lg` - cards, dialogs, modals)
  - `radius-full`: 9999px (`rounded-full` - avatars, status pills)
- **Elevation / Shadows:**
  - Flat/Subtle: `0 1px 3px 0 rgb(0 0 0 / 0.1)` (Cards)
  - Popover/Modal: `0 10px 15px -3px rgb(0 0 0 / 0.1)` (Dropdowns, Dialogs)

---

## 4. Layout & Responsive Breakpoints

- **Breakpoints:**
  - Mobile: `< 640px` (standard test at **390px**)
  - Tablet: `640px - 1024px` (standard test at **768px**)
  - Desktop: `> 1024px` (standard test at **1280px+**)
- **Data Tables vs Mobile:**
  - Desktop (`>= 768px`): Full multi-column data table with sortable headers.
  - Mobile (`< 768px`): Automatically convert table rows into touch-friendly cards or collapsible lists.

---

## 5. The 6 Mandatory UI States (Non-Negotiable)

Every interactive surface, list, form, or dashboard page **MUST** implement and handle all 6 states:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE 6 MANDATORY UI STATES                       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. NORMAL:       Clean hierarchy, primary CTA evident, clear spacing   │
│ 2. LOADING:      Skeleton placeholder layout (never bare spinners)     │
│ 3. EMPTY:        Friendly icon/graphic + helpful copy + primary CTA   │
│ 4. ERROR:        Inline banner/toast with human error msg + retry CTA  │
│ 5. VALIDATION:   Field-level feedback below inputs, disabled submit    │
│ 6. RESPONSIVE:   Seamless adaptation from Mobile 390px to Desktop 1280px│
└────────────────────────────────────────────────────────────────────────┘
```

1. **Normal State:** Loaded with content, clear visual hierarchy, primary action evident.
2. **Loading State:** Skeleton matching the actual layout shape (Skeleton rows for table, Skeleton card for widgets). Never leave blank whitespace.
3. **Empty State:** When no items exist (or search returns 0 results): Display friendly icon, concise title, description, and a clear button to create the first item.
4. **Error State:** When an API request or background job fails: Show human-readable error banner/callout with a "Retry" or "Go back" action.
5. **Validation State:** Real-time feedback directly beneath invalid fields (red border, helper message). Disable submit buttons while processing.
6. **Responsive State:** Test and verify both 390px (mobile) and 1280px (desktop) without any horizontal scrollbar overflow.

---

## 6. Verification & Quality Gates

Before declaring any UI task complete, the assistant must verify:
- **L1 (Static):** Typecheck (`tsc`), linter passing with zero errors.
- **L2 (Build):** `npm run build` succeeds without syntax or asset bundling errors.
- **L3 (Functional):** Form submission, state transitions (Normal, Loading, Empty, Error, Validation), and responsive layout verified.
