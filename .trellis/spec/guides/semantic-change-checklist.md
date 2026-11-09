# Semantic Change Checklist

> **Purpose**: When changing core semantics (how the system interprets data), ensure all dependent code is updated consistently.
>
> **When to use**: Before and after changing the meaning of a field, type, status enum, or convention that multiple layers depend on.

---

## What is a "Semantic Change"?

A semantic change is when you modify **how the system interprets data**, not just the data itself.

| Change Type                | Example                                               | Is Semantic?  |
| -------------------------- | ----------------------------------------------------- | ------------- |
| Add new field              | Add `priority` to entity                              | No            |
| Change field meaning       | `type="doc"` can no longer be a directory             | **Yes**       |
| Change implicit convention | "no content = directory" -> "type=folder = directory" | **Yes**       |
| Change timestamp unit      | Seconds -> Milliseconds                               | **Yes**       |
| Change enum values         | Add `"archived"` to status                            | No (additive) |
| Remove / rename enum value | Rename `"review"` -> `"verification"`                 | **Yes**       |

**Key indicator**: If existing code that reads this data would behave differently after your change, it's semantic.

---

## The Checklist

### Phase 1: Before Implementation

#### 1.1 Identify All Dependencies

```bash
# Search for field/value usage across entire codebase
rg "field_name"
rg "old_value"
```

**Document all locations that depend on the old semantics:**

| File       | Line | Current Logic             | Needs Update? |
| ---------- | ---- | ------------------------- | ------------- |
| `file1.ts` | 296  | `type === "doc"`          | Yes           |
| `file2.ts` | 27   | checks children + content | Yes           |

#### 1.2 Identify Cross-Layer Impact

Check each layer for semantic dependencies:

- [ ] **Storage / Database Schema**: Does storage enforce or persist the old semantics?
- [ ] **Backend / Service / CLI**: Which handlers assume old semantics?
- [ ] **Frontend / UI**: Which components render based on old logic?
- [ ] **Shared Types**: Which type definitions assume old semantics?
- [ ] **Tests**: Which tests assert old behavior?

#### 1.3 Plan the Migration

| Step | Description                         | Backward Compatible? |
| ---- | ----------------------------------- | -------------------- |
| 1    | Add new type/field                  | Yes                  |
| 2    | Update writers to use new semantics | Partial              |
| 3    | Update readers to handle new/both   | Yes                  |
| 4    | Migrate existing data               | N/A                  |
| 5    | Remove old semantics support        | No                   |

---

### Phase 2: During Implementation

#### 2.1 Update All Writers First

Ensure all code that **creates/modifies** data uses new semantics:

- [ ] Database / file write operations
- [ ] API / IPC handlers that create data
- [ ] Initialization & template functions
- [ ] Import/export functions

#### 2.2 Update All Readers

Ensure all code that **reads/interprets** data uses new semantics:

- [ ] Queries / parsers with filters on the field
- [ ] Response formatters
- [ ] UI rendering logic
- [ ] Utility & validation functions

#### 2.3 Update Comments and Documentation

- [ ] Inline comments describing old behavior
- [ ] JSDoc/TSDoc on affected functions
- [ ] README, `.trellis/spec/`, or docs if applicable
- [ ] Type definitions

---

### Phase 3: After Implementation

#### 3.1 Verification Grep

Re-run the searches from Phase 1.1 to confirm all locations are updated:

```bash
# Should return 0 results for old pattern (if fully migrated)
rg "old_pattern"

# Should return results for new pattern
rg "new_pattern"
```

#### 3.2 Cross-Reference Checklist

For each location identified in Phase 1.1, confirm `Updated? = Yes` and `Verified? = Yes`.

#### 3.3 Type Check & Integration Test

1. Run project typecheck and test suite.
2. Test the complete flow: Create data with new semantics -> Read back and verify interpretation -> Modify and verify all layers see consistent data.

---

## Anti-Patterns to Avoid

### 1. Partial Migration

```typescript
// DON'T: Leave old logic "just in case" when doing a clean break
if (entity.type === 'folder' || (entity.type === 'doc' && hasChildren)) {
  // This preserves old bugs!
}

// DO: Clean break to new semantics (or explicit migration boundary)
if (entity.type === 'folder') {
  // Single source of truth
}
```

### 2. Documentation Drift

```typescript
// DON'T: Leave outdated comments that contradict the code
/**
 * Returns true if entity is a directory.
 * A directory is a doc with no content and children. // LIES!
 */
function isDirectory(entity) {
  return entity.type === 'folder';
}
```

---

## Quick Reference

```
Before Changing Semantics:
1. grep all usages
2. document all locations
3. plan migration steps

During Change:
4. update writers first
5. update readers
6. update comments & specs

After Change:
7. re-grep to verify (0 old occurrences)
8. typecheck & integration test
```

---

**Core Principle**: Semantic changes are high-risk because they're invisible. The code looks the same, but means something different. Explicit is better than implicit.
