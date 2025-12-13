# E2E Test Plan - Smart ZZP Hub

## Company Portal
1) **Register/login admin**  
   - URL: `/` login bedrijf (company@example.com / test123)  
   - Expected: Dashboard zichtbaar, tabs Worklogs/Statements/Invoices/Expenses/Outbox/Settings.
2) **ZZP-profiel aanmaken**  
   - Action: POST /api/zzp-users (via UI form) met naam/e-mail.  
   - Expected: Profiel verschijnt in lijst, gekoppeld aan tenant.
3) **Werkbonnen toevoegen**  
   - Action: Tab Werkbonnen → voeg 5 entries (hour/stop/location/project/point).  
   - Expected: Lijst toont alle records met juiste totaalbedragen.
4) **Weekoverzicht genereren**  
   - Action: Tab Overzichten → “Weekoverzicht genereren”.  
   - Expected: Nieuw overzicht met status “Open”, totaal = som werkbonnen.
5) **Exporteren**  
   - Action: Export CSV + PDF knoppen.  
   - Expected: Downloads slagen (HTTP 200, bestand met regels).
6) **Factuur genereren**  
   - Action: “Factuur” knop → API `/api/invoices/generate`.  
   - Expected: Factuurnummer FACT-<jaar>-####, PDF base64 in response, lijst Invoices toont entry.
7) **Statement e-mail (outbox)**  
   - Action: “Verstuur per e-mail” → `/api/statements/:id/send`.  
   - Expected: Bestand in `storage/mail-outbox/`, zichtbaar in Outbox tab.
8) **Status naar betaald**  
   - Action: “Markeer betaald” → `/api/statements/:id` status=paid.  
   - Expected: Badge “Betaald”, totals on dashboard bijgewerkt.

## ZZP Portal
1) **Login ZZP**  
   - URL: `/` login ZZP (test@example.com / test123).  
   - Expected: Tabs Statements/Invoices/Expenses/Settings.
2) **Statements bekijken**  
   - Expected: Zelfde weekoverzicht, geen andere tenant data.
3) **Factuur genereren**  
   - Action: “Factuur” knop op overzicht.  
   - Expected: PDF base64 response, factuurnummer aanwezig.
4) **Uitgaven toevoegen**  
   - Action: Tab Uitgaven → categorie (brandstof, onderhoud, materiaal).  
   - Expected: Lijst toont bedrag en datum, totals in UI bijgewerkt.
5) **Invoice status inzien**  
   - Expected: Betaald/onbetaald status zichtbaar via statements-status.

## Validation Steps
- `docker compose up -d --build`
- `docker compose ps` all healthy
- `curl http://localhost/` returns UI (200)
- `curl http://localhost/api/health` returns JSON status ok
- Verify Outbox file creation after send action
