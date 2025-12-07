# Smart ZZP Hub - System Overview

## Project Description

Smart ZZP Hub is a comprehensive invoicing and administration platform for ZZP (Zelfstandige Zonder Personeel - Dutch freelancers) professionals and companies that work with them. The system manages worklogs, generates statements, creates legal invoices, and provides BTW (VAT) calculation tools to help freelancers and companies comply with Dutch tax regulations.

## Key Features

- **Worklog Management**: Companies track hours/work performed by ZZP freelancers
- **Statement Generation**: Automated weekly statements with status tracking (open, invoiced, paid)
- **Invoice Generation**: Legal Dutch invoice numbering (FACT-YYYY-NNNN format) with PDF export
- **BTW Calculation**: VAT calculation tools for both ZZP users and companies
- **Expense Tracking**: ZZP users track business expenses for tax deductions
- **Income Dashboard**: Quick overview of income, expenses, and net profit for ZZP users
- **AI Boekhouder (Analytics Engine)**: Comprehensive financial analysis with health scoring, volatility tracking, and personalized recommendations
- **Dual User Types**: Separate workflows for ZZP freelancers and companies

## Technology Stack

**Backend:**
- Node.js with Express
- PostgreSQL database
- JWT authentication
- PDFKit for invoice generation

**Frontend:**
- React (with JSX)
- Component-based architecture
- Dutch UI language, English code/comments

## Backend Modules

### Routes

1. **auth.routes.js** - Authentication & User Management
   - User registration (ZZP and Company)
   - Login with JWT token generation
   - Password hashing and validation

2. **btw.routes.js** - BTW (VAT) Calculations
   - BTW overview for periods (month/quarter/year)
   - Transaction lists with BTW breakdowns
   - CSV export functionality
   - Supports both ZZP and company scopes

3. **companies.routes.js** - Company Management
   - Company profile CRUD operations
   - Company-specific data retrieval

4. **expenses.routes.js** - Expense Tracking
   - ZZP expense logging
   - Expense retrieval and filtering
   - Used for BTW voorbelasting calculations

5. **invoices.routes.js** - Invoice Generation
   - PDF invoice generation with legal numbering
   - Duplication prevention (one invoice per statement)
   - Sequential numbering per year (FACT-YYYY-NNNN)
   - Invoice retrieval by statement

6. **statements.routes.js** - Statement Management
   - Weekly statement generation
   - Statement status updates (open → invoiced → paid)
   - Statement retrieval with filtering

7. **worklog.routes.js** - Worklog Management
   - Work entry creation
   - Worklog retrieval and filtering
   - Foundation for statement calculations

8. **zzp-users.routes.js** - ZZP User Management
   - ZZP profile management
   - User-company relationships

9. **aiAccountant.routes.js** - AI Boekhouder (Analytics Engine)
   - Comprehensive financial analysis endpoint
   - Monthly income/expense aggregation (up to 24 months)
   - Rolling averages (3m, 6m, 12m)
   - Volatility analysis (income stability)
   - Financial health scoring (0-100)
   - BTW calculations per quarter
   - Smart observations and recommendations
   - Question-aware insights

### Utilities

- **db/client.js** - PostgreSQL connection management
- **utils/week.js** - ISO week calculation utilities
- **utils/error.js** - Standardized error response helper
- **utils/calc.js** - Currency and BTW calculation helpers
- **middleware/auth.js** - JWT authentication middleware
- **config/jwt.js** - JWT configuration

## AI Boekhouder (Analytics Engine)

The AI Boekhouder is a sophisticated financial analysis system that provides ZZP users with deep insights into their business performance. Unlike simple calculators, it analyzes historical patterns, identifies trends, and provides context-aware recommendations.

### Key Capabilities

**Data Analysis:**
- Aggregates up to 24 months of financial history
- Calculates monthly income, expenses, and net profit
- Identifies best and worst performing months
- Tracks income volatility using standard deviation

**Financial Health Scoring:**
- Composite score (0-100) based on multiple factors:
  - Profit margin
  - Income stability (volatility)
  - Expense ratio
  - Growth trend
- Classification: "gezond" (healthy), "aandacht nodig" (attention needed), "risicovol" (risky)

