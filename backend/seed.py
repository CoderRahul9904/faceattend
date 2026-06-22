import os
import sys

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
import models
import auth

def seed_database():
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Seeding users...")
        
        # 1. Seed Teacher
        teacher_email = "teacher@demo.com"
        teacher = db.query(models.User).filter(models.User.email == teacher_email).first()
        if not teacher:
            teacher = models.User(
                name="Prof. Sarah Jenkins",
                email=teacher_email,
                password_hash=auth.get_password_hash("demo123"),
                role="teacher"
            )
            db.add(teacher)
            db.flush() # Populate ID
            print(f"-> Created teacher: {teacher_email}")
        else:
            print(f"-> Teacher already exists: {teacher_email}")

        # 2. Seed 6 Students
        students_seeded = []
        for i in range(1, 7):
            email = f"student{i}@demo.com"
            student_id = f"STU00{i}"
            student = db.query(models.User).filter(models.User.email == email).first()
            if not student:
                student = models.User(
                    name=f"Student Number {i}",
                    email=email,
                    password_hash=auth.get_password_hash("demo123"),
                    role="student",
                    student_id=student_id
                )
                db.add(student)
                print(f"-> Created student: {email} ({student_id})")
                students_seeded.append(email)
            else:
                print(f"-> Student already exists: {email}")
                students_seeded.append(email)

        # 3. Seed 2 Subjects
        subjects_data = [
            {"name": "Data Structures", "code": "CS301"},
            {"name": "Database Management Systems", "code": "CS401"}
        ]
        
        subjects_seeded = []
        for sub in subjects_data:
            subject = db.query(models.Subject).filter(models.Subject.code == sub["code"]).first()
            if not subject:
                subject = models.Subject(
                    name=sub["name"],
                    code=sub["code"],
                    teacher_id=teacher.id
                )
                db.add(subject)
                print(f"-> Created subject: {sub['name']} ({sub['code']})")
                subjects_seeded.append(sub["code"])
            else:
                print(f"-> Subject already exists: {sub['name']} ({sub['code']})")
                subjects_seeded.append(sub["code"])

        db.commit()
        print("\n" + "="*50)
        print("SEEDING SUMMARY")
        print("="*50)
        print(f"Teacher:            {teacher.name} ({teacher.email})")
        print(f"Students Seeded:    {len(students_seeded)} users")
        for i, email in enumerate(students_seeded, 1):
            print(f"  {i}. {email} (STU00{i})")
        print(f"Subjects Seeded:    {len(subjects_seeded)} subjects")
        for code in subjects_seeded:
            print(f"  - {code}")
        print("="*50)
        print("Database seeded successfully and is ready for use!")
        
    except Exception as e:
        db.rollback()
        print(f"Seeding failed: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
