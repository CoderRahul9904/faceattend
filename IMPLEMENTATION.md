# IMPLEMENTATION.md — FaceAttend
## AI-Powered Face Recognition Attendance Monitoring System

> **GitHub Repo Name:** `faceattend`
> **Demo Mode:** Fully local. Backend on `localhost:8000`, Frontend on `localhost:3001`.
> **Team Size / Scale:** MVP for 5–7 students, extendable.

---

## 1. PROJECT OVERVIEW

FaceAttend is a web-based attendance monitoring system that uses laptop camera + face recognition AI to automatically mark student attendance during a lecture session. A teacher starts a session, the system scans faces at a configurable interval, and marks students present or absent based on consecutive-scan logic. Students can view their own attendance on a dashboard. Teachers can export attendance as Excel sheets.

---

## 2. CORE RULES & BUSINESS LOGIC

### 2.1 Attendance Marking Logic
- Each lecture session has a configurable scan interval (default: 15 sec for MVP demo, 15 min for real world).
- During a 1-hour lecture (or demo session), scans happen at every interval tick.
- **Present Rule:** Student must appear in at least one scan out of every two consecutive scans.
- **Absent Rule:** If a student is MISSED in 2 or more consecutive scans → marked ABSENT for that lecture.
- **Late Rule:** If a student misses the first 2 consecutive scans (was not in class at start) → marked ABSENT even if they appear later.
- Each scan result is stored individually (for audit trail).

### 2.2 Scan Interval Configuration
- Teacher can set interval before starting session: `5s / 15s / 30s / 60s` (dropdown in UI).
- In production (real world): interval = 900 seconds (15 min).
- Interval is stored per session.

### 2.3 Roles
- **Student:** Register, upload face photos, view own attendance dashboard.
- **Teacher:** Start/stop sessions, view live scan results, export Excel.

---

## 3. TECH STACK

| Layer | Technology |
|---|---|
| Backend | Python 3.11 + FastAPI |
| Face Recognition | `face_recognition` library (dlib-based) |
| Database | SQLite (local file `faceattend.db`) — no setup needed |
| ORM | SQLAlchemy |
| Auth | JWT (python-jose) with role-based access |
| Frontend | React 18 + Vite + Tailwind CSS |
| Camera | Browser `getUserMedia` API → JPEG frame → POST to backend |
| Excel Export | `openpyxl` |
| CORS | FastAPI CORSMiddleware (allow localhost:3001) |

> **Why SQLite over PostgreSQL?** Zero setup for local demo. No Docker needed. Works out of the box on any laptop.

---

## 4. FOLDER STRUCTURE

```
faceattend/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── database.py              # SQLAlchemy setup, SQLite connection
│   ├── models.py                # DB models
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── auth.py                  # JWT logic, password hashing
│   ├── face_utils.py            # Face encoding, comparison logic
│   ├── routes/
│   │   ├── auth_routes.py       # /register, /login
│   │   ├── student_routes.py    # /students, /attendance (student view)
│   │   ├── teacher_routes.py    # /sessions, /scan, /export
│   │   └── face_routes.py       # /face/upload, /face/encode
│   ├── face_data/               # Stored face encodings (.pkl files per student)
│   ├── requirements.txt
│   └── .env                     # SECRET_KEY, etc.
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── api/
│   │   │   └── client.js        # axios instance pointing to localhost:8000
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # JWT token storage, user role
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── StudentDashboard.jsx
│   │   │   ├── TeacherDashboard.jsx
│   │   │   ├── SessionPage.jsx  # Live scan UI (teacher)
│   │   │   └── AttendancePage.jsx # Attendance history (student)
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── StatCard.jsx
│   │   │   ├── AttendanceTable.jsx
│   │   │   ├── CameraFeed.jsx   # getUserMedia + frame capture
│   │   │   ├── ScanResult.jsx   # Live scan overlay results
│   │   │   └── NoticeCard.jsx
│   │   └── styles/
│   │       └── index.css        # Tailwind directives
│   ├── index.html
│   ├── vite.config.js           # port: 3001
│   ├── tailwind.config.js
│   └── package.json
│
├── IMPLEMENTATION.md
└── README.md
```

---

## 5. DATABASE MODELS

### users
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | VARCHAR | Full name |
| email | VARCHAR UNIQUE | Login email |
| password_hash | VARCHAR | bcrypt |
| role | ENUM | `student` / `teacher` |
| student_id | VARCHAR | e.g. "STU001" (null for teacher) |
| created_at | DATETIME | |

### face_encodings
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| user_id | FK → users.id | |
| encoding_path | VARCHAR | Path to .pkl file with numpy array |
| photo_count | INTEGER | Number of photos used (5) |
| created_at | DATETIME | |

