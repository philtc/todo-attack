// Todo Attack Web Editor - Main Application
let editor;
let currentFile = 'todo.md';

// Apply heading colors from hex codes
function applyHeadingColors() {
    if (!editor) return;
    
    const model = editor.getModel();
    const lines = model.getLinesContent();
    
    // Clear previous decorations
    const decorations = [];
    const colors = new Set();
    
    lines.forEach((line, lineIndex) => {
        const match = line.match(/^#{1,3}\s+(.*?)(?:\s+(#[0-9A-Fa-f]{6}))?$/);
        if (match && match[2]) {
            const color = match[2];
            colors.add(color);
            const className = `heading-color-${color.substring(1)}`; // Remove # for CSS class name
            const startColumn = match[0].indexOf(match[1]) + 1;
            const endColumn = startColumn + match[1].length;
            
            decorations.push({
                range: new monaco.Range(lineIndex + 1, startColumn, lineIndex + 1, endColumn + 1),
                options: {
                    inlineClassName: className,
                    inlineClassNameAffectsLetterSpacing: true
                }
            });
        }
    });
    
    // Apply all decorations at once
    editor.deltaDecorations([], decorations);
    
    // Apply styles for the decorations
    const style = document.createElement('style');
    style.id = 'heading-colors';
    
    // Generate CSS for each unique color
    let css = '';
    colors.forEach(color => {
        const className = `heading-color-${color.substring(1)}`; // Remove # for CSS class name
        css += `
            .${className} {
                color: ${color} !important;
            }
        `;
    });
    
    style.textContent = css;
    
    // Remove existing style if it exists
    const existingStyle = document.getElementById('heading-colors');
    if (existingStyle) {
        document.head.removeChild(existingStyle);
    }
    
    if (colors.size > 0) {
        document.head.appendChild(style);
    }
}

// Theme management
let isDarkTheme = true;

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    const themeName = isDarkTheme ? 'todo-attack-dark' : 'todo-attack-light';
    monaco.editor.setTheme(themeName);
    
    // Update UI elements
    document.body.classList.toggle('light-theme', !isDarkTheme);
    document.body.classList.toggle('dark-theme', isDarkTheme);
    
    // Save preference
    localStorage.setItem('themePreference', isDarkTheme ? 'dark' : 'light');
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('themePreference') || 'dark';
    isDarkTheme = savedTheme === 'dark';
    
    // Apply theme
    const themeName = isDarkTheme ? 'todo-attack-dark' : 'todo-attack-light';
    if (monaco) {
        monaco.editor.setTheme(themeName);
    }
    
    // Update UI
    document.body.classList.toggle('light-theme', !isDarkTheme);
    document.body.classList.toggle('dark-theme', isDarkTheme);
}

