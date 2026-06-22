# Dashboard mail backend

This small backend sends dashboard invite and password reset emails from `s.edge@bollegraaf.com`.

## Setup

```powershell
cd server
npm install
copy .env.example .env
notepad .env
```

Fill in the real password or app password for `s.edge@bollegraaf.com`:

```env
SMTP_USER=s.edge@bollegraaf.com
SMTP_PASSWORD=PUT_REAL_PASSWORD_OR_APP_PASSWORD_HERE
```

Then start it:

```powershell
npm run dev
```

For the frontend, create/update `.env` in the dashboard project root:

```env
VITE_API_URL=http://localhost:3001/api
```

Then restart the Vite dev server.

## Important

This is enough for the current client-local dashboard login demo.
For production, users/passwords/reset tokens must be stored in a backend database and passwords must be hashed.