### subjects
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | VARCHAR | e.g. "Data Structures" |
| code | VARCHAR | e.g. "CS301" |
| teacher_id | FK → users.id | |

### sessions
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| subject_id | FK → subjects.id | |
| teacher_id | FK → users.id | |
| date | DATE | |
| start_time | DATETIME | |
| end_time | DATETIME | nullable, set on stop |
| scan_interval_seconds | INTEGER | 5/15/30/60 |
| status | ENUM | `active` / `completed` |

### scans
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| session_id | FK → sessions.id | |
| scan_number | INTEGER | 1, 2, 3, 4... |
| scanned_at | DATETIME | |

### scan_results
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| scan_id | FK → scans.id | |
| student_id | FK → users.id | |
| detected | BOOLEAN | Was face detected in this scan? |
| confidence | FLOAT | Match confidence score |

### attendance
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| session_id | FK → sessions.id | |
| student_id | FK → users.id | |
| status | ENUM | `present` / `absent` |
| computed_at | DATETIME | When final status was computed |

---

## 6. API ENDPOINTS

### Auth
```
POST /auth/register        → Register student or teacher
POST /auth/login           → Returns JWT token + role
```

### Face Registration
```
POST /face/upload          → Student uploads 5 photos (multipart form)
                             Computes face_encoding, saves .pkl
GET  /face/status          → Check if student has face registered
```

### Sessions (Teacher only)
```
POST /sessions/start       → { subject_id, scan_interval_seconds }
                             Returns session_id
POST /sessions/stop        → { session_id }
                             Triggers final attendance computation
GET  /sessions/active      → Returns current active session (if any)
GET  /sessions/            → List all sessions (teacher view)
```

### Scanning (Teacher only)
```
POST /sessions/{id}/scan   → Multipart: JPEG frame from camera
                             Returns: [{ student_name, student_id, detected, confidence }]
                             Internally: creates scan record + scan_results
```

### Attendance
```
GET  /attendance/student   → Student's own attendance (subject-wise, date-wise)
GET  /attendance/session/{id} → All student results for a session (teacher)
GET  /attendance/export/{session_id} → Returns .xlsx file download
```

### Subjects (Teacher)
```
POST /subjects/            → Create subject
GET  /subjects/            → List subjects
```

---

## 7. FACE RECOGNITION LOGIC (face_utils.py)

```
REGISTRATION:
- Accept 5 images from student
- For each image: detect face → compute 128-dim encoding vector
- Average the 5 encodings into one representative encoding
- Save as numpy array in face_data/{student_id}.pkl

SCANNING:
- Load all registered student encodings from face_data/
- Accept 1 JPEG frame from camera
- Detect all faces in frame (can detect multiple faces simultaneously)
- For each detected face: compare against all student encodings
- Use tolerance = 0.5 (strict) for small groups
- Return list of matched student IDs with confidence scores

ATTENDANCE COMPUTATION (triggered on session stop):
- Load all scans for session ordered by scan_number
- For each student:
    - Build array of detected/not-detected per scan: [T, T, F, F] etc.
    - Check consecutive miss rule: if any 2 consecutive = False → ABSENT
    - If first 2 consecutive = False → ABSENT (late rule)
    - Otherwise → PRESENT
- Write final status to attendance table
```

---

## 8. FRONTEND PAGES & COMPONENTS

### 8.1 Design System (Lovable-style)
- **Primary color:** `#3B5BDB` (blue, matches screenshot)
- **Accent:** `#00C9A7` (teal for stats)
- **Background:** `#F8F9FD` (light grey-white)
- **Sidebar:** `#1E3A8A` (dark navy blue)
- **Font:** Inter (Google Fonts)
- **Card style:** white, `rounded-xl`, `shadow-sm`, `border border-gray-100`
- **Stat cards:** icon left, label + large bold value

### 8.2 Page Breakdown

**Login / Register**
- Clean centered card, role selector (Student / Teacher)
- Student registration includes face upload step (5 photos with webcam capture or file upload)

**Student Dashboard** (matches screenshot style)
- Stat cards: Attendance Rate, Total Credits, GPA, Hours Today
- Attendance table: Subject | Date | Status (Present/Absent badge)
- Notices section (static for MVP)

**Teacher Dashboard**
- Active session status card
- Subject list with "Start Session" button
- Recent sessions list

**Session Page (Teacher - Live)**
- Large camera feed (CameraFeed component)
- Scan interval selector dropdown (5s / 15s / 30s / 60s)
- "Start Session" / "Stop Session" buttons
- Live scan results panel: student cards with green (detected) / red (not detected) indicators
- Scan counter: "Scan 2 of 4"