// Initialize the editor
function initEditor() {
    // Register the todo language
    monaco.languages.register({ id: 'todo' });
    
    // Register custom commands
    monaco.editor.defineTheme('todo-attack', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'meta.task.pending', foreground: 'FF5722' },
            { token: 'meta.task.inprogress', foreground: '2196F3' },
            { token: 'meta.task.completed', foreground: '4CAF50', textDecoration: 'line-through' },
            { token: 'markup.heading', foreground: '673AB7', fontStyle: 'bold' },
            { token: 'entity.name.tag', foreground: '9C27B0' },
            { token: 'keyword.other.due', foreground: 'FF9800' },
            { token: 'keyword.other.priority', foreground: 'F44336', fontStyle: 'bold' }
        ]
    });
    
    // Register custom editor actions
    monaco.editor.addEditorAction({
        id: 'indentTask',
        label: 'Indent Task',
        keybindings: [monaco.KeyCode.Tab],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run: function(editor) {
            const selection = editor.getSelection();
            const model = editor.getModel();
            const lineNumber = selection.positionLineNumber;
            const line = model.getLineContent(lineNumber);
            
            // Only handle task lines
            if (/^\s*[-*+]\s*\[.\]/.test(line)) {
                const indentMatch = line.match(/^(\s*)/);
                const currentIndent = indentMatch ? indentMatch[1] : '';
                const newIndent = currentIndent + '    ';
                
                model.pushEditOperations(
                    [],
                    [{
                        range: new monaco.Range(lineNumber, 1, lineNumber, currentIndent.length + 1),
                        text: newIndent
                    }],
                    () => null
                );
                
                // Move cursor to the right position
                const position = selection.getPosition();
                const newColumn = position.column + 4;
                editor.setPosition({ lineNumber: position.lineNumber, column: newColumn });
                return;
            }
            
            // Default tab behavior
            editor.trigger('keyboard', 'tab', {});
        }
    });
    
    // Register Enter key handler
    monaco.editor.addEditorAction({
        id: 'newTaskLine',
        label: 'New Task Line',
        keybindings: [monaco.KeyCode.Enter],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.6,
        run: function(editor) {
            const selection = editor.getSelection();
            const model = editor.getModel();
            const lineNumber = selection.positionLineNumber;
            const line = model.getLineContent(lineNumber);
            
            // If line is blank, default enter behavior (new line)
            if (line.trim() === '') {
                editor.trigger('keyboard', 'type', { text: '\n' });
                return;
            }

            // Handle heading lines
            // Matches up to ###, captures optional trailing hex color (e.g., #1976D2)
            const headingMatch = line.match(/^(#{1,3})\s+(.+?)(\s+#[0-9A-Fa-f]{6})?\s*$/);
            if (headingMatch) {
                const hasHex = !!headingMatch[3];
                if (!hasHex) {
                    // Find nearest previous heading with a hex color
                    const lines = model.getLinesContent();
                    let inheritedHex = null;
                    for (let i = lineNumber - 2; i >= 0; i--) { // 0-based index
                        const m = lines[i].match(/^#{1,3}\s+.*\s+(#[0-9A-Fa-f]{6})\s*$/);
                        if (m) { inheritedHex = m[1]; break; }
                    }

                    // Default if no hex exists ABOVE (spec requires inheriting from above; otherwise use default)
                    if (!inheritedHex) {
                        // If there is truly no hex anywhere in the file, we still default to #1976D2.
                        // We won't inherit from below headings per spec wording.
                        inheritedHex = '#1976D2';
                    }

                    // Append the hex to the current heading line
                    const trimmedRight = line.replace(/\s+$/, '');
                    const newHeading = `${trimmedRight} ${inheritedHex}`;
                    model.pushEditOperations(
                        [],
                        [{
                            range: new monaco.Range(lineNumber, 1, lineNumber, line.length + 1),
                            text: newHeading
                        }],
                        () => null
                    );
                }

                // After ensuring hex, perform default enter behavior
                editor.trigger('keyboard', 'type', { text: '\n' });
                return;
            }

            // Only handle task lines
            if (/^\s*[-*+]\s*\[.\]/.test(line)) {
                const indentMatch = line.match(/^(\s*)/);
                const currentIndent = indentMatch ? indentMatch[1] : '';
                const newLine = '\n' + currentIndent + '- [ ] ';
                
                // If at the end of the line, just insert a new task
                if (selection.positionColumn >= line.length) {
                    model.pushEditOperations(
                        [],
                        [{
                            range: new monaco.Range(lineNumber, line.length + 1, lineNumber, line.length + 1),
                            text: newLine
                        }],
                        () => null
                    );
                    
                    // Position cursor on the new line after the task marker
                    editor.setPosition({
                        lineNumber: lineNumber + 1,
                        column: newLine.length + 1
                    });
                    return;
                }
                
                // If in the middle of the line, split it
                const position = selection.getPosition();
                const before = line.substring(0, position.column - 1);
                const after = line.substring(position.column - 1);
                
                model.pushEditOperations(
                    [],
                    [
                        {
                            range: new monaco.Range(lineNumber, 1, lineNumber, position.column),
                            text: before + '\n' + currentIndent + '- [ ] '
                        },
                        {
                            range: new monaco.Range(lineNumber, position.column, lineNumber, line.length + 1),
                            text: after
                        }
                    ],
                    () => null
                );
                
                // Position cursor on the new line after the task marker
                editor.setPosition({
                    lineNumber: lineNumber + 1,
                    column: currentIndent.length + 7 // Position after "- [ ] "
                });
                return;
            }
            
            // Default enter behavior
            editor.trigger('keyboard', 'type', { text: '\n' });
        }
    });
    
    // Register a folding range provider for todo language
    monaco.languages.registerFoldingRangeProvider('todo', {
        provideFoldingRanges: function(model, context, token) {
            const lines = model.getLinesContent();
            const ranges = [];
            const headerStack = [];
            
            // First pass: find all headers and their levels
            const headers = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const headerMatch = line.match(/^(#+)\s/);
                if (headerMatch) {
                    headers.push({
                        level: headerMatch[1].length,
                        lineNumber: i + 1, // 1-based
                        content: line.trim()
                    });
                }
            }
            
            // Second pass: create folding ranges between headers
            for (let i = 0; i < headers.length; i++) {
                const current = headers[i];
                const next = headers[i + 1];
                
                // Find the end of this section (either next header of same or higher level, or end of file)
                let endLine = lines.length;
                
                for (let j = i + 1; j < headers.length; j++) {
                    if (headers[j].level <= current.level) {
                        endLine = headers[j].lineNumber - 1;
                        break;
                    }
                }
                
                // Only create a range if there's content to fold
                if (current.lineNumber < endLine) {
                    ranges.push({
                        start: current.lineNumber,
                        end: endLine,
                        kind: monaco.languages.FoldingRangeKind.Region
                    });
                }
            }
            
            return ranges;
        }
    });
    
    // Define custom syntax highlighting
    monaco.languages.setMonarchTokensProvider('todo', {
        defaultToken: 'text',
        tokenPostfix: '.todo',
        
        // Define your syntax highlighting rules here
        tokenizer: {
            root: [
                // Completed tasks (entire line)
                [/^(\s*-\s*\[x\].*)$/, 'line-completed'],
                
                // In-progress tasks
                [/^\s*-\s*\[\/\]/, 'task-in-progress'],
                
                // Pending tasks
                [/^\s*-\s*\[\s*\]/, 'task-pending'],
                
                // Headers
                [/^#{1,3}\s+.*$/, 'header'],
                
                // Tags
                [/\+[\w-]+/, 'tag'],
                
                // Due dates
                [/(due:\d{4}-\d{2}-\d{2})/, 'due-date'],
                
                // Priority
                [/(\([abc]\))/, 'priority']
            ]
        }
    });
    
    // Define a theme for the editor
    monaco.editor.defineTheme('todo-attack', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'meta.task.pending', foreground: 'FF5722' },
            { token: 'meta.task.inprogress', foreground: '2196F3' },
            { token: 'meta.task.completed', foreground: '4CAF50', textDecoration: 'line-through' },
            { token: 'markup.heading', foreground: '673AB7', fontStyle: 'bold' },
            { token: 'entity.name.tag', foreground: '9C27B0' },
            { token: 'keyword.other.due', foreground: 'FF9800' },
            { token: 'keyword.other.priority', foreground: 'F44336', fontStyle: 'bold' }
        ],
        colors: {
            'editor.background': '#FFFFFF',
            'editor.lineHighlightBackground': '#F5F5F5',
            'editorLineNumber.foreground': '#999999',
            'editorLineNumber.activeForeground': '#000000',
            'editorIndentGuide.background': '#EEEEEE',
            'editorIndentGuide.activeBackground': '#DDDDDD'
        }
    });
    
    // Define dark theme
    monaco.editor.defineTheme('todo-attack-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'keyword', foreground: '569CD6' },
            { token: 'tag', foreground: '9CDCFE', fontStyle: 'bold' },
            { token: 'priority', foreground: 'F44747' },
            { token: 'due-date', foreground: '6A9955' },
            { token: 'header', foreground: '569CD6', fontStyle: 'bold' },
            { token: 'comment', foreground: '6A9955' },
            { token: 'task-done', foreground: '808080', textDecoration: 'line-through' },
            { token: 'task-in-progress', foreground: 'FFA500' },
            { token: 'task-pending', foreground: 'D4D4D4' },
            // Add a rule to style the entire line for completed tasks
            { token: 'line-completed', foreground: '808080', textDecoration: 'line-through' }
        ],
        colors: {
            'editor.background': '#2F2F2F',
            'editor.foreground': '#FFFFFF',
            'editor.lineHighlightBackground': '#333333',
            'editorLineNumber.foreground': '#666666',
            'editor.selectionBackground': '#ADD6FF',
            'editor.inactiveSelectionBackground': '#E5E5E5',
            'editorCursor.foreground': '#FFFFFF',
            'editorWhitespace.foreground': '#BBBBBB',
            'editorIndentGuide.background': '#444444',
            'editorIndentGuide.activeBackground': '#555555',
            'editor.selectionHighlightBorder': '#ADD6FF'
        }
    });

    // Define light theme
    monaco.editor.defineTheme('todo-attack-light', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'keyword', foreground: '0000FF' },
            { token: 'tag', foreground: '000080', fontStyle: 'bold' },
            { token: 'priority', foreground: 'FF0000' },
            { token: 'due-date', foreground: '008000' },
            { token: 'header', foreground: '000000', fontStyle: 'bold' },
            { token: 'comment', foreground: '008000' },
            { token: 'task-done', foreground: '808080', textDecoration: 'line-through' },
            { token: 'task-in-progress', foreground: 'FF8C00' },
            { token: 'task-pending', foreground: '000000' },
            // Add a rule to style the entire line for completed tasks
            { token: 'line-completed', foreground: '808080', textDecoration: 'line-through' }
        ],
        colors: {
            'editor.background': '#FFFFFF',
            'editor.foreground': '#000000',
            'editor.lineHighlightBackground': '#F5F5F5',
            'editorLineNumber.foreground': '#999999',
            'editor.selectionBackground': '#ADD6FF',
            'editor.inactiveSelectionBackground': '#E5E5E5',
            'editorCursor.foreground': '#000000',
            'editorWhitespace.foreground': '#BBBBBB',
            'editorIndentGuide.background': '#F0F0F0',
            'editorIndentGuide.activeBackground': '#D0D0D0',
            'editor.selectionHighlightBorder': '#ADD6FF'
        }
    });

    // Create the editor
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: '',
        language: 'todo',
        theme: 'todo-attack-dark',
        automaticLayout: true,
        fontSize: 14,
        lineNumbers: 'on',
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        wordWrap: 'on',
        folding: true,
        foldingHighlight: true,
        foldingStrategy: 'auto',
        showFoldingControls: 'always',
        foldingImportsByDefault: false,
        renderLineHighlight: 'all',
        lineDecorationsWidth: 10,
        glyphMargin: true,
        // Configure folding to work with headers
        foldingRanges: {
            maxFoldingRegions: 10000, // Increase if needed
            maxRangesPerProvider: 10000
        },
        cursorStyle: 'line',
        autoIndent: 'full',
        tabSize: 4,
        
        // Editor behavior options
        wordWrap: 'on',
        autoClosingBrackets: 'languageDefined',
        autoClosingQuotes: 'languageDefined',
        autoIndent: 'full',
        fontFamily: '"Roboto Mono", monospace',
        fontLigatures: true,
        scrollBeyondLastLine: false,
        tabCompletion: 'on',
        suggestOnTriggerCharacters: true,
        snippetSuggestions: 'inline',
        links: true,
        mouseWheelZoom: true,
        multiCursorModifier: 'alt',
        quickSuggestions: {
            other: true,
            comments: false,
            strings: true
        }
    });

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Load the file after editor is ready
    loadFile();
    
    // Apply heading colors after render and file load
    editor.getModel().onDidChangeContent(() => {
        applyHeadingColors();
        // If Kanban is visible, re-render it to reflect changes
        const kanbanEl = document.getElementById('kanban');
        if (kanbanEl && kanbanEl.style.display !== 'none') {
            renderKanban();
        }
    });
    
    // Initial apply
    setTimeout(applyHeadingColors, 500);
}

