# MeritCyc — Manual Test Checklist

**Tester Name:** ___________________________  
**Test Date:** ___________________________  
**App URL:** ___________________________  
**Browser & Version:** ___________________________

---

## How to Use This Document

1. Go through each test case step by step.
2. Mark each result: **PASS** or **FAIL**.
3. If **FAIL**, write the reason in the "Failure Reason / Notes" column.
4. At the end, fill in the **Summary** section.

Legend:
- ✅ PASS
- ❌ FAIL
- ⏭ SKIPPED (not applicable for your plan/role)

---

## Accounts Needed Before Testing

| Role | Email | Password |
|------|-------|----------|
| Super Admin | | |
| HR Admin | | |
| Manager | | |
| Employee | | |
| Platform Admin (Lumora) | | |

---

---

# MODULE 1 — Authentication

## 1.1 Login

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 1.1.1 | Go to the login page | Login form with Email and Password fields is shown | | |
| 1.1.2 | Enter a valid email and correct password, click **Sign In** | User is logged in and redirected to their dashboard | | |
| 1.1.3 | Enter a valid email and **wrong** password, click **Sign In** | Error message is shown; user is NOT logged in | | |
| 1.1.4 | Leave email and password empty, click **Sign In** | Validation errors appear on both fields | | |
| 1.1.5 | Enter an invalid email format (e.g. `notanemail`), click **Sign In** | Email format validation error is shown | | |
| 1.1.6 | Log in successfully, then close and reopen the browser tab | User remains logged in (session persists) | | |

## 1.2 Forgot & Reset Password

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 1.2.1 | Click **Forgot Password** on the login page | A page/modal to enter email is shown | | |
| 1.2.2 | Enter a registered email, click **Send Reset Link** | Success message is shown; password reset email arrives | | |
| 1.2.3 | Enter an unregistered email, click **Send Reset Link** | Appropriate error or generic message shown (no crash) | | |
| 1.2.4 | Open the reset link from email and set a new password | New password is saved; user can log in with it | | |

## 1.3 Employee Self-Registration (QR Code)

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 1.3.1 | Scan the company QR code (or open the join URL) | Registration form is shown, pre-filled with company info | | |
| 1.3.2 | Fill in all required fields and submit | OTP is sent to the provided email | | |
| 1.3.3 | Enter the OTP received | Registration completes; user sees a "Pending Approval" message | | |
| 1.3.4 | Enter a wrong OTP | Error is shown; user cannot proceed | | |

## 1.4 Employee Self-Registration (Manual Code)

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 1.4.1 | Go to `/join`, enter the company code manually | Company info is confirmed and registration form appears | | |
| 1.4.2 | Enter an invalid company code | Error message is shown | | |

## 1.5 Pending Approval State

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 1.5.1 | Log in as a newly registered user (not yet approved) | "Pending Approval" screen is shown; no app access | | |
| 1.5.2 | Log in as an approved user | Full dashboard is accessible | | |

## 1.6 Session Timeout

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 1.6.1 | Log in, then leave the app idle for 30+ minutes | User is automatically logged out or warned about inactivity | | |

## 1.7 Logout

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 1.7.1 | Click the logout option from any page | User is signed out and redirected to the login page | | |
| 1.7.2 | After logout, press the browser Back button | User is NOT able to access protected pages | | |

---

# MODULE 2 — Company & People Management

> **Required role: HR Admin or Super Admin**

## 2.1 Employee Directory

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 2.1.1 | Navigate to **People → Directory** | List of all employees is displayed | | |
| 2.1.2 | Type a name in the search bar | List filters to show matching employees | | |
| 2.1.3 | Filter by **Department** | Only employees in that department are shown | | |
| 2.1.4 | Filter by **Role** | Only employees with that role are shown | | |
| 2.1.5 | Filter by **Status** (active / inactive) | Only employees with that status are shown | | |
| 2.1.6 | Click on an employee's name | Employee detail page opens with full profile | | |

