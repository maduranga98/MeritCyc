# Module 4 — Budget Simulation

## PROMPT 4.1 — What-If Scenario Builder with Sliders

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/cycles/SimulationDashboard.tsx
- The SimulationDashboard shows saved simulation results.
- MISSING: a "What-If" mode where HR can adjust parameters with real-time sliders and see results update live (without saving to Firestore — just client-side re-calculation).

Task:
Add a "What-If Explorer" section to SimulationDashboard.tsx.

Requirements:
1. Add a "What-If Explorer" card below the simulation results. It's collapsed by default with a "Open What-If Explorer" toggle button.
2. When expanded, show sliders for:
   - Score Threshold: 0–100 range slider. Label: "Minimum qualifying score: {value}%". Default: 60.
   - Budget Cap: numeric input OR slider showing 50%–200% of the cycle's configured budget. Label: "Budget cap: {currency}{value}". Default: 100% of configured budget.
   - Score Distribution: radio buttons — Normal, Top Heavy, Bottom Heavy, Uniform. Default: Normal.
3. As the user moves any slider, run a CLIENT-SIDE simulation immediately (do NOT call Cloud Function — replicate the simulation logic in the frontend):
   - Use the currently selected simulation's employee count as the population.
   - Apply the threshold: employees below the threshold score get 0% increment.
   - Apply tier logic from the cycle's tiers array.
   - Calculate: qualifying count, total projected cost, average increment %, budget utilization %.
   - Update a results summary panel next to the sliders in real time (debounce 200ms for slider changes).
4. Results summary panel shows:
   - Qualifying Employees: large number with delta from baseline (e.g., "47 employees ▲12 from baseline")
   - Total Projected Cost: large currency value with delta
   - Budget Utilization: colored percentage badge (green/amber/red per thresholds)
   - Average Increment %: number
5. A "Save as Scenario" button below the results that calls the existing `runBudgetSimulation` Cloud Function with the current slider values, saves the result, and adds it to the saved scenarios list.
6. Baseline for delta comparisons: the currently selected saved simulation.

Client-side calculation logic (implement in a utility function `calculateWhatIfResults(params)`):
- Generate N scores using the selectedDistribution
- Filter by threshold
- Map each score to a tier
- Calculate increment amounts using tier midpoint
- Sum to get total cost, divide by budget for utilization

TypeScript: add a `WhatIfParams` type and `WhatIfResults` type.
```

---

## PROMPT 4.2 — Apply Scenario to Cycle

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/cycles/SimulationDashboard.tsx
- Saved simulation scenarios are displayed.
- MISSING: the "Apply to Cycle" button that takes a scenario's parameters and applies them back to the draft cycle's budget settings.

Task:
Implement the Apply Scenario to Cycle feature.

Requirements:
1. Each saved simulation scenario card/row should have an "Apply to Cycle" button. Show it only when:
   - The cycle is still in `draft` status (cannot apply to a locked/active cycle).
   - This scenario is NOT already the applied one (track with `isApplied: boolean` field on the simulation doc).
2. Clicking "Apply to Cycle":
   a. Show a confirmation dialog: "Apply '{scenarioName}' to this cycle? This will update the cycle's budget settings to match this scenario's parameters." with Apply / Cancel.
   b. On confirm: call `applyScenarioToCycle` Cloud Function with `{ cycleId, simulationId }`.
   c. Show spinner on button during call.
   d. On success:
      - Toast: "Scenario applied. Cycle budget settings updated."
      - Mark this scenario's card with an "Applied" green badge.
      - Unmark any previously applied scenario.
      - Update local state to reflect `isApplied: true` on the selected scenario.
3. If the cycle is not in draft status, show a tooltip on the disabled "Apply" button: "Can only apply scenarios to draft cycles."
4. The "Applied" scenario badge: small inline green badge "✓ Applied" next to the scenario name in the list panel.
5. Also show in the cycle's Overview tab (CycleDetail.tsx) a "Simulation Applied" info row: "Based on scenario: '{name}'" with a link to the simulation dashboard.

Cloud Function call: `httpsCallable(functions, 'applyScenarioToCycle')({ cycleId, simulationId })`
```
