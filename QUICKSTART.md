# Quickstart voor Smart ZZP Hub (3 minuten)

1) **Download & start**
```bash
git clone https://github.com/munjed80/smart-zzp-hub.git
cd smart-zzp-hub
cp .env.example .env   # vul DB_PASSWORD + JWT_SECRET in
docker compose up -d --build
```

2) **Inloggen**
- Ga naar `http://localhost/`
- Bedrijf (admin): `company@example.com` / `test123`
- ZZP: `test@example.com` / `test123`

3) **Belangrijkste flows**
- **Werkbon**: Tab "Werkbonnen" → voeg entries toe (uur/stop/locatie/project/punt)
- **Overzicht**: Tab "Overzichten" → “Weekoverzicht genereren” → exporteer PDF/CSV → genereer factuur
- **Uitgaven** (ZZP): Tab "Uitgaven" → nieuwe uitgave opslaan
- **E-mail (staging)**: Tab "Outbox" toont gelogde mails uit `storage/mail-outbox`

4) **Gezondheidscheck**
```bash
curl http://localhost/api/health
```

5) **Stoppen / updaten**
```bash
docker compose down        # stoppen
docker compose pull        # update images (of build)
docker compose up -d       # herstart
```