## 2.2 Employee Detail View

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 2.2.1 | Open any employee's detail page | Profile, role, department, salary info, and performance data are shown | | |
| 2.2.2 | Edit the employee's role or department and save | Changes are saved and reflected immediately | | |

## 2.3 Bulk Employee Import

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 2.3.1 | Click **Import / Bulk Import** in the People section | A modal or page with a CSV upload option appears | | |
| 2.3.2 | Upload a correctly formatted CSV file | Employees are imported successfully with a success message | | |
| 2.3.3 | Upload a CSV with errors (e.g. missing required fields) | Errors are highlighted; invalid rows are NOT imported | | |

## 2.4 Invite Employees

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 2.4.1 | Click **Invite Employee** | Modal to enter email(s) appears | | |
| 2.4.2 | Enter a valid email and send invite | Invite is sent; email appears in the Invite Tracker | | |
| 2.4.3 | Navigate to **Invites** tracker | List of pending invites is shown with status | | |
| 2.4.4 | Click **Resend** on a pending invite | Invite email is resent | | |

## 2.5 Pending Approvals

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 2.5.1 | Navigate to **HR → Approvals** | List of pending registrations is shown | | |
| 2.5.2 | Click on a pending applicant | Detail panel opens with their submitted info | | |
| 2.5.3 | Click **Approve** | User is approved and can now log in | | |
| 2.5.4 | Click **Reject** | User is rejected; a rejection notice can be sent | | |
| 2.5.5 | Click **Request Info** | A message is sent to the applicant asking for more info | | |
| 2.5.6 | Select multiple pending applicants and bulk approve | All selected users are approved at once | | |

## 2.6 Department Management

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 2.6.1 | Navigate to **People → Departments** | List of departments is shown | | |
| 2.6.2 | Create a new department with a valid name | Department is created and appears in the list | | |
| 2.6.3 | Edit an existing department's name | Name is updated in the list | | |

## 2.7 Salary Band Management

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 2.7.1 | Navigate to **People → Salary Bands** | List of salary bands is shown | | |
| 2.7.2 | Create a new salary band with min and max values | Band is created and appears in the list | | |
| 2.7.3 | Edit an existing band's range | Changes are saved | | |

---

# MODULE 3 — Increment Cycle Engine

> **Required role: HR Admin or Super Admin**

## 3.1 Create a Cycle

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 3.1.1 | Navigate to **Cycles** and click **Create Cycle** | Cycle creation wizard/form opens | | |
| 3.1.2 | Fill in cycle name, start/end dates, and scope (all employees / department / salary band), then proceed | Step advances successfully | | |
| 3.1.3 | Add at least one evaluation criterion (name, type, weight) | Criterion is added to the list | | |
| 3.1.4 | Add scoring tiers with corresponding increment percentages | Tiers are saved | | |
| 3.1.5 | Set a budget (percentage or fixed pool) | Budget is configured | | |
| 3.1.6 | Complete the wizard and save | Cycle appears in the Cycles list with "Draft" status | | |
| 3.1.7 | Try to save a cycle with missing required fields | Validation errors are shown; cycle is not saved | | |

## 3.2 Manage a Cycle

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 3.2.1 | Open an existing cycle | Cycle details, criteria, tiers, and scope are displayed | | |
| 3.2.2 | Edit a criterion on a draft cycle | Changes are saved | | |
| 3.2.3 | Click **Lock Cycle** | Cycle status changes; criteria can no longer be edited | | |
| 3.2.4 | Try to edit a criterion after locking | Edit is prevented with an appropriate message | | |

## 3.3 Budget Tracker

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 3.3.1 | Open a cycle's **Budget Tracker** | Budget utilization chart and department breakdown are shown | | |
| 3.3.2 | After some evaluations are finalized, check the tracker | Numbers update to reflect actual spend vs. budget | | |

