 # MarkViz Project Features and Landing Page Content

## Run with PostgreSQL Authentication

The dashboard must be opened through the Node.js server. Opening `markviz.html` directly as a file bypasses the server and cannot enforce authentication.

1. Install Node.js 20 or newer from https://nodejs.org.
2. Create a PostgreSQL database with your provider.
3. Set `DATABASE_URL` to the provider connection string.
4. Open a terminal in the MarkViz folder and run `npm install`.
5. Start the app with `npm start`.
4. Open `http://localhost:3000` and use **Sign up** to create an account.

### Windows PowerShell npm error

If PowerShell reports that `C:\Program Files\nodejs\npm.ps1` cannot be loaded because running scripts are disabled, use the Windows command shim:

```powershell
npm.cmd install
npm.cmd start
```

The test command is:

```powershell
npm.cmd test
```

To allow the normal `npm` command for only your Windows user account, open PowerShell and run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Then restart the terminal and use `npm install`, `npm start`, or `npm test` normally.

The server creates the PostgreSQL tables automatically on first start. Signup records are stored in `users`, passwords are stored as scrypt hashes, active login sessions are stored in `sessions`, password reset tokens are stored in `password_resets`, and each user's marks workspace is stored as JSONB in `workspace_data`.

## Deploy for multiple users

This backend is ready for many users on one Node.js service. It is not limited to one browser: accounts, sessions, marks, students, subjects, and reports data are stored server-side and are separated by the authenticated user ID.

The browser keeps only a namespaced cache for responsiveness; the server database is the source of truth. Data from the old pre-backend `localStorage` format is intentionally not imported automatically because doing so could expose one browser user's marks to another account.

1. Create a hosted PostgreSQL database using Neon, Supabase, Vercel Postgres, or another provider.
2. Add `DATABASE_URL` to the Vercel project environment variables for Preview and Production.
3. Deploy with the included `vercel.json`; Vercel runs `server.js` as a Node function.
4. Set `NODE_ENV=production`. The server enables PostgreSQL TLS and secure login cookies.
5. Open `/health` after deployment. It should return `{ "ok": true, "database": "postgresql" }`.
6. Configure automated PostgreSQL backups through the database provider.

The Vercel filesystem is not used for application data. All accounts, sessions, password resets, marks, students, subjects, and reports are stored in PostgreSQL, so the system can run across multiple serverless instances.

