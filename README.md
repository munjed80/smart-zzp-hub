# Smart ZZP Hub

Smart ZZP Hub is a dual-portal platform for Dutch ZZP freelancers and the mid-sized companies that work with them.

The goal of this project is to automate the weekly workflow:

- Companies register delivered work (stops, hours, locations, points, projects).
- The system generates weekly statements per ZZP.
- ZZP users log in, review their statement, and create an official invoice in one click.

The **default UI language will be Dutch**, but all code, identifiers, and comments are in English to keep the codebase clean.

## Project structure

- `backend/` – Node.js + Express REST API
- `db/` – Database schema drafts (PostgreSQL‑oriented)
- `docs/` – Functional and flow documentation (EN)

## MVP scope

**Company portal**

- Manage ZZP profiles (basic contact and contract data).
- Log work entries per ZZP:
  - tariff type: stop / hour / location / point / project
  - quantity
  - agreed unit price
  - work date
- Generate weekly statements per ZZP.
- Export statements as PDF or CSV and send them to ZZP by email.

**ZZP portal**

- View weekly statements.
- Generate an invoice from a statement (PDF).
- Basic expense tracking (fuel, maintenance, materials).
- Overview of paid / unpaid invoices.

## Technical stack (initial)

- Backend: Node.js + Express
- Database: PostgreSQL (or a compatible cloud service)
- Auth: to be decided (JWT / session‑based)
- Frontend: will be added later (likely Next.js or a lightweight SPA)
- Language:
  - UI texts: Dutch (via translation files)
  - Code: English

## Status

This repository currently contains the initial backend skeleton, database schema draft, and flow documentation. More will be added iteratively.
