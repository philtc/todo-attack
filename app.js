// Todo Attack Web Editor - Main Application
let editor;
let currentFile = 'todo.md';

// Initialize the editor
function initEditor() {
    editor = ace.edit("editor");
    editor.setTheme("ace/theme/todo-attack");
    editor.session.setMode("ace/mode/todo");
    editor.setOptions({
        fontSize: 14,
        showPrintMargin: false,
        wrap: true,
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true
    });

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Load the todo.md file on startup
    loadFile();
}

// Set up custom keyboard shortcuts
function setupKeyboardShortcuts() {
    // Save file (Ctrl+S)
    editor.commands.addCommand({
        name: 'saveFile',
        bindKey: {win: 'Ctrl-S', mac: 'Command-S'},
        exec: function(editor) {
            saveFile();
        }
    });

    // Load file (Ctrl+O)
    editor.commands.addCommand({
        name: 'loadFile',
        bindKey: {win: 'Ctrl-O', mac: 'Command-O'},
        exec: function(editor) {
            loadFile();
        }
    });

    // Toggle task status (Ctrl+T)
    editor.commands.addCommand({
        name: 'toggleTask',
        bindKey: {win: 'Ctrl-T', mac: 'Command-T'},
        exec: function(editor) {
            toggleTaskStatus();
        }
    });

    // Add today's date (Ctrl+D)
    editor.commands.addCommand({
        name: 'addDate',
        bindKey: {win: 'Ctrl-D', mac: 'Command-D'},
        exec: function(editor) {
            addTodaysDate();
        }
    });

    // Insert new task (Ctrl+N)
    editor.commands.addCommand({
        name: 'insertTask',
        bindKey: {win: 'Ctrl-N', mac: 'Command-N'},
        exec: function(editor) {
            insertTask();
        }
    });

    // Toggle help (Ctrl+H)
    editor.commands.addCommand({
        name: 'toggleHelp',
        bindKey: {win: 'Ctrl-H', mac: 'Command-H'},
        exec: function(editor) {
            toggleHelp();
        }
    });
}

// Load file from server
function loadFile() {
    showStatus('Loading file...', 'info');
    
    fetch('file-handler.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'load',
            filename: currentFile
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            editor.setValue(data.content, -1);
            showStatus('File loaded successfully', 'success');
        } else {
            showStatus('Error loading file: ' + data.error, 'error');
        }
    })
    .catch(error => {
        showStatus('Error: ' + error.message, 'error');
    });
}

// Save file to server
function saveFile() {
    showStatus('Saving file...', 'info');
    
    const content = editor.getValue();
    
    fetch('file-handler.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'save',
            filename: currentFile,
            content: content
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatus('File saved successfully', 'success');
        } else {
            showStatus('Error saving file: ' + data.error, 'error');
        }
    })
    .catch(error => {
        showStatus('Error: ' + error.message, 'error');
    });
}

// Toggle task status between [ ], [/], [x]
function toggleTaskStatus() {
    const cursor = editor.getCursorPosition();
    const line = editor.session.getLine(cursor.row);
    
    let newLine = line;
    
    // Check for different task patterns and cycle through them
    if (line.match(/^(\s*)-\s*\[\s*\]/)) {
        // Pending -> In Progress
        newLine = line.replace(/^(\s*)-\s*\[\s*\]/, '$1- [/]');
    } else if (line.match(/^(\s*)-\s*\[\/\]/)) {
        // In Progress -> Completed
        newLine = line.replace(/^(\s*)-\s*\[\/\]/, '$1- [x]');
    } else if (line.match(/^(\s*)-\s*\[x\]/)) {
        // Completed -> Pending
        newLine = line.replace(/^(\s*)-\s*\[x\]/, '$1- [ ]');
    } else {
        // Not a task line, convert to pending task
        const indent = line.match(/^(\s*)/)[1];
        const content = line.replace(/^(\s*)/, '').replace(/^-\s*/, '');
        newLine = indent + '- [ ] ' + content;
    }
    
    // Replace the line
    const range = new ace.Range(cursor.row, 0, cursor.row, line.length);
    editor.session.replace(range, newLine);
    
    // Keep cursor position
    editor.moveCursorTo(cursor.row, cursor.column);
}

// Add today's date as due date
function addTodaysDate() {
    const today = new Date().toISOString().split('T')[0];
    const cursor = editor.getCursorPosition();
    const line = editor.session.getLine(cursor.row);
    
    // Check if line already has a due date
    if (line.includes('due:')) {
        // Replace existing due date
        const newLine = line.replace(/due:\d{4}-\d{2}-\d{2}/, `due:${today}`);
        const range = new ace.Range(cursor.row, 0, cursor.row, line.length);
        editor.session.replace(range, newLine);
    } else {
        // Add due date at end of line
        const newLine = line + ` due:${today}`;
        const range = new ace.Range(cursor.row, 0, cursor.row, line.length);
        editor.session.replace(range, newLine);
    }
}

// Insert a new task at current position
function insertTask() {
    const cursor = editor.getCursorPosition();
    const line = editor.session.getLine(cursor.row);
    const indent = line.match(/^(\s*)/)[1];
    
    const newTask = indent + '- [ ] ';
    editor.session.insert({row: cursor.row + 1, column: 0}, newTask + '\n');
    editor.moveCursorTo(cursor.row + 1, newTask.length);
}

// Show status message
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
    statusEl.style.display = 'block';
    
    // Hide after 3 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// Toggle help panel
function toggleHelp() {
    const helpEl = document.getElementById('shortcuts-help');
    helpEl.classList.toggle('show');
}

// Auto-completion for tags and common patterns
function setupAutoCompletion() {
    const todoCompletions = [
        {caption: "+ui", value: "+ui", meta: "tag"},
        {caption: "+react", value: "+react", meta: "tag"},
        {caption: "+api", value: "+api", meta: "tag"},
        {caption: "+database", value: "+database", meta: "tag"},
        {caption: "+frontend", value: "+frontend", meta: "tag"},
        {caption: "+backend", value: "+backend", meta: "tag"},
        {caption: "+testing", value: "+testing", meta: "tag"},
        {caption: "+bug", value: "+bug", meta: "tag"},
        {caption: "+feature", value: "+feature", meta: "tag"},
        {caption: "+refactor", value: "+refactor", meta: "tag"},
        {caption: "+high-priority", value: "+high-priority", meta: "tag"},
        {caption: "+critical", value: "+critical", meta: "tag"},
        {caption: "+low-priority", value: "+low-priority", meta: "tag"},
        {caption: "due:", value: "due:" + new Date().toISOString().split('T')[0], meta: "date"},
        {caption: "(a)", value: "(a)", meta: "priority"},
        {caption: "(b)", value: "(b)", meta: "priority"},
        {caption: "(c)", value: "(c)", meta: "priority"},
        {caption: "- [ ]", value: "- [ ] ", meta: "task"},
        {caption: "- [/]", value: "- [/] ", meta: "task"},
        {caption: "- [x]", value: "- [x] ", meta: "task"}
    ];

    editor.completers.push({
        getCompletions: function(editor, session, pos, prefix, callback) {
            callback(null, todoCompletions.filter(function(completion) {
                return completion.caption.toLowerCase().indexOf(prefix.toLowerCase()) === 0;
            }));
        }
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initEditor();
    setupAutoCompletion();
});

// Prevent default browser shortcuts that conflict with our custom ones
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && ['s', 'o', 't', 'd', 'n', 'h'].includes(e.key.toLowerCase())) {
        e.preventDefault();
    }
});
