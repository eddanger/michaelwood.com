# GarageBot Bridge - Lightweight Command & Status API
from flask import Flask, request, jsonify, render_template, session, redirect, g
import sqlite3
import json
import os
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'garagebot-dev-key-change-in-prod')

# Admin password (set via env or default for dev)
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'garagebot123')

DATABASE = '/app/data/garagebot.db'

def get_db():
    """Get database connection"""
    db = getattr(g, '_database', None)
    if db is None:
        os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    """Close database connection"""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    """Initialize database tables"""
    with app.app_context():
        db = get_db()
        db.executescript('''
            CREATE TABLE IF NOT EXISTS status (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                command TEXT NOT NULL,
                params TEXT,
                status TEXT DEFAULT 'pending',
                result TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                executed_at TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT DEFAULT 'info',
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);
            CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
        ''')
        db.commit()
        
        # Set initial status
        db.execute('''
            INSERT OR REPLACE INTO status (key, value, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
        ''', ('system', json.dumps({
            'status': 'online',
            'version': '1.0.0',
            'location': '🚗 Garage'
        })))
        db.commit()

def require_auth(f):
    """Decorator to require admin authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin'):
            return redirect('/garagebot-bridge/login')
        return f(*args, **kwargs)
    return decorated

# Public Routes
@app.route('/garagebot-bridge/')
def public_status():
    """Public status page - safe for anyone"""
    db = get_db()
    
    # Get latest status
    status_row = db.execute(
        "SELECT value FROM status WHERE key = 'system'"
    ).fetchone()
    
    system_status = json.loads(status_row['value']) if status_row else {
        'status': 'unknown',
        'version': '1.0.0'
    }
    
    # Get service statuses
    services = []
    for row in db.execute("SELECT key, value FROM status WHERE key LIKE 'service_%'"):
        services.append({
            'name': row['key'].replace('service_', ''),
            'status': row['value']
        })
    
    # Get recent public-safe logs (last 24h)
    logs = []
    for row in db.execute('''
        SELECT message, created_at FROM logs 
        WHERE level IN ('info', 'success') 
        AND created_at > datetime('now', '-24 hours')
        ORDER BY created_at DESC LIMIT 10
    '''):
        logs.append({
            'message': row['message'],
            'time': row['created_at']
        })
    
    return render_template('public.html', 
                         system=system_status,
                         services=services,
                         logs=logs)

# Admin Routes
@app.route('/garagebot-bridge/login', methods=['GET', 'POST'])
def login():
    """Admin login"""
    if request.method == 'POST':
        password = request.form.get('password')
        if password == ADMIN_PASSWORD:
            session['admin'] = True
            return redirect('/garagebot-bridge/admin')
        return render_template('login.html', error='Invalid password')
    return render_template('login.html')

@app.route('/garagebot-bridge/logout')
def logout():
    """Admin logout"""
    session.pop('admin', None)
    return redirect('/garagebot-bridge/')

@app.route('/garagebot-bridge/admin')
@require_auth
def admin_panel():
    """Admin control panel"""
    db = get_db()
    
    # Get all status
    status = {}
    for row in db.execute("SELECT key, value FROM status"):
        status[row['key']] = row['value']
    
    # Get pending commands
    pending = []
    for row in db.execute('''
        SELECT * FROM commands 
        WHERE status = 'pending' 
        ORDER BY created_at DESC
    '''):
        pending.append(dict(row))
    
    # Get recent commands (last 24h)
    recent = []
    for row in db.execute('''
        SELECT * FROM commands 
        WHERE status != 'pending'
        AND created_at > datetime('now', '-24 hours')
        ORDER BY created_at DESC LIMIT 20
    '''):
        recent.append(dict(row))
    
    # Get all logs (last 24h)
    logs = []
    for row in db.execute('''
        SELECT * FROM logs 
        WHERE created_at > datetime('now', '-24 hours')
        ORDER BY created_at DESC LIMIT 50
    '''):
        logs.append(dict(row))
    
    return render_template('admin.html',
                         status=status,
                         pending=pending,
                         recent=recent,
                         logs=logs)

# API Routes - Bot Communication
@app.route('/api/status', methods=['POST'])
def update_status():
    """Bot pushes status updates"""
    data = request.get_json()
    if not data or 'key' not in data or 'value' not in data:
        return jsonify({'error': 'Missing key or value'}), 400
    
    db = get_db()
    db.execute('''
        INSERT OR REPLACE INTO status (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    ''', (data['key'], json.dumps(data['value']) if isinstance(data['value'], (dict, list)) else data['value']))
    db.commit()
    
    return jsonify({'success': True})

@app.route('/api/status/<key>')
def get_status(key):
    """Get specific status value"""
    db = get_db()
    row = db.execute('SELECT value FROM status WHERE key = ?', (key,)).fetchone()
    if row:
        try:
            return jsonify({'value': json.loads(row['value'])})
        except:
            return jsonify({'value': row['value']})
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/commands/pending')
def get_pending_commands():
    """Bot polls for pending commands"""
    db = get_db()
    commands = []
    for row in db.execute('''
        SELECT id, command, params, created_at FROM commands
        WHERE status = 'pending'
        ORDER BY created_at ASC
    '''):
        cmd = {
            'id': row['id'],
            'command': row['command'],
            'created_at': row['created_at']
        }
        if row['params']:
            try:
                cmd['params'] = json.loads(row['params'])
            except:
                cmd['params'] = row['params']
        commands.append(cmd)
    
    return jsonify({'commands': commands})

@app.route('/api/commands/<int:cmd_id>/complete', methods=['POST'])
def complete_command(cmd_id):
    """Bot marks command as complete with result"""
    data = request.get_json() or {}
    result = data.get('result', '')
    
    db = get_db()
    db.execute('''
        UPDATE commands 
        SET status = 'completed', result = ?, executed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (result, cmd_id))
    db.commit()
    
    return jsonify({'success': True})

@app.route('/api/commands/<int:cmd_id>/fail', methods=['POST'])
def fail_command(cmd_id):
    """Bot marks command as failed"""
    data = request.get_json() or {}
    error = data.get('error', 'Unknown error')
    
    db = get_db()
    db.execute('''
        UPDATE commands 
        SET status = 'failed', result = ?, executed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (error, cmd_id))
    db.commit()
    
    return jsonify({'success': True})

@app.route('/api/log', methods=['POST'])
def add_log():
    """Bot adds a log entry"""
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'Missing message'}), 400
    
    level = data.get('level', 'info')
    message = data['message']
    
    db = get_db()
    db.execute('INSERT INTO logs (level, message) VALUES (?, ?)', (level, message))
    db.commit()
    
    return jsonify({'success': True})

# Admin API - Create commands
@app.route('/api/command', methods=['POST'])
@require_auth
def create_command():
    """Admin creates a new command"""
    data = request.get_json()
    if not data or 'command' not in data:
        return jsonify({'error': 'Missing command'}), 400
    
    command = data['command']
    params = json.dumps(data.get('params')) if data.get('params') else None
    
    db = get_db()
    cursor = db.execute(
        'INSERT INTO commands (command, params) VALUES (?, ?)',
        (command, params)
    )
    db.commit()
    
    return jsonify({
        'success': True,
        'id': cursor.lastrowid
    })

# Simple command buttons for admin
@app.route('/admin/command/<cmd>')
@require_auth
def quick_command(cmd):
    """Quick command buttons"""
    db = get_db()
    
    # Map simple commands to actions
    command_map = {
        'check_email': 'Check recent emails',
        'check_calendar': 'Check calendar events',
        'memory_update': 'Update memory files',
        'git_status': 'Check git status',
        'system_info': 'Get system info'
    }
    
    db.execute(
        'INSERT INTO commands (command, params) VALUES (?, ?)',
        (cmd, json.dumps({'description': command_map.get(cmd, cmd)}))
    )
    db.commit()
    
    db.execute(
        'INSERT INTO logs (level, message) VALUES (?, ?)',
        ('info', f'Command queued: {cmd}')
    )
    db.commit()
    
    return redirect('/garagebot-bridge/admin')

def create_app():
    """Application factory for gunicorn"""
    init_db()
    return app

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)
