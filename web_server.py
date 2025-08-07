"""
Simple web interface for Todo Attack using Flask.
"""
from flask import Flask, render_template, request, jsonify, redirect, url_for, send_file, abort
from werkzeug.utils import secure_filename
from datetime import date
import json
import os
import re
import secrets
from pathlib import Path

from todo_model import TodoParser, TaskStatus

app = Flask(__name__)
# Security configurations
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024  # Reduced to 2MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['SECRET_KEY'] = secrets.token_hex(32)  # Generate secure secret key
app.config['WTF_CSRF_ENABLED'] = True

# Security constants
ALLOWED_EXTENSIONS = {'.md', '.txt'}  # Only allow markdown and text files
MAX_FILENAME_LENGTH = 255
MAX_CONTENT_LENGTH = 1024 * 1024  # 1MB max content size

parser = TodoParser()
current_file = Path("todo.md")

# Create uploads directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def load_todos():
    """Load todos from current file."""
    global parser, current_file
    if current_file.exists():
        parser.parse_file(str(current_file))
    return parser

@app.route('/')
def index():
    """Main page showing all todos."""
    parser = load_todos()
    return render_template('index.html', 
                         groups=parser.root_groups,
                         tasks=parser.all_tasks,
                         current_file=current_file.name,
                         today=date.today())

@app.route('/api/toggle_task/<int:line_number>', methods=['POST'])
def toggle_task(line_number):
    """Toggle task status via API."""
    parser = load_todos()
    
    # Find task by line number
    task = next((t for t in parser.all_tasks if t.line_number == line_number), None)
    if task:
        task.toggle_status()
        parser.save_to_file(str(current_file))
        return jsonify({'status': 'success', 'new_status': task.status.name})
    
    return jsonify({'status': 'error', 'message': 'Task not found'}), 404

@app.route('/api/add_due_date/<int:line_number>', methods=['POST'])
def add_due_date(line_number):
    """Add due date to task via API."""
    parser = load_todos()
    
    task = next((t for t in parser.all_tasks if t.line_number == line_number), None)
    if task:
        task.add_due_date_today()
        parser.save_to_file(str(current_file))
        return jsonify({'status': 'success', 'due_date': str(task.due_date)})
    
    return jsonify({'status': 'error', 'message': 'Task not found'}), 404

@app.route('/api/filter')
def filter_tasks():
    """Filter tasks by various criteria."""
    parser = load_todos()
    
    status_filter = request.args.get('status')
    tag_filter = request.args.get('tags')
    
    tasks = parser.all_tasks
    
    if status_filter:
        status_map = {
            'pending': TaskStatus.PENDING,
            'progress': TaskStatus.IN_PROGRESS,
            'completed': TaskStatus.COMPLETED
        }
        if status_filter in status_map:
            tasks = [t for t in tasks if t.status == status_map[status_filter]]
    
    if tag_filter:
        tags = [tag.strip() for tag in tag_filter.split(',')]
        tasks = [t for t in tasks if any(tag in t.tags for tag in tags)]
    
    return jsonify([{
        'text': task.text,
        'status': task.status.name,
        'tags': task.tags,
        'due_date': str(task.due_date) if task.due_date else None,
        'line_number': task.line_number
    } for task in tasks])

@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    """Handle file upload."""
    if request.method == 'POST':
        if 'file' not in request.files:
            return jsonify({'status': 'error', 'message': 'No file selected'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'status': 'error', 'message': 'No file selected'}), 400
        
        # Security: Validate file
        if not is_valid_upload_file(file):
            return jsonify({'status': 'error', 'message': 'Invalid file type or content'}), 400
        
        # Security: Generate secure filename
        filename = generate_secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Security: Ensure we don't overwrite existing files
        if os.path.exists(filepath):
            return jsonify({'status': 'error', 'message': 'File already exists'}), 409
        
        try:
            # Security: Read and validate content before saving
            content = file.read().decode('utf-8')
            if len(content) > MAX_CONTENT_LENGTH:
                return jsonify({'status': 'error', 'message': 'File too large'}), 413
            
            # Security: Validate content is safe markdown
            if not is_safe_markdown_content(content):
                return jsonify({'status': 'error', 'message': 'Invalid file content'}), 400
            
            # Save file securely
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            global current_file
            current_file = Path(filepath)
            
            return jsonify({'status': 'success', 'message': f'File {filename} uploaded successfully'})
        except UnicodeDecodeError:
            return jsonify({'status': 'error', 'message': 'Invalid file encoding'}), 400
        except Exception:
            return jsonify({'status': 'error', 'message': 'Upload failed'}), 500
    
    return render_template('upload.html')

@app.route('/select_file', methods=['POST'])
def select_file():
    """Select an existing file to work with."""
    data = request.get_json()
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'status': 'error', 'message': 'No filename provided'}), 400
    
    # Security: Validate and sanitize filename
    if not is_safe_filename(filename):
        return jsonify({'status': 'error', 'message': 'Invalid filename'}), 400
    
    filepath = Path(filename)
    
    # Security: Ensure file is within allowed directories
    if not is_safe_path(filepath):
        return jsonify({'status': 'error', 'message': 'Access denied'}), 403
    
    if not filepath.exists():
        return jsonify({'status': 'error', 'message': 'File not found'}), 404
    
    global current_file
    current_file = filepath
    
    return jsonify({'status': 'success', 'message': f'Selected file: {filepath.name}'})

