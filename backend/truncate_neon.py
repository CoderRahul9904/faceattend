import os
import sys
from sqlalchemy import text

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine

def truncate_db():
    print("Connecting to database and truncating tables...")
    db = SessionLocal()
    try:
        sql = "TRUNCATE TABLE attendance, scan_results, scans, sessions, face_encodings, subjects, users RESTART IDENTITY CASCADE;"
        db.execute(text(sql))
        db.commit()
        print("Successfully truncated all tables in Neon database!")
    except Exception as e:
        db.rollback()
        print(f"Error during truncation: {str(e)}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    truncate_db()
