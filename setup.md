# Todo Attack Web Editor - Setup Guide

## Overview
A secure web-based editor for Todo Attack markdown files using LAMP stack with Ace Editor and custom syntax highlighting.

## Requirements
- **Linux** server (Ubuntu/Debian recommended)
- **Apache** web server with mod_rewrite enabled
- **PHP** 7.4+ with standard extensions
- **File permissions** configured for web editing

## Installation

### 1. LAMP Stack Setup
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install apache2 php libapache2-mod-php

# Enable required Apache modules
sudo a2enmod rewrite
sudo a2enmod headers
sudo systemctl restart apache2
```

### 2. Deploy Files
Copy all files to your web directory:
```bash
# Copy to Apache document root
sudo cp -r * /var/www/html/todo-attack/
sudo chown -R www-data:www-data /var/www/html/todo-attack/
sudo chmod 644 /var/www/html/todo-attack/*.md
sudo chmod 644 /var/www/html/todo-attack/*.php
```

### 3. Set File Permissions
```bash
# Make todo.md writable by web server
sudo chmod 664 /var/www/html/todo-attack/todo.md
sudo chmod 664 /var/www/html/todo-attack/README.md

# Ensure Apache can create backup files
sudo chmod 775 /var/www/html/todo-attack/
```

### 4. Apache Virtual Host (Optional)
Create a dedicated virtual host:
```apache
<VirtualHost *:80>
    ServerName todo-attack.local
    DocumentRoot /var/www/html/todo-attack
    
    <Directory /var/www/html/todo-attack>
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/todo-attack_error.log
    CustomLog ${APACHE_LOG_DIR}/todo-attack_access.log combined
</VirtualHost>
```

## Features

### ✨ **Editor Features**
- **Syntax Highlighting**: Custom highlighting for todo items, tags, due dates
- **Auto-completion**: Smart suggestions for tags and common patterns
- **Keyboard Shortcuts**: Efficient task management shortcuts
- **Real-time Preview**: Live syntax highlighting as you type

### 🔒 **Security Features**
- **File Restrictions**: Only allows editing of todo.md and README.md
- **Input Validation**: Content size limits and sanitization
- **Atomic Writes**: Safe file operations with backups
- **Access Control**: .htaccess restrictions on sensitive files

### 📝 **Todo Syntax Support**
- **Task Status**: `[ ]` (pending), `[/]` (in progress), `[x]` (completed)
- **Tags**: `+tag` syntax with highlighting
- **Due Dates**: `due:YYYY-MM-DD` format with validation
- **Priority**: `(a)`, `(b)`, `(c)` priority indicators
- **Colors**: Hex color codes for visual organization
- **Hierarchy**: Full markdown header support

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save file |
| `Ctrl+O` | Load/reload file |
| `Ctrl+T` | Toggle task status |
| `Ctrl+D` | Add today's date |
| `Ctrl+N` | Insert new task |
| `Ctrl+H` | Toggle help panel |

## File Structure
```
todo-attack/
├── index.html          # Main editor interface
├── app.js             # Editor functionality
├── todo-mode.js       # Custom Ace Editor mode
├── file-handler.php   # Secure backend API
├── .htaccess         # Apache security config
├── todo.md           # Main todo file
├── README.md         # Project documentation
└── setup.md          # This setup guide
```

## Security Considerations

### File Access
- Only `todo.md` and `README.md` can be edited
- Backup files are automatically created and cleaned up
- Sensitive files are protected via .htaccess

### Input Validation
- File size limited to 1MB
- JSON input validation
- XSS protection headers
- CSRF protection through same-origin policy

### Backup System
- Automatic backups before each save
- Keeps last 5 backups with timestamps
- Atomic file operations prevent corruption

## Troubleshooting

### Common Issues

**1. File Permission Errors**
```bash
sudo chown www-data:www-data /path/to/todo.md
sudo chmod 664 /path/to/todo.md
```

**2. Apache Module Missing**
```bash
sudo a2enmod rewrite headers
sudo systemctl restart apache2
```

**3. PHP Errors**
Check Apache error logs:
```bash
sudo tail -f /var/log/apache2/error.log
```

**4. CORS Issues (Development)**
Add to Apache config:
```apache
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, OPTIONS"
```

## Development Mode

For local development without Apache:
```bash
# Start PHP built-in server
php -S localhost:8080

# Access at: http://localhost:8080
```

## Production Deployment

### SSL/HTTPS Setup
```bash
# Install Certbot
sudo apt install certbot python3-certbot-apache

# Get SSL certificate
sudo certbot --apache -d your-domain.com
```

### Additional Security
- Change default file permissions
- Implement user authentication
- Add rate limiting
- Monitor access logs
- Regular security updates

## Support

For issues or feature requests, check the project repository or create an issue with:
- Server environment details
- Error messages from logs
- Steps to reproduce the problem