@app.route('/get_file_content')
def get_file_content():
    """Get the raw content of the current file for editing."""
    global current_file
    
    if not current_file.exists():
        return jsonify({'status': 'error', 'message': 'File not found'}), 404
    
    try:
        with open(current_file, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'status': 'success', 'content': content, 'filename': current_file.name})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/save_file_content', methods=['POST'])
def save_file_content():
    """Save the edited content back to the file."""
    global current_file
    
    data = request.get_json()
    content = data.get('content')
    
    if content is None:
        return jsonify({'status': 'error', 'message': 'No content provided'}), 400
    
    # Security: Validate content size
    if len(content) > MAX_CONTENT_LENGTH:
        return jsonify({'status': 'error', 'message': 'Content too large'}), 413
    
    # Security: Validate content is safe markdown
    if not is_safe_markdown_content(content):
        return jsonify({'status': 'error', 'message': 'Invalid content'}), 400
    
    # Security: Ensure current_file is safe
    if not is_safe_path(current_file):
        return jsonify({'status': 'error', 'message': 'Access denied'}), 403
    
    try:
        with open(current_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Reload the parser with new content
        load_todos()
        
        return jsonify({'status': 'success', 'message': 'File saved successfully'})
    except Exception:
        return jsonify({'status': 'error', 'message': 'Save failed'}), 500

@app.route('/list_files')
def list_files():
    """List available markdown files in current directory and uploads folder."""
    files = []
    
    # Current directory .md files
    for file in Path('.').glob('*.md'):
        files.append({
            'name': file.name,
            'path': str(file),
            'size': file.stat().st_size,
            'location': 'current'
        })
    
    # Uploaded files
    upload_dir = Path(app.config['UPLOAD_FOLDER'])
    if upload_dir.exists():
        for file in upload_dir.glob('*.md'):
            files.append({
                'name': file.name,
                'path': str(file),
                'size': file.stat().st_size,
                'location': 'uploads'
            })
    
    return jsonify({'files': files})

@app.route('/download/<path:filename>')
def download_file(filename):
    """Download a file."""
    # Security: Validate and sanitize filename
    if not is_safe_filename(filename):
        abort(400)
    
    filepath = Path(filename)
    
    # Security: Ensure file is within allowed directories
    if not is_safe_path(filepath):
        abort(403)
    
    if not filepath.exists():
        abort(404)
    
    # Security: Check file extension
    if filepath.suffix.lower() not in ALLOWED_EXTENSIONS:
        abort(403)
    
    try:
        return send_file(filepath, as_attachment=True)
    except Exception:
        abort(500)

# Security helper functions
def is_safe_filename(filename):
    """Check if filename is safe and doesn't contain path traversal."""
    if not filename or len(filename) > MAX_FILENAME_LENGTH:
        return False
    
    # Check for path traversal attempts
    if '..' in filename or '/' in filename or '\\' in filename:
        return False
    
    # Check for null bytes and other dangerous characters
    if '\x00' in filename or any(ord(c) < 32 for c in filename):
        return False
    
    return True

def is_safe_path(filepath):
    """Check if file path is within allowed directories."""
    try:
        # Resolve path to absolute path
        abs_path = filepath.resolve()
        
        # Get current working directory and uploads directory
        cwd = Path.cwd().resolve()
        upload_dir = (Path.cwd() / app.config['UPLOAD_FOLDER']).resolve()
        
        # Check if path is within current directory or uploads directory
        try:
            abs_path.relative_to(cwd)
            return True
        except ValueError:
            try:
                abs_path.relative_to(upload_dir)
                return True
            except ValueError:
                return False
    except Exception:
        return False

def is_valid_upload_file(file):
    """Validate uploaded file is safe."""
    if not file or not file.filename:
        return False
    
    # Check filename
    if not is_safe_filename(file.filename):
        return False
    
    # Check file extension
    filename_lower = file.filename.lower()
    if not any(filename_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        return False
    
    return True

def generate_secure_filename(original_filename):
    """Generate a secure filename."""
    # Use werkzeug's secure_filename and add timestamp for uniqueness
    base_name = secure_filename(original_filename)
    if not base_name:
        base_name = 'upload.md'
    
    # Add timestamp to prevent conflicts
    name_parts = base_name.rsplit('.', 1)
    if len(name_parts) == 2:
        name, ext = name_parts
        return f"{name}_{secrets.token_hex(8)}.{ext}"
    else:
        return f"{base_name}_{secrets.token_hex(8)}"

def is_safe_markdown_content(content):
    """Validate markdown content is safe."""
    if not isinstance(content, str):
        return False
    
    # Check for suspicious patterns that might indicate code injection
    suspicious_patterns = [
        r'<script[^>]*>',
        r'javascript:',
        r'data:text/html',
        r'vbscript:',
        r'onload\s*=',
        r'onerror\s*=',
        r'onclick\s*=',
    ]
    
    content_lower = content.lower()
    for pattern in suspicious_patterns:
        if re.search(pattern, content_lower):
            return False
    
    return True

# Security headers
@app.after_request
def add_security_headers(response):
    """Add security headers to all responses."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    return response

if __name__ == '__main__':
    # Security: Disable debug mode in production
    import os
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode, host='127.0.0.1', port=5000)  # Changed to localhost only