// Set up custom keyboard shortcuts
function setupKeyboardShortcuts() {
    // Add our custom commands
    const addCommand = (id, keybinding, handler) => {
        editor.addAction({
            id: id,
            label: id,
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode[keybinding]
            ],
            run: handler
        });
    };
    
    // Save file (Ctrl+Shift+S)
    addCommand('saveFile', 'KeyS', () => saveFile());
    
    // Load file (Ctrl+Shift+O)
    addCommand('loadFile', 'KeyO', () => loadFile());
    
    // Toggle task status (Ctrl+Shift+T)
    addCommand('toggleTaskStatus', 'KeyT', () => toggleTaskStatus());
    
    // Add today's date (Ctrl+Shift+D)
    addCommand('addTodaysDate', 'KeyD', () => addTodaysDate());
    
    // Insert new task (Ctrl+Shift+N)
    addCommand('insertTask', 'KeyN', () => insertTask());
    
    // Toggle help (Ctrl+Shift+H)
    addCommand('toggleHelp', 'KeyH', () => toggleHelp());
    
    // Additional global key handler to catch any remaining browser shortcuts
    document.addEventListener('keydown', function(e) {
        // Prevent browser's save dialog on Ctrl+S
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveFile();
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
            const model = editor.getModel();
            model.setValue(data.content);
            showStatus('File loaded successfully', 'success');
        } else {
            showStatus('Error: ' + (data.error || 'Unknown error occurred'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatus('Error loading file: ' + error.message, 'error');
    });
}

// Save file to server
function saveFile() {
    showStatus('Saving file...', 'info');
    
    const content = editor.getModel().getValue();
    
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
            showStatus('Error: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatus('Error saving file: ' + error.message, 'error');
    });
}