## 3.4 Cycle Simulation *(Pro/Enterprise plan required)*

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 3.4.1 | Open a cycle and click **Simulate** | Simulation page opens with scenario controls | | |
| 3.4.2 | Adjust distribution type or parameters and run | Projected budget impact and score distribution are shown | | |
| 3.4.3 | Save a simulation scenario | Scenario is saved and can be revisited | | |
| 3.4.4 | Compare two saved simulations | Side-by-side comparison is displayed | | |

---

# MODULE 4 — Evaluations & Scoring

## 4.1 Manager: Evaluate Team Members

> **Required role: Manager**

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 4.1.1 | Navigate to **Evaluations** | List of team members pending evaluation for active cycles is shown | | |
| 4.1.2 | Click on a team member for an active cycle | Evaluation form with all criteria is shown | | |
| 4.1.3 | Fill in scores for each criterion and save as draft | Draft is saved; can be resumed later | | |
| 4.1.4 | Complete and submit the evaluation | Evaluation is submitted; member is removed from the pending list | | |
| 4.1.5 | Try to submit with missing required criteria scores | Validation error is shown; submission is blocked | | |
| 4.1.6 | Check that weighted total score and increment percentage are auto-calculated | Score and increment % update as criteria are filled | | |

## 4.2 HR: Review & Override Scores

> **Required role: HR Admin or Super Admin**

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 4.2.1 | Navigate to **Evaluations → Review** | All manager-submitted evaluations are listed | | |
| 4.2.2 | Open a submitted evaluation | Score breakdown by criteria is shown | | |
| 4.2.3 | Override a score and provide a justification | Override is saved with justification recorded | | |
| 4.2.4 | Click **Finalize** on an evaluation | Evaluation is locked and increment is confirmed | | |

---

# MODULE 5 — Career Development

## 5.1 Career Paths (HR/Super Admin)

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 5.1.1 | Navigate to **Career Paths** | List of defined career paths is shown | | |
| 5.1.2 | Create a new career path with levels | Path is created; levels are saved | | |
| 5.1.3 | Configure milestones for a level (e.g. min score, min cycles, tenure) | Milestones are saved per level | | |
| 5.1.4 | Edit an existing path's level | Changes are saved | | |

## 5.2 Employee Career Map

> **Required role: Employee**

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 5.2.1 | Navigate to **Career** | Current level, progress bar toward next level, and milestones are displayed | | |
| 5.2.2 | Check milestones (score threshold, cycle count, tenure) | Completed milestones show as achieved; pending ones show remaining requirements | | |
| 5.2.3 | Check career history section | Previous career levels or promotions are listed | | |

## 5.3 Increment Stories (Employee)

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 5.3.1 | Navigate to **Increments** | Past increment cycles are listed | | |
| 5.3.2 | Click on a past cycle | Score breakdown per criterion is shown | | |
| 5.3.3 | Check AI-generated improvement recommendations | Recommendations are shown relevant to the employee's performance | | |
| 5.3.4 | Click **Download PDF** | PDF is generated and downloaded with correct data | | |

---

# MODULE 6 — Analytics & Fairness

> **Required role: HR Admin or Super Admin (Fairness requires Pro+ plan)**

## 6.1 Executive Analytics Dashboard

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 6.1.1 | Navigate to **Analytics** | KPI cards, increment trend charts, department comparison are displayed | | |
| 6.1.2 | Check that charts render without errors | All charts load with data or an empty-state message | | |
| 6.1.3 | Navigate to **Analytics → Departments → [Dept Name]** | Department-specific performance breakdown is shown | | |

## 6.2 Fairness Dashboard *(Pro/Enterprise plan required)*

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 6.2.1 | Navigate to **Fairness** | Disparity metrics, pay gap indicators, and fairness alerts are displayed | | |
| 6.2.2 | Check department disparity section | Score and increment variance across departments is shown | | |
| 6.2.3 | Check manager consistency section | Manager scoring patterns are shown | | |
| 6.2.4 | Check fairness alerts | Alerts (critical / warning / info) are listed with descriptions | | |
| 6.2.5 | Check recommendations section | Actionable recommendations for improving fairness are shown | | |

