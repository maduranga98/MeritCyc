# Module 2 — People Management

## PROMPT 2.1 — Employee Detail Page with Tabs

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- The EmployeeDirectory page (src/pages/people/EmployeeDirectory.tsx) has a slide-out panel when clicking "View" on a row.
- MISSING: a dedicated full Employee Detail Page with tabbed navigation (Overview, Increment History, Activity).
- Route should be: /people/employees/:uid

Task:
Create a new page component at src/pages/people/EmployeeDetail.tsx and wire its route in src/App.tsx.

Page requirements:

HEADER section:
- Employee avatar (photo if exists, else initials circle in emerald-500), name (text-2xl font-bold), job title + department in slate-500, role badge (colored by role), status badge (active=green, inactive=red, pending=amber).
- "Edit Profile" button (opens existing edit panel logic) and deactivate/reactivate button (Danger Zone, visible to hr_admin and super_admin only).

TAB 1 — Overview:
- Info cards in a 2-col grid: Email, Department, Salary Band, Role, Status, Registration Method, Member Since, Last Active.
- Current salary band details card: band name, level, min-max salary range.
- Manager assignment card: shows which manager they report to (from department's manager field).

TAB 2 — Increment History:
- Table of all completed cycles the employee participated in. Columns: Cycle Name, Period, Score, Tier (colored badge), Increment %, Increment Amount, Status.
- Fetch from `/evaluations` collection where `employeeId == uid AND status IN [submitted, overridden, finalized]`.
- If no history: empty state with Trophy icon "No increment cycles yet."
- Clicking a row navigates to `/increments/{cycleId}` (the increment story page).

TAB 3 — Activity:
- Timeline list of audit log entries for this employee. Fetch from `/auditLogs` where `targetId == uid OR actorUid == uid`, ordered by createdAt desc, limit 50.
- Each entry: timestamp (relative + absolute on hover), actor email, action badge (colored by action type: USER_APPROVED=emerald, SCORE_OVERRIDDEN=amber, ROLE_CHANGED=blue, DEACTIVATED=red).
- Show "No activity recorded" if empty.

Data fetching:
- Use Firestore `getDoc` for user data from `/users/{uid}`.
- Validate that the fetched user belongs to the same companyId as the logged-in user — if not, redirect to /people/directory with a toast "Employee not found."
- Add ProtectedRoute: allowedRoles ["hr_admin", "super_admin"] for this route.

Design: standard AppLayout with PageLayout wrapper, bg-slate-50 background, white tab content card with border border-slate-200 rounded-xl shadow-sm.
```
