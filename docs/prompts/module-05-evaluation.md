# Module 5 — Evaluation & Scoring

## PROMPT 5.1 — Score Override UI Panel

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/evaluations/HRScoreReview.tsx
- The `OverrideScorePanel` component is imported from src/components/evaluations/OverrideScorePanel.tsx
- Check if this component is fully implemented or just a stub.

Task:
Implement the complete OverrideScorePanel component at src/components/evaluations/OverrideScorePanel.tsx.

Panel requirements:
1. Right-side slide-out panel (same pattern as ApprovalDetailPanel — framer-motion, 480px wide, fixed, z-50, backdrop overlay).
2. Header: "Override Score — {employeeName}" + X close button. A warning banner: "Score overrides are permanently audit-logged and cannot be undone." bg-amber-50 border border-amber-200 text-amber-700.
3. Read-only section — "Manager's Original Scores":
   - Table showing each criterion: Criterion Name | Weight | Manager's Score | Weighted Score
   - Total row at bottom: "Original Total: {weightedTotalScore}%" with tier badge.
4. Editable section — "Override Scores":
   - For each criterion, an input field pre-filled with the manager's score, appropriate for measurement type:
     * numeric: number input, min/max from criterion config
     * boolean: toggle (Yes/No)
     * rating: 1–5 star selector
     * percentage: number input with % suffix, 0–100
   - As HR changes any score, auto-recalculate the weighted total in real time and show the new tier in a prominent badge.
   - Show a diff indicator next to each changed field: original vs new value in small text.
5. Mandatory Justification field:
   - Textarea, min 10 characters, required.
   - Label: "Reason for Override (required — this will be visible in the audit log)"
   - Character count: e.g., "45 / 10 minimum"
6. Action buttons:
   - "Apply Override": bg-amber-500 text-white, disabled until justification >= 10 chars. Calls `overrideScore` Cloud Function with { evaluationId, scores: {criteriaId: {score, weightedScore}}, reason }. Shows spinner.
   - "Cancel": closes panel without saving.
7. On success: toast "Score overridden and audit logged.", panel closes, parent table row updates to show "Overridden" status badge.

Props: `evaluation: Evaluation`, `cycle: Cycle`, `onClose: () => void`, `onSuccess: () => void`

Types: import Evaluation from ../../types/evaluation, Cycle from ../../types/cycle.
```

---

## PROMPT 5.2 — Finalize Cycle Modal

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/evaluations/HRScoreReview.tsx
- The `FinalizeCycleModal` is imported from src/components/evaluations/FinalizeCycleModal.tsx.
- Check if this component is complete or a stub.

Task:
Implement the complete FinalizeCycleModal component.

Modal requirements:
1. Centered overlay modal, max-w-lg, bg-white, rounded-xl, shadow-xl.
2. A pre-finalization checklist shown before the confirm button is enabled:
   - ✓ or ✗ All evaluations submitted (count pending evaluations — show "3 evaluations still pending" in red if any)
   - ✓ or ✗ No evaluations in "not_started" status
   - ✓ Budget within limits (check projected total against cycle budget)
3. If any checklist item is ✗, disable the "Finalize" button and show: "Resolve the above issues before finalizing."
4. Summary stats in the modal:
   - Total employees evaluated: N
   - Score distribution: mini bar chart or text summary (N in each tier)
   - Projected total increment cost
   - Average increment %
5. Confirmation text: "Finalizing this cycle will:
   • Calculate and lock all increment amounts
   • Generate an Increment Story for each employee
   • Notify all employees of their results
   • Mark this cycle as Completed — this cannot be undone."
6. Two-step confirmation:
   - Step 1: Shows the above info with "Proceed to Confirm" button.
   - Step 2: Shows "Type FINALIZE to confirm" — a text input. The final "Finalize Cycle" button is disabled until the user types exactly "FINALIZE".
7. On final confirm: calls `finalizeCycle` Cloud Function with `{ cycleId }`. Shows a progress state: "Generating increment stories... this may take a moment." with a spinner.
8. On success: toast "Cycle finalized! Increment stories generated.", modal closes, page shows the cycle is now Completed.
9. On error: show error message inside modal, allow retry.

Props: `cycle: Cycle`, `evaluations: Evaluation[]`, `onClose: () => void`, `onSuccess: () => void`
```

---

## PROMPT 5.3 — Evaluation Deadline Reminder Indicators

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/evaluations/ManagerEvaluationsHub.tsx
- Managers see their team's evaluation progress for active cycles.
- MISSING: visual deadline urgency indicators (7 days / 3 days / 1 day warnings).

Task:
Add deadline urgency indicators to the ManagerEvaluationsHub and evaluation cards.

Requirements:
1. In ManagerEvaluationsHub, for each active cycle card, calculate days remaining until the cycle's `evaluationDeadline`.
2. Show a deadline badge on the cycle card:
   - > 7 days remaining: no badge (or subtle "Due in X days" in slate-400)
   - 4-7 days: amber badge "Due in X days" bg-amber-100 text-amber-700
   - 2-3 days: orange badge "Due in X days ⚠" bg-orange-100 text-orange-700
   - 1 day: red pulsing badge "Due Tomorrow! 🔴" with animate-pulse bg-red-100 text-red-700
   - Overdue: red badge "OVERDUE — X days past deadline" bg-red-500 text-white
3. On the TeamEvaluationPage (src/pages/evaluations/TeamEvaluationPage.tsx), add a deadline banner at the top of the page if deadline is within 3 days:
   - "⚠ Manager evaluation deadline: {date}. You have {N} evaluations remaining."
   - bg-amber-50 border border-amber-300 text-amber-800 rounded-xl p-4 mb-6
4. In the evaluation form (individual employee evaluation), show a small deadline chip in the top-right of the form header.
5. Sort cycles on ManagerEvaluationsHub: most urgent deadline first.

Utility function: Create `getDaysUntilDeadline(deadline: Timestamp): number` in src/lib/utils.ts and `getDeadlineUrgency(days: number): 'safe' | 'warning' | 'urgent' | 'critical' | 'overdue'`.
```
