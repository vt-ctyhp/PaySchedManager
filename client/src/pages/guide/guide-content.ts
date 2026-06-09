// Content model + data for the in-app User Guide (/guide).
// Keep this as plain data (no JSX) so it is easy to search and maintain.

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "subhead"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "bullets"; items: string[] }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "callout"; tone: "tip" | "note" | "warn"; text: string }
  | { type: "table"; head: string[]; rows: string[][] };

export type GuideSection = {
  id: string;
  title: string;
  /** lucide icon key, mapped to a component in the renderer */
  icon: string;
  /** one-line summary shown under the title + used for search */
  summary: string;
  /** extra search terms / synonyms */
  keywords?: string[];
  blocks: GuideBlock[];
};

const IMG = (name: string) => `/guide-assets/${name}`;

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "overview",
    title: "What this app is for",
    icon: "Info",
    summary: "A quick orientation to PaySchedManager and what problems it solves.",
    keywords: ["intro", "introduction", "purpose", "about", "getting started"],
    blocks: [
      {
        type: "p",
        text: "PaySchedManager tracks the money your business owes and pays out. You set up payment schedules (recurring or one-time obligations such as rent, loans, subscriptions, taxes, and vendor bills), then record payments against them as you pay. The dashboard turns all of that into forecasts, breakdowns, trends, and an attention list of problems — and keeps an audit trail of every change.",
      },
      {
        type: "p",
        text: "It answers questions like:",
      },
      {
        type: "bullets",
        items: [
          "How much do we spend per month on recurring commitments?",
          "What is due in the next 7 / 30 / 90 days, and to whom?",
          "What is overdue right now?",
          "Did we actually pay it — when, from which account, and who approved it?",
          "Is anything underpaid, overpaid, or paid late?",
        ],
      },
      {
        type: "p",
        text: "The app supports multiple internal companies (business units / entities), so one login can manage payments across an entire group.",
      },
    ],
  },
  {
    id: "big-picture",
    title: "The big picture: goal & how it works",
    icon: "Target",
    summary: "The goal of PaySchedManager and the simple loop the whole app runs on.",
    keywords: [
      "goal", "purpose", "how it works", "big picture", "model", "workflow", "loop",
      "reconcile", "reconciliation", "one-time", "recurring", "scheduled",
      "subscription", "auto-withdrawal", "credit card", "misc expenses", "ledger",
    ],
    blocks: [
      { type: "subhead", text: "The goal" },
      {
        type: "p",
        text: "PaySchedManager exists to answer three questions with confidence, at any moment, across every company you run: What do we owe? Did we pay it? Can we prove it? It replaces scattered spreadsheets and a dozen bank logins with one source of truth for your outgoing money — so bills get paid on time, from the right account, with documentation, and nothing slips through the cracks.",
      },
      { type: "subhead", text: "How it works — four moving parts" },
      { type: "p", text: "The whole app is built from four things that build on each other:" },
      {
        type: "bullets",
        items: [
          "Schedules — the plan. What you owe and when (rent, loans, subscriptions, taxes, vendor bills), recurring or one-time.",
          "Records — the reality. Proof that a payment actually happened: date, amount, account, method, approver, and attached confirmation.",
          "Dashboard — the comparison. It lines the plan up against reality: forecasts of what's due, what's overdue, and anything underpaid, overpaid, or late.",
          "Audit log — the trust layer. Every edit and deletion is recorded with a reason, so the numbers stay defensible.",
        ],
      },
      { type: "subhead", text: "The everyday loop" },
      {
        type: "steps",
        items: [
          "Set up once — your companies, the accounts you pay from, your vendors, and a schedule for each recurring or one-time obligation.",
          "Look ahead — the dashboard shows what's due in the next 7 / 30 / 90 days and to whom.",
          "Pay & record — log a payment when you pay: one at a time, or bulk-imported from a bank/card CSV.",
          "Reconcile — recording against a schedule moves it forward automatically (advances a recurring bill's next due date, or closes a one-time).",
          "Review — categorize, attach proof, and clear anything on the attention list (late / under / over).",
        ],
      },
      { type: "subhead", text: "One-time vs. scheduled — and how import helps" },
      {
        type: "bullets",
        items: [
          "Scheduled payments (rent, loans, subscriptions, auto-withdrawals) live as recurring schedules. Each payment you record advances the schedule to its next due date, so the forecast stays current without manual upkeep.",
          "One-time payments are tracked two ways: a one-time schedule for something you're planning, or a standalone payment record for a charge that already happened and isn't tied to any schedule.",
          "Importing transactions does both jobs at once — point it at a credit-card or bank CSV and it captures miscellaneous card spend as one-time records (categorize them on the History tab), and auto-matches recurring subscriptions and auto-withdrawals to their schedules by vendor name, recording the payment and reconciling the schedule in one step.",
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Matching is vendor-name based and ends with a quick Review step, so you confirm the high / medium / low-confidence matches before they're saved — auto-matched, not hand-resolved. See 'Importing transactions from CSV' for the full walkthrough.",
      },
      {
        type: "callout",
        tone: "tip",
        text: "It's a ledger, not a payment processor: PaySchedManager never moves money — it tracks what you owe and the proof that you paid it. One login spans every internal company, so the whole group's obligations live in one place.",
      },
    ],
  },
  {
    id: "concepts",
    title: "Key concepts & glossary",
    icon: "BookOpen",
    summary: "The eight terms and the status badges that make the rest of the app obvious.",
    keywords: [
      "glossary", "terms", "vocabulary", "definitions", "vendor", "expense id",
      "frequency", "internal company", "payment account", "expense type", "badge",
      "paid", "overdue", "due soon", "scheduled", "inactive",
    ],
    blocks: [
      { type: "p", text: "Understanding these terms makes everything else straightforward." },
      {
        type: "table",
        head: ["Term", "What it means"],
        rows: [
          ["Internal Company", "A business entity you pay FROM (e.g., Trans Fine Jewelry). Every schedule and account belongs to one. Has a short abbreviation, e.g. TFJ."],
          ["Payment Schedule (expense / obligation)", "A commitment to pay a vendor — recurring or one-time. Holds the amount, frequency, next due date, the account it pays from, and a unique Expense ID."],
          ["Payment Record", "Proof that a payment actually happened: date, amount, method, account, who approved it, and optional file attachments. Usually linked to a schedule."],
          ["Payment Account", "A bank account or card you pay WITH. Belongs to an internal company. Identified by its last 4 digits."],
          ["Vendor", "Who you pay TO (Netflix, a landlord, the IRS). Stored as a name plus a short abbreviation used to build the Expense ID."],
          ["Expense Type", "A category for analytics (Operating Expense, Rent, Tax, Subscription Services, Auto Loan, …)."],
          ["Payment Type / Method", "How money moves: Check, ACH, Wire, Credit Card, Debit Card, Bank Transfer, PayPal, Cash, etc."],
          ["Frequency", "How often a schedule repeats: one-time, weekly, bi-weekly, monthly, quarterly, yearly."],
        ],
      },
      { type: "subhead", text: "Status badges" },
      { type: "p", text: "These appear on schedules throughout the app:" },
      {
        type: "table",
        head: ["Badge", "Meaning"],
        rows: [
          ["Paid", "The obligation is settled / marked complete."],
          ["Due Soon", "Due within the next 7 days."],
          ["Overdue", "The due date has passed and no payment is recorded."],
          ["Scheduled", "Upcoming, but not within the 'due soon' window."],
          ["Inactive", "Switched off — excluded from all totals and forecasts."],
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "Expense IDs are generated automatically from the company/vendor abbreviations plus a sequence number, e.g. TFJ-TFJ-001. You never type them by hand — you only supply the vendor abbreviation (max 6 characters).",
      },
    ],
  },
  {
    id: "login",
    title: "Logging in & accounts",
    icon: "LogIn",
    summary: "Sign in, register, and switch themes.",
    keywords: ["sign in", "log in", "password", "username", "register", "create account", "theme", "dark mode", "light mode"],
    blocks: [
      { type: "p", text: "When you open the app you land on the sign-in screen." },
      { type: "image", src: IMG("01-login.png"), alt: "Login screen", caption: "The sign-in screen." },
      { type: "subhead", text: "To sign in" },
      {
        type: "steps",
        items: [
          "Enter your Username.",
          "Enter your Password.",
          "Click Sign In. You are taken straight to the dashboard.",
        ],
      },
      {
        type: "p",
        text: "Your session stays active until you log out (the logout button is in the dashboard header).",
      },
      { type: "subhead", text: "Creating an account" },
      {
        type: "p",
        text: "Click 'Don't have an account? Register' to switch the card into registration mode, then enter a username and password and click Create Account. In most deployments, new users are created by an administrator from Settings → Users so roles are assigned correctly. If you don't know your credentials, ask an admin to create your account.",
      },
      {
        type: "callout",
        tone: "tip",
        text: "The sun/moon toggle in the top-right corner switches between light and dark mode at any time — including on the login screen.",
      },
    ],
  },
  {
    id: "dashboard",
    title: "The dashboard at a glance",
    icon: "LayoutDashboard",
    summary: "The home screen, its header controls, and how the page is organised.",
    keywords: ["home", "header", "toolbar", "timeframe", "navigation", "logout", "add payment"],
    blocks: [
      { type: "p", text: "After signing in you see the Expense Dashboard — the hub for everything." },
      { type: "image", src: IMG("03-dashboard-header-kpis.png"), alt: "Dashboard header and KPI cards", caption: "The header, the four KPI cards, and the Overview/Schedules/History tabs." },
      { type: "subhead", text: "The header (top bar), left to right" },
      {
        type: "bullets",
        items: [
          "Title & subtitle — 'Expense Dashboard'.",
          "Timeframe selector — Next 7 Days / Next 30 Days / Next 90 Days / Next 12 Months. Controls the Upcoming KPI and the Upcoming Payments panel.",
          "Import Transactions — opens the CSV importer.",
          "Audit Log — opens the audit ledger (admins only).",
          "Settings (gear icon) — opens configuration.",
          "Logout — ends your session.",
          "+ Add Payment — the primary action; creates a new payment schedule.",
        ],
      },
      { type: "p", text: "Below the header are the four KPI cards and then the Overview / Schedules / History tabs." },
    ],
  },
  {
    id: "kpis",
    title: "The four KPI cards",
    icon: "Gauge",
    summary: "What each headline number means and what you see when you click it.",
    keywords: ["monthly run-rate", "run rate", "upcoming", "overdue", "paid this month", "metrics", "kpi", "drill"],
    blocks: [
      { type: "p", text: "Each card is a live number AND a button — click any card to drill into the exact items behind it." },
      {
        type: "table",
        head: ["Card", "What the number means", "Click to see…"],
        rows: [
          ["Monthly Run-Rate", "Every recurring schedule converted to a per-month amount and summed — your steady-state monthly spend.", "All recurring items with their monthly-equivalent amounts."],
          ["Upcoming", "Total due within the timeframe chosen in the header, with a count (e.g., '37 due · Next 30 Days').", "Every obligation due in that window."],
          ["Overdue", "Total past its due date with no recorded payment, plus the count of items.", "Every overdue item, so you can act on it."],
          ["Paid This Month", "Total of payment records dated in the current calendar month, with the count.", "Each payment recorded this month."],
        ],
      },
      { type: "callout", tone: "note", text: "Clicking a card opens the drill-down dialog described in the next section." },
    ],
  },
  {
    id: "overview-tab",
    title: "Overview tab — charts & panels",
    icon: "BarChart3",
    summary: "Forecast, breakdown, upcoming payments, the issues list, and the spending trend.",
    keywords: ["forecast", "breakdown", "donut", "pie", "chart", "spending trend", "issues", "upcoming payments", "late", "underpaid", "overpaid"],
    blocks: [
      { type: "p", text: "The Overview tab is the default view. It has four analytic regions plus a trend chart at the bottom." },
      { type: "image", src: IMG("02-dashboard-overview-full.png"), alt: "Full Overview tab", caption: "The complete Overview tab." },
      { type: "subhead", text: "Upcoming Expense Forecast (bar chart)" },
      { type: "p", text: "Projects total obligations for each of the next several months, including recurring repeats and one-time items. Click any bar/month to drill into every payment due that month." },
      { type: "subhead", text: "Expense Breakdown (donut chart)" },
      { type: "p", text: "Shows where the money goes. Use the Type · Company · Account toggle to regroup the same spend three ways. Click a slice to drill into that category. The legend lists each slice with its dollar amount and percentage." },
      { type: "subhead", text: "Upcoming Payments (operational panel)" },
      { type: "p", text: "Lists what's coming due within the header's timeframe. A List / By Company toggle switches between individual obligations (each with a Record Payment button) and totals grouped per company. A running subtotal sits at the bottom." },
      { type: "subhead", text: "Payment Issues (attention panel)" },
      { type: "p", text: "Your problem list. A red badge shows the issue count (green 'All clear' when there are none). Each card flags one of four problem types:" },
      {
        type: "table",
        head: ["Issue", "Trigger"],
        rows: [
          ["Overdue", "Past due with no payment recorded."],
          ["Late Payment", "A payment was recorded AFTER the scheduled due date."],
          ["Underpaid", "The latest payment was LESS than the scheduled amount."],
          ["Overpaid", "The latest payment was MORE than the scheduled amount."],
        ],
      },
      { type: "p", text: "Each card shows the vendor, company, amount, and a plain-English detail line. Click a card to open the full expense detail." },
      { type: "subhead", text: "Spending Trend (area chart)" },
      { type: "p", text: "Plots ACTUAL recorded payments by month for the recent past — what truly left your accounts, as opposed to what was merely scheduled. Click a month to drill into the payments recorded then." },
    ],
  },
  {
    id: "drilldowns",
    title: "Drill-downs & expense details",
    icon: "Search",
    summary: "The two dialogs that open when you click any number, bar, slice, or issue.",
    keywords: ["drilldown", "drill down", "expense detail", "details", "filter", "investigate"],
    blocks: [
      { type: "subhead", text: "Drill-down dialog" },
      { type: "p", text: "Opened from KPI cards, chart elements, and company rows. It lists every item behind the number you clicked." },
      { type: "image", src: IMG("04-drilldown.png"), alt: "Drill-down dialog", caption: "Drilling into 'Upcoming · Next 30 Days'." },
      {
        type: "bullets",
        items: [
          "A title describing the context (e.g., 'Upcoming · Next 30 Days').",
          "A search box (filter by vendor or account).",
          "All companies and All types dropdown filters.",
          "A table: Vendor · Company · Type · Account · Due date · Amount.",
          "A total of all rows shown, plus an item count.",
        ],
      },
      { type: "p", text: "Click any row to open its expense detail." },
      { type: "subhead", text: "Expense detail dialog" },
      { type: "p", text: "The full picture of a single schedule:" },
      { type: "image", src: IMG("05-expense-detail.png"), alt: "Expense detail dialog", caption: "Schedule details plus its full payment history." },
      {
        type: "bullets",
        items: [
          "Vendor name, Expense ID, status badge, and active/inactive state.",
          "A details table: company, expense type, amount, frequency, next due date, payment account, payment type.",
          "A payment history sub-table listing every recorded payment for that schedule (date, amount, method, account, days late, confirmation indicator).",
          "An Edit Schedule button (admins) that jumps straight to the edit form.",
        ],
      },
    ],
  },
  {
    id: "schedules",
    title: "Schedules tab — managing obligations",
    icon: "CalendarClock",
    summary: "Find, filter, and act on every obligation from the card grid.",
    keywords: ["schedules", "cards", "filter", "search", "recurring", "menu", "three dot"],
    blocks: [
      { type: "p", text: "The Schedules tab shows every obligation as a card grid." },
      { type: "image", src: IMG("06-schedules.png"), alt: "Schedules tab", caption: "The Schedules tab with filters and the card grid." },
      { type: "subhead", text: "Filter and find" },
      {
        type: "bullets",
        items: [
          "Filter toggle: All · Recurring · Due Soon · Overdue.",
          "Search by vendor, Expense ID, or company.",
        ],
      },
      { type: "p", text: "Each card shows the Expense ID, the vendor name, a status badge, the amount, the due date in relative terms ('Due in 3 days'), and the frequency. Inactive schedules appear dimmed." },
      { type: "subhead", text: "The card menu" },
      { type: "p", text: "The three-dot (⋯) menu on each card opens its actions:" },
      { type: "image", src: IMG("07-card-menu.png"), alt: "Schedule card menu", caption: "Record Payment, Edit, and Delete (admins) on each card." },
      {
        type: "bullets",
        items: [
          "Record Payment — log a payment against this schedule.",
          "Edit — change any field.",
          "Delete — remove the schedule (admins only; asks for confirmation).",
        ],
      },
      { type: "callout", tone: "note", text: "If you have no schedules yet, the tab shows an 'Add Your First Payment' button that opens the same form as + Add Payment." },
    ],
  },
  {
    id: "add-schedule",
    title: "Adding a payment schedule",
    icon: "PlusCircle",
    summary: "Create a new recurring or one-time obligation, field by field.",
    keywords: ["add payment", "new schedule", "create", "recurring", "one-time", "vendor abbreviation", "next due date"],
    blocks: [
      { type: "p", text: "Click + Add Payment in the header (or 'Add Your First Payment' on an empty Schedules tab)." },
      { type: "image", src: IMG("14-add-payment.png"), alt: "Add Payment Schedule dialog", caption: "The Add Payment Schedule form." },
      { type: "p", text: "Fill in the form (all fields are required unless noted):" },
      {
        type: "table",
        head: ["Field", "What to enter"],
        rows: [
          ["Internal Company", "The entity this obligation belongs to."],
          ["Expense Type", "The analytics category (Rent, Tax, Operating Expense, …)."],
          ["Vendor Name", "Who you're paying, e.g. Netflix, Adobe."],
          ["Vendor Abbreviation", "A short code (max 6 chars), e.g. NFLX. Used to build the Expense ID."],
          ["Payment Amount", "The dollar amount per occurrence."],
          ["Frequency", "one-time · weekly · bi-weekly · monthly · quarterly · yearly."],
          ["Payment Type", "The method you'll usually pay with (Check, ACH, Wire, …)."],
          ["Payment Account", "The account the money comes from."],
          ["Next Due Date", "The next date it's due. Future due dates are calculated automatically from the frequency."],
        ],
      },
      { type: "steps", items: ["Fill every field.", "Click Add Payment to save.", "The new schedule appears immediately on the Schedules tab and is counted in the KPIs and forecasts."] },
      {
        type: "callout",
        tone: "tip",
        text: "One-time schedules: if you choose frequency 'one-time', the Record Payment dialog opens automatically right after you save, with the date and amount pre-filled — so you can log the payment in the same step (or cancel if it isn't paid yet).",
      },
    ],
  },
  {
    id: "record-payment",
    title: "Recording a payment",
    icon: "Receipt",
    summary: "Tell the system an obligation was actually paid, with proof attached.",
    keywords: ["record payment", "pay", "check number", "approval", "confirmation", "upload", "attachment", "method"],
    blocks: [
      { type: "p", text: "Recording a payment is how you tell the system an obligation was actually paid. You can start it from several places:" },
      {
        type: "bullets",
        items: [
          "The ⋯ menu → Record Payment on a schedule card.",
          "The Record Payment button in the Upcoming Payments list.",
          "The Record Payment button on the History tab (for a payment not tied to a specific schedule).",
          "Automatically, right after creating a one-time schedule.",
        ],
      },
      { type: "image", src: IMG("08-record-payment.png"), alt: "Record Payment dialog", caption: "The Record Payment form (started from a schedule, so the Expense ID is locked)." },
      {
        type: "table",
        head: ["Field", "Notes"],
        rows: [
          ["Expense ID", "Shown locked when you started from a specific schedule. When recording a standalone payment you pick the Expense ID here."],
          ["Payment Date", "The date the payment was made (calendar picker)."],
          ["Payment Amount", "Pre-filled from the schedule; edit if you paid a different amount (this drives the underpaid / overpaid flags)."],
          ["Approved By (optional)", "The user who approved the payment."],
          ["Payment Method", "Check, ACH, Wire, Credit Card, Debit Card, Bank Transfer, PayPal, Cash, Other. When set to Check, the confirmation field captures the check #."],
          ["Payment Account (optional)", "The account it was paid from."],
          ["Approval Screenshot (optional)", "Upload proof of approval (email/Slack/approval-tool screenshot)."],
          ["Confirmation File (optional)", "Upload proof of payment (bank confirmation, receipt)."],
        ],
      },
      {
        type: "steps",
        items: [
          "Open the Record Payment dialog from any of the entry points above.",
          "Set the payment date.",
          "Confirm or adjust the amount.",
          "Choose the payment method and (optionally) the account.",
          "Optionally select who approved it and upload the approval/confirmation files.",
          "Click Record Payment.",
        ],
      },
      { type: "p", text: "The payment then appears on the History tab, counts toward Paid This Month and the Spending Trend, and updates the schedule's status." },
      { type: "callout", tone: "tip", text: "Attach the approval screenshot and confirmation file. They're optional, but they make the History tab self-documenting for audits." },
    ],
  },
  {
    id: "edit-delete-schedule",
    title: "Editing & deleting a schedule",
    icon: "Pencil",
    summary: "Change a schedule's fields, retire it with Inactive, or delete it.",
    keywords: ["edit schedule", "delete schedule", "inactive", "active", "retire", "update"],
    blocks: [
      { type: "subhead", text: "Editing" },
      { type: "p", text: "From a schedule card's ⋯ menu → Edit (or Edit Schedule in the expense detail dialog):" },
      { type: "image", src: IMG("09-edit-schedule.png"), alt: "Edit Payment Schedule dialog", caption: "The Edit form mirrors the Add form and adds an Is Active toggle." },
      { type: "p", text: "You can change the company, vendor name/abbreviation, amount, frequency, next due date, payment type, payment account, and expense type. The Is Active toggle controls whether the schedule counts:" },
      {
        type: "bullets",
        items: [
          "Active — the schedule counts in KPIs, forecasts, and the issues list.",
          "Inactive — kept for history but excluded from all totals. Use this to retire an obligation without deleting it.",
        ],
      },
      { type: "p", text: "Click Update to save." },
      { type: "subhead", text: "Deleting" },
      { type: "p", text: "⋯ menu → Delete (admins only) asks you to confirm. Deleting cannot be undone." },
      { type: "callout", tone: "warn", text: "Prefer Inactive over Delete when you want to keep the payment history." },
    ],
  },
  {
    id: "history",
    title: "History tab — recorded payments",
    icon: "History",
    summary: "The ledger of every payment that has actually been recorded.",
    keywords: ["history", "ledger", "payments", "timing", "late", "payer", "method"],
    blocks: [
      { type: "p", text: "The History tab is the ledger of every payment that has actually been recorded." },
      { type: "image", src: IMG("10-history.png"), alt: "History tab", caption: "The payment history table with export buttons." },
      { type: "p", text: "Columns: Date · Company / Vendor · Amount · Payer · Payment Method · Account · Category · Timing · Confirmation · Approval." },
      {
        type: "bullets",
        items: [
          "Method is shown as a colour-coded badge (Credit Card, Bank Transfer, …).",
          "Category is the payment's Expense Type (e.g., Rent, Payroll Taxes). Payments linked to a schedule show that schedule's category; one-time/imported payments show Uncategorized until you set one via Edit.",
          "Timing reads 'On time (due …)' or 'N day(s) late (due …)'.",
          "The Confirmation / Approval columns show whether files are attached.",
        ],
      },
      { type: "subhead", text: "Per-row actions" },
      {
        type: "bullets",
        items: [
          "View files — open/download attachments or add new ones.",
          "Edit — change the record, with a mandatory reason.",
          "Delete — remove the record, with a mandatory reason (admins only).",
        ],
      },
      { type: "p", text: "At the top of the table are Record Payment and the two Export buttons." },
    ],
  },
  {
    id: "edit-records",
    title: "Editing, deleting & attaching files to records",
    icon: "FileText",
    summary: "Controlled, logged changes to payment records, plus file management.",
    keywords: ["edit record", "delete record", "reason", "files", "attachments", "upload", "download", "audit"],
    blocks: [
      { type: "p", text: "Because payment records are financial facts, edits and deletions are controlled and logged." },
      { type: "subhead", text: "Editing a record" },
      { type: "image", src: IMG("11-edit-payment-record.png"), alt: "Edit payment record dialog", caption: "A reason for the edit is required and saved to the audit log." },
      { type: "p", text: "Click Edit on a History row. Update the amount, payment date, method, account, category, and 'approved by'. A Reason for edit is required — it, with a before/after snapshot, is written to the audit log. Click Update." },
      { type: "p", text: "Setting a category (Expense Type): the Category dropdown classifies any payment — this is the only way to categorize an imported one-time payment that isn't tied to a schedule. For a payment linked to a schedule, the category defaults to the schedule's Expense Type; changing it here overrides this one payment only (the schedule is untouched). Choosing Uncategorized on a linked payment makes it fall back to the schedule's Expense Type. Categories come from the Expense Types list in Settings." },
      { type: "subhead", text: "Deleting a record" },
      { type: "image", src: IMG("13-delete-payment-record.png"), alt: "Delete payment record dialog", caption: "Deletions require a reason and are recorded in the audit log." },
      { type: "p", text: "Click Delete on a History row (admins only). A reason is required and the deletion is recorded with a snapshot of what was removed. This is not an undo — be sure before confirming." },
      { type: "subhead", text: "Managing files" },
      { type: "image", src: IMG("12-manage-files.png"), alt: "Manage payment files dialog", caption: "Download or add the approval screenshot and confirmation file after the fact." },
      { type: "p", text: "Click View files on a History row to download an existing approval screenshot or confirmation file, or upload one to add/replace it. This is how you back-fill documentation on payments recorded without attachments." },
    ],
  },
  {
    id: "csv-import",
    title: "Importing transactions from CSV",
    icon: "Upload",
    summary: "Bulk-record payments from a bank or card CSV export in three steps.",
    keywords: ["csv", "import", "bank", "upload", "mapping", "confidence", "match", "bulk"],
    blocks: [
      { type: "p", text: "Instead of recording payments one at a time, you can bulk-import them from a bank/card CSV export. Click Import Transactions in the header." },
      { type: "image", src: IMG("15-csv-import.png"), alt: "CSV import upload step", caption: "Step 1 — drag and drop a CSV file (max 10 MB)." },
      { type: "subhead", text: "The three-step wizard" },
      {
        type: "steps",
        items: [
          "Upload — drag and drop a CSV onto the box, or click Browse Files. Maximum file size 10 MB.",
          "Map accounts — match each unique bank-account name in your CSV to one of your Payment Accounts. Save these as Account Mappings so future imports recognise them automatically.",
          "Review & import — each transaction is matched to a schedule and labelled with a confidence level (high / medium / low / unmatched). Tick which to record, bulk-assign an internal company, then click Import.",
        ],
      },
      { type: "p", text: "Imported transactions behave exactly like manually recorded payments (they appear in History, count toward totals, and get flagged if late/under/over)." },
      { type: "callout", tone: "tip", text: "Get matching right once: the better your Account Mappings and last-4 digits, the higher the auto-match confidence and the less manual review each import needs." },
      { type: "callout", tone: "tip", text: "Categories on imports: transactions that match a schedule inherit that schedule's Category automatically. Unmatched (one-time) imports come in as Uncategorized — open the row's Edit dialog to assign a Category." },
    ],
  },
  {
    id: "export",
    title: "Exporting reports (CSV & PDF)",
    icon: "Download",
    summary: "Download payment history for accounting or sharing.",
    keywords: ["export", "csv", "pdf", "report", "download", "reconcile"],
    blocks: [
      { type: "p", text: "On the History tab, two buttons export your payment records:" },
      {
        type: "bullets",
        items: [
          "Export CSV — downloads a spreadsheet of all payment records (for Excel/Sheets, accounting, or reconciliation).",
          "Export PDF — downloads a formatted, printable report of payment history.",
        ],
      },
      { type: "callout", tone: "note", text: "Use the tab filters/search first if you want to export a focused subset rather than everything." },
    ],
  },
  {
    id: "settings",
    title: "Settings — companies, accounts, types, users",
    icon: "Settings",
    summary: "Configure the lists that power the rest of the app.",
    keywords: ["settings", "companies", "accounts", "bank", "account mappings", "payment types", "expense types", "users", "roles", "configuration"],
    blocks: [
      { type: "p", text: "Click the gear (Settings) icon in the header. Settings is organised into tabs." },
      { type: "subhead", text: "Internal Companies" },
      { type: "image", src: IMG("16-settings-companies.png"), alt: "Settings — Internal Companies", caption: "The list of entities you pay from." },
      { type: "p", text: "Click + Add Company and provide a Company Name and Abbreviation." },
      { type: "image", src: IMG("17-add-company.png"), alt: "Add company dialog" },
      { type: "subhead", text: "Payment Accounts" },
      { type: "image", src: IMG("18-settings-accounts.png"), alt: "Settings — Payment Accounts", caption: "The bank accounts and cards you pay with." },
      { type: "p", text: "Click Add Account to create one:" },
      { type: "image", src: IMG("19-add-account.png"), alt: "Add account dialog" },
      {
        type: "table",
        head: ["Field", "Notes"],
        rows: [
          ["Internal Company", "Which entity owns the account."],
          ["Bank", "Pick an existing bank, or click Add Bank to create one inline (bank name + nickname)."],
          ["Account Type", "Checking, Savings, Credit, Other, etc."],
          ["Last 4 Digits (optional)", "The account's last four digits — the key the app uses to match accounts during CSV import."],
          ["Account Name", "Generated automatically from company + bank + type + last 4 (read-only preview)."],
        ],
      },
      { type: "subhead", text: "Account Mappings" },
      { type: "image", src: IMG("20-settings-account-mappings.png"), alt: "Settings — Account Mappings", caption: "Map CSV account names to your Payment Accounts." },
      { type: "p", text: "Click Add Mapping, enter the CSV Account Name exactly as it appears in your file, and choose the Payment Account it corresponds to. Existing mappings can be edited or deleted." },
      { type: "subhead", text: "Payment Types" },
      { type: "image", src: IMG("21-settings-payment-types.png"), alt: "Settings — Payment Types", caption: "The methods available in the Record Payment form." },
      { type: "subhead", text: "Expense Types" },
      { type: "image", src: IMG("22-settings-expense-types.png"), alt: "Settings — Expense Types", caption: "The categories used in forms and the Expense Breakdown chart." },
      { type: "subhead", text: "Users (admin only)" },
      { type: "image", src: IMG("23-settings-users.png"), alt: "Settings — Users", caption: "Manage who can sign in." },
      { type: "p", text: "Click Add User to create an account with a username, password, and role:" },
      { type: "image", src: IMG("24-add-user.png"), alt: "Add user dialog" },
      {
        type: "bullets",
        items: [
          "Admin — full access, including deletes, the audit log, and user management.",
          "User — can view, add schedules, and record/edit payments, but cannot delete or manage users.",
        ],
      },
    ],
  },
  {
    id: "audit",
    title: "The audit log",
    icon: "ShieldCheck",
    summary: "A tamper-evident record of every edit and deletion of a payment record.",
    keywords: ["audit", "ledger", "history", "changes", "before", "after", "snapshot", "compliance"],
    blocks: [
      { type: "p", text: "Open it from Audit Log in the header (admins only)." },
      { type: "image", src: IMG("25-audit-log.png"), alt: "Audit log", caption: "The Payment Audit Ledger (empty until the first edit/deletion)." },
      { type: "p", text: "The Payment Audit Ledger records every edit and deletion of a payment record. When entries exist, each row shows the timestamp, the action (Edited / Deleted), the payment ID, the reason that was entered, who performed it, and an expandable before/after snapshot. Newest entries are listed first." },
      { type: "callout", tone: "note", text: "A fresh system shows 'No audit entries yet.' — the ledger fills in the first time someone edits or deletes a payment record." },
    ],
  },
  {
    id: "roles",
    title: "Roles & permissions",
    icon: "Users",
    summary: "Exactly what a User can do versus an Admin.",
    keywords: ["roles", "permissions", "admin", "user", "access", "who can"],
    blocks: [
      { type: "p", text: "Admin-only controls simply don't appear for regular users (for example, the Audit Log button and delete buttons are hidden)." },
      {
        type: "table",
        head: ["Capability", "User", "Admin"],
        rows: [
          ["View dashboard, charts, drill-downs", "Yes", "Yes"],
          ["Add / edit payment schedules", "Yes", "Yes"],
          ["Record payments, attach files", "Yes", "Yes"],
          ["Edit payment records (with reason)", "Yes", "Yes"],
          ["Import CSV, export CSV/PDF", "Yes", "Yes"],
          ["Manage Settings lists (companies, accounts, types, mappings)", "Yes", "Yes"],
          ["Delete schedules / payment records", "No", "Yes"],
          ["View the audit log", "No", "Yes"],
          ["Manage users", "No", "Yes"],
        ],
      },
    ],
  },
  {
    id: "recipes",
    title: "End-to-end workflows (recipes)",
    icon: "ListChecks",
    summary: "Common tasks as numbered, do-this-then-that recipes.",
    keywords: ["workflow", "recipe", "setup", "how to", "month end", "reconcile", "first time"],
    blocks: [
      { type: "subhead", text: "A — First-time setup" },
      {
        type: "steps",
        items: [
          "Settings → Internal Companies: add each entity you pay from.",
          "Settings → Payment Accounts: add each bank/card (add banks inline; include last-4 digits to enable CSV matching).",
          "Settings → Payment Types and Expense Types: make sure the methods and categories you use exist.",
          "Optional — Settings → Account Mappings: pre-map your bank's CSV account names.",
          "Admin — Settings → Users: create logins for your team with the right roles.",
        ],
      },
      { type: "subhead", text: "B — Add a recurring bill (e.g., monthly rent)" },
      {
        type: "steps",
        items: [
          "Click + Add Payment.",
          "Set Company, Expense Type = Rent, Vendor name/abbr, Amount, Frequency = monthly, Payment Type, Payment Account, Next Due Date.",
          "Click Add Payment. It now appears on Schedules and in the forecast.",
        ],
      },
      { type: "subhead", text: "C — Pay a bill and log it" },
      {
        type: "steps",
        items: [
          "Find the schedule (Schedules tab or the Upcoming Payments panel).",
          "Click Record Payment.",
          "Set the date, confirm/adjust the amount, choose the method and account, add approver and files.",
          "Click Record Payment. It moves into History and updates the KPIs.",
        ],
      },
      { type: "subhead", text: "D — Log a one-time payment" },
      {
        type: "steps",
        items: [
          "Click + Add Payment, set Frequency = one-time, fill the rest, click Add Payment.",
          "The Record Payment dialog opens automatically — complete it and save.",
        ],
      },
      { type: "subhead", text: "E — Month-end reconciliation from the bank" },
      {
        type: "steps",
        items: [
          "Export your bank/card transactions to CSV.",
          "Import Transactions → upload → map accounts → review confidence and selection → Import.",
          "Check the Payment Issues panel for anything late/under/over and resolve it.",
        ],
      },
      { type: "subhead", text: "F — Correct a payment with an audit trail" },
      {
        type: "steps",
        items: [
          "History → Edit on the row.",
          "Change the fields and enter a Reason for edit.",
          "Click Update. The change is now visible in the Audit Log with before/after snapshots.",
        ],
      },
    ],
  },
  {
    id: "faq",
    title: "Frequently asked questions",
    icon: "HelpCircle",
    summary: "Quick answers to the most common questions.",
    keywords: ["faq", "questions", "why", "how", "difference"],
    blocks: [
      { type: "subhead", text: "Why is an item 'Overdue' when I already paid it?" },
      { type: "p", text: "Because no payment record is logged against it yet. Record the payment and the status updates." },
      { type: "subhead", text: "What's the difference between Monthly Run-Rate and Upcoming?" },
      { type: "p", text: "Run-Rate is the steady monthly cost of all recurring schedules (normalised to a month). Upcoming is the actual total due inside the timeframe you pick in the header, recurring or not." },
      { type: "subhead", text: "Why doesn't a schedule show up in totals?" },
      { type: "p", text: "It's probably Inactive. Open it (Edit) and turn Is Active on. Inactive schedules are intentionally excluded." },
      { type: "subhead", text: "How are Underpaid vs Overpaid decided?" },
      { type: "p", text: "By comparing the payment record amount to the scheduled amount. Edit the amount on either the record or the schedule so they reflect reality." },
      { type: "subhead", text: "How is the Expense ID created?" },
      { type: "p", text: "Automatically from the company/vendor abbreviations plus a sequence number (e.g., TFJ-TFJ-001). You only supply the vendor abbreviation (max 6 chars)." },
      { type: "subhead", text: "Where do check numbers go?" },
      { type: "p", text: "In the Record Payment dialog, set Payment Method = Check; the confirmation field then captures the check #." },
      { type: "subhead", text: "Does changing the timeframe change my data?" },
      { type: "p", text: "No. It only changes the window used by the Upcoming KPI and the Upcoming Payments panel. Nothing is modified." },
      { type: "subhead", text: "Who can see the Audit Log?" },
      { type: "p", text: "Admins only. It's empty until the first payment-record edit or deletion happens." },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: "Wrench",
    summary: "Symptoms and fixes for common snags.",
    keywords: ["troubleshoot", "problem", "error", "not showing", "missing", "fix", "rejected"],
    blocks: [
      {
        type: "table",
        head: ["Symptom", "Fix"],
        rows: [
          ["A new schedule/payment isn't showing up", "Refresh the tab; confirm the schedule is Active; for Upcoming, check the timeframe selector covers its due date."],
          ["An account isn't available when recording a payment", "Add it in Settings → Payment Accounts first."],
          ["A company / expense type / payment type is missing from a dropdown", "Add it under the matching Settings tab."],
          ["CSV upload rejected", "File must be CSV and under 10 MB."],
          ["CSV rows show 'unmatched' / low confidence", "Add an Account Mapping and the account's last-4 digits; confirm low-confidence rows manually."],
          ["I can't see Delete / Audit Log / Users", "Those are admin-only. Ask an administrator."],
          ["Numbers look wrong after an edit", "Open the Audit Log to see what changed, when, and why."],
          ["I'm stuck in dark/light mode", "Toggle the sun/moon button (top-right)."],
        ],
      },
    ],
  },
];
