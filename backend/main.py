from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routes import auth_routes, face_routes, teacher_routes, student_routes

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="FaceAttend API", version="1.0")

# CORS middleware configuration
origins = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_routes.router)
app.include_router(face_routes.router)
app.include_router(teacher_routes.router)
app.include_router(student_routes.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the FaceAttend API"}
