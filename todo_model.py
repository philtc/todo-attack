"""
Todo data model for parsing and managing markdown-based todo lists.
"""
import re
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

class TaskStatus(Enum):
    PENDING = "[ ]"
    IN_PROGRESS = "[/]"
    COMPLETED = "[x]"

@dataclass
class Task:
    """Represents a single todo task."""
    text: str
    status: TaskStatus = TaskStatus.PENDING
    tags: List[str] = field(default_factory=list)
    due_date: Optional[date] = None
    priority: Optional[str] = None
    line_number: int = 0
    indent_level: int = 0
    
    def __post_init__(self):
        """Parse tags, due date, and priority from text."""
        self._parse_metadata()
    
    def _parse_metadata(self):
        """Extract tags, due date, and priority from task text."""
        # Extract tags (+tag format)
        tag_pattern = r'\+([a-zA-Z0-9_-]+)'
        self.tags = re.findall(tag_pattern, self.text)
        
        # Extract due date (due:YYYY-MM-DD format)
        due_pattern = r'due:(\d{4}-\d{2}-\d{2})'
        due_match = re.search(due_pattern, self.text)
        if due_match:
            try:
                self.due_date = datetime.strptime(due_match.group(1), '%Y-%m-%d').date()
            except ValueError:
                pass
        
        # Extract priority ((a), (b), (c) format)
        priority_pattern = r'\(([abc])\)'
        priority_match = re.search(priority_pattern, self.text)
        if priority_match:
            self.priority = priority_match.group(1)
    
    def toggle_status(self):
        """Cycle through task statuses."""
        if self.status == TaskStatus.PENDING:
            self.status = TaskStatus.IN_PROGRESS
        elif self.status == TaskStatus.IN_PROGRESS:
            self.status = TaskStatus.COMPLETED
        else:
            self.status = TaskStatus.PENDING
    
    def add_due_date_today(self):
        """Add today's date as due date."""
        today = date.today()
        self.due_date = today
        
        # Remove existing due date from text if present
        self.text = re.sub(r'\s*due:\d{4}-\d{2}-\d{2}', '', self.text)
        # Add new due date
        self.text += f" due:{today.strftime('%Y-%m-%d')}"
    
    def get_display_text(self) -> str:
        """Get formatted text for display."""
        return f"{self.status.value} {self.text}"
    
    def get_clean_text(self) -> str:
        """Get task text without status markers."""
        return self.text.strip()

@dataclass
class TaskGroup:
    """Represents a group of tasks under a header."""
    name: str
    level: int  # Header level (1, 2, 3)
    tasks: List[Task] = field(default_factory=list)
    children: List['TaskGroup'] = field(default_factory=list)
    parent: Optional['TaskGroup'] = None
    collapsed: bool = False
    line_number: int = 0
    color: Optional[str] = None  # Hex color code for theming
    
    def __post_init__(self):
        """Parse color from name if present."""
        self._parse_color()
    
    def add_task(self, task: Task):
        """Add a task to this group."""
        self.tasks.append(task)
    
    def add_child(self, child: 'TaskGroup'):
        """Add a child group."""
        child.parent = self
        self.children.append(child)
    
    def get_all_tasks(self, include_children: bool = True) -> List[Task]:
        """Get all tasks in this group and optionally its children."""
        all_tasks = self.tasks.copy()
        if include_children:
            for child in self.children:
                all_tasks.extend(child.get_all_tasks())
        return all_tasks
    
    def toggle_collapsed(self):
        """Toggle collapsed state."""
        self.collapsed = not self.collapsed
    
    def _parse_color(self):
        """Parse hex color code from name."""
        # Look for hex color pattern at end of name: #RRGGBB
        color_pattern = r'\s+#([0-9A-Fa-f]{6})\s*$'
        match = re.search(color_pattern, self.name)
        if match:
            self.color = f"#{match.group(1).upper()}"
            # Remove color code from display name
            self.name = re.sub(color_pattern, '', self.name).strip()
    
    def get_display_name(self):
        """Get name without color code for display."""
        return self.name
    
    def get_color_with_alpha(self, alpha=0.1):
        """Get color with alpha for background tinting."""
        if not self.color:
            return None
        
        # Convert hex to RGB
        hex_color = self.color.lstrip('#')
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        
        return f"rgba({r}, {g}, {b}, {alpha})"

