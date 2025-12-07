# Smart ZZP Hub - API Routes Documentation

## Authentication Routes (`/api/auth`)

### POST /api/auth/register
Register a new user (ZZP or Company)

**Body Parameters:**
- `email` (string, required) - User email address
- `password` (string, required) - User password
- `fullName` (string, required) - Full name
- `userType` (string, required) - "zzp" or "company"
- `companyName` (string, optional) - Required if userType is "company"
- `kvkNumber` (string, optional) - Company KVK number
- `btwNumber` (string, optional) - Company BTW number

**Response:** User object with JWT token

---

### POST /api/auth/login
Authenticate a user

**Body Parameters:**
- `email` (string, required) - User email
- `password` (string, required) - User password

**Response:** User object with JWT token

---

## BTW (VAT) Routes (`/api/btw`)

### GET /api/btw/overview
Get BTW overview for a company for a specific period

**Query Parameters:**
- `companyId` (UUID, required) - Company ID
- `period` (string, required) - "month", "quarter", or "year"
- `year` (number, required) - Year (2000-2100)
- `value` (number, optional) - Month (1-12) or Quarter (1-4), required for month/quarter

**Response:**
```json
{
  "subtotal": 1000.00,
  "btw": 210.00,
  "net": 1210.00,
  "period": "quarter",
  "year": 2024,
  "value": 4,
  "startDate": "2024-10-01",
  "endDate": "2024-12-31"
}
```

---

### GET /api/btw/export
Export BTW data as CSV

**Query Parameters:**
- `scope` (string, required) - "zzp" or "company"
- `zzpId` (UUID) - Required when scope=zzp
- `companyId` (UUID) - Required when scope=company
- `period` (string, required) - "month", "quarter", or "year"
- `year` (number, required) - Year
- `value` (number, optional) - Period value

**Response:** CSV file download

---

### GET /api/btw/transactions
Get detailed BTW transactions

**Query Parameters:**
- `scope` (string, required) - "zzp" or "company"
- `zzpId` (UUID) - Required when scope=zzp
- `companyId` (UUID) - Required when scope=company
- `period` (string, required) - "month", "quarter", or "year"
- `year` (number, required) - Year
- `value` (number, optional) - Period value

**Response:**
```json
{
  "transactions": [...],
  "summary": {
    "totalIncome": 10000.00,
    "totalExpenses": 500.00,
    "netIncome": 9500.00,
    "btwReceived": 2100.00,
    "btwPaid": 105.00,
    "btwBalance": 1995.00
  },
  "categoryTotals": {...}
}
```

---

## Company Routes (`/api/companies`)

### POST /api/companies
Create a new company

**Body Parameters:**
- `userId` (UUID, required) - Associated user ID
- `name` (string, required) - Company name
- `kvkNumber` (string, optional) - KVK number
- `btwNumber` (string, optional) - BTW number
- `email` (string, optional) - Contact email
- `phone` (string, optional) - Contact phone

**Response:** Created company object

---

### GET /api/companies/:id
Get company details

**URL Parameters:**
- `id` (UUID) - Company ID

**Response:** Company object

---

### GET /api/companies
List all companies

**Response:** Array of company objects

---

## Expense Routes (`/api/expenses`)

### POST /api/expenses
Create a new expense

**Body Parameters:**
- `zzpId` (UUID, required) - ZZP user ID
- `expenseDate` (date, required) - Date of expense
- `category` (string, required) - Expense category
- `amount` (number, required) - Expense amount
- `notes` (string, optional) - Additional notes

**Response:** Created expense object

---

### GET /api/expenses
Get expenses for a ZZP user

**Query Parameters:**
- `zzpId` (UUID, required) - ZZP user ID

**Response:**
```json
{
  "items": [...],
  "total": 500.00
}
```

---

### DELETE /api/expenses/:id
Delete an expense

**URL Parameters:**
- `id` (UUID) - Expense ID

**Response:** Success confirmation

---

## Invoice Routes (`/api/invoices`)

### POST /api/invoices/generate
Generate an invoice for a statement

**Body Parameters:**
- `statementId` (UUID, required) - Statement ID