// Toggle task status between [ ], [/], [x]
function toggleTaskStatus() {
    const model = editor.getModel();
    const position = editor.getPosition();
    const lineNumber = position.lineNumber;
    const line = model.getLineContent(lineNumber);
    const lineStart = { lineNumber, column: 1 };
    const lineEnd = { lineNumber, column: line.length + 1 };
    
    // Toggle task status
    const newLine = line.replace(
        /^(\s*-\s*\[)([ x/])(\])/,
        (match, p1, p2, p3) => {
            if (p2 === ' ') return p1 + '/' + p3;  // [ ] -> [/]
            if (p2 === '/') return p1 + 'x' + p3;   // [/] -> [x]
            return p1 + ' ' + p3;                   // [x] -> [ ]
        }
    );
    
    // Apply the change
    editor.executeEdits('toggleTask', [{
        range: new monaco.Range(lineNumber, 1, lineNumber, line.length + 1),
        text: newLine
    }]);
    
    // Restore cursor position
    editor.setPosition(position);
    editor.focus();
}

// Add today's date as due date
function addTodaysDate() {
    const today = new Date().toISOString().split('T')[0];
    const position = editor.getPosition();
    const model = editor.getModel();
    const lineNumber = position.lineNumber;
    const line = model.getLineContent(lineNumber);
    
    // Check if line already has a due date
    if (line.includes('due:')) {
        // Replace existing due date
        const newLine = line.replace(/due:\d{4}-\d{2}-\d{2}/, `due:${today}`);
        editor.executeEdits('addTodaysDate', [{
            range: new monaco.Range(lineNumber, 1, lineNumber, line.length + 1),
            text: newLine
        }]);
    } else {
        // Add due date at end of line with a space if needed
        const separator = line.endsWith(' ') ? '' : ' ';
        const newLine = line + `${separator}due:${today}`;
        
        // Apply the change
        editor.executeEdits('addTodaysDate', [{
            range: new monaco.Range(lineNumber, 1, lineNumber, line.length + 1),
            text: newLine
        }]);
    }
    
    editor.focus();
}

