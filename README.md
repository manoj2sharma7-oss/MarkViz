# MarkViz

A teacher marks/analytics workspace, fully server-rendered with Express + EJS
and backed by PostgreSQL. Restructured into a conventional MVC layout.

## Project structure

```
MarkViz/
├── server.js                 # App entry point — wires everything together
├── config/
│   └── database.js           # PostgreSQL pool + schema migration
├── controllers/
│   ├── authController.js     # signup, login, logout, session, password reset
│   ├── workspaceController.js# get/save/delete a teacher's workspace data
│   └── pageController.js     # renders the EJS pages
├── middleware/
│   ├── ensureDatabase.js     # blocks requests until the DB pool is ready
│   └── auth.js                # getSession, requireApiSession, requirePageSession
├── routes/
│   ├── authRoutes.js         # /api/auth/*
│   ├── workspaceRoutes.js    # /api/workspace
│   └── pageRoutes.js         # /, /login, /dashboard, /health
├── utils/
│   ├── password.js           # scrypt hash/verify helpers
│   └── cookies.js            # session cookie + createSession helpers
├── views/                    # EJS templates (server-rendered pages)
│   ├── landing.ejs
│   ├── login.ejs
│   └── dashboard.ejs
├── public/                   # static assets served as-is
│   ├── css/
│   └── js/
├── smoke-test.js             # end-to-end API test (needs DATABASE_URL)
└── .env.example
```

## Routes

| Method | Path                       | Description                                  |
| ------ | --------------------------- | --------------------------------------------- |
| GET    | `/`                         | Landing page (EJS)                            |
| GET    | `/login`                    | Login / signup page (EJS)                     |
| GET    | `/dashboard`                | Teacher workspace, requires a session (EJS)   |
| GET    | `/health`                   | Health check (used by the smoke test)         |
| POST   | `/api/auth/signup`          | Create an account                             |
| POST   | `/api/auth/login`           | Log in, sets the session cookie               |
| POST   | `/api/auth/logout`          | Clears the session                            |
| GET    | `/api/auth/session`         | Current session info                          |
| POST   | `/api/auth/forgot-password` | Verify identity, issue a reset token          |
| POST   | `/api/auth/reset-password`  | Consume the reset token, set a new password   |
| GET    | `/api/workspace`             | Fetch the signed-in teacher's saved data      |
| PUT    | `/api/workspace`             | Save the workspace data                       |
| DELETE | `/api/workspace`             | Clear the workspace data                      |

The old flat filenames (`Login.html`, `markviz.html`,
`markviz_landing_page.html`) still work — they 301-redirect to the new
routes above, so old bookmarks/links don't break.

## Running locally

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL with a real PostgreSQL connection string
npm start
```

The server loads `.env` automatically on startup (via `dotenv`) and listens
on `PORT` (default `3000`). It requires `DATABASE_URL` to point at a real
PostgreSQL database — if you see `{"error":"DATABASE_URL is not
configured."}`, it means `.env` is missing, empty, or still has the
placeholder value from `.env.example`. Tables are created automatically on
boot.

## Testing

```bash
DATABASE_URL=postgresql://... npm test
```

Runs `smoke-test.js`, which boots the server against a real database and
exercises signup, login, two-step password reset, workspace persistence, and
user isolation end to end.

## Notes on the rewrite

- The dashboard (`views/dashboard.ejs`) is server-rendered on load — the
  signed-in teacher's name and school are injected server-side — and the
  interactive marks/analytics workspace itself (tables, charts, exports)
  still runs client-side via `public/js/app.js`, since that logic is
  inherently interactive (live editing, instant recalculation, chart
  rendering) and isn't a good fit for full page reloads per action.
- Fixed a pre-existing bug where the database schema migration combined a
  multi-statement SQL string with query parameters, which PostgreSQL's
  extended query protocol rejects (`cannot insert multiple commands into a
  prepared statement`). The DDL and the parameterized cleanup queries now
  run as separate calls.
- Fixed a stray leading `npm` typo in the old `markviz.html` file that would
  have broken the page if served directly.