**Smart Insights:**
- Observations: What is happening in your business
- Recommendations: What actions to take
- BTW planning: Quarterly tax obligations
- Buffer calculations: Emergency fund recommendations
- Question-aware responses: Adapts to user queries about pension, buffer, auto, etc.

**Analytics Provided:**
- Rolling averages (3-month, 6-month, 12-month)
- Income volatility measurement
- Profit margin percentage
- BTW breakdown per quarter
- Monthly trend visualization data
- Top 3 best months
- Worst 3 months (risk indicators)

## Frontend Pages

### ZZP User Pages

1. **/login** - Login Page
   - Email/password authentication
   - User type selection (ZZP/Company)
   - JWT token storage

2. **/statements** - Statements Overview
   - Weekly statement list with status
   - Invoice generation (opens PDF in new tab)
   - Invoice download (direct file download)
   - Invoice numbers displayed
   - BTW summary calculation
   - Expense tracking section
   - Link to Dashboard

3. **/dashboard** - Income Dashboard
   - Summary card: Total omzet, Total uitgaven, Netto winst
   - Recent paid statements table (last 5)
   - Recent expenses table (last 5)
   - Link back to Statements

4. **/btw** - BTW Overview
   - Period selection (month/quarter/year)
   - BTW summary cards (income, expenses, balance)
   - Transaction table with filtering
   - BTW over time chart
   - Category totals
   - CSV export
   - Link to BTW aangifte hulp

5. **/btw/aangifte** - BTW Aangifte Hulp (Declaration Helper)
   - Year and quarter selection
   - Calculated amounts for Belastingdienst portal:
     - Omzet exclusief BTW (21%)
     - BTW over omzet (21%)
     - Voorbelasting (BTW over kosten)
     - Te betalen BTW
   - Helper text explaining it's not an official declaration

### Company Pages

6. **/company/worklogs** - Worklog Management
   - Add new worklogs for ZZP users
   - View worklog history
   - Filter by ZZP user and date range

7. **/company/statements** - Statement Management
   - Generate statements for ZZP users by week
   - View statement history
   - Statement status tracking

8. **/company/btw** - Company BTW Overview
   - Similar to ZZP BTW but company-scoped
   - Period selection
   - Income-only BTW calculation (no expense deductions)
   - Transaction table
   - Chart visualization
   - Link to company BTW aangifte hulp

9. **/company/btw/aangifte** - Company BTW Aangifte Hulp
   - Year and quarter selection
   - Calculated amounts:
     - Omzet exclusief BTW (21%)
     - BTW over omzet (21%)
     - Te betalen BTW (no voorbelasting for companies)

### Shared Components

- **Header.jsx** - ZZP user navigation header with logout
- **CompanyHeader.jsx** - Company navigation header with logout

## Database Schema

### Core Tables

- **users** - Authentication and profile data
- **companies** - Company information
- **zzp_users** - ZZP freelancer profiles
- **worklogs** - Individual work entries
- **statements** - Weekly aggregated statements
- **expenses** - ZZP business expenses
- **invoices** - Generated invoice records with legal numbering

### Key Relationships

- Companies → ZZP Users (one-to-many)
- Companies → Worklogs → Statements (aggregation)
- Statements → Invoices (one-to-one)
- ZZP Users → Expenses (one-to-many)

## Authentication Flow

1. User logs in with email/password
2. Backend validates and returns JWT token
3. Frontend stores token and user info in localStorage
4. Protected routes check authentication on mount
5. ZZP users redirected to /login, companies to /

## Invoice Numbering System

- Format: **FACT-{year}-{sequence}**
- Example: FACT-2025-0007
- Sequential per year with 4-digit padding
- Stored in database to prevent duplicates
- One invoice per statement (duplication prevention)

## Localization

- **UI Text**: Dutch (Nederlands)
- **Code & Comments**: English
- **Date Format**: DD-MM-YYYY (Dutch)
- **Currency Format**: € 1.234,56 (Dutch)

## Key Business Rules

1. Statements are generated weekly (ISO week numbers)
2. BTW rate is 21% (Netherlands standard rate)
3. Invoice numbers are sequential per year, never reset
4. ZZP users can claim voorbelasting on expenses
5. Companies cannot claim voorbelasting in this system
6. Statement status flow: open → invoiced → paid
7. Once an invoice is generated, it cannot be regenerated
