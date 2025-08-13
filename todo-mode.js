// Custom Ace Editor mode for Todo Attack markdown syntax
ace.define("ace/mode/todo", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/markdown_highlight_rules", "ace/tokenizer", "ace/range"], function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextMode = require("./text").Mode;
    var MarkdownHighlightRules = require("./markdown_highlight_rules").MarkdownHighlightRules;
    var Tokenizer = require("../tokenizer").Tokenizer;
    var Range = require("../range").Range;

    var TodoHighlightRules = function() {
        MarkdownHighlightRules.call(this);

        // Add custom rules for Todo Attack syntax
        this.$rules.start.unshift(
            // Task status highlighting with proper cursor positioning
            {
                token: [
                    "markup.list.pending",
                    "markup.list.pending.checkbox",
                    "markup.list.pending",
                    "markup.list.pending"
                ],
                regex: /^((\s*)-\s*\[)(\s*)(\])/,
                next: "task-line"
            },
            {
                token: [
                    "markup.list.inprogress",
                    "markup.list.inprogress.checkbox",
                    "markup.list.inprogress",
                    "markup.list.inprogress"
                ],
                regex: /^((\s*)-\s*\[)(\/)(\])/,
                next: "task-line"
            },
            {
                token: [
                    "markup.list.completed",
                    "markup.list.completed.checkbox",
                    "markup.list.completed",
                    "markup.list.completed"
                ],
                regex: /^((\s*)-\s*\[)(x)(\])/,
                next: "task-line"
            },
            // Priority indicators with different colors
            {
                token: "keyword.priority.high",
                regex: /\(a\)/
            },
            {
                token: "keyword.priority.medium",
                regex: /\(b\)/
            },
            {
                token: "keyword.priority.low",
                regex: /\(c\)/
            },
            // Tags
            {
                token: "string.tag",
                regex: /\+[\w-]+/
            },
            // Due dates
            {
                token: "constant.numeric.date",
                regex: /due:\d{4}-\d{2}-\d{2}/
            },
            // Color codes - no special styling
            {
                token: "text",
                regex: /#[0-9A-Fa-f]{6}/
            },
            // Headers with color codes - match the entire line as one token
            {
                token: function(value) {
                    // This will match the entire heading line including the # and hex code
                    return "heading-line";
                },
                regex: /^#{1,3}[^\n]*?(?:#[0-9A-Fa-f]{6})?$/,
                merge: false,
                caseInsensitive: true,
                next: "headingContent"
            },
            // This state handles the actual content of the heading
            {
                defaultToken: "heading-line",
                token: function(value) {
                    if (/#[0-9A-Fa-f]{6}$/i.test(value)) {
                        const hexColor = value.match(/#([0-9A-Fa-f]{6})$/i)[0].toLowerCase();
                        return `heading-line heading-color-${hexColor.substring(1)}`;
                    }
                    return "heading-line";
                },
                regex: ".+",
                next: "start"
            },
            // Completed tasks - light grey
            {
                token: "completed",
                regex: /^\s*-\s*\[x\].*$/,
                merge: false
            }
        );

        // Task line state for highlighting within task content
        this.$rules["task-line"] = [
            {
                token: "keyword.priority",
                regex: /\([abc]\)/
            },
            {
                token: "string.tag",
                regex: /\+[\w-]+/
            },
            {
                token: "constant.numeric.date",
                regex: /due:\d{4}-\d{2}-\d{2}/
            },
            {
                token: "text",
                regex: /$/,
                next: "start"
            },
            {
                defaultToken: "text"
            }
        ];
    };

    oop.inherits(TodoHighlightRules, MarkdownHighlightRules);

    // Custom Fold Mode for Todo Attack
    var FoldMode = function() {};
    
    // Use the markdown fold mode as base
    var MarkdownFoldMode = require("../mode/folding/markdown").FoldMode;
    oop.inherits(FoldMode, MarkdownFoldMode);
    
    (function() {
        this.getFoldWidget = function(session, foldStyle, row) {
            var line = session.getLine(row);
            var isStart = line.match(/^#+\s+.*/);
            
            if (!isStart) return "";
            
            // Check if this header has content to fold
            var level = line.match(/^(#+)/)[1].length;
            var nextRow = row + 1;
            var maxRow = session.getLength();
            
            while (nextRow < maxRow) {
                var nextLine = session.getLine(nextRow);
                var match = nextLine.match(/^(#+)/);
                
                if (match && match[1].length <= level) {
                    return nextRow > row + 1 ? "start" : "";
                }
                nextRow++;
            }
            
            return nextRow > row + 1 ? "start" : "";
        };
        
        this.getFoldWidgetRange = function(session, foldStyle, row) {
            var line = session.getLine(row);
            var match = line.match(/^(#+)/);
            
            if (!match) return null;
            
            var level = match[1].length;
            var startRow = row;
            var endRow = session.getLength();
            
            // Find the end of the foldable section
            for (var i = row + 1; i < session.getLength(); i++) {
                var nextLine = session.getLine(i);
                var nextMatch = nextLine.match(/^(#+)/);
                
                if (nextMatch && nextMatch[1].length <= level) {
                    endRow = i - 1;
                    break;
                }
            }
            
            // Don't fold if there's only one line
            if (startRow >= endRow) return null;
            
            return new Range(startRow, line.length, endRow, session.getLine(endRow).length);
        };
        
    }).call(FoldMode.prototype);
    
    // Export the FoldMode
    exports.FoldMode = FoldMode;

    var Mode = function() {
        TextMode.call(this);
        this.HighlightRules = TodoHighlightRules;
        
        // Initialize the fold mode with the custom FoldMode class
        this.foldingRules = new FoldMode();
        
        // Set default behavior
        this.$behaviour = this.$defaultBehaviour;
        
        // Add toggle fold behavior
        var self = this;
        this.$behaviour.$toggleFoldWidget = function(editor) {
            var cursor = editor.getCursorPosition();
            var session = editor.session;
            var row = cursor.row;
            var line = session.getLine(row);
            
            // If we're on a header line, handle the fold
            if (line.match(/^#+\s+/)) {
                var range = self.foldingRules.getFoldWidgetRange(session, "markbegin", row);
                if (range) {
                    if (session.getFoldAt(row, 1, 1)) {
                        session.unfold(range);
                    } else {
                        session.foldAll(range.start.row, range.end.row, range.start.column);
                    }
                    return true;
                }
            }
            return false;
        };
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.type = "text";
        this.tabSize = 4;
        
        this.getNextLineIndent = function(state, line, tab) {
            // Preserve current indentation for new lines
            var indent = this.$getIndent(line).replace(/\t/g, '    ');
            
            // If the line ends with a colon, add an extra level of indentation
            if (/\s*[-*+]\s*\[.\]/.test(line) && line.trim().endsWith(':')) {
                indent += '    ';
            }
            return indent;
        };
        
        // Handle tab key for indentation
        this.getMatching = function(session, row, column, chr) {
            if (chr === '\t') {
                // Get current line and cursor position
                var line = session.getLine(row);
                var cursor = session.selection.getCursor();
                var selection = session.selection;
                
                // If there's a selection, indent all selected lines
                if (!selection.isEmpty()) {
                    var range = selection.getRange();
                    var startRow = range.start.row;
                    var endRow = range.end.row;
                    
                    // If selection ends at column 0, don't include the last line
                    if (range.end.column === 0 && endRow > startRow) {
                        endRow--;
                    }
                    
                    // Indent each selected line
                    for (var i = startRow; i <= endRow; i++) {
                        var lineContent = session.getLine(i);
                        var indent = this.$getIndent(lineContent);
                        var newIndent = '    ' + indent;
                        session.doc.replace(
                            new Range(i, 0, i, indent.length),
                            newIndent
                        );
                    }
                    
                    // Adjust the selection
                    if (startRow === endRow) {
                        selection.setSelectionRange({
                            start: { row: startRow, column: range.start.column + 4 },
                            end: { row: endRow, column: range.end.column + 4 }
                        });
                    } else {
                        selection.setSelectionRange({
                            start: { row: startRow, column: range.start.column + 4 },
                            end: { row: endRow, column: range.end.column }
                        });
                    }
                    
                    return {
                        indent: '',
                        type: 'text',
                        match: ''
                    };
                }
                // If it's a task line, indent it
                else if (/^\s*[-*+]\s*\[.\]/.test(line)) {
                    var indent = this.$getIndent(line);
                    var newIndent = indent + '    ';
                    session.doc.replace(
                        new Range(row, 0, row, indent.length),
                        newIndent
                    );
                    
                    // Move cursor to the right position after indentation
                    var newColumn = column + 4 - (column % 4) + (column % 4 === 0 ? 4 : 0);
                    selection.moveCursorTo(row, newColumn);
                    
                    return {
                        indent: newIndent,
                        type: 'text',
                        match: ''
                    };
                }
            }
            return undefined;
        };
        
        // Handle shift+tab for outdenting
        this.autoOutdent = function(state, session, row) {
            var selection = session.selection;
            var range = selection.getRange();
            var startRow = range.start.row;
            var endRow = range.end.row;
            
            // If there's a selection, outdent all selected lines
            if (!selection.isEmpty() && endRow > startRow) {
                for (var i = startRow; i <= endRow; i++) {
                    var line = session.getLine(i);
                    var match = line.match(/^\s*/)[0];
                    
                    if (match.length >= 4) {
                        var newIndent = match.replace(/^ {4}|^\t/, '');
                        session.doc.replace(
                            new Range(i, 0, i, match.length),
                            newIndent
                        );
                    }
                }
                return true;
            }
            // Single line outdent
            else {
                var line = session.getLine(row);
                var match = line.match(/^\s*/)[0];
                
                if (match.length >= 4) {
                    var newIndent = match.replace(/^ {4}|^\t/, '');
                    session.doc.replace(
                        new Range(row, 0, row, match.length),
                        newIndent
                    );
                    
                    // Adjust cursor position
                    var cursor = selection.getCursor();
                    var newColumn = Math.max(0, cursor.column - 4);
                    selection.moveCursorTo(cursor.row, newColumn);
                    
                    return true;
                }
            }
            return false;
        };
        
        // Handle Enter key for task lines
        this.onEnter = function(state, session, range) {
            var cursor = range.start;
            var line = session.getLine(cursor.row);
            var match = line.match(/^(\s*[-*+]\s*\[[ x]\])(\s*)/);
            
            if (match) {
                // Get the current indentation and task marker
                var indent = match[1].length + match[2].length;
                var currentIndent = line.match(/^\s*/)[0];
                
                // Insert new line with the same indentation and task marker
                var newLine = '\n' + currentIndent + '- [ ] ';
                
                // If we're at the end of the line, just insert the new task
                if (cursor.column >= line.length) {
                    session.doc.replace(range, newLine);
                    return {
                        indent: currentIndent + '    ',
                        text: newLine,
                        selection: [1, newLine.length]
                    };
                }
                // If we're in the middle of the line, split it
                else {
                    var before = line.substring(0, cursor.column);
                    var after = line.substring(cursor.column);
                    
                    session.doc.replace(range, '\n' + currentIndent + after);
                    
                    return {
                        text: '\n' + currentIndent + '- [ ] ',
                        selection: [1, currentIndent.length + 6] // Position after the task marker
                    };
                }
            }
            
            // Default behavior for non-task lines
            return this.$getIndent(line);
        };
        
        this.$id = "ace/mode/todo";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});

// Custom theme for Todo Attack
ace.define("ace/theme/todo-attack", ["require", "exports", "module", "ace/lib/dom"], function(require, exports, module) {
    exports.isDark = false;
    exports.cssClass = "ace-todo-attack";
    exports.cssText = `
.ace-todo-attack .ace_gutter {
    background: #f8f9fa;
    color: #6c757d;
}

.ace-todo-attack .ace_print-margin {
    width: 1px;
    background: #e9ecef;
}

.ace-todo-attack {
    background-color: #ffffff;
    color: #212529;
}

.ace-todo-attack .ace_cursor {
    color: #212529;
}

.ace-todo-attack .ace_marker-layer .ace_selection {
    background: #007bff33;
}

.ace-todo-attack .ace_marker-layer .ace_step {
    background: #ffecb3;
}

.ace-todo-attack .ace_marker-layer .ace_bracket {
    margin: -1px 0 0 -1px;
    border: 1px solid #d1ecf1;
}

.ace-todo-attack .ace_marker-layer .ace_active-line {
    background: #f8f9fa;
}

.ace-todo-attack .ace_gutter-active-line {
    background-color: #f8f9fa;
}

.ace-todo-attack .ace_marker-layer .ace_selected-word {
    background: #ffc107;
    border: 1px solid #ffc107;
}

/* Folding widget styling */
.ace-todo-attack .ace_fold-widget {
    background-image: none;
    width: 12px;
    margin-left: 2px;
}

.ace-todo-attack .ace_fold-widget.ace_start {
    background-image: none;
}

.ace-todo-attack .ace_fold-widget.ace_end {
    background-image: none;
}

.ace-todo-attack .ace_fold-widget.ace_closed {
    background-image: none;
}

.ace-todo-attack .ace_fold-widget:hover {
    background-color: rgba(0, 0, 0, 0.06);
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
}

.ace-todo-attack .ace_fold-widget:after {
    content: '›';
    position: absolute;
    color: #6c757d;
    font-size: 16px;
    line-height: 12px;
    transition: transform 0.1s;
}

.ace-todo-attack .ace_fold-widget.ace_closed:after {
    transform: rotate(0deg);
}

.ace-todo-attack .ace_fold-widget.ace_open:after {
    transform: rotate(90deg);
}

/* Todo-specific styling */
.ace-todo-attack .ace_markup.ace_list.ace_pending {
    color: #6c757d;
    font-weight: bold;
}

.ace-todo-attack .ace_markup.ace_list.ace_inprogress {
    color: #fd7e14;
    font-weight: bold;
}

.ace-todo-attack .ace_markup.ace_list.ace_completed {
    color: #6c757d;
    text-decoration: line-through;
    font-weight: normal;
}

/* Priority colors */
.ace-todo-attack .ace_keyword.ace_priority-high {
    color: #dc3545;
    font-weight: bold;
    background: #f8d7da;
    padding: 1px 3px;
    border-radius: 3px;
}

.ace-todo-attack .ace_keyword.ace_priority-medium {
    color: #ffc107;
    font-weight: bold;
    background: #fff3cd;
    padding: 1px 3px;
    border-radius: 3px;
}

.ace-todo-attack .ace_keyword.ace_priority-low {
    color: #28a745;
    font-weight: bold;
    background: #d4edda;
    padding: 1px 3px;
    border-radius: 3px;
}

/* Set Roboto Mono as the default font */
.ace-todo-attack {
    font-family: 'Roboto Mono', monospace !important;
    line-height: 1.5 !important;
}

/* Ensure all text in the editor uses Roboto Mono */
.ace-todo-attack * {
    font-family: 'Roboto Mono', monospace !important;
}

/* Style for tags */
.ace-todo-attack .ace_string.ace_tag {
    color: #007bff;
}

/* Style for due dates */
.ace-todo-attack .ace_constant.ace_date {
    color: #28a745;
}

/* Style for headers */
.ace-todo-attack .ace_markup.ace_heading {
    font-weight: bold !important;
}

/* Style for completed tasks - lighter grey */
.ace-todo-attack .completed {
    color: #9e9e9e !important;
}

/* Reset specific elements instead of using universal selector */
.ace-todo-attack .ace_markup,
.ace-todo-attack .ace_text-layer,
.ace-todo-attack .ace_line,
.ace-todo-attack .ace_content {
    white-space: pre !important;
    line-height: 1.5 !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* Ensure editor container has proper height */
.ace-todo-attack .ace_scroller {
    height: 100% !important;
}

/* Reset specific styles that might cause issues */
.ace-todo-attack .ace_markup {
    color: inherit !important;
    background: none !important;
    text-decoration: none !important;
}

.ace-todo-attack .ace_string.ace_tag {
    color: #007bff;
    font-weight: 500;
    background: #e3f2fd;
    padding: 1px 3px;
    border-radius: 3px;
}

.ace-todo-attack .ace_constant.ace_numeric.ace_date {
    color: #dc3545;
    font-weight: 500;
    background: #fff5f5;
    padding: 1px 3px;
    border-radius: 3px;
}

.ace-todo-attack .ace_keyword.ace_priority {
    color: #e83e8c;
    font-weight: bold;
    background: #fce4ec;
    padding: 1px 3px;
    border-radius: 3px;
}

.ace-todo-attack .ace_constant.ace_other.ace_color {
    font-weight: 500;
    padding: 1px 3px;
    border-radius: 3px;
}

.ace-todo-attack .ace_markup.ace_heading.ace_1 {
    color: #1976d2;
    font-weight: bold;
    font-size: 1.2em;
}

.ace-todo-attack .ace_markup.ace_heading.ace_2 {
    color: #2196f3;
    font-weight: bold;
    font-size: 1.1em;
}

.ace-todo-attack .ace_markup.ace_heading.ace_3 {
    color: #64b5f6;
    font-weight: bold;
}

/* Heading line styling - applies to the entire line */
.ace-todo-attack .ace_heading-line {
    font-weight: bold !important;
}

/* Apply colors to heading lines */
.ace-todo-attack .ace_heading-line.heading-color-1976d2 {
    color: #1976D2 !important;
}
.ace-todo-attack .ace_heading-line.heading-color-2196f3 {
    color: #2196F3 !important;
}
.ace-todo-attack .ace_heading-line.heading-color-64b5f6 {
    color: #64B5F6 !important;
}
.ace-todo-attack .ace_heading-line.heading-color-4caf50 {
    color: #4CAF50 !important;
}
.ace-todo-attack .ace_heading-line.heading-color-8bc34a {
    color: #8BC34A !important;
}
.ace-todo-attack .ace_heading-line.heading-color-ffc107 {
    color: #FFC107 !important;
}
.ace-todo-attack .ace_heading-line.heading-color-ff9800 {
    color: #FF9800 !important;
}
.ace-todo-attack .ace_heading-line.heading-color-f44336 {
    color: #F44336 !important;
}
.ace-todo-attack .ace_heading-line.heading-color-9c27b0 {
    color: #9C27B0 !important;
}
.ace-todo-attack .ace_heading-line.heading-color-673ab7 {
    color: #673AB7 !important;
}

/* Force grey color for hashes and hex codes in Monaco Editor */
.monaco-editor .mtk10,
.monaco-editor .mtkb,
.monaco-editor .view-lines .mtk10,
.monaco-editor .view-lines .mtkb,
.monaco-editor .view-line .mtk10,
.monaco-editor .view-line .mtkb {
    color: #888888 !important;
    -webkit-text-fill-color: #888888 !important;
    text-fill-color: #888888 !important;
    fill: #888888 !important;
    stroke: #888888 !important;
    opacity: 1 !important;
}

/* Force color on all children and override any other styles */
.ace-todo-attack .ace_heading-line,
.ace-todo-attack .ace_heading-line *,
.ace-todo-attack .ace_heading-line .ace_markup,
.ace-todo-attack .ace_heading-line .ace_markup *,
.ace-todo-attack .ace_heading-line .ace_punctuation,
.ace-todo-attack .ace_heading-line .ace_heading,
.ace-todo-attack .ace_heading-line .ace_heading * {
    color: inherit !important;
    background: transparent !important;
    text-shadow: none !important;
    font-weight: bold !important;
    font-family: inherit !important;
}

.ace-todo-attack .ace_invisible {
    color: #6c757d;
}

.ace-todo-attack .ace_keyword {
    color: #d73a49;
}

.ace-todo-attack .ace_meta {
    color: #6f42c1;
}

.ace-todo-attack .ace_comment {
    color: #6a737d;
    font-style: italic;
}

.ace-todo-attack .ace_string {
    color: #032f62;
}
`;

    var dom = require("../lib/dom");
    dom.importCssString(exports.cssText, exports.cssClass);
});