// Insert a new task at current position
function insertTask() {
    const position = editor.getPosition();
    const model = editor.getModel();
    const lineNumber = position.lineNumber;
    const line = model.getLineContent(lineNumber);
    let newLine = '- [ ] ';
    
    // If the current line is not empty, add the task below
    if (line.trim() !== '') {
        newLine = '\n' + newLine;
        const insertPosition = {
            lineNumber: lineNumber + 1,
            column: 1
        };
        
        editor.executeEdits('insertTask', [{
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            text: newLine
        }]);
        
        editor.setPosition({
            lineNumber: insertPosition.lineNumber,
            column: newLine.length - 1  // -1 to account for the newline
        });
    } else {
        // Insert at current position
        const column = position.column || 1;
        editor.executeEdits('insertTask', [{
            range: new monaco.Range(lineNumber, column, lineNumber, column),
            text: newLine
        }]);
        
        // Move cursor to end of inserted text
        editor.setPosition({
            lineNumber: position.lineNumber,
            column: column + newLine.length
        });
    }
    
    // Focus the editor
    editor.focus();
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

// Auto-completion for tags and due dates only
function setupAutoCompletion() {
    // Define our completion items - only tags and due dates
    const todoCompletions = [
        // Common tags
        { label: '+ui', insertText: 'ui ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+react', insertText: 'react ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+api', insertText: 'api ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+database', insertText: 'database ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+frontend', insertText: 'frontend ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+backend', insertText: 'backend ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+testing', insertText: 'testing ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+bug', insertText: 'bug ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+feature', insertText: 'feature ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+refactor', insertText: 'refactor ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+high-priority', insertText: 'high-priority ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+critical', insertText: 'critical ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        { label: '+low-priority', insertText: 'low-priority ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Tag' },
        
        // Date templates
        { 
            label: 'due:today', 
            insertText: `due:${new Date().toISOString().split('T')[0]}`, 
            kind: monaco.languages.CompletionItemKind.Event,
            detail: 'Due date',
            documentation: `Due date: ${new Date().toISOString().split('T')[0]}`
        },
        { 
            label: 'due:tomorrow',
            insertText: `due:${new Date(Date.now() + 86400000).toISOString().split('T')[0]}`,
            kind: monaco.languages.CompletionItemKind.Event,
            detail: 'Due date',
            documentation: `Due date: ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}`
        },
        { 
            label: 'due:nextweek',
            insertText: `due:${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}`,
            kind: monaco.languages.CompletionItemKind.Event,
            detail: 'Due date',
            documentation: `Due date: ${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}`
        }
    ]; // Close the todoCompletions array

    // Register a completion item provider for the 'todo' language
    monaco.languages.registerCompletionItemProvider('todo', {
        provideCompletionItems: function(model, position) {
            // Get the text until the current position
            const textUntilCursor = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            });
            
            // Only show completions when we have a prefix or at the start of a word
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };
            
            // Only show completions after + (for tags) or after 'due:' (for dates)
            const lastPlusIndex = textUntilCursor.lastIndexOf('+');
            const lastDueIndex = textUntilCursor.lastIndexOf('due:');
            
            // Check if we're after a + or due:
            const isAfterPlus = lastPlusIndex > -1 && 
                (lastDueIndex === -1 || lastPlusIndex > lastDueIndex);
            const isAfterDue = lastDueIndex > -1 && 
                (lastPlusIndex === -1 || lastDueIndex > lastPlusIndex);
            
            let filtered = [];
            
            if (isAfterPlus) {
                // Show tag completions (without the + in insert text)
                const tagPrefix = textUntilCursor.substring(lastPlusIndex + 1).toLowerCase();
                filtered = todoCompletions
                    .filter(completion => completion.kind === monaco.languages.CompletionItemKind.Keyword)
                    .filter(completion => completion.label.substring(1).toLowerCase().startsWith(tagPrefix));
                
                // Adjust the range to replace from the +
                range.startColumn = lastPlusIndex + 1;
            } else if (isAfterDue) {
                // Show date completions
                const datePrefix = textUntilCursor.substring(lastDueIndex + 4).toLowerCase();
                filtered = todoCompletions
                    .filter(completion => completion.kind === monaco.languages.CompletionItemKind.Event)
                    .filter(completion => completion.label.toLowerCase().includes(datePrefix));
                
                // Adjust the range to replace from after 'due:'
                range.startColumn = lastDueIndex + 4;
            }
            
            return { 
                suggestions: filtered.map(item => ({
                    ...item,
                    range: range,
                    insertText: item.insertText, // Use the insertText as is (without + for tags)
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                })) 
            };
        }
    });
    
    // Enable autocompletion
    // Monaco's completion is enabled by default when a provider is registered
}

