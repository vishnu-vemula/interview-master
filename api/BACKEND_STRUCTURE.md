# InterviewMaster Backend Architecture

This document provides a comprehensive overview of the backend folder structure, file responsibilities, and the core design patterns used in the InterviewMaster application.

---

## 📁 Root Structure (`/backend`)

| File/Folder | Purpose |
| :--- | :--- |
| `src/` | Main source code directory. |
| `uploads/` | Temporary storage for local PDF uploads (cleared after process). |
| `.env` | Environment variables (API Keys, DB URI, Secret Keys). |
| `package.json` | Project dependencies and scripts. |

---

## 📁 Source Directory (`/backend/src`)

### 🛠️ Core Files
- **`server.ts`**: Application entry point. Handles HTTP server initialization, database connection, and WebSocket (Socket.io) binding.
- **`app.ts`**: Express application configuration. Sets up security headers (Helmet), CORS, rate limiting, logging middleware, and route registration.
- **`socket.ts`**: Real-time communication logic. Manages live interview "follow-up" questions using streaming Groq responses.

---

### 📂 `config/` (System Configuration)
- **`db.ts`**: MongoDB connection logic using Mongoose.
- **`cloudinary.ts`**: Configuration for Cloudinary (Remote storage for resume PDFs).
- **`groq.ts`**: Shared client for Groq LLM API.
- **`logger.ts`**: Winston/Morgan logger setup for production-grade logging.

---

### 📂 `services/` (The "Brain" of the App)
*This is where all complex business logic and AI integrations reside.*

- **`ai.service.ts`**: Orchestrates all LLM calls (Question generation, Answer evaluation, Grounding validation, Final reports).
- **`rag.service.ts`**: Retrieval-Augmented Generation pipeline. Handles embedding, vector stores, and metadata-aware retrieval.
- **`chunking.service.ts`**: Semantic document splitting. Detects sections (Skills, Experience) and ensures context is preserved in chunks.
- **`optimizer.service.ts`**: Semantic query optimizer to expand raw user topics into dense technical search queries.

---

### 📂 `controllers/` (Route Handlers)
*Manages the request/response lifecycle. Acts as the bridge between Routes and Services.*

- **`auth.controller.ts`**: Handles Login, Registration, and JWT issuance.
- **`resume.controller.ts`**: Manages PDF uploads, text extraction, and semantic chunk previews.
- **`interview.controller.ts`**: Creates and finds interview templates.
- **`session.controller.ts`**: Manages active interview sessions, saving answers, and triggering AI evaluations.
- **`user.controller.ts`**: User profile management and dashboard statistics.

---

### 📂 `models/` (Data Schemas)
- **`user.model.ts`**: Defines user profiles, auth data, and credits/usage stats.
- **`resume.model.ts`**: Stores extracted text, parsed JSON data, and Cloudinary URLs.
- **`interview.model.ts`**: Template for an interview, containing the set of generated questions.
- **`session.model.ts`**: Stores candidate answers, AI scores, and final feedback reports.

---

### 📂 `routes/` (API Endpoints)
- **`auth.routes.ts`**: `/api/auth`
- **`resume.routes.ts`**: `/api/resumes`
- **`interview.routes.ts`**: `/api/interviews`
- **`session.routes.ts`**: `/api/sessions`
- **`user.routes.ts`**: `/api/users`

---

### 📂 `middleware/` (Request Processing)
- **`auth.middleware.ts`**: Protects routes using JWT verification and role checks.
- **`upload.middleware.ts`**: Handles multi-part/form-data for PDF uploads using Multer.
- **`errorHandler.ts`**: Global centralized error handler for consistent API responses.
- **`requestLogger.ts`**: Logs incoming request details (Method, URL, time).
- **`validate.ts`**: Joi/Zod-like validation for incoming request bodies.

---

### 📂 `utils/` (Helper Utilities)
- **`app-error.ts`**: Custom error class for operational errors.
- **`jwt.utils.ts`**: Token signing and verification helpers.
- **`normalizer.ts`**: **Text Pre-processor** — cleans and standardizes text (JS -> JavaScript) before it hits the embedding API.
