#!/usr/bin/env python3
import os
import sys
import subprocess

def setup_project():
    """Setup the Web3 Audit Intelligence System"""
    print("🚀 Setting up Web3 Audit Intelligence System...")

    # Create virtual environment
    subprocess.run([sys.executable, "-m", "venv", "venv"])

    # Install dependencies
    pip_cmd = "venv/bin/pip" if os.name != 'nt' else "venv\\Scripts\\pip"
    subprocess.run([pip_cmd, "install", "-r", "requirements.txt"])

    # Setup database
    print("Setting up database...")
    # Database setup logic here

    print("✅ Setup complete!")
    print("Run 'source venv/bin/activate' to activate environment")
    print("Then 'python run.py' to start the system")

if __name__ == "__main__":
    setup_project()