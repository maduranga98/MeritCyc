# Module 6 — Employee Experience

## PROMPT 6.1 — Improvement Recommendations in Increment Stories

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/increments/IncrementStoryDetail.tsx
- The IncrementStoryDetail page shows an employee's score breakdown for a completed cycle.
- MISSING: the "Improvement Recommendations" section that gives specific, actionable tips for criteria where the employee scored below the tier threshold.

Task:
Add an Improvement Recommendations section to IncrementStoryDetail.tsx.

Requirements:
1. After the score breakdown section, add a new "How to Improve Next Cycle" card (bg-white border border-slate-200 rounded-xl shadow-sm p-6).
2. Only show this card if the employee did NOT achieve the top tier (i.e., there's room to improve).
3. For each criterion where the employee's score was BELOW the next tier's threshold, generate a specific recommendation:
   - Identify the score gap: "You scored X%. The next tier requires Y%. Gap: Z%."
   - Show a progress bar: current score / next tier threshold.
   - Show a recommendation based on criterion type and data source:
     * Manager-scored criteria: "Work with your manager to set specific goals for {criterion name} in the next review period."
     * Self-scored criteria: "Document your {criterion name} progress regularly and discuss with your manager."
     * System criteria (e.g., attendance): "Consistent daily attendance will automatically improve this score in the next cycle."
   - If the criterion has a description, include: "This criterion measures: {description}"
4. Show criteria sorted by improvement impact (largest gap first = highest priority).
5. Add a "Highest Impact" badge to the top 1 criterion recommendation (the one with the largest gap).
6. If the employee achieved the top tier: show a celebration card instead: "🏆 Outstanding Performance — You've achieved the highest tier! Keep up the excellent work." bg-emerald-50 border border-emerald-200.
7. Data needed from the evaluation doc: scores (per criterion), cycle's criteria definitions, cycle's tiers. All should already be loaded in the page — use existing state.

No new API calls needed — derive everything from already-loaded evaluation and cycle data on the page.
```

---

## PROMPT 6.2 — Real-Time Criteria Progress Tracking for Employees

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/dashboards/EmployeeDashboard.tsx
- Employees can see their active cycle.
- MISSING: a "Your Progress" section that shows real-time progress against each locked criterion during an active cycle.

Task:
Add a "Your Progress This Cycle" section to the EmployeeDashboard for employees with an active cycle.

Requirements:
1. Query the employee's evaluation doc for the active cycle: `/evaluations` where `employeeId == user.uid AND cycleId == activeCycleId`.
2. Use `onSnapshot` for real-time updates (manager scores update in real time as the manager enters them).
3. Show a card: "Your Progress — {cycleName}" with a "Live" indicator dot (pulsing green dot + "Live" text).
4. For each criterion in the cycle's locked criteria:
   - Criterion name + weight badge
   - Data source label: "Scored by: Manager" / "Scored by: System" / "Scored by: You"
   - Score status:
     * Manager/System criteria: if score exists in eval doc → show the score value + a filled progress bar. If no score yet → show "Pending manager evaluation" in slate-400 with an empty progress bar.
     * Self criteria: if score exists → show it. If not → show a "Score Yourself" button (only if the cycle is active and self-scoring is enabled). (Self-scoring form is out of scope for this prompt — just show the button as a placeholder.)
   - A mini progress bar showing score / 100.
5. Below individual criteria, show:
   - "Current Weighted Score: X.X%" (calculated from submitted scores only, labelled as partial if some are still pending)
   - "Estimated Tier: {tierName}" based on current score (or "Pending — more scores needed" if < 50% of criteria are scored)
6. If no evaluation doc exists yet for this employee in this cycle: show "Your manager hasn't started your evaluation yet." with a clock icon.
7. If cycle is completed: replace this section with a "View Your Increment Story" CTA button linking to `/increments/{cycleId}`.

Use `onSnapshot` cleanup in useEffect return. TypeScript strict mode — no `any`.
```