**Response:**
```json
{
  "invoiceId": "uuid",
  "invoiceNumber": "FACT-2025-0007",
  "statementId": "uuid",
  "year": 2024,
  "weekNumber": 48,
  "subtotal": 1000.00,
  "btw": 210.00,
  "total": 1210.00,
  "pdf": "base64-encoded-pdf",
  "isExisting": false,
  "createdAt": "2024-12-06T..."
}
```

**Notes:**
- Checks for existing invoice first
- If exists, returns metadata without PDF
- Sequential numbering: FACT-{year}-{sequence}
- Stores invoice record in database

---

### GET /api/invoices/by-statement/:statementId
Get invoice information for a statement

**URL Parameters:**
- `statementId` (UUID) - Statement ID

**Response:**
```json
{
  "id": "uuid",
  "invoice_number": "FACT-2025-0007",
  "file_url": null,
  "created_at": "2024-12-06T..."
}
```

---

## Statement Routes (`/api/statements`)

### POST /api/statements
Create a new statement

**Body Parameters:**
- `companyId` (UUID, required) - Company ID
- `zzpId` (UUID, optional) - ZZP user ID (omit for all ZZP users)
- `year` (number, required) - Year
- `weekNumber` (number, required) - Week number (1-53)

**Response:** Created statement object

---

### GET /api/statements
Get statements

**Query Parameters:**
- `zzpId` (UUID, optional) - Filter by ZZP user
- `companyId` (UUID, optional) - Filter by company
- `status` (string, optional) - Filter by status ("open", "invoiced", "paid")

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "zzp_id": "uuid",
      "year": 2024,
      "week_number": 48,
      "total_amount": 1000.00,
      "currency": "EUR",
      "status": "open",
      "created_at": "..."
    }
  ]
}
```

---

### PATCH /api/statements/:id
Update statement status

**URL Parameters:**
- `id` (UUID) - Statement ID

**Body Parameters:**
- `status` (string, required) - New status ("open", "invoiced", "paid")

**Response:** Updated statement object

---

## Worklog Routes (`/api/worklogs`)

### POST /api/worklogs
Create a new worklog entry

**Body Parameters:**
- `companyId` (UUID, required) - Company ID
- `zzpId` (UUID, required) - ZZP user ID
- `workDate` (date, required) - Date of work
- `tariffType` (string, required) - Tariff type (e.g., "Normaal", "Avond")
- `quantity` (number, required) - Hours worked
- `unitPrice` (number, required) - Hourly rate
- `currency` (string, optional) - Currency code (default: "EUR")
- `notes` (string, optional) - Additional notes

**Response:** Created worklog object

---

### GET /api/worklogs
Get worklogs

**Query Parameters:**
- `companyId` (UUID, optional) - Filter by company
- `zzpId` (UUID, optional) - Filter by ZZP user
- `startDate` (date, optional) - Filter from date
- `endDate` (date, optional) - Filter to date

**Response:**
```json
{
  "items": [...],
  "total": 1000.00
}
```

---

## ZZP User Routes (`/api/zzp-users`)

### POST /api/zzp-users
Create a new ZZP user profile

**Body Parameters:**
- `userId` (UUID, required) - Associated user ID
- `companyId` (UUID, required) - Associated company ID
- `fullName` (string, required) - Full name
- `email` (string, optional) - Contact email
- `phone` (string, optional) - Contact phone
- `externalRef` (string, optional) - External reference

**Response:** Created ZZP user object

---

### GET /api/zzp-users/:id
Get ZZP user details

**URL Parameters:**
- `id` (UUID) - ZZP user ID

**Response:** ZZP user object

---

### GET /api/zzp-users
List ZZP users for a company

**Query Parameters:**
- `companyId` (UUID, optional) - Filter by company

**Response:** Array of ZZP user objects

---

## Common Response Codes

- **200 OK** - Successful GET/PATCH request
- **201 Created** - Successful POST request
- **400 Bad Request** - Invalid parameters or validation error
- **401 Unauthorized** - Missing or invalid authentication
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error

## Date Formats

- **Query/Body Params**: ISO 8601 date strings (YYYY-MM-DD)
- **Response**: ISO 8601 timestamps with timezone (YYYY-MM-DDTHH:mm:ss.sssZ)

## Currency Format

- All amounts are numeric with 2 decimal precision
- Currency code is "EUR" unless specified otherwise
- Frontend displays in Dutch format: € 1.234,56
