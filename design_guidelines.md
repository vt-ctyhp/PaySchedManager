# Design Guidelines: Payment Tracking Application

## Design Approach
**Reference-Based Approach** drawing from modern productivity tools (Linear, Notion) combined with financial app trust patterns. This utility-focused application prioritizes clarity, organization, and efficient data management while maintaining a professional, trustworthy aesthetic appropriate for financial tracking.

## Core Design Principles
1. **Clarity First**: Financial data demands absolute readability and zero ambiguity
2. **Scannable Hierarchies**: Users should quickly identify payment statuses, amounts, and due dates
3. **Purposeful Color**: Use color strategically to communicate payment states (due, overdue, paid)
4. **Data Density Balance**: Present comprehensive information without overwhelming users

## Color Palette

### Dark Mode (Primary)
- **Background Base**: 222 15% 10% (deep charcoal)
- **Surface Elevated**: 222 13% 14% (card backgrounds)
- **Surface Hover**: 222 12% 18% (interactive states)
- **Text Primary**: 0 0% 95%
- **Text Secondary**: 220 9% 65%
- **Border Subtle**: 222 13% 20%

### Semantic Colors
- **Success/Paid**: 142 70% 45% (green - paid status)
- **Warning/Due Soon**: 38 92% 50% (amber - payment due within 7 days)
- **Critical/Overdue**: 0 84% 60% (red - overdue payments)
- **Primary Action**: 221 83% 53% (blue - CTAs, links)
- **Neutral/Scheduled**: 220 13% 50% (gray - upcoming payments)

### Light Mode
- **Background Base**: 0 0% 98%
- **Surface Elevated**: 0 0% 100%
- **Text Primary**: 222 20% 15%
- **Text Secondary**: 220 9% 45%
- Semantic colors remain consistent with adjusted luminosity for contrast

## Typography

**Font Stack**: 
- Primary: 'Inter' (Google Fonts) - numbers, data, UI
- Monospace: 'JetBrains Mono' (Google Fonts) - amounts, account numbers

**Type Scale**:
- Display (Dashboard Title): text-3xl font-semibold (30px)
- Heading (Section/Card Titles): text-xl font-semibold (20px)
- Subheading (Company Names): text-base font-medium (16px)
- Body (Details, Descriptions): text-sm (14px)
- Caption (Metadata, Timestamps): text-xs text-secondary (12px)
- Amounts: text-lg font-mono font-semibold (tabular numbers)

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: p-4 or p-6
- Section gaps: gap-4 or gap-6
- Page margins: px-6 md:px-8 lg:px-12
- Card spacing: space-y-4

**Grid Structure**:
- Main dashboard: 3-column responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Payment cards: Full-width on mobile, adaptive on desktop
- Form layouts: Single column with max-w-2xl centering
- Table view: Full-width with horizontal scroll on mobile

## Component Library

### Navigation
- **Top Bar**: Fixed header with app title, quick actions (Add Payment), user menu
- **Sidebar** (Desktop): Persistent navigation with Dashboard, All Schedules, Payment History, Settings
- **Bottom Nav** (Mobile): 4 primary actions with icons

### Dashboard Cards
- **Payment Schedule Card**: Elevated surface (shadow-sm) with:
  - Company name (prominent, text-lg)
  - Payment amount (text-2xl font-mono font-bold)
  - Due date with countdown badge
  - Frequency indicator (pill badge)
  - Status color bar (4px left border)
  - Quick actions menu (ellipsis icon)

### Data Display
- **Status Badges**: Rounded-full px-3 py-1 with semantic colors and icons
  - Paid (green): checkmark icon
  - Due Soon (amber): clock icon
  - Overdue (red): alert icon
  - Scheduled (neutral): calendar icon

- **Payment History Table**: Striped rows with:
  - Date (font-mono)
  - Amount (font-mono, prominent)
  - Company
  - Payment method badge
  - Confirmation file link/preview
  - Sticky header on scroll

### Forms & Input
- **Add/Edit Payment Modal**: Centered overlay (max-w-2xl) with:
  - Clear section divisions
  - Grouped related fields
  - Inline validation
  - File upload dropzone with preview
  - Primary/Secondary action buttons

- **Input Fields**: Consistent styling
  - Label above (text-sm font-medium)
  - Input with border focus ring (ring-2 ring-primary)
  - Helper text below (text-xs text-secondary)
  - Error states (border-red, text-red)

### Interactive Elements
- **Primary Buttons**: bg-primary hover:bg-primary/90, rounded-lg px-6 py-2.5
- **Secondary Buttons**: border border-border hover:bg-surface-hover
- **Icon Buttons**: p-2 rounded-md hover:bg-surface-hover
- **Dropdown Menus**: Elevated (shadow-lg), rounded-lg, border

### Visual Indicators
- **Payment Timeline**: Horizontal timeline showing upcoming payments (next 30 days)
- **Quick Stats Cards**: 2x2 grid showing total scheduled, paid this month, upcoming this week, overdue
- **Progress Rings**: Circular progress for recurring payment cycles

## Animations
**Minimal and Purposeful**:
- Modal/drawer entry: slide-in (150ms ease-out)
- Toast notifications: slide-down (200ms)
- Card hover: subtle lift (transform scale-[1.01], 100ms)
- Loading states: skeleton screens (no spinners)
- Status changes: smooth color transitions (300ms)

## Key Screens

### Dashboard
- Quick stats grid (top)
- Payment timeline (middle)
- Upcoming payments cards in 3-column grid
- Filter chips (All, Recurring, One-time, Overdue)

### All Schedules
- Table view with sortable columns
- Advanced filters sidebar (frequency, company, status)
- Bulk actions toolbar (when items selected)

### Record Payment
- Two-step flow: 
  1. Select existing schedule OR create new
  2. Payment details form with file upload

### Payment History
- Chronological list/table view
- Search and filter by date range, company, method
- Export functionality

## Images
**No hero image** - this is a utility dashboard. Images used only for:
- Empty states: Simple illustrations for "No payments scheduled" (use placeholder comments)
- File upload previews: PDF/image thumbnails
- Company logos: Optional small icons in payment cards (32x32px)