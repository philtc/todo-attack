#!/usr/bin/env python3
"""
Todo Attack - Main Launcher
Provides both TUI and Web interface options for markdown todo management.
"""
import sys
import argparse
import subprocess
from pathlib import Path

def run_tui():
    """Launch the Textual TUI application."""
    try:
        from todo_app import main
        print("🚀 Starting Todo Attack TUI...")
        main()
    except ImportError as e:
        print(f"❌ Error importing TUI modules: {e}")
        print("💡 Make sure you've installed the requirements: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error running TUI: {e}")
        sys.exit(1)

def run_web():
    """Launch the Flask web application."""
    try:
        from web_server import app
        print("🌐 Starting Todo Attack Web Interface...")
        print("📱 Open your browser to: http://localhost:5000")
        app.run(debug=True, host='0.0.0.0', port=5000)
    except ImportError as e:
        print(f"❌ Error importing web modules: {e}")
        print("💡 Make sure you've installed the requirements: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error running web server: {e}")
        sys.exit(1)

def check_requirements():
    """Check if todo.md file exists and requirements are installed."""
    todo_file = Path("todo.md")
    if not todo_file.exists():
        print("⚠️  Warning: todo.md file not found in current directory.")
        print("📝 Create a todo.md file with your tasks to get started.")
        print("\nExample todo.md structure:")
        print("""
# Work
## Project Alpha
- [ ] design login page +ui +high-priority due:2025-01-20
- [/] implement dashboard +react +frontend
- [x] setup routing +react

# Personal  
## Home Tasks
- [ ] grocery shopping +errands
- [ ] fix leaky faucet +maintenance due:2025-01-15
        """)
        return False
    return True

def show_help():
    """Show application help and features."""
    print("""
📝 Todo Attack - Markdown-based Todo Management

🎯 FEATURES:
• Hierarchical task organization (categories → projects → task groups)
• Task status tracking: pending [ ], in-progress [/], completed [x]
• Flexible tagging system with +tag syntax
• Due date management with due:YYYY-MM-DD format
• Priority indicators with (a), (b), (c) notation

🖥️  TUI MODE (Textual Interface):
• Rich terminal interface with tree view
• Keyboard shortcuts:
  - Ctrl+T: Toggle task status
  - Ctrl+D: Add today's date as due date
  - Ctrl+Z: Toggle fold/unfold groups
  - Ctrl+S: Save changes
  - Ctrl+R: Refresh from file
  - Ctrl+Q: Quit
• Filtering by status, tags, and categories
• Real-time search and navigation

🌐 WEB MODE (Browser Interface):
• Modern web interface accessible from any browser
• Click-to-toggle task status
• Filter buttons for different views
• Search functionality
• Responsive design for mobile and desktop
• Real-time updates with auto-save

📁 FILE STRUCTURE:
Your todo.md file should follow this structure:
# Category (Work, Personal, Learning, etc.)
## Project Name
### Task Group (optional)
- [ ] task description +tags due:YYYY-MM-DD

🏷️  TAGGING EXAMPLES:
+ui +frontend +react +high-priority +bug +feature +meeting +research

📅 DUE DATE FORMAT:
due:2025-01-20 (always use YYYY-MM-DD format)

🔥 PRIORITY FORMAT:
(a) high priority, (b) medium priority, (c) low priority
    """)

def main():
    """Main application entry point."""
    parser = argparse.ArgumentParser(
        description="Todo Attack - Markdown-based Todo Management",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        'mode', 
        nargs='?', 
        choices=['tui', 'web', 'help'], 
        default='tui',
        help='Interface mode: tui (terminal), web (browser), or help'
    )
    
    parser.add_argument(
        '--check', 
        action='store_true',
        help='Check if todo.md exists and show example structure'
    )
    
    args = parser.parse_args()
    
    print("📝 Todo Attack - Markdown Todo Management")
    print("=" * 50)
    
    if args.check:
        check_requirements()
        return
    
    if args.mode == 'help':
        show_help()
        return
    
    # Check if todo.md exists
    if not check_requirements():
        response = input("\n❓ Continue anyway? (y/N): ").lower().strip()
        if response != 'y':
            print("👋 Create todo.md and try again!")
            return
    
    # Launch the appropriate interface
    if args.mode == 'tui':
        run_tui()
    elif args.mode == 'web':
        run_web()

if __name__ == "__main__":
    main()