## 6.3 Reports Generator

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 6.3.1 | Navigate to **Analytics → Reports** | Report types are listed | | |
| 6.3.2 | Generate a **Cycle Summary Report** (PDF) | PDF is downloaded with cycle data | | |
| 6.3.3 | Generate an **Annual Summary Report** (PDF) | PDF is downloaded with annual data | | |
| 6.3.4 | Generate a **Department Comparison Report** | Report is generated and opens or downloads | | |
| 6.3.5 | Generate a **Fairness & Equity Report** | Report is generated | | |
| 6.3.6 | Export **Audit Trail** as CSV | CSV file is downloaded with audit log data | | |

## 6.4 Audit Trail *(Pro/Enterprise plan required)*

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 6.4.1 | Navigate to **Audit Trail** | Log of all system actions is shown with actor, action, and timestamp | | |
| 6.4.2 | Filter by actor (user) | Only actions by that user are shown | | |
| 6.4.3 | Filter by action type | Only actions of that type are shown | | |
| 6.4.4 | Filter by date range | Only actions within that range are shown | | |
| 6.4.5 | Export the audit trail | File is downloaded with filtered data | | |

---

# MODULE 7 — Billing & Licensing

> **Required role: Super Admin**

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 7.1 | Navigate to **Billing** | Current plan, employee count, and monthly cost are displayed | | |
| 7.2 | Navigate to **Pricing** | All plans (Free, Professional, Enterprise) with feature comparison are shown | | |
| 7.3 | On a **Free plan**, try to access **Audit Trail** | A plan-gate message is shown; feature is blocked | | |
| 7.4 | On a **Free plan**, try to access **Simulations** | A plan-gate message is shown; feature is blocked | | |
| 7.5 | On a **Free plan**, try to access **Fairness Dashboard** | A plan-gate message is shown; feature is blocked | | |
| 7.6 | If on a trial, check the **Trial Banner** | Banner shows remaining trial days | | |

---

# MODULE 8 — Settings

## 8.1 Profile Settings (All Roles)

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 8.1.1 | Navigate to **Settings → Profile** | Current profile info is displayed | | |
| 8.1.2 | Update name or other profile fields and save | Changes are saved and displayed correctly | | |

## 8.2 General Settings (Super Admin)

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 8.2.1 | Navigate to **Settings → General** | Company name, timezone, currency, date format fields are shown | | |
| 8.2.2 | Update company name and save | New name is reflected in the app (e.g. sidebar, headers) | | |
| 8.2.3 | Upload a company logo | Logo is uploaded and shown in the app | | |
| 8.2.4 | Click **Export Data** | Company data is exported (CSV or ZIP download) | | |

## 8.3 Registration Settings (HR Admin / Super Admin)

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 8.3.1 | Navigate to **Settings → Registration** | QR code and company join code are displayed | | |
| 8.3.2 | Regenerate the QR code | New QR code is generated; old one is invalidated | | |
| 8.3.3 | Check pending registration stats | Count of pending registrations is shown | | |

## 8.4 Notification Settings

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 8.4.1 | Navigate to **Settings → Notifications** | Notification preference toggles are shown | | |
| 8.4.2 | Toggle an email notification off and save | Setting is saved; notification type is disabled | | |

## 8.5 Security Settings

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 8.5.1 | Navigate to **Settings → Security** | Password policy options are displayed | | |
| 8.5.2 | Update a security setting and save | Change is persisted | | |

---

# MODULE 9 — Notifications

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 9.1 | Navigate to **Notifications** | Notification list is shown | | |
| 9.2 | Filter by **Cycle Updates** | Only cycle-related notifications are shown | | |
| 9.3 | Filter by **Evaluations** | Only evaluation-related notifications are shown | | |
| 9.4 | Filter by **Account** | Only account-related notifications are shown | | |
| 9.5 | Click **Mark as Read** on a single notification | Notification is marked as read (visual change) | | |
| 9.6 | Click **Mark All as Read** | All notifications are marked as read | | |
| 9.7 | Trigger a system event (e.g. cycle locked) and check notifications | New notification for that event appears | | |

