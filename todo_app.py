"""
Todo Attack - Textual TUI Application for Markdown Todo Management
"""
from datetime import date
from pathlib import Path
from typing import List, Optional, Set

from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, ScrollableContainer
from textual.widgets import (
    Header, Footer, Tree, Input, Button, Static, Label,
    DataTable, Tabs, TabPane, ListView, ListItem
)
from textual.binding import Binding
from textual.reactive import reactive
from textual.message import Message
from textual import events
from rich.text import Text
from rich.console import Console

from todo_model import TodoParser, TaskGroup, Task, TaskStatus


class TaskTree(Tree):
    """Custom tree widget for displaying tasks with folding support."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.parser: Optional[TodoParser] = None
        self.filtered_tags: Set[str] = set()
        self.show_completed = True
        self.show_pending = True
        self.show_in_progress = True
    
    def load_tasks(self, parser: TodoParser):
        """Load tasks from parser into tree."""
        self.parser = parser
        self.refresh_tree()
    
    def refresh_tree(self):
        """Refresh the tree display."""
        if not self.parser:
            return
        
        self.clear()
        root = self.root
        
        for group in self.parser.root_groups:
            self._add_group_to_tree(root, group)
        
        # Expand all nodes by default
        root.expand_all()
    
    def _add_group_to_tree(self, parent_node, group: TaskGroup):
        """Add a task group and its contents to the tree."""
        # Create group node
        group_label = f"📁 {group.name}"
        if group.collapsed:
            group_label = f"📂 {group.name} (collapsed)"
        
        group_node = parent_node.add(group_label, data={"type": "group", "obj": group})
        
        if not group.collapsed:
            # Add tasks
            for task in group.tasks:
                if self._should_show_task(task):
                    self._add_task_to_tree(group_node, task)
            
            # Add child groups
            for child_group in group.children:
                self._add_group_to_tree(group_node, child_group)
    
    def _add_task_to_tree(self, parent_node, task: Task):
        """Add a task to the tree."""
        # Create task display text
        status_icon = {
            TaskStatus.PENDING: "⭕",
            TaskStatus.IN_PROGRESS: "🔄",
            TaskStatus.COMPLETED: "✅"
        }
        
        icon = status_icon.get(task.status, "⭕")
        text = f"{icon} {task.get_clean_text()}"
        
        # Add priority indicator
        if task.priority:
            text = f"🔥({task.priority}) {text}"
        
        # Add due date indicator
        if task.due_date:
            today = date.today()
            if task.due_date < today and task.status != TaskStatus.COMPLETED:
                text += " 🔴 OVERDUE"
            elif task.due_date == today:
                text += " 📅 TODAY"
            else:
                text += f" 📅 {task.due_date}"
        
        # Add tags
        if task.tags:
            tag_text = " ".join(f"#{tag}" for tag in task.tags)
            text += f" {tag_text}"
        
        parent_node.add_leaf(text, data={"type": "task", "obj": task})
    
    def _should_show_task(self, task: Task) -> bool:
        """Check if task should be shown based on current filters."""
        # Status filter
        if task.status == TaskStatus.PENDING and not self.show_pending:
            return False
        if task.status == TaskStatus.IN_PROGRESS and not self.show_in_progress:
            return False
        if task.status == TaskStatus.COMPLETED and not self.show_completed:
            return False
        
        # Tag filter
        if self.filtered_tags and not any(tag in task.tags for tag in self.filtered_tags):
            return False
        
        return True
    
    def get_selected_task(self) -> Optional[Task]:
        """Get the currently selected task."""
        if not self.cursor_node or not self.cursor_node.data:
            return None
        
        data = self.cursor_node.data
        if data.get("type") == "task":
            return data.get("obj")
        return None
    
    def get_selected_group(self) -> Optional[TaskGroup]:
        """Get the currently selected group."""
        if not self.cursor_node or not self.cursor_node.data:
            return None
        
        data = self.cursor_node.data
        if data.get("type") == "group":
            return data.get("obj")
        return None


class FilterPanel(Container):
    """Panel for filtering tasks by various criteria."""
    
    def compose(self) -> ComposeResult:
        with Vertical():
            yield Label("Filters", classes="filter-title")
            yield Button("All Tasks", id="filter-all", classes="filter-btn")
            yield Button("Pending", id="filter-pending", classes="filter-btn")
            yield Button("In Progress", id="filter-progress", classes="filter-btn")
            yield Button("Completed", id="filter-completed", classes="filter-btn")
            yield Button("Overdue", id="filter-overdue", classes="filter-btn")
            yield Label("Tags", classes="filter-title")
            yield Input(placeholder="Filter by tags...", id="tag-filter")


class TodoApp(App):
    """Main Todo application."""
    
    CSS = """
    .filter-title {
        text-style: bold;
        margin: 1 0;
    }
    
    .filter-btn {
        width: 100%;
        margin: 0 0 1 0;
    }
    
    .status-bar {
        background: $primary;
        color: $text;
        height: 1;
    }
    
    #main-container {
        layout: horizontal;
    }
    
    #filter-panel {
        width: 25%;
        background: $surface;
        padding: 1;
    }
    
    #task-panel {
        width: 75%;
        padding: 1;
    }
    """
    
    BINDINGS = [
        Binding("ctrl+t", "toggle_task_status", "Toggle Status"),
        Binding("ctrl+d", "add_due_date", "Add Due Date"),
        Binding("ctrl+z", "toggle_fold", "Toggle Fold"),
        Binding("ctrl+s", "save_file", "Save"),
        Binding("ctrl+r", "refresh", "Refresh"),
        Binding("ctrl+q", "quit", "Quit"),
        Binding("f1", "show_help", "Help"),
    ]
    
    def __init__(self):
        super().__init__()
        self.parser = TodoParser()
        self.todo_file = Path("todo.md")
        self.task_tree: Optional[TaskTree] = None
        self.filter_panel: Optional[FilterPanel] = None
    
    def compose(self) -> ComposeResult:
        yield Header()
        
        with Container(id="main-container"):
            with Container(id="filter-panel"):
                self.filter_panel = FilterPanel()
                yield self.filter_panel
            
            with Container(id="task-panel"):
                self.task_tree = TaskTree("Todo Tasks", id="task-tree")
                yield self.task_tree
        
        yield Footer()
    
    def on_mount(self) -> None:
        """Load todo file on startup."""
        self.load_todo_file()
    
    def load_todo_file(self):
        """Load and parse the todo file."""
        if self.todo_file.exists():
            try:
                self.parser.parse_file(str(self.todo_file))
                if self.task_tree:
                    self.task_tree.load_tasks(self.parser)
                self.notify("Todo file loaded successfully")
            except Exception as e:
                self.notify(f"Error loading todo file: {e}", severity="error")
        else:
            self.notify("Todo file not found. Create todo.md to get started.", severity="warning")
    
    def action_toggle_task_status(self):
        """Toggle the status of the selected task."""
        if not self.task_tree:
            return
        
        task = self.task_tree.get_selected_task()
        if task:
            task.toggle_status()
            self.task_tree.refresh_tree()
            self.notify(f"Task status changed to: {task.status.name}")
    
    def action_add_due_date(self):
        """Add today's date as due date to selected task."""
        if not self.task_tree:
            return
        
        task = self.task_tree.get_selected_task()
        if task:
            task.add_due_date_today()
            self.task_tree.refresh_tree()
            self.notify(f"Due date set to today: {date.today()}")
    
    def action_toggle_fold(self):
        """Toggle folding of the selected group."""
        if not self.task_tree:
            return
        
        group = self.task_tree.get_selected_group()
        if group:
            group.toggle_collapsed()
            self.task_tree.refresh_tree()
            status = "collapsed" if group.collapsed else "expanded"
            self.notify(f"Group '{group.name}' {status}")
    
    def action_save_file(self):
        """Save changes back to the todo file."""
        try:
            self.parser.save_to_file(str(self.todo_file))
            self.notify("Todo file saved successfully")
        except Exception as e:
            self.notify(f"Error saving file: {e}", severity="error")
    
    def action_refresh(self):
        """Refresh the todo list from file."""
        self.load_todo_file()
    
    def action_show_help(self):
        """Show help information."""
        help_text = """
        Todo Attack - Keyboard Shortcuts:
        
        Ctrl+T: Toggle task status (pending → in progress → completed)
        Ctrl+D: Add today's date as due date
        Ctrl+Z: Toggle fold/unfold for groups
        Ctrl+S: Save changes to file
        Ctrl+R: Refresh from file
        Ctrl+Q: Quit application
        F1: Show this help
        
        Navigation:
        ↑/↓: Move up/down
        Enter: Expand/collapse tree nodes
        """
        self.notify(help_text)
    
    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle filter button presses."""
        if not self.task_tree:
            return
        
        button_id = event.button.id
        
        if button_id == "filter-all":
            self.task_tree.show_pending = True
            self.task_tree.show_in_progress = True
            self.task_tree.show_completed = True
            self.task_tree.filtered_tags.clear()
        elif button_id == "filter-pending":
            self.task_tree.show_pending = True
            self.task_tree.show_in_progress = False
            self.task_tree.show_completed = False
        elif button_id == "filter-progress":
            self.task_tree.show_pending = False
            self.task_tree.show_in_progress = True
            self.task_tree.show_completed = False
        elif button_id == "filter-completed":
            self.task_tree.show_pending = False
            self.task_tree.show_in_progress = False
            self.task_tree.show_completed = True
        elif button_id == "filter-overdue":
            # Show only overdue tasks
            overdue_tasks = self.parser.get_overdue_tasks()
            # This would need more complex filtering logic
            pass
        
        self.task_tree.refresh_tree()
        self.notify(f"Filter applied: {button_id}")
    
    def on_input_changed(self, event: Input.Changed) -> None:
        """Handle tag filter input changes."""
        if event.input.id == "tag-filter" and self.task_tree:
            filter_text = event.value.strip()
            if filter_text:
                # Parse comma-separated tags
                tags = [tag.strip().lstrip('#') for tag in filter_text.split(',')]
                self.task_tree.filtered_tags = set(tags)
            else:
                self.task_tree.filtered_tags.clear()
            
            self.task_tree.refresh_tree()


def main():
    """Run the Todo Attack application."""
    app = TodoApp()
    app.run()


if __name__ == "__main__":
    main()
