# Pre-Implementation Checklist

> **Purpose**: Ask the right questions **before** writing code to avoid common architectural mistakes.

---

## Why This Checklist?

Most code quality issues aren't caught during implementation—they're **designed in** from the start:

| Problem                               | Root Cause                                | Cost                       |
| ------------------------------------- | ----------------------------------------- | -------------------------- |
| Constants duplicated across 5 files   | Didn't ask "will this be used elsewhere?" | Refactoring + testing      |
| Same logic repeated in multiple hooks | Didn't ask "does this pattern exist?"     | Creating abstraction later |
| Cross-layer type mismatches           | Didn't ask "who else consumes this?"      | Debugging + fixing         |

**This checklist catches these issues before they become code.**

---

## The Checklist

### 1. Constants & Configuration

Before adding any constant or config value:

- [ ] **Cross-layer usage?** Will this value be used across multiple layers (e.g., backend + frontend, or main + renderer)?
  - If yes -> Put in `shared/constants/` or a shared contract module
  - Example: `MAX_FILE_SIZE` used by both file picker UI and backend validation

- [ ] **Multiple consumers?** Will this value be used in 2+ files within the same layer?
  - If yes -> Put in a shared constants file for that layer
  - Example: Don't define `DEBOUNCE_MS = 2000` in each hook file

- [ ] **Magic number?** Is this a hardcoded value that could change?
  - If yes -> Extract to named constant with comment explaining why
  - Example: `MAX_BATCH_SIZE: 100 // Query limit for performance`

### 2. Logic & Patterns

Before implementing any logic:

- [ ] **Pattern exists?** Search for similar patterns in the codebase first

  ```bash
  # Example: Before implementing debounced save
  rg "setTimeout.*save" src/
  rg "debounce" src/
  ```

- [ ] **Will repeat?** Will this exact logic be needed in 2+ places?
  - If yes -> Create a shared hook/utility **first**, then use it
  - Example: `useDebounce` instead of repeating debounce logic in 5 hooks

- [ ] **Callback pattern?** Does the logic need optional callbacks (`onStart`, `onComplete`, `onError`)?
  - If yes -> Design the abstraction with callback support from the start

### 3. Types & Interfaces

Before defining types:

- [ ] **Cross-layer type?** Is this type used across API / IPC / module boundaries?
  - If yes -> Define in a shared types location
  - Never duplicate type definitions between producer and consumer layers

- [ ] **Existing type?** Does a similar type already exist?
  - Search before creating: `rg "interface.*YourTypeName" src/`

### 4. UI Components & State

Before creating UI components:

- [ ] **Visual-logic consistency?** If there's already a visual distinction (icon, color, label) for a concept, does your logic match?
- [ ] **State lifecycle?** Will this component unmount during normal user flow?
  - If yes -> Consider where state should persist (parent, context, store)

---

## Quick Decision Tree

```
Adding a value/constant?
|-- Used across layers (backend/frontend or main/renderer)? -> shared/constants/
|-- Used in 2+ files in the same layer? -> <layer>/shared/constants/
+-- Single file only? -> Local constant is fine

Adding logic/behavior?
|-- Similar pattern exists? -> Extend or reuse existing
|-- Will be used in 2+ places? -> Create shared hook/utility first
+-- Single use only? -> Implement directly (but document pattern)
```

---

## Anti-Patterns to Avoid

### Copy-Paste-Modify

```typescript
// DON'T: Same logic in 5 files
const DEBOUNCE_MS = 2000;
const triggerSave = useCallback(() => {
  // 20 lines of identical logic
}, []);
```

### Shared Abstraction

```typescript
// DO: Single source of truth
import { AUTO_SAVE_DELAY } from '@shared/constants';
export function useAutoSave(options) {
  /* logic once */
}
```

### Local Constant Aliases

```typescript
// DON'T: Create local aliases for imported constants
import { CONFIG } from '@shared/constants';
const DEBOUNCE_MS = CONFIG.DEBOUNCE_MS; // Unnecessary!

// DO: Use imported constants directly
setTimeout(fn, CONFIG.DEBOUNCE_MS);
```

---

## Relationship to Other Guides

| Guide                                                         | Focus                     | Timing                      |
| ------------------------------------------------------------- | ------------------------- | --------------------------- |
| **Pre-Implementation Checklist** (this)                       | Questions before coding   | Before writing code         |
| [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md)   | Patterns and abstractions | During/after implementation |
| [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) | Data flow across layers   | Complex feature planning    |

---

**Core Principle**: 5 minutes of checklist thinking saves 50 minutes of refactoring.
