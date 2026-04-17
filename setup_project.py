import os
import subprocess
import sys

def setup():
    # 1. Create Folders
    folders = ['static', 'static/js', 'static/css']
    for folder in folders:
        os.makedirs(folder, exist_ok=True)
        print(f"Created folder: {folder}")

    # 2. Create requirements.txt
    with open('requirements.txt', 'w') as f:
        f.write("fastapi\nsqlmodel\nuvicorn[standard]\npython-dotenv\n")
    
    # 3. Create .env
    with open('.env', 'w') as f:
        f.write("DATABASE_URL=sqlite:///./papers.db\n")

    # 4. Install Dependencies
    print("Installing dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    
    print("\nProject setup complete!")
    print("Next: Copy the 'models.py' code into a new file named models.py.")

if __name__ == "__main__":
    setup()