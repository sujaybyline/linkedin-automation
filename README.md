# APEX LinkedIn Ops — React + Node + MySQL

Separate **frontend** and **backend** for Hostinger deployment (same pattern as panworld).

The original Next.js app remains in `../dashboard/` — unchanged.

## Structure

```
dashboard2/
├── backend/          ← Node.js Express API (port 4000)
│   ├── server.js
│   ├── routes/
│   ├── lib/
│   └── uploads/cards/
└── frontend/         ← React + Vite (port 5173)
    └── src/
```

**Database:** Uses the same MySQL schema as the Next.js dashboard:
`../dashboard/mysql/import_tables_only.sql` → database `apex_linkedin_ops`

Default login: `admin@apex.local` / `Admin@123`

---

## Local development

### 1. MySQL (XAMPP)

Import SQL if not done already:
`dashboard/mysql/import_tables_only.sql` into `apex_linkedin_ops`

### 2. Backend

```powershell
cd dashboard2/backend
copy .env.example .env
# Edit .env — DB credentials, JWT secrets
npm install
npm run dev
```

API runs at **http://localhost:4000**

### 3. Frontend

```powershell
cd dashboard2/frontend
copy .env.example .env
npm install
npm run dev
```

App runs at **http://localhost:5173** (proxies `/api/*` → backend)

---

## Hostinger deployment

Deploy **two parts** (like panworld):

| Part | Folder | Hostinger |
|------|--------|-----------|
| **Frontend** | `dashboard2/frontend/dist/` | Static site or subdomain |
| **Backend** | `dashboard2/backend/` | Node.js app (port 4000) |
| **Database** | Already in MySQL | `apex_linkedin_ops` |

### Backend on Hostinger

1. Upload `backend/` (no `node_modules`)
2. `npm install && npm start`
3. Set env vars: `DB_*`, `JWT_*`, `CLIENT_URL=https://yourdomain.com`
4. PM2: `pm2 start server.js --name apex-api`

### Frontend on Hostinger

1. Set `VITE_API_URL=https://api.yourdomain.com` (or same domain)
2. `npm run build`
3. Upload `frontend/dist/` to public_html OR serve via nginx

### Nginx example (one domain)

```nginx
location / {
    root /var/www/apex-frontend/dist;
    try_files $uri /index.html;
}

location /api/ {
    proxy_pass http://127.0.0.1:4000/;
    proxy_set_header Host $host;
    client_max_body_size 20M;
}
```

### Cron (publish worker)

Every 15 minutes:

```bash
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/publish
```

---

## API routes (backend)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login |
| GET | `/cards` | List cards |
| POST | `/cards` | Upload card |
| GET | `/cards/:id/image` | Card image |
| POST | `/captions/:id` | Generate caption |
| GET | `/approvals` | Approval queue |
| POST | `/approvals/:id` | Approve/reject |
| GET/PATCH | `/schedule` | Schedule manager |
| GET | `/queue` | Publishing queue |
| GET | `/dashboard/stats` | Dashboard stats |
| GET/PUT | `/system/emergency-stop` | Emergency stop |
| POST | `/cron/publish` | Worker (cron) |

---

## vs Next.js dashboard

| | `dashboard/` (Next.js) | `dashboard2/` (React+Node) |
|---|--------------------------|----------------------------|
| Deploy | 1 app | 2 apps (frontend + backend) |
| Database | Same MySQL | Same MySQL |
| Features | Full MVP | Same MVP ported |
| Hostinger | Node.js single app | Like panworld split |

Both can run against the **same database** — do not run both on the same post ID sequence in production without coordination.