**Attendance Export (Teacher)**
- Session selector dropdown
- "Download Excel" button → triggers GET /attendance/export/{id}

### 8.3 CameraFeed Component Logic
```
1. On mount: request getUserMedia({ video: true })
2. Render <video> element with stream
3. When session is active + interval ticks:
   a. Draw video frame to hidden <canvas>
   b. canvas.toBlob() → JPEG
   c. POST to /sessions/{id}/scan with FormData
   d. Display returned scan results in ScanResult overlay
4. On session stop: stop stream tracks
```

---

## 9. EXCEL EXPORT FORMAT (openpyxl)

Sheet: "Attendance Report"

| Student ID | Student Name | Subject | Date | Status | Scans Detected | Total Scans |
|---|---|---|---|---|---|---|
| STU001 | John Smith | Data Structures | 12/06/2026 | Present | 3/4 | 4 |
| STU002 | Jane Doe | Data Structures | 12/06/2026 | Absent | 1/4 | 4 |

- Header row: bold, blue background, white text
- Present rows: light green fill
- Absent rows: light red fill
- Auto column width

---

## 10. ENVIRONMENT & SETUP

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### requirements.txt
```
fastapi
uvicorn
sqlalchemy
python-jose[cryptography]
passlib[bcrypt]
python-multipart
face_recognition
numpy
pillow
openpyxl
python-dotenv
```

> NOTE: `face_recognition` requires `cmake` and `dlib`. Installation steps:
> - Windows: `pip install cmake` then `pip install dlib` then `pip install face_recognition`
> - Mac: `brew install cmake` then pip install
> - Linux: `sudo apt install cmake` then pip install

### Frontend Setup
```bash
cd frontend
npm install
npm run dev   # starts on localhost:3001
```

### vite.config.js
```js
export default {
  server: { port: 3001 }
}
```

---

## 11. ANTIGRAVITY MISSION BREAKDOWN

Execute missions in this exact order. Each mission is independent and builds on the previous.

---

### MISSION 1 — Backend Foundation
**Goal:** FastAPI app with database, models, auth working.
- Set up FastAPI app in `main.py` with CORS for localhost:3001
- Create `database.py` with SQLite + SQLAlchemy engine
- Create all models in `models.py` (users, subjects, sessions, scans, scan_results, attendance, face_encodings)
- Create `auth.py` with JWT token generation, bcrypt password hashing, get_current_user dependency
- Create `schemas.py` with all Pydantic models
- Create `auth_routes.py` with POST /auth/register and POST /auth/login
- Test: register a teacher and student, login returns token

---

### MISSION 2 — Face Registration
**Goal:** Student can upload 5 photos, system stores face encodings.
- Create `face_utils.py` with:
  - `encode_faces(image_list) -> np.ndarray` — averages encodings from 5 images
  - `find_matches(frame, known_encodings_dict) -> list` — matches faces in a frame
  - `save_encoding(student_id, encoding)` — saves to face_data/
  - `load_all_encodings() -> dict` — loads all student encodings at startup
- Create `face_routes.py` with:
  - POST /face/upload — accepts 5 image files, runs encode_faces, saves .pkl
  - GET /face/status — returns whether current student has face registered
- face_data/ directory must be created if not exists

---

### MISSION 3 — Subject & Session Management
**Goal:** Teacher can create subjects, start/stop sessions.
- Create `teacher_routes.py` with:
  - POST /subjects/ — create subject (teacher auth required)
  - GET /subjects/ — list subjects
  - POST /sessions/start — { subject_id, scan_interval_seconds } → creates session, returns session_id
  - POST /sessions/stop — { session_id } → sets end_time, status=completed, triggers attendance computation
  - GET /sessions/active — returns active session or null
  - GET /sessions/ — list all past sessions with subject name
- Implement `compute_attendance(session_id)` in face_utils.py or a separate service:
  - Loads all scan_results for session
  - Applies consecutive miss logic
  - Writes to attendance table

---

### MISSION 4 — Live Scan Endpoint
**Goal:** Camera frame POST → face detection → scan results saved → response returned.
- In `teacher_routes.py` add:
  - POST /sessions/{session_id}/scan
    - Accepts multipart JPEG frame
    - Loads all face encodings
    - Runs find_matches on frame
    - Creates Scan record (scan_number = last + 1)
    - Creates ScanResult records for each student (detected=True/False)
    - Returns list of { student_id, student_name, detected, confidence }
- Handle edge case: if no faces detected, still create scan record with all detected=False

---

### MISSION 5 — Attendance & Export Routes
**Goal:** Student can view attendance. Teacher can export Excel.
- Create `student_routes.py`:
  - GET /attendance/student — returns attendance grouped by subject, with per-session status
