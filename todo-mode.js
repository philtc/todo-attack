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
            // Headers - bold
            {
                token: "markup.heading",
                regex: /^#{1,3}\s+.*$/,
                merge: false
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
                
                // If it's a task line, indent it
                if (/^\s*[-*+]\s*\[.\]/.test(line)) {
                    var indent = this.$getIndent(line);
                    var newIndent = indent + '    ';
                    session.doc.replace(
                        new Range(row, 0, row, indent.length),
                        newIndent
                    );
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
            var line = session.getLine(row);
            var match = line.match(/^\s*/)[0];
            
            if (match.length >= 4) {
                // Remove 4 spaces or a tab
                var newIndent = match.replace(/^ {4}|^\t/, '');
                session.doc.replace(
                    new Range(row, 0, row, match.length),
                    newIndent
                );
                return true;
            }
            return false;
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
