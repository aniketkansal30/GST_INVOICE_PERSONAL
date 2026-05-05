# GST Invoice Generator — Full Stack SaaS

A production-quality GST Invoice management application built with React, Node.js, Express, and MongoDB.

## Features

- **Authentication** — JWT-based signup/login, bcrypt password hashing
- **Invoice Management** — Create, edit, delete, duplicate, view invoices
- **GST Calculation** — Auto CGST+SGST (same state) or IGST (inter-state)
- **HSN Code Support** — Smart suggestions based on item name
- **PDF Export** — Pixel-perfect A4 invoice PDF download
- **Print** — Browser print with clean layout
- **Dark Mode** — Light / Dark / System theme
- **Pagination & Search** — Filter by client name or invoice number
- **Dashboard Stats** — Total invoices, amounts, status breakdown

---

## Project Structure

```
gst-invoice-app/
├── client/                  # React frontend
│   └── src/
│       ├── App.jsx
│       ├── context/         # Auth, Theme, Invoice contexts
│       ├── pages/           # Login, Signup, Dashboard, Form, Preview, Settings
│       ├── components/      # Layout, Sidebar
│       └── utils/           # API, calculations, PDF generator
│
└── server/                  # Node.js backend
    ├── index.js
    ├── models/              # User, Invoice (Mongoose)
    ├── controllers/         # Auth, Invoice logic
    ├── routes/              # /api/auth, /api/invoices
    └── middleware/          # JWT auth middleware
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Backend

```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm install
npm run dev
```

Server runs at `http://localhost:5000`

### 2. Frontend

```bash
cd client
npm install
npm start
```

App opens at `http://localhost:3000`

---

## Environment Variables (server/.env)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/gst-invoice` |
| `JWT_SECRET` | JWT signing secret | *(required)* |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:3000` |

---

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/profile` | Get profile (auth) |
| PUT | `/api/auth/profile` | Update profile (auth) |
| PUT | `/api/auth/password` | Change password (auth) |

### Invoices (all require auth)
| Method | Path | Description |
|---|---|---|
| GET | `/api/invoices` | List invoices (search, pagination) |
| POST | `/api/invoices` | Create invoice |
| GET | `/api/invoices/:id` | Get single invoice |
| PUT | `/api/invoices/:id` | Update invoice |
| DELETE | `/api/invoices/:id` | Delete invoice |
| POST | `/api/invoices/:id/duplicate` | Duplicate invoice |

---

## Production Deployment

1. Build frontend: `cd client && npm run build`
2. Serve the `build/` folder via your server or a CDN
3. Set `NODE_ENV=production` and proper `MONGODB_URI` in server `.env`
4. Deploy server to Railway, Render, or EC2

---

## GST Logic

- If **seller state == buyer state** → applies **CGST + SGST** (split equally)
- If **seller state ≠ buyer state** → applies **IGST**
- Supported GST rates: 0%, 5%, 12%, 18%, 28%
- HSN code smart suggestions for common items (software, hardware, textiles, food, etc.)
