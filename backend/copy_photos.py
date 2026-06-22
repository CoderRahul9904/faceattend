import os
import shutil

src = r"c:\Users\moury\Desktop\faceattend\backend\test_photos\rahul\Rahul_Passport_Image.jpeg"
dest_dir = r"c:\Users\moury\Desktop\faceattend\backend\test_photos\upload_photos"
os.makedirs(dest_dir, exist_ok=True)
for i in range(1, 6):
    shutil.copy(src, os.path.join(dest_dir, f"img{i}.jpg"))
print("Copied 5 files successfully!")