// ===== Kanban View =====
function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseTasks() {
    if (!editor) return [];
    const model = editor.getModel();
    const lines = model.getLinesContent();
    const tasks = [];
    let lastHeading = null;
    let lastColor = '#1976D2';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const h = line.match(/^(#{1,3})\s+(.*?)(?:\s+(#[0-9A-Fa-f]{6}))?\s*$/);
        if (h) {
            lastHeading = h[2].trim();
            if (h[3]) lastColor = h[3];
            continue;
        }
        const m = line.match(/^(\s*)[-*+]\s*\[([ x/])\]\s*(.*)$/);
        if (m) {
            const statusCh = m[2];
            let status = 'backlog';
            if (statusCh === '/') status = 'inprogress';
            else if (statusCh === 'x') status = 'done';
            const text = m[3];
            const tags = (text.match(/\+[\w-]+/g) || []).join(' ');
            const due = (text.match(/\bdue:\d{4}-\d{2}-\d{2}\b/) || [null])[0];
            tasks.push({
                id: `ln-${i + 1}`,
                lineNumber: i + 1,
                status,
                text,
                heading: lastHeading,
                color: lastColor || '#1976D2',
                tags,
                due
            });
        }
    }
    return tasks;
}

function attachDragHandlers(card) {
    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', card.dataset.lineNumber);
        e.dataTransfer.effectAllowed = 'move';
    });
}

