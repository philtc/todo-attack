// Custom Ace Editor mode for Todo Attack markdown syntax
ace.define("ace/mode/todo", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/markdown_highlight_rules", "ace/tokenizer"], function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextMode = require("./text").Mode;
    var MarkdownHighlightRules = require("./markdown_highlight_rules").MarkdownHighlightRules;
    var Tokenizer = require("../tokenizer").Tokenizer;

    var TodoHighlightRules = function() {
        MarkdownHighlightRules.call(this);

        // Add custom rules for Todo Attack syntax
        this.$rules.start.unshift(
            // Task status highlighting
            {
                token: "markup.list.pending",
                regex: /^(\s*)-\s*\[\s*\]/,
                next: "task-line"
            },
            {
                token: "markup.list.inprogress", 
                regex: /^(\s*)-\s*\[\/\]/,
                next: "task-line"
            },
            {
                token: "markup.list.completed",
                regex: /^(\s*)-\s*\[x\]/,
                next: "task-line"
            },
            // Priority indicators
            {
                token: "keyword.priority",
                regex: /\([abc]\)/
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
            // Color codes
            {
                token: "constant.other.color",
                regex: /#[0-9A-Fa-f]{6}/
            },
            // Headers with colors
            {
                token: ["markup.heading.1", "constant.other.color"],
                regex: /^(#{1}\s+.*?)(\s+#[0-9A-Fa-f]{6})?$/
            },
            {
                token: ["markup.heading.2", "constant.other.color"],
                regex: /^(#{2}\s+.*?)(\s+#[0-9A-Fa-f]{6})?$/
            },
            {
                token: ["markup.heading.3", "constant.other.color"],
                regex: /^(#{3}\s+.*?)(\s+#[0-9A-Fa-f]{6})?$/
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

    var Mode = function() {
        TextMode.call(this);
        this.HighlightRules = TodoHighlightRules;
        this.$behaviour = this.$defaultBehaviour;
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.type = "text";
        this.getNextLineIndent = function(state, line, tab) {
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
    color: #28a745;
    font-weight: bold;
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
