<?php
/**
 * Todo Attack - Secure File Handler
 * Handles reading and writing of the todo.md file with security measures
 */

// Security headers
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// CORS headers for local development
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

// Validate required fields
if (!isset($data['action'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Action required']);
    exit;
}

// Security: Only allow specific filenames
$allowedFiles = ['todo.md', 'README.md'];
$filename = isset($data['filename']) ? $data['filename'] : 'todo.md';

if (!in_array($filename, $allowedFiles)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'File not allowed']);
    exit;
}

// Get the full file path (current directory)
$filePath = __DIR__ . '/' . $filename;

// Handle different actions
switch ($data['action']) {
    case 'load':
        handleLoad($filePath);
        break;
    
    case 'save':
        if (!isset($data['content'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Content required for save']);
            exit;
        }
        handleSave($filePath, $data['content']);
        break;
    
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Unknown action']);
        exit;
}

/**
 * Handle file loading
 */
function handleLoad($filePath) {
    try {
        if (!file_exists($filePath)) {
            // Create empty file if it doesn't exist
            file_put_contents($filePath, '');
            $content = '';
        } else {
            $content = file_get_contents($filePath);
            if ($content === false) {
                throw new Exception('Failed to read file');
            }
        }
        
        echo json_encode([
            'success' => true,
            'content' => $content,
            'filename' => basename($filePath),
            'size' => strlen($content),
            'modified' => file_exists($filePath) ? date('Y-m-d H:i:s', filemtime($filePath)) : null
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle file saving with backup
 */
function handleSave($filePath, $content) {
    try {
        // Input validation
        if (strlen($content) > 1024 * 1024) { // 1MB limit
            throw new Exception('File too large (max 1MB)');
        }
        
        // Create backup if file exists
        if (file_exists($filePath)) {
            $backupPath = $filePath . '.backup.' . date('Y-m-d-H-i-s');
            if (!copy($filePath, $backupPath)) {
                throw new Exception('Failed to create backup');
            }
            
            // Keep only last 5 backups
            cleanupBackups(dirname($filePath), basename($filePath));
        }
        
        // Write the file atomically
        $tempPath = $filePath . '.tmp.' . uniqid();
        if (file_put_contents($tempPath, $content, LOCK_EX) === false) {
            throw new Exception('Failed to write temporary file');
        }
        
        if (!rename($tempPath, $filePath)) {
            unlink($tempPath);
            throw new Exception('Failed to move temporary file');
        }
        
        // Set appropriate permissions
        chmod($filePath, 0644);
        
        echo json_encode([
            'success' => true,
            'message' => 'File saved successfully',
            'filename' => basename($filePath),
            'size' => strlen($content),
            'modified' => date('Y-m-d H:i:s', filemtime($filePath))
        ]);
        
    } catch (Exception $e) {
        // Clean up temp file if it exists
        if (isset($tempPath) && file_exists($tempPath)) {
            unlink($tempPath);
        }
        
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Clean up old backup files, keeping only the 5 most recent
 */
function cleanupBackups($dir, $filename) {
    $pattern = $dir . '/' . $filename . '.backup.*';
    $backups = glob($pattern);
    
    if (count($backups) > 5) {
        // Sort by modification time (oldest first)
        usort($backups, function($a, $b) {
            return filemtime($a) - filemtime($b);
        });
        
        // Remove oldest backups
        $toRemove = array_slice($backups, 0, count($backups) - 5);
        foreach ($toRemove as $backup) {
            unlink($backup);
        }
    }
}

/**
 * Log security events (optional)
 */
function logSecurityEvent($event, $details = '') {
    $logFile = __DIR__ . '/security.log';
    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    
    $logEntry = sprintf(
        "[%s] %s - IP: %s - UA: %s - Details: %s\n",
        $timestamp,
        $event,
        $ip,
        $userAgent,
        $details
    );
    
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}
?>