function attachDropHandlers(zone) {
    zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const ln = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const targetStatus = zone.dataset.status;
        if (!ln || !targetStatus) return;
        updateTaskStatusAtLine(ln, targetStatus);
        renderKanban();
    });
}

function updateTaskStatusAtLine(lineNumber, targetStatus) {
    const model = editor.getModel();
    const line = model.getLineContent(lineNumber);
    const mapped = { backlog: ' ', inprogress: '/', done: 'x' };
    const ch = mapped[targetStatus] || ' ';
    // Support -, *, + bullets
    const newLine = line.replace(/^(\s*[-*+]\s*\[)([ x/])(\])/, (m, p1, _s, p3) => p1 + ch + p3);
    if (newLine !== line) {
        model.pushEditOperations([], [{
            range: new monaco.Range(lineNumber, 1, lineNumber, line.length + 1),
            text: newLine
        }], () => null);
    }
}

function renderKanban() {
    const tasks = parseTasks();
    const zones = {
        backlog: document.querySelector('.kanban-dropzone[data-status="backlog"]'),
        inprogress: document.querySelector('.kanban-dropzone[data-status="inprogress"]'),
        done: document.querySelector('.kanban-dropzone[data-status="done"]')
    };
    Object.values(zones).forEach(z => { if (z) z.innerHTML = ''; });
    tasks.forEach(t => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.lineNumber = String(t.lineNumber);
        card.style.borderLeftColor = t.color || '#1976D2';
        card.innerHTML = `
            <div class="title">${escapeHtml(t.text)}</div>
            <div class="meta">${escapeHtml(t.heading || 'Uncategorized')}${t.tags ? ' · ' + escapeHtml(t.tags) : ''}${t.due ? ' · ' + escapeHtml(t.due) : ''}</div>
        `;
        attachDragHandlers(card);
        const zone = zones[t.status] || zones.backlog;
        zone && zone.appendChild(card);
    });
    Object.values(zones).forEach(z => z && attachDropHandlers(z));
}

function toggleKanbanView() {
    const editorContainer = document.querySelector('.editor-container');
    const kanban = document.getElementById('kanban');
    const btn = document.getElementById('kanbanToggle');
    const showingKanban = kanban && kanban.style.display !== 'none' && kanban.style.display !== '';
    if (showingKanban) {
        if (kanban) kanban.style.display = 'none';
        if (editorContainer) editorContainer.style.display = 'flex';
        if (btn) btn.textContent = '🗂️ Kanban';
        if (editor) { editor.layout(); editor.focus(); }
    } else {
        if (editorContainer) editorContainer.style.display = 'none';
        if (kanban) kanban.style.display = 'block';
        if (btn) btn.textContent = '📄 List';
        renderKanban();
    }
}

// Initialize function to be called from HTML
globalThis.initEditor = initEditor;
globalThis.setupAutoCompletion = setupAutoCompletion;
globalThis.toggleKanbanView = toggleKanbanView;

// Prevent default browser shortcuts that conflict with our custom ones
document.addEventListener('keydown', function(e) {
    // Block Ctrl/Command + Shift + S/O/T/D/N/H
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (['s', 'o', 't', 'd', 'n', 'h'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            
            // Trigger the corresponding command
            const commands = {
                's': 'saveFile',
                'o': 'loadFile',
                't': 'toggleTask',
                'd': 'addDate',
                'n': 'insertTask',
                'h': 'toggleHelp'
            };
            
            if (commands[key]) {
                editor.commands.exec(commands[key], editor);
            }
        }
    }
}, true); // Use capture phase to ensure we catch the event first
