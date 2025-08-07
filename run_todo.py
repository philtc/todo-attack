#!/usr/bin/env python3
"""
Simple launcher script for Todo Attack application.
"""
import sys
from pathlib import Path

# Add current directory to path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent))

from todo_app import main

if __name__ == "__main__":
    main()
