# FaceAttend — AI-Powered Face Recognition Attendance Monitoring System

FaceAttend is an automated, web-based attendance tracking system designed for small classrooms or lecture sessions (MVP demo size: 5–7 students). It uses a standard laptop camera feed combined with deep-learning-based face recognition to track attendance without manual roll-calls.

---

## 🚀 Setup Instructions

### 1. Prerequisite: C/C++ Compiler & CMake
The backend uses `dlib` and `face_recognition`, which require `cmake` and a C/C++ compiler (e.g., Visual Studio Build Tools with C++ workload on Windows, Xcode Command Line Tools on macOS, or `build-essential` on Linux) to compile successfully.

### 2. Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   * **Windows:**
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```
   * **macOS/Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the database migrations & seed script:
   ```bash
   python seed.py
   ```
5. Start the FastAPI development server on port **8001**:
   ```bash
   python -m uvicorn main:app --port 8001 --reload
   ```

### 3. Frontend Setup
1. Open a second terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server (runs on port **3001**):
   ```bash
   npm run dev
   ```
4. Open your web browser and navigate to `http://localhost:3001`.

---

## 🔑 Demo Credentials

After running `seed.py`, the following demo accounts are available:

| Role | Email | Password | Details |
|---|---|---|---|
| **Teacher** | `teacher@demo.com` | `demo123` | Prof. Sarah Jenkins (Owns Data Structures CS301 & DBMS CS401) |
| **Student** | `student1@demo.com` | `demo123` | Student ID: `STU001` |
| **Student** | `student2@demo.com` | `demo123` | Student ID: `STU002` |
| **Student** | `student3@demo.com` | `demo123` | Student ID: `STU003` |
| **Student** | `student4@demo.com` | `demo123` | Student ID: `STU004` |
| **Student** | `student5@demo.com` | `demo123` | Student ID: `STU005` |
| **Student** | `student6@demo.com` | `demo123` | Student ID: `STU006` |

---

## ⚠️ Mandatory Face Registration Note
Seeded student accounts **do not come with face encodings pre-configured**. In order for students to appear on the attendance logs or be recognized during live camera scans, they must perform their onboarding live:
1. Log in as a student (e.g., `student1@demo.com` / `demo123`).
2. You will be automatically redirected to the **Profile Validation / Face Registration** flow.
3. Complete the **5 guided photo snapshots** via your webcam (or upload 5 images using the file upload fallback) and click **Activate Account**.
4. Once completed, the student can access their dashboard and will be scanned correctly during lectures.

---

## ⏱️ Business Logic Rules
- **Present Rule:** A student must appear in at least one scan out of every two consecutive scan ticks.
- **Absent Rule:** A student missed in 2 or more consecutive scans is marked `absent` for that session.
- **Late Rule:** A student who misses the first 2 consecutive scans (not in class at the start of the lecture) is marked `absent` even if they show up in later scans.
- **Exporting Reports:** Excel sheets can only be exported *after* a session has been successfully stopped.

---

## 🔧 Known Limitations
- **Lighting Conditions:** Face matching accuracy is highly dependent on even, standard room lighting. Shadowing or backlight can reduce matching confidence.
- **Camera Perspective:** Students should directly face the webcam during camera scans. Side profiles or steep angles may fail to match.
- **SQLite Database:** The application runs on local SQLite (`faceattend.db`), which is designed for demo purposes and zero-configuration local runs. For large-scale production deployments, PostgreSQL would be required.