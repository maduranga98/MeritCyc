# Module 11 — Settings

## PROMPT 11.1 — Data Export (Full Company ZIP)

```
You are working on MeritCyc, a React 18 + TypeScript + Tailwind CSS + Firebase app.

Context:
- File: src/pages/settings/DataPrivacySettings.tsx
- The Data & Privacy settings page exists.
- MISSING: working "Export All Company Data" functionality.

Task:
Implement the Export Company Data feature.

Requirements:
1. The page has (or add) an "Export All Company Data" button in a card: "Export your complete company data as a ZIP file containing JSON files for all records."
2. Clicking the button:
   a. Shows a confirmation dialog: "This will export all company data including employee records, cycle data, and evaluation scores. The export may take a minute for large companies." with Export / Cancel.
   b. On confirm, show progress: "Exporting... collecting data" spinner state on the button.
3. Frontend data collection — fetch from Firestore in sequence:
   - Company doc: `/companies/{companyId}`
   - Departments: `/companies/{companyId}/departments` (all docs)
   - Salary Bands: `/companies/{companyId}/salaryBands` (all docs)
   - Employees: `/users` where `companyId == companyId` (all docs, remove sensitive fields: passwordHash etc — there are none in Firestore, but strip any auth-specific fields)
   - Cycles: `/cycles` where `companyId == companyId` (all docs)
   - Evaluations: `/evaluations` where `companyId == companyId` (all docs)
   - Audit Logs: `/auditLogs` where `companyId == companyId` (limited to last 1000)
4. Build JSON files for each collection (array of docs, each doc includes its Firestore ID as `id` field).
5. Convert Firestore Timestamps to ISO strings before JSON serialization.
6. Use JSZip (install if not present: `npm install jszip`) to create a ZIP:
   - `export/company.json`
   - `export/departments.json`
   - `export/salary_bands.json`
   - `export/employees.json`
   - `export/cycles.json`
   - `export/evaluations.json`
   - `export/audit_logs.json`
   - `export/README.txt` — a text file explaining each file's schema
7. Trigger download of the ZIP: `{companyName}_MeritCyc_Export_{date}.zip`
8. Show "Export complete" toast on success. Reset button to idle state.
9. Show a note: "Sensitive employee data is included. Store this file securely." in amber below the button.

ProtectedRoute: this action is Super Admin only — hide the export card from hr_admin users.
```
