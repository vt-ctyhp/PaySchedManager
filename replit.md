# Payment Tracking Application

## Overview

A full-stack payment tracking application for managing recurring and one-time payment schedules. The application allows users to track internal companies, payment accounts, payment types, and expense categories, with the ability to schedule payments and record payment history. Built with a focus on clarity and organization for financial data management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18+ with TypeScript for type safety
- Vite as the build tool and development server
- Client-side routing using Wouter (lightweight React router)
- Hot Module Replacement (HMR) enabled in development

**UI Component System**
- Shadcn/UI component library with Radix UI primitives
- Custom design system based on "new-york" style
- Tailwind CSS for styling with CSS variables for theming
- Dark mode support with theme toggle functionality
- Design inspired by Linear and Notion for productivity-focused UX

**State Management**
- TanStack Query (React Query) for server state management
- Query invalidation strategy for real-time data updates
- Custom query client with specific refetch policies (disabled window focus refetch, infinite stale time)
- Form state handled by React Hook Form with Zod validation

**Key Design Patterns**
- Component composition with reusable UI primitives
- Custom hooks for shared logic (useToast, useIsMobile)
- Toast notifications for user feedback
- Responsive design with mobile-first approach

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for the REST API
- HTTP server creation using Node's native `http` module
- ESM (ECMAScript Modules) for modern JavaScript imports

**API Design**
- RESTful endpoints following resource-based patterns
- CRUD operations for all entities (Internal Companies, Payment Accounts, Payment Types, Expense Types, Payment Schedules, Payment Records)
- JSON request/response format
- Request logging middleware for debugging
- Error handling middleware with status code propagation

**Database Layer**
- Drizzle ORM for type-safe database queries
- PostgreSQL as the database (configured for Neon serverless)
- Schema-first approach with Drizzle Zod integration for validation
- UUID primary keys with `gen_random_uuid()` default values
- Database migrations stored in `/migrations` directory

**Data Models**
1. **Internal Companies** - Organizations making payments (name, abbreviation)
2. **Payment Accounts** - Payment methods (name, account type, last four digits)
3. **Payment Types** - Categories of payment methods
4. **Expense Types** - Categories of expenses
5. **Payment Schedules** - Recurring/one-time payment definitions (vendor, amount, frequency, due date)
6. **Payment Records** - Historical payment logs

**Storage Abstraction**
- Interface-based storage layer (`IStorage`) for database operations
- Separation of concerns between route handlers and data access
- CRUD operations abstracted into storage service methods

### Development & Build Process

**Development Mode**
- Vite dev server with middleware mode integration
- Express server proxies requests to Vite for HMR
- TSX for running TypeScript server code directly
- Replit-specific plugins for error overlay and development banner

**Production Build**
- Client: Vite builds to `dist/public`
- Server: esbuild bundles to `dist/index.js` with external packages
- Static file serving in production mode
- Platform-node bundle format for server code

**Type Safety**
- Shared types between client and server via `@shared` alias
- Zod schemas for runtime validation and TypeScript inference
- Drizzle schema generates TypeScript types automatically

## External Dependencies

### Database & ORM
- **PostgreSQL** - Primary database (Neon serverless deployment)
- **Drizzle ORM** - Type-safe database queries and migrations
- **@neondatabase/serverless** - Serverless PostgreSQL driver

### UI Component Libraries
- **Radix UI** - Headless accessible UI primitives (20+ components)
- **Shadcn/UI** - Pre-styled component system
- **Lucide React** - Icon library
- **Tailwind CSS** - Utility-first CSS framework

### Form & Validation
- **React Hook Form** - Form state management
- **Zod** - Schema validation for forms and API
- **@hookform/resolvers** - React Hook Form Zod integration

### State Management & Data Fetching
- **TanStack Query** - Server state management and caching
- **Wouter** - Lightweight client-side routing

### Date & Time
- **date-fns** - Date manipulation and formatting

### Development Tools
- **Vite** - Build tool and dev server
- **esbuild** - Server bundler for production
- **TSX** - TypeScript execution for development
- **Replit plugins** - Development experience enhancements (cartographer, error modal, dev banner)

### Styling & Design
- **class-variance-authority** - Type-safe variant API for components
- **clsx** / **tailwind-merge** - Conditional class name utilities
- **cmdk** - Command menu component
- **embla-carousel-react** - Carousel component

### Fonts
- **Inter** - Primary UI font (Google Fonts)
- **JetBrains Mono** - Monospace font for numbers and amounts (Google Fonts)