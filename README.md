# 🎯 InterviewMaster

> **Current implementation status:** PayU India hosted checkout, confirmed fulfillment, refund reconciliation, private PDF uploads and interview allowances run on the existing MongoDB application. Firebase Auth is available as an opt-in bridge and is tested with the local emulator. The Prisma migration has been applied and tested on PostgreSQL, but **the running application has not cut over to PostgreSQL**. Paid plans are one-time passes, and external PayU sandbox and AI/storage journeys remain unverified. See [implementation status](docs/IMPLEMENTATION_STATUS.md), [PayU setup](docs/PAYU.md), [schema](docs/POSTGRESQL_SCHEMA.md) and [user migration](docs/USER_MIGRATION.md) before deployment.

<div align="center">

![InterviewMaster Banner](https://img.shields.io/badge/Interview-Master-419683?style=for-the-badge&logo=target&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)

**A mock interview platform that reads your resume, asks real questions, and scores every answer.**

[Getting Started](#-getting-started) · [API Reference](#-api-endpoints) · [Architecture](#-project-structure)

</div>

---

## 📖 Overview

**InterviewMaster** runs realistic mock interviews end to end:

1. Upload a **resume (PDF)** — text is extracted and semantically chunked
2. Paste a **job description** and pick topics / difficulty
3. A **RAG pipeline** retrieves the parts of your resume that match the role
4. Questions are generated from *your actual experience* (Groq / Llama 3)
5. Follow-ups stream in **real time** over Socket.io, reacting to each answer
6. Every answer is scored, and a **full feedback report** closes the session
7. A built-in **Job Board** surfaces matching openings (Adzuna API)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📄 Resume ingestion | PDF upload → text extraction → semantic chunking |
| 🧠 RAG pipeline | LangChain + OpenAI embeddings → grounded question generation |
| 💬 Live sessions | Real-time follow-up questions via Socket.io streaming |
| 📊 Answer scoring | Per-answer evaluation + final report via Groq LLM |
| 📈 Dashboard | Session history, score trends, performance analytics |
| 💼 Job Board | Live listings from the Adzuna API with match scoring |
| 🔐 Auth | Firebase Auth bridge or legacy JWT mode; server-side role checks |
| ☁️ Cloud storage | Resumes stored on Cloudinary |
| ⚡ Redis cache | Multi-level caching for job searches |
| 📝 Admin panel | Users, content, prompts, scraper and analytics management |
| 🚦 Request logging | Winston-backed structured logs on every request |

---

## 🛠️ Tech Stack

### API (`/api`)
- **Language**: TypeScript (strict mode, staged ramp-up)
- **Runtime**: Node.js + Express
- **Database**: MongoDB (Mongoose)
- **AI / LLM**: Groq SDK (Llama 3), LangChain, OpenAI embeddings
- **Real-time**: Socket.io
- **File storage**: Cloudinary + Multer
- **Cache**: Redis (official client, compat wrapper)
- **Auth**: Firebase Admin SDK bridge and legacy JWT mode, RBAC middleware
- **Security**: Helmet, CORS, express-rate-limit, compression
- **Logging**: Winston request logging with query strings omitted

### Web (`/frontend`)
- **Framework**: React 18 + Vite
- **State**: Zustand + TanStack React Query
- **Routing**: React Router v7
- **UI / animation**: Framer Motion, Lucide React
- **Styling**: Tailwind CSS (single-accent teal design system)
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Real-time**: Socket.io client

---

## 📁 Project Structure

```
interview-master/
├── api/                            # TypeScript backend
│   └── src/
│       ├── server.ts               # HTTP bootstrap, schedulers, lifecycle
│       ├── app.ts                  # Express app: middleware, routes, logging
│       ├── socket.ts               # Real-time follow-up Q&A logic
│       ├── config/                 # db, redis, groq, cloudinary, logger
│       ├── controllers/            # Route handlers (one concern per module)
│       │   ├── admin.controller/   # stats | users | content + barrel
│       │   ├── auth.controller.ts
│       │   ├── resume.controller.ts
│       │   ├── interview.controller.ts
│       │   ├── session.controller.ts
│       │   ├── jobs.controller.ts
│       │   └── user.controller.ts
│       ├── services/               # Business logic & AI integrations
│       │   ├── ai.service/         # prompts | questions | evaluation | parsing
│       │   ├── adzuna.service.ts   # Job search client (canonical)
│       │   ├── rag.service.ts      # Embeddings + vector retrieval
│       │   ├── chunking.service.ts # Semantic document splitting
│       │   ├── optimizer.service.ts
│       │   └── job-*.ts            # sync, cleanup, search, match services
│       ├── models/                 # Mongoose schemas (kebab-case files)
│       ├── routes/                 # API route definitions
│       ├── middleware/             # auth, rbac, upload, validation, logging
│       ├── utils/                  # query-parser/, deduplicator, scoring-engine
│       └── types/                  # Express request/response augmentations
│
└── frontend/
    └── src/
        ├── app.jsx                 # Route tree + providers
        ├── main.jsx                # Entry point
        ├── pages/                  # landing, dashboard, interview, jobs, admin
        ├── components/             # navigation/, admin/, jobs/, ui/
        ├── context/                # auth, app, admin-auth contexts
        ├── hooks/                  # use-jobs, use-auth, use-admin-query
        ├── services/               # Axios API clients
        ├── store/                  # Zustand stores (auth-store)
        └── utils/                  # Helpers
```

**Naming conventions**: kebab-case filenames throughout (`user.model.ts`, `admin-sidebar.jsx`); camelCase variables and functions; PascalCase React component identifiers; UPPER_SNAKE_CASE for environment-derived constants.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [MongoDB Atlas](https://www.mongodb.com/atlas) account (or local MongoDB)
- [Redis](https://redis.io/) (local or cloud — Upstash / Redis Cloud)
- [Groq API key](https://console.groq.com) — free tier available
- [OpenAI API key](https://platform.openai.com) — for embeddings
- [Cloudinary account](https://cloudinary.com) — for file storage
- [Adzuna API](https://developer.adzuna.com/) — for the Job Board (optional)

### 1. Clone and install

```bash
git clone https://github.com/vishnu-vemula/interview-master.git
cd interview-master
npm run install:all        # installs api/ and frontend/ dependencies
```

### 2. Configure the API

```bash
cd api
cp .env.example .env
```

Fill in `api/.env`:

```env
PORT=5000
NODE_ENV=development

MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/interviewmaster_db

JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_refresh_token_secret_min_32_chars
JWT_REFRESH_EXPIRE=30d

GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

CLIENT_URL=http://localhost:5173

REDIS_ENABLED=true
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
ADZUNA_COUNTRY=in
```

### 3. Configure the frontend

```bash
cd ../frontend
cp .env.example .env
```

`frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=InterviewMaster
```

### 4. Seed the admin account (optional)

```bash
cd ../api
npm run seed:admin
```

Creates `admin@interviewmaster.com` (default password `passwore123` — **change it immediately** in any real deployment).

### 5. Run

```bash
# root — two terminals, or:
npm run dev:api          # API    → http://localhost:5000
npm run dev:web          # Web    → http://localhost:5173
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive tokens |
| `POST` | `/api/auth/refresh` | Exchange refresh token |
| `POST` | `/api/resumes/upload` | Upload a resume PDF |
| `GET`  | `/api/resumes` | List uploaded resumes |
| `POST` | `/api/interviews` | Create an interview |
| `GET`  | `/api/interviews/:id` | Interview details |
| `POST` | `/api/sessions` | Start an interview session |
| `POST` | `/api/sessions/:id/answer` | Submit an answer for evaluation |
| `GET`  | `/api/sessions/:id/report` | Final feedback report |
| `GET`  | `/api/users/dashboard` | Dashboard statistics |
| `GET`  | `/api/jobs` | Search the Job Board |
| `GET`  | `/api/health` | Liveness probe |

All requests are logged (method, path, status, duration, IP, user id) via Winston.

---

## 🧠 How a Session Works

```
Resume PDF upload
        ↓
Text extraction (pdf-parse)
        ↓
Semantic chunking (LangChain text splitters)
        ↓
Embeddings (OpenAI) → vector store
        ↓
Create interview (role + topics + difficulty)
        ↓
Query optimization (optimizer.service.ts)
        ↓
RAG retrieval — relevant resume chunks
        ↓
Question generation (Groq / Llama 3)
        ↓
Live interview over Socket.io
        ↓
Answer evaluation (Groq / Llama 3)
        ↓
Final report
```

---

## 📜 Scripts

| Location | Command | What it does |
|---|---|---|
| root | `npm run install:all` | Install API + web dependencies |
| root | `npm run dev:api` / `dev:web` | Run API / frontend in dev mode |
| root | `npm run build` | Build both packages |
| api | `npm run dev` | `tsx watch` — hot-reload dev server |
| api | `npm run build` | Compile TypeScript → `dist/` |
| api | `npm start` | Run the compiled build |
| api | `npm run typecheck` | `tsc --noEmit` type check |
| api | `npm run seed:admin` | Create the admin account |
| web | `npm run dev` / `build` / `lint` | Vite dev server / production build / ESLint |

---

## 🤝 Contributing

1. Fork the repository
2. Branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m "Add my feature"`
4. Push and open a pull request

Please follow the existing conventions: kebab-case filenames, camelCase identifiers, one responsibility per module, and `npm run typecheck` green before submitting.

---

## 📄 License

Released under the [MIT License](LICENSE).

> **Note:** This project is a derivative of the open-source "AI-Interviewer"
> project (portions © Aftab Alam, MIT). The original MIT copyright notice is
> retained in the LICENSE file as required by the license.

---

## 👨‍💻 Author

**vishnu-vemula**

---

<div align="center">

Built with **Groq**, **React**, and **MongoDB**

⭐ If InterviewMaster helped you land the job, leave a star!

</div>
