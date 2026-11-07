# Lean Trellis Lifecycle & Status Standard

> **Contract Type**: Durable Workflow & UI Integration Specification  
> **Status**: Confirmed  
> **Last Updated**: 2026-11-07  

---

## 1. Purpose & Core Invariant

This specification defines the canonical lifecycle states, document-level status metadata, and observer contract for Lean Trellis feature tasks.

### Core Invariant
1. **Explicit Status First (Single Source of Truth)**: The `Status:` header in `implement.md` is the primary source of truth for the active engineering lifecycle of any feature. Checklists provide granular progress calculation (`progress: 0.0 - 1.0`), but explicit status determines Kanban lane placement.
2. **Deterministic, Concrete Values Only**: Headers must declare a single, concrete status value (e.g., `**Status:** Planning`). Template placeholders containing pipe delimiters (e.g. `Draft | In Review | Approved`) are strictly prohibited.
3. **Scoping of Checklists**: Checkboxes (`- [ ]` and `- [x]`) are strictly reserved for `## 1. Ordered Implementation Checklist`. All other sections (such as `## 3. Risk Watchlist` or operational notes) must use standard bullet points (`- `).

---

## 2. Canonical Status Values

### 2.1. `implement.md` (Primary Execution Engine)

| Canonical Status | Meaning | Kanban Lane |
| :--- | :--- | :--- |
| `Planning` | Task scaffolded, requirements/design ready, checklist being drafted. | **Lane 1: Planning** |
| `In Progress` | Actively being coded in active chat session. | **Lane 2: In Progress** |
| `Verification` | Coding checklist 100% complete (`[x]`). Pending test suite run & Acceptance Criteria check. | **Lane 3: Review / Verification** |
| `Blocked` | Paused due to an external dependency, blocker, or architectural hurdle. | **Lane 3: Blocked** |
| `Completed` | Acceptance Criteria verified, automated tests pass, developer session recorded. | **Lane 4: Done** |

### 2.2. `prd.md` (Product Requirements Document)

| Status | Meaning |
| :--- | :--- |
| `Draft` | Initial requirements discovery and brainstorming. |
| `In Review` | Scope questions or trade-offs actively being discussed. |
| `Approved` | Requirements and scope boundaries locked and agreed. |
| `Completed` | Feature implemented, verified, and shipped. |

### 2.3. `design.md` (Technical Architecture)

| Status | Meaning |
| :--- | :--- |
| `Draft` | Proposed design, schema contracts, and alternatives considered. |
| `Approved` | Architecture confirmed; ready for checklist implementation. |
| `Completed` | Implementation completed and verified against design. |

---

## 3. State Machine & Conversational Triggers

The assistant transitions statuses deterministically across the 3 natural chat triggers:

```
[User: "Tạo task <name>"]
        │
        ▼
   Scaffold Task
   • prd.md: Draft
   • design.md: Draft
   • implement.md: Planning
        │
   (Clarify & Confirm)
        ▼
   • prd.md: Approved
   • design.md: Approved
        │
[User: "Implement task <name>"]
        │
        ▼
   Start Coding
   • implement.md: In Progress
        │
   (Tick all [x] in Section 1)
        ▼
   Checklist Complete
   • implement.md: Verification
   • Pre-verification Git Hand-off (git add, git commit)
        │
[User: "Check task <name>"]
        │
        ▼
   Verify Acceptance Criteria & Run Tests
        │
   (Tests pass & AC confirmed)
        ▼
   Synchronize Completion
   • prd.md: Completed
   • design.md: Completed
   • implement.md: Completed
   • add_session.py recorded to journal
```

---

## 4. Contract for UI & Tool Observers (e.g., Trellis Card Desktop)

External observers (Tauri app, CLI, dashboards) must adhere to these resolution rules when scanning `.trellis/research/<slug>/`:

1. **Precedence**:
   - Check `implement.md` for `Status: <status>`.
   - If not found, check `prd.md` for `Status: <status>`.
   - Strip template placeholders: if value contains `|`, discard as unselected template and evaluate subtask checklist.
2. **Lane Mapping**:
   - `planning`, `draft`, `approved` ➔ Lane 1 (Planning / Backlog).
   - `in_progress` ➔ Lane 2 (In Progress).
   - `verification`, `review`, `blocked` ➔ Lane 3 (Verification / Blocked).
   - `completed`, `done` ➔ Lane 4 (Done / Completed).
3. **Subtask Calculation**:
   - Count `- [x]` (done) and `- [ ]` (pending) **strictly within** `## 1. Ordered Implementation Checklist`. Stop parsing subtasks when encountering `## 2.` or `## 3.`.
