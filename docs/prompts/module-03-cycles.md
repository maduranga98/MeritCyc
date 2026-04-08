# Module 3 — Increment Cycle Engine

## PROMPT 3.1 — Cycle Create Wizard (4-Step)

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- The CyclesList page (src/pages/cycles/CyclesList.tsx) has a "+ New Cycle" button.
- MISSING: the button either does nothing or opens an incomplete form. A proper 4-step create wizard is needed.
- Route: /cycles/new (or modal — use a full-page route approach)

Task:
Create src/pages/cycles/CreateCycle.tsx — a 4-step wizard page for creating a new increment cycle.

Step 1 — Basic Info:
- Cycle Name (required, min 3 chars)
- Description (textarea, optional)
- Start Date (date picker, must be today or future)
- End Date (date picker, must be after start date)
- Evaluation Deadline (date picker, must be before end date — this is the deadline for managers to submit scores)
- Validation: end date < start date shows inline error. Evaluation deadline < start date shows inline error.

Step 2 — Scope:
- "Include All Departments" toggle (default on). If toggled off, show a multi-select checklist of all company departments from Firestore.
- "Include All Salary Bands" toggle (default on). If toggled off, show a multi-select checklist of all company salary bands.
- Estimated Employee Count: auto-calculated based on scope selection, fetched from Firestore user count filtered by selected depts/bands. Show as "~X employees in scope."

Step 3 — Budget:
- Budget Mode radio: "Percentage Based" (each employee can receive up to X% increment) OR "Fixed Total Budget" (total pool cannot exceed $X).
- If Percentage Based: input for Max Increment Percentage (e.g., 15%). Hint: "Each employee's increment will not exceed 15% of their current salary."
- If Fixed Total Budget: input for Total Budget Amount + Currency selector (pre-filled from company currency setting). Hint: "Total increment cost across all employees will not exceed this amount."
- Budget Alert Thresholds: two inputs — Warning threshold % (default 80) and Critical threshold % (default 95). Hint: "You'll be alerted when projected spend reaches these levels."

Step 4 — Review:
- Summary card showing all selections from Steps 1-3 in read-only format.
- Each section has an "Edit" link that navigates back to that step.
- "Create Cycle" button: calls `createCycle` Cloud Function with all data. Shows spinner during call.
- On success: navigate to `/cycles/{newCycleId}` with toast "Cycle created! Now build your criteria."
- On error: show error toast, stay on review step.