class TodoParser:
    """Parser for markdown-based todo files."""
    
    def __init__(self):
        self.root_groups: List[TaskGroup] = []
        self.all_tasks: List[Task] = []
    
    def parse_file(self, filepath: str) -> List[TaskGroup]:
        """Parse a markdown todo file and return task groups."""
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        return self.parse_lines(lines)
    
    def parse_lines(self, lines: List[str]) -> List[TaskGroup]:
        """Parse lines and build task group hierarchy."""
        self.root_groups = []
        self.all_tasks = []
        group_stack = []
        
        for line_num, line in enumerate(lines, 1):
            line = line.rstrip()
            if not line.strip():
                continue
            
            # Check if it's a header
            header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if header_match:
                level = len(header_match.group(1))
                name = header_match.group(2)
                
                # Create new group (color will be parsed in __post_init__)
                group = TaskGroup(name=name, level=level, line_number=line_num)
                
                # Find parent group
                while group_stack and group_stack[-1].level >= level:
                    group_stack.pop()
                
                if group_stack:
                    group_stack[-1].add_child(group)
                else:
                    self.root_groups.append(group)
                
                group_stack.append(group)
            
            # Check if it's a task
            elif re.match(r'^\s*-\s+\[([ /x])\]', line):
                task = self._parse_task_line(line, line_num)
                if task:
                    self.all_tasks.append(task)
                    if group_stack:
                        group_stack[-1].add_task(task)
        
        return self.root_groups
    
    def _parse_task_line(self, line: str, line_num: int) -> Optional[Task]:
        """Parse a single task line."""
        # Match task pattern: - [status] text
        match = re.match(r'^(\s*)-\s+\[([ /x])\]\s+(.+)$', line)
        if not match:
            return None
        
        indent = len(match.group(1))
        status_char = match.group(2)
        text = match.group(3)
        
        # Map status character to enum
        status_map = {
            ' ': TaskStatus.PENDING,
            '/': TaskStatus.IN_PROGRESS,
            'x': TaskStatus.COMPLETED
        }
        status = status_map.get(status_char, TaskStatus.PENDING)
        
        return Task(
            text=text,
            status=status,
            line_number=line_num,
            indent_level=indent
        )
    
    def save_to_file(self, filepath: str):
        """Save the current state back to a markdown file."""
        lines = []
        
        def write_group(group: TaskGroup, indent: int = 0):
            # Write group header
            header_prefix = '#' * group.level
            lines.append(f"{header_prefix} {group.name}")
            
            # Write tasks
            for task in group.tasks:
                task_indent = '  ' * (indent + 1) if indent > 0 else ''
                lines.append(f"{task_indent}- {task.status.value} {task.text}")
            
            # Write child groups
            for child in group.children:
                if not group.collapsed:
                    write_group(child, indent + 1)
        
        for root_group in self.root_groups:
            write_group(root_group)
            lines.append('')  # Empty line between root groups
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    
    def get_tasks_by_tag(self, tag: str) -> List[Task]:
        """Get all tasks with a specific tag."""
        return [task for task in self.all_tasks if tag in task.tags]
    
    def get_tasks_by_status(self, status: TaskStatus) -> List[Task]:
        """Get all tasks with a specific status."""
        return [task for task in self.all_tasks if task.status == status]
    
    def get_overdue_tasks(self) -> List[Task]:
        """Get all overdue tasks."""
        today = date.today()
        return [task for task in self.all_tasks 
                if task.due_date and task.due_date < today and task.status != TaskStatus.COMPLETED]
