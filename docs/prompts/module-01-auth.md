# Module 1 — Auth & Registration

## PROMPT 1.1 — Approval Detail Slide-Out Panel (Edit Before Approving)

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File to modify: src/pages/people/PendingApprovals.tsx
- The PendingApprovals page lists employees awaiting HR approval after self-registration.
- Currently clicking a row does NOT open a slide-out detail panel — only basic approve/reject buttons exist inline.

Task:
Build a right-side slide-out detail panel component called `ApprovalDetailPanel` that opens when an HR Admin clicks on any pending employee row in the PendingApprovals table.

Panel requirements:
1. Slides in from the right (framer-motion, translateX animation), 400px wide, full viewport height, fixed position, bg-white, shadow-xl, z-50. Backdrop overlay with bg-black/30 behind it.
2. Panel header: employee name + "Pending Approval" badge (amber), X close button top right.
3. Panel body — read-only submitted info section:
   - Full Name, Email, Department (submitted by user), Job Title, Registration Method (QR/Manual), OTP Verified badge (green check), Submitted At timestamp.
4. Panel body — editable fields section (HR can correct before approving):
   - Department: SearchableDropdown populated from Firestore `/companies/{companyId}/departments`
   - Salary Band: SearchableDropdown populated from Firestore `/companies/{companyId}/salaryBands`
   - Role: select dropdown — options: employee, manager (NOT hr_admin or super_admin)
   All three fields pre-filled from the pending user doc but editable.
5. Action buttons row at bottom of panel:
   - "Approve" button: bg-emerald-500, calls `approveRegistration` Cloud Function with { targetUid, departmentId, salaryBandId, role }. Shows spinner during call. On success: toast "Employee approved", panel closes, table row disappears.
   - "Request Info" button: bg-amber-500, opens a small inline textarea inside the panel for the HR to type a message, then calls `requestMoreInfo` Cloud Function with { targetUid, message }. On success: toast "Info requested", status badge changes to "Info Requested".
   - "Reject" button: border-red-500 text-red-600, shows a confirmation inline before calling `rejectRegistration` Cloud Function with { targetUid }. On success: toast "Rejected", panel closes.
6. All Cloud Function calls use `httpsCallable` from `firebase/functions`.
7. Show a loading skeleton inside the panel while department/band data is being fetched.
8. Clicking outside the panel (on the backdrop) closes it.
9. Export the component and wire it into PendingApprovals.tsx — replace the existing inline action buttons with a "Review" button per row that opens this panel.

Design: follow existing MeritCyc patterns — rounded-xl cards inside panel, slate-900 headings, slate-500 secondary text, emerald-500 primary button style matching rest of app.

Do not remove any existing functionality from PendingApprovals.tsx.
```

---

## PROMPT 1.2 — Bulk Approve / Reject in Pending Approvals

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File to modify: src/pages/people/PendingApprovals.tsx
- The page shows pending employee registrations. Individual approve/reject exists.
- MISSING: ability to select multiple rows and bulk approve or bulk reject.

Task:
Add bulk selection and bulk actions to the PendingApprovals table.

Requirements:
1. Add a checkbox column as the first column of the table. The header checkbox selects/deselects all visible rows.
2. When 1+ rows are selected, show a sticky action bar that floats above the table (fixed bottom of the page or sticky below the filter bar) containing:
   - "X employees selected" count text
   - "Bulk Approve" button: bg-emerald-500 text-white. On click, show a confirmation dialog: "Approve {X} employees? They will all be assigned their submitted department and band." with Confirm / Cancel.
   - "Bulk Reject" button: border border-red-300 text-red-600. On click, show a confirmation dialog: "Reject {X} employees? This cannot be undone." with Confirm / Cancel.
   - "Clear Selection" link to deselect all.
3. On Bulk Approve confirm:
   - Call `approveRegistration` Cloud Function for each selected employee sequentially (not parallel to avoid rate limits). Pass their existing departmentId, salaryBandId, role from the pending doc.
   - Show a progress indicator: "Approving 3 of 8..." inside the confirmation dialog while processing.
   - On complete: toast "X employees approved", clear selection, table refreshes.
4. On Bulk Reject confirm:
   - Call `rejectRegistration` Cloud Function for each selected employee sequentially.
   - Show progress the same way.
   - On complete: toast "X employees rejected", clear selection, table refreshes.
5. If any individual call fails, show an error summary at the end: "3 approved, 1 failed — see console." Do not abort remaining operations on one failure.
6. Selection state is local React state (not persisted).
7. The existing single-row Review panel (ApprovalDetailPanel) still works — clicking "Review" opens the panel; clicking the checkbox just selects without opening the panel.

Design: Action bar uses bg-slate-900 text-white, rounded-xl, shadow-lg, fixed bottom-6 left-1/2 -translate-x-1/2 z-40, min-w-[480px].
```