General:
- Progress bar at top (4 steps, emerald fill).
- Back/Next buttons. Next is disabled until current step validates.
- All form state preserved when navigating between steps.
- Add route `/cycles/new` with ProtectedRoute allowedRoles: ["hr_admin", "super_admin"] in App.tsx.
- The "+ New Cycle" button on CyclesList.tsx navigates to `/cycles/new`.
```

---

## PROMPT 3.2 — Criteria Templates Library Modal

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/components/cycles/CriteriaBuilder.tsx
- The CriteriaBuilder already has a `showTemplateModal` state and a `BookOpen` icon button labeled "Templates" that sets it to true.
- MISSING: the actual TemplateModal component content — it just has a placeholder or empty modal.

Task:
Build the complete TemplateLibraryModal component and integrate it into CriteriaBuilder.tsx.

Modal requirements:
1. Triggered by the existing "Templates" button in CriteriaBuilder.
2. Full-screen overlay modal (max-w-2xl centered, bg-white rounded-xl shadow-xl).
3. Header: "Criteria Templates" title + X close button.
4. 6 pre-built templates as clickable cards in a 2-col grid:

   Template 1 — "Standard Performance" (5 criteria):
   - KPI Achievement: 40%, percentage, manager
   - Attendance: 20%, percentage, system
   - Peer Review: 15%, rating, manager
   - Manager Rating: 15%, rating, manager
   - Learning & Development: 10%, boolean, self

   Template 2 — "Engineering Team" (4 criteria):
   - Code Quality: 35%, rating, manager
   - Delivery & Deadlines: 30%, percentage, manager
   - Technical Skills Growth: 20%, rating, self
   - Collaboration: 15%, rating, manager

   Template 3 — "Sales Performance" (4 criteria):
   - Revenue Target Achievement: 50%, percentage, system
   - New Client Acquisition: 25%, numeric, system
   - Customer Satisfaction: 15%, rating, manager
   - CRM Hygiene: 10%, boolean, manager

   Template 4 — "Simple 3-Factor" (3 criteria):
   - Performance: 50%, rating, manager
   - Attendance: 30%, percentage, system
   - Conduct: 20%, boolean, manager

   Template 5 — "Balanced Scorecard" (5 criteria):
   - Financial Outcomes: 25%, percentage, system
   - Customer Impact: 25%, rating, manager
   - Internal Process: 20%, rating, manager
   - Learning & Growth: 15%, rating, self
   - Teamwork: 15%, rating, manager

   Template 6 — "Tenure & Performance" (3 criteria):
   - Performance Score: 60%, numeric, manager
   - Years of Service Bonus: 25%, numeric, system
   - Skill Certification: 15%, boolean, self

5. Each template card shows: template name (bold), brief description, list of criterion names + weights, a "Use This Template" button (emerald).
6. A warning banner at the top: "Applying a template will replace your current criteria. This cannot be undone." in amber.
7. Clicking "Use This Template":
   a. If current criteria exist: show inline confirmation "Replace your {N} existing criteria with this template?" — Confirm replaces, Cancel goes back.
   b. Calls `handleApplyTemplate` prop with the template's criteria array.
   c. Closes the modal.
8. Each card has a hover state: border-emerald-300 shadow-md.

The modal receives: `onApply: (criteria: Omit<CriteriaItem, 'id' | 'order'>[]) => void` and `onClose: () => void` props.
Wire it into the existing CriteriaBuilder's showTemplateModal state.
```

---

## PROMPT 3.3 — Criteria Preview as Employee View

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/components/cycles/CriteriaBuilder.tsx
- The CriteriaBuilder has a `showPreviewModal` state and an `Eye` icon button labeled "Preview" that sets it to true.
- MISSING: the actual CriteriaPreviewModal component.

Task:
Build the CriteriaPreviewModal that shows HR exactly what employees will see once criteria are locked.

Modal requirements:
1. Full-screen overlay, max-w-lg centered, bg-slate-50.
2. Header: "Employee View Preview" + a badge "How employees will see this" (blue) + X close button.
3. A top banner: "This is a preview of how employees will see your criteria after you publish and lock the cycle." bg-blue-50 border border-blue-200 text-blue-700 text-sm.
4. Simulated employee card — render as if you were the employee seeing this on their Career Map:
   - "Your Increment Criteria" as the section heading (as an employee would see it)
   - Lock icon + "Criteria locked and cannot be changed" — shown in preview even though it's not locked yet (to show what it will look like)
   - For each criterion:
     * Criterion name (bold)
     * Weight displayed as a pill badge: e.g., "40% weight" in slate-100 text-slate-700
     * Data source shown as: "Scored by: Your Manager" / "Scored by: System" / "Scored by: You (Self)"
     * Measurement type shown as: "Score type: Rating 1–5" / "Score type: Yes/No" / "Score type: Number" / "Score type: Percentage"
     * Description if it exists
   - Tier section below criteria: "How your score translates to an increment"
     * Each tier as a row: tier name, score range bar (visual progress bar), increment range %
     * Color-coded by tier color
5. A footer inside the modal: "Employees cannot see your raw scoring notes, only the criteria names, weights, and descriptions you've entered."
6. Receives props: `criteria: CriteriaItem[]`, `tiers: TierConfig[]`, `onClose: () => void`
Wire into the existing showPreviewModal state in CriteriaBuilder.
```
