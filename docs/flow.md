# Smart ZZP Hub – High level flow

This document describes the high-level flow of the Smart ZZP Hub platform.

## Overview

Smart ZZP Hub is a dual-portal platform designed to streamline the workflow between Dutch ZZP freelancers and the mid-sized companies that hire them.

## Actors

1. **Company User** – An employee or administrator of a company that works with multiple ZZP freelancers.
2. **ZZP User** – A self-employed professional (ZZP'er) who delivers work for companies.

## Main Flow

### 1. Work Logging (Company Portal)

The company user logs work entries for their ZZP freelancers. Each entry includes:

- **Tariff type**: stop, hour, location, point, or project
- **Quantity**: number of units delivered
- **Unit price**: agreed rate per unit (in EUR)
- **Work date**: the date the work was performed
- **Notes**: optional additional information

Companies can log work for multiple ZZP users, across different tariff types.

### 2. Statement Generation (System)

At the end of each week (or on demand), the system aggregates all worklogs for a given ZZP user into a **weekly statement**. The statement summarizes:

- Total work entries
- Breakdown by tariff type
- Total amount due

The statement is made available to the ZZP user via the ZZP portal.

### 3. Invoice Generation (ZZP Portal)

The ZZP user logs into their portal and:

1. Reviews the weekly statement(s) provided by the company.
2. Confirms the work entries are correct.
3. Generates an official invoice based on the statement with a single click.

The invoice can be exported as PDF and sent to the company for payment.

## Additional Features (MVP)

- **Expense Tracking**: ZZP users can track expenses such as fuel, maintenance, and materials.
- **Payment Overview**: ZZP users can view which invoices have been paid and which are still outstanding.

## Language Note

> **Important**: The user interface (UI) of this application will be in **Dutch** to serve the primary market of Dutch freelancers and companies. However, all code, documentation, comments, and technical identifiers remain in **English** to maintain a clean and internationally accessible codebase.