---

## PROMPT 1.3 — Sidebar Pending Badge with Live Count

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File to check/modify: src/components/layout/AppLayout.tsx or Sidebar component (find the sidebar nav component)
- The sidebar has navigation links for all roles.
- MISSING: a red badge showing the count of pending approvals next to the "Pending Approvals" nav item, updating in real time via a Firestore listener.

Task:
Add a real-time pending approvals count badge to the sidebar nav.

Requirements:
1. Find the sidebar navigation component (likely AppLayout or a Sidebar component). Locate the nav item that links to `/people/pending-approvals`.
2. Add a Firestore real-time listener using `onSnapshot` that queries:
   `/users` collection where `companyId == user.companyId` AND `status == "pending_approval"`
   Count the results and store in local state `pendingCount`.
3. Only subscribe to this listener when the logged-in user has role `hr_admin` or `super_admin`. Employees and managers should not run this query.
4. Show the count as a red circular badge (bg-red-500 text-white text-xs font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center) to the right of the "Pending Approvals" label in the sidebar.
5. If count is 0, hide the badge entirely (not just show "0").
6. If count > 99, show "99+".
7. The listener must be cleaned up on component unmount (return unsubscribe from useEffect).
8. Store the subscription in a useEffect inside the sidebar component with `user.companyId` and `user.role` as dependencies.
9. Also update the browser tab title when count > 0: `(${pendingCount}) MeritCyc` — reset to `MeritCyc` when count is 0.

Do not change any existing sidebar styling or navigation structure.
```

---

## PROMPT 1.4 — Invite Resend with New Token

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File to modify: src/pages/people/InviteTracker.tsx
- The InviteTracker page lists all sent invites with statuses: pending, accepted, expired, revoked.
- The "Actions" column exists but the Resend button is either missing or non-functional.

Task:
Implement a working Resend Invite flow for expired or pending invites.

Requirements:
1. In the Actions column of the InviteTracker table, show a "Resend" button only when the invite status is `expired` or `pending`.
2. The button is a small secondary button: border border-slate-300 text-slate-700 text-sm px-3 py-1 rounded-md hover:bg-slate-50.
3. Clicking "Resend":
   a. Check if the invite has already been resent 3 times (check `resendCount` field on the invite doc). If resendCount >= 3, show an inline error: "Maximum resends reached (3/3). Please create a new invite instead." — do not call the function.
   b. If resendCount < 3, call the `sendEmployeeInvite` Cloud Function (which creates a new token and sends a fresh email) passing the invite's original { email, name, departmentId, salaryBandId, role } data.
   c. Show a spinner on the button during the call.
   d. On success: toast "Invite resent to {email}. New link expires in 7 days." The row's status updates to "pending" and expiry date resets to now + 7 days (from the Cloud Function response).
   e. On error: toast the error message.
4. Show a resend count badge next to the status for partially-resent invites: e.g., "Expired · 2/3 resends used" in small slate-500 text.
5. Accepted and revoked invites show no Resend button.
6. Add a "Revoke" button for pending invites: calls a `revokeInvite` function (or updates Firestore status to "revoked" via a callable). Only show for pending status.

Do not change the existing table structure — only add to the Actions column.
```
