# Module 8 — Analytics

## PROMPT 8.1 — YoY Comparison & Department Drill-Down in Executive Dashboard

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/analytics/ExecutiveDashboard.tsx
- The ExecutiveDashboard exists with basic summary cards.
- MISSING: Year-over-Year comparison charts and department drill-down.

Task:
Enhance ExecutiveDashboard.tsx with YoY comparison and department drill-down.

YoY Comparison section:
1. Fetch all COMPLETED cycles ordered by completedAt. Group by year.
2. Build a Recharts LineChart with:
   - X-axis: years (e.g., 2023, 2024, 2025)
   - Lines: Average Increment %, Total Spend, Employee Count
   - Each line a different color (emerald, slate-600, amber)
   - Tooltip showing all three metrics on hover
3. Below the chart: a summary table. Columns: Year | Cycles Run | Employees Reviewed | Avg Increment % | Total Spend | YoY Change (%)
   - YoY Change column: green ▲ if increase, red ▼ if decrease vs prior year.
4. If only 1 year of data: show "Complete more cycles to see year-over-year trends." placeholder.

Department Drill-Down section:
1. Add a "Department Breakdown" card below the YoY section.
2. A department selector: tab strip or dropdown showing all departments.
3. When a department is selected, show:
   - Average score for that department across all completed cycles
   - Average increment % for that department
   - Employee count
   - A BarChart (Recharts) showing per-cycle average score for employees in that department
   - Top performer of the department (highest avg score employee name + score)
   - Lowest scorer (if only showing as "1 employee below average" without naming, for privacy)
4. Data source: aggregate from `/evaluations` where companyId matches AND filter by departmentId.
5. Loading skeleton while fetching department data.

General:
- All charts use Recharts (already installed).
- All monetary values formatted using the company's currency from the company doc.
- TypeScript strict — define proper types for all aggregated data structures.
```

---

## PROMPT 8.2 — Branded PDF Cycle Summary Report

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/analytics/ReportsGenerator.tsx
- The reports generator page exists but may have placeholder download functionality.

Task:
Implement a fully working "Cycle Summary Report" PDF generation using jsPDF + html2canvas.

Requirements:
1. When the user selects "Cycle Summary Report" and clicks "Generate", fetch all needed data then render a hidden report div and convert to PDF.

Data to fetch:
- Cycle details (name, dates, status, budget)
- All evaluations for the cycle (scores, tiers, increment amounts)
- Department breakdown (group evaluations by departmentId)
- Company info (name, logo)

Report pages to render:
- Page 1: Cover page — company logo (if exists), company name, "Increment Cycle Report", cycle name, date range, "Prepared by MeritCyc", generation date.
- Page 2: Executive Summary — 4 KPI boxes: Total Employees Reviewed, Average Score, Total Increment Cost, Average Increment %. A tier distribution pie chart (rendered as a Recharts chart, screenshot with html2canvas).
- Page 3: Department Summary — table with one row per department: Dept Name, Employee Count, Avg Score, Avg Increment %, Total Cost.
- Page 4: Score Distribution — histogram or bar chart of score ranges (0-10, 10-20, ... 90-100) showing how many employees fell in each range.
- Page 5: Full Employee List — table with Employee Name, Department, Score, Tier, Increment %, Increment Amount. Sorted by department then score descending.

PDF generation approach:
- Render each page as a separate hidden div.
- Use html2canvas to capture each div sequentially.
- Add each canvas image to jsPDF as a new page.
- File name: "{companyName}_Cycle_Report_{cycleName}_{date}.pdf"
- All hidden divs use explicit hex colors (no Tailwind CSS variables for html2canvas compatibility).

Show "Generating report... (page X of 5)" progress during generation.
Toast "Report downloaded" on complete.
```