The `/health` endpoint can be used by the hosting provider for health checks. The database contains account information and must not be committed to source control.

 ## 1. Project Overview

 **MarkViz** is a browser-based student marks management and analytics workspace for teachers and schools. It helps teachers register students, enter marks, calculate results, understand class performance, compare exam progress, and export or print academic records from one dashboard.

 Current project files:

 - `markviz.html`: Main teacher dashboard application.
 - `markviz_landing_page.html`: Public marketing and introduction page.
 - `app.js`: Application state, calculations, navigation, charts, reports, and data actions.
 - `style.css`: Dashboard layout, responsive styling, tables, forms, charts, and navigation.
 - `first.py` and `firt.py`: Python files currently present in the project; document their purpose separately if they are still part of the product.

 ## 2. Implemented Features

 ### Teacher Dashboard

 - Overview of the number of registered students.
 - Current exam selector.
 - Class average for the selected exam.
 - Number of completed exams.
 - Exam progress table for all four regular exams.
 - Quick links to open each exam.
 - Class performance charts.
 - Subject theory-average chart.
 - Pass versus NG result chart.
 - Empty states when students or marks have not been entered.

 ### Student Management

 - Add students using roll number and full name.
 - Support for up to 55 students.
 - Prevent duplicate roll numbers.
 - Validate roll numbers and required names.
 - View all registered students in a table.
 - Remove students with confirmation.
 - Remove a student's saved regular-exam and test-exam marks when that student is removed.

 ### Regular Exam Management

 - Support for First Term, Second Term, Third Term, and Annual Exam.
 - Select the active exam from the top navigation.
 - Enter theory and practical marks for every student and subject.
 - Mark limits change automatically by academic level:
	 - Primary: Theory 50 and Practical 50.
	 - Secondary: Theory 75 and Practical 25.
 - Validate marks so values cannot be below zero or above the relevant maximum.
 - Treat blank cells as incomplete.
 - Require every theory and practical mark before completing an exam.
 - Save marks in the browser while entering them.

 ### Test Exam Workflow

 - Separate Test Exam marks-entry page.
 - Enter theory marks out of 20 for each subject.
 - Use 8 out of 20 as the test-exam pass mark.
 - Validate test marks between 0 and 20.
 - Require every student's test mark before saving the test exam.
 - Dedicated Test Exam Ledger.
 - Dedicated Test Exam Report page.

 ### Result and Grading Calculations

 - Calculate subject totals from theory and practical marks.
 - Calculate total marks and full marks.
 - Calculate percentage.
 - Calculate GPA.
 - Assign divisions: Distinction, First, Second, Third, or NG.
 - Determine PASS or NG for every student.
 - Check pass requirements independently for each subject.
 - Calculate grades for primary and secondary levels.
 - Generate subject-level theory and practical grade values in the Grade Ledger.
 - Show grading rules in Settings.

 Primary component grading:

 - 45–50: A+
 - 40–44: A
 - 35–39: B+
 - 30–34: B
 - 25–29: C+
 - 20–24: C
 - 18–19: D+
 - Below 18: NG

 Secondary grading:

 - 90 and above: A+
 - 80–89: A
 - 70–79: B+
 - 60–69: B
 - 50–59: C+
 - 40–49: C
 - 35–39: D
 - Below 35: NG

 ### Analysis and Visualization

 - Individual student analysis.
 - Student selector for switching between individual results.
 - Individual percentage, GPA, and result summary.
 - Individual theory-versus-practical chart.
 - Subject-wise class theory-average chart.
 - Number of students passing each subject.
 - Chart.js visualizations with tooltips, legends, and responsive sizing.

 ### Exam Comparison

 - Compare completed regular exams from First Term through the selected exam.
 - Show each student's percentage across exams.
 - Show overall percentage change between the first and latest completed exam.
 - Display a class comparison chart.
 - Require earlier exams to be completed before comparison.
 - Download comparison graph as PNG.
 - Download comparison data as CSV.
 - Print or save the comparison view as PDF through the browser print dialog.

 ### Ledgers and Reports

 - Student Marks Ledger for the selected regular exam.
 - Marks Ledger columns for theory, practical, total, full marks, percentage, division, GPA, and result.
 - Grade Ledger with theory GPA, practical GPA, and overall GPA.
 - Test Exam Ledger with subject theory marks, grades, totals, percentage, and result.
 - Test Exam Report Card with:
	 - Total students.
	 - Passed students.
	 - NG students.
	 - Class average.
	 - Top three students.
	 - Subject averages.
	 - Weak-student count by subject.
	 - Subject pass and NG counts.
	 - Pass-percentage and NG-percentage charts.
	 - Ranked student report cards.
 - Regular exam text report with class average, pass count, NG count, highest performer, and subject theory averages.
 - Copy regular exam text reports to the clipboard.

 ### Export and Printing

 - Download regular marks ledgers as CSV.
 - Download test-exam ledgers as CSV.
 - Download comparison tables as CSV.
 - Download Grade Ledger as CSV.
 - Download Grade Ledger as Excel `.xlsx` when the XLSX library is available.
 - Print marks ledgers.
 - Print Grade Ledger.
 - Print Test Exam results.
 - Print or save report cards as PDF through the browser.

 ### Subject and Level Settings

 - Switch between Primary Level and Secondary Level.
 - Maintain a separate subject list for each level.
 - Add subjects.
 - Rename subjects.
 - Remove subjects while keeping at least one subject.
 - Preserve matching marks when subjects are renamed.
 - Update ledger columns after subjects are saved.
 - Display the active grading rules and pass thresholds.
 - Clear all saved data after two confirmation prompts.

 ### Data and Usability

 - Keep a namespaced browser cache for responsiveness while PostgreSQL remains the source of truth for students, subjects, marks, test marks, selected level, and current exam.
 - Restore saved data when the app opens again in the same browser.
 - Toast notifications for validation, save, delete, and export actions.
 - Responsive desktop and mobile layout.
 - Collapsible desktop sidebar.
 - Mobile navigation menu.
 - Keyboard-friendly focus states.
 - Navigation dropdown for the Test Exam pages.
 - Logout-style action that returns to the dashboard while preserving saved browser data.

 ## 3. Recommended Landing Page Structure

 The landing page should explain the product clearly and lead teachers to open the dashboard. It should describe features that exist today and avoid claiming cloud accounts, automatic online backup, mobile apps, AI predictions, or multi-school collaboration until those are implemented.

 ### Header Navigation

 Include:

 - MarkViz logo and “Student Analytics” label.
 - Features link.
 - Analytics link.
 - How It Works link.
 - About or Contact link.
 - Primary **Open Dashboard** button linking to `markviz.html`.
 - Responsive mobile navigation.

 ### Hero Section

 Recommended headline:

 > Turn student marks into clear academic insight.

 Supporting copy:

 > MarkViz gives teachers one focused workspace for marks entry, result calculation, performance analysis, exam comparison, and printable reports.

 Primary call to action:

 - **Open MarkViz Dashboard**

 Secondary call to action:

 - **Explore Features**

 The hero should show a real dashboard preview containing the student count, class average, exam progress, and a performance chart. A realistic preview is more convincing than generic education imagery.

 ### Trust and Product Proof

 Use short, truthful proof points instead of invented customer logos or statistics:

 - Four regular exam terms.
 - Primary and secondary grading support.
 - Up to 55 students per workspace.
 - CSV, Excel, print, and PDF-ready outputs.
 - Data saved locally in the browser.

 ### Feature Section

 Use six focused feature blocks:

 1. **Fast Marks Entry**: Enter theory and practical marks with built-in limits and incomplete-mark validation.
 2. **Student Performance Analytics**: See class averages, pass rates, subject performance, individual analysis, GPA, and divisions.
 3. **Exam Comparison**: Track student percentages from First Term to the latest completed exam.
 4. **Test Exam Reports**: Produce rankings, subject summaries, weak-student counts, and report cards.
 5. **Ledgers and Exports**: Download CSV or Excel files and print clean academic ledgers.
 6. **Flexible Academic Settings**: Switch levels and add, rename, or remove subjects.

 ### How It Works Section

 Show the product in four steps:

 1. Register students with roll numbers and names.
 2. Choose the level, exam, and subjects.
 3. Enter marks and complete the exam.
 4. Review insights, compare progress, and export reports.

 ### Analytics Preview Section

 Highlight the visual outputs available in the dashboard:

 - Class average by subject.
 - Pass versus NG distribution.
 - Individual theory and practical performance.
 - Exam-to-exam percentage change.
 - Test-exam pass and NG percentages.

 ### Reports and Outputs Section

 Explain that teachers can create practical records for school use:

 - Marks Ledger.
 - Grade Ledger.
 - Test Exam Ledger.
 - Test Exam Report Card.
 - Regular Exam Text Report.
 - CSV and Excel downloads.
 - Printable pages and browser-generated PDFs.

 ### Data Privacy Section

 The current app stores data in the browser's local storage. The landing page should state this plainly:

 > Your workspace data stays in the browser on this device. Export important records regularly, especially before clearing browser data or changing devices.

 This section should also explain that the current app does not provide server backup or cross-device synchronization.

 ### Final Call to Action

 Recommended copy:

 > Make every mark easier to understand.

 Add a prominent **Open Dashboard** button and a smaller link to the feature overview.

 ### Footer

 Include:

 - MarkViz name and short description.
 - Links to Features, Analytics, How It Works, and About.
 - Support or contact link if a real contact address exists.
 - Privacy note about local browser storage.
 - Copyright information for the actual owner or organization.

 ## 4. Important Landing Page Accuracy Notes

 Do not advertise these as current features unless they are added to the application:

 - User registration and login.
 - Cloud synchronization or automatic backups.
 - Multiple teachers editing the same workspace.
 - Parent or student portals.
 - SMS, email, or WhatsApp delivery.
 - AI-generated predictions or recommendations.
 - Automatic school-wide database management.
 - Native Android or iOS applications.

 The existing landing page already has a good visual foundation. Its primary improvements should be to add the full feature coverage above, connect its main buttons to `markviz.html`, replace generic proof with real product facts, and make the local-storage limitation visible.

 ## 5. Suggested Product Taglines

 - Marks in. Insight out.
 - A clearer view of every student's progress.
 - From marks entry to meaningful reports.
 - One workspace for marks, analysis, and results.