---

# MODULE 10 — Role-Based Access Control

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 10.1 | Log in as **Employee** and try to open **Analytics** | Access is denied or the menu item is hidden | | |
| 10.2 | Log in as **Employee** and try to open **Cycles** | Access is denied or the menu item is hidden | | |
| 10.3 | Log in as **Manager** and try to open **Billing** | Access is denied or the menu item is hidden | | |
| 10.4 | Log in as **Manager** and try to open **Settings → General** | Access is denied | | |
| 10.5 | Log in as **HR Admin** and verify the correct dashboard is shown | HR Admin dashboard with cycles, approvals, and analytics links is shown | | |
| 10.6 | Log in as **Super Admin** and verify full menu access | All modules including Billing and General Settings are accessible | | |
| 10.7 | Log in as **Platform Admin** (Lumora) and check the Platform Dashboard | Multi-company view is shown; company-specific data is hidden | | |

---

# MODULE 11 — Role-Specific Dashboards

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 11.1 | Log in as **Super Admin** | Dashboard shows company overview, pending approvals count, evaluation status | | |
| 11.2 | Log in as **HR Admin** | Dashboard shows active cycles, approvals queue, and quick analytics links | | |
| 11.3 | Log in as **Manager** | Dashboard shows team members, evaluation progress, deadline reminders | | |
| 11.4 | Log in as **Employee** | Dashboard shows personal career progress, increment history, and notifications | | |

---

# MODULE 12 — General UI & UX

| # | Steps | Expected Result | Result | Failure Reason / Notes |
|---|-------|----------------|--------|------------------------|
| 12.1 | Resize the browser window to a tablet width (~768px) | Layout adjusts; no overlapping elements or broken layout | | |
| 12.2 | Resize the browser window to a mobile width (~375px) | Layout adjusts or shows a mobile-friendly view | | |
| 12.3 | Navigate between pages using the sidebar | Each page loads correctly without errors | | |
| 12.4 | Press the browser Back button after navigating | Previous page is shown correctly | | |
| 12.5 | Refresh the page on any protected route while logged in | Page reloads correctly without redirecting to login | | |
| 12.6 | Check for console errors on any page | No critical JavaScript errors in the browser console | | |
| 12.7 | Check loading states on data-heavy pages | Spinner or skeleton loader is shown while data loads | | |
| 12.8 | Check empty states (e.g. no employees, no cycles yet) | A friendly empty-state message is shown instead of a blank section | | |

---

---

# Summary

**Test Date:** ___________________________  
**Tester:** ___________________________

| Category | Total Tests | Passed | Failed | Skipped |
|----------|------------|--------|--------|---------|
| Module 1 — Authentication | 18 | | | |
| Module 2 — People Management | 18 | | | |
| Module 3 — Cycle Engine | 12 | | | |
| Module 4 — Evaluations | 11 | | | |
| Module 5 — Career Development | 10 | | | |
| Module 6 — Analytics & Fairness | 15 | | | |
| Module 7 — Billing | 6 | | | |
| Module 8 — Settings | 11 | | | |
| Module 9 — Notifications | 7 | | | |
| Module 10 — Role-Based Access | 7 | | | |
| Module 11 — Dashboards | 4 | | | |
| Module 12 — General UI/UX | 8 | | | |
| **TOTAL** | **127** | | | |

---

## Failed Tests Summary

List all failed tests here for quick review:

| Test # | Feature | Failure Description |
|--------|---------|---------------------|
| | | |
| | | |
| | | |
| | | |
| | | |
| | | |
| | | |
| | | |

---

## Additional Notes

_Write any other observations, unexpected behavior, or suggestions here:_

_______________________________________________________________________________

_______________________________________________________________________________

_______________________________________________________________________________

_______________________________________________________________________________