- In `teacher_routes.py` add:
  - GET /attendance/session/{session_id} — all students with present/absent for that session
  - GET /attendance/export/{session_id} — returns .xlsx file using openpyxl
    - Format: Student ID, Name, Subject, Date, Status, Scans Detected / Total Scans
    - Present rows = green fill, Absent rows = red fill, Header = blue bold

---

### MISSION 6 — Frontend Foundation + Auth
**Goal:** React app, routing, auth context, login/register pages.
- Init Vite React app, install tailwind, axios, react-router-dom
- Set vite.config.js port to 3001
- Create `api/client.js` — axios with baseURL=http://localhost:8000, JWT interceptor
- Create `AuthContext.jsx` — stores token + user info in localStorage, login/logout functions
- Create `Login.jsx` — email/password form, role shown after login, redirects by role
- Create `Register.jsx` — name, email, password, role selector (student/teacher)
  - If student: after register show face upload step (5 photos)
- Create `Navbar.jsx` and `Sidebar.jsx` matching the Lovable screenshot style:
  - Dark navy sidebar (#1E3A8A), white text, icons + labels
  - Menu items: Dashboard, Attendance, Students, Lectures, Notices, Messages, Results, Settings
  - Top bar: search, date, notification bell, user avatar

---

### MISSION 7 — Student Dashboard
**Goal:** Student sees their attendance overview with stat cards + table.
- Create `StudentDashboard.jsx`:
  - Fetch GET /attendance/student
  - StatCards: Attendance Rate (%), Total Subjects, Best Subject, Days Present
  - AttendanceTable: Subject | Date | Session | Status (green Present / red Absent badge)
- Create `StatCard.jsx` component — icon, label, large bold value, accent color
- Create `AttendanceTable.jsx` — sortable by date, filterable by subject
- Style matches screenshot: white cards, rounded-xl, shadow-sm, blue headings

---

### MISSION 8 — Teacher Dashboard + Session Page
**Goal:** Teacher can start a session, see live camera, trigger scans.
- Create `TeacherDashboard.jsx`:
  - Fetch subjects list
  - Show active session status card (if any)
  - Subject cards with "Start Session" button
  - Recent sessions list with export button per row
- Create `SessionPage.jsx` (navigated to when session starts):
  - Large camera feed using CameraFeed component
  - Scan interval dropdown: 5s / 15s / 30s / 60s
  - "Start Scanning" button (begins interval timer)
  - "Stop Session" button (calls /sessions/stop, navigates back)
  - Live scan panel: student photo placeholder + name + green/red detected badge
  - Scan counter display: "Scan 3 of 4"
- Create `CameraFeed.jsx`:
  - getUserMedia on mount
  - captureFrame() — draws to canvas, returns blob
  - Expose captureFrame via ref so SessionPage can call it on interval

---

### MISSION 9 — Excel Export + Polish
**Goal:** Export works, UI is polished, demo-ready.
- Add "Export Attendance" button in TeacherDashboard for each completed session
- On click: GET /attendance/export/{session_id} → triggers file download in browser
- Add loading states to all fetch calls (spinner component)
- Add toast notifications for: login success, session started, session stopped, export downloaded, scan completed
- Add empty states for: no subjects created, no sessions, no attendance records
- Final UI pass: ensure consistent spacing, colors match design system, all pages responsive
- Add seed script `backend/seed.py`:
  - Creates 1 teacher account: teacher@demo.com / demo123
  - Creates 5 student accounts: student1@demo.com to student5@demo.com / demo123
  - Creates 2 subjects: Data Structures (CS301), Database Management (CS401)

---

## 12. DEMO FLOW (For External Evaluator)

1. Open `localhost:3001`
2. Login as teacher (teacher@demo.com / demo123)
3. Show Teacher Dashboard — subjects listed
4. Click "Start Session" on Data Structures → set interval to 15 seconds
5. Session Page opens — camera feed visible
6. Click "Start Scanning" — team members stand in front of camera
7. After 2 scans, one person steps away (simulates bunking)
8. After 2 more scans, Stop Session
9. Show attendance table — person who left marked Absent
10. Click Export → Excel downloads, open to show colored rows
11. Login as student (student1@demo.com / demo123)
12. Show Student Dashboard — attendance percentage, subject-wise history

---

## 13. KNOWN LIMITATIONS (Mention in Viva)

- Face recognition accuracy decreases in low light — demo in well-lit room
- Single camera angle — students should face camera during scan
- SQLite not suitable for production scale — would use PostgreSQL in real deployment
- No real-time WebSocket — teacher manually triggers scans (or interval auto-triggers)
- Face registration requires good quality photos — no blur, clear lighting

---

*Last updated: June 2026 | FaceAttend MVP v1.0*
