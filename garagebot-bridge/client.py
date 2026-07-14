#!/usr/bin/env python3
"""
GarageBot Local Client
Runs on Mike's computer, polls the web bridge for commands
and executes them, then reports back status.
Uses urllib (standard library) instead of requests.
"""

import urllib.request
import urllib.error
import json
import time
import os
import subprocess
from datetime import datetime

# Configuration
BRIDGE_URL = os.environ.get('GARAGEBOT_BRIDGE', 'https://garagebot.michaelwood.com')
POLL_INTERVAL = 30  # seconds

def api_request(method, path, data=None):
    """Make API request using urllib"""
    url = f"{BRIDGE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    
    if data:
        data_bytes = json.dumps(data).encode('utf-8')
    else:
        data_bytes = None
    
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    except Exception as e:
        raise

def log(level, message):
    """Log locally and to the bridge"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {level.upper()}: {message}", flush=True)
    
    # Also send to bridge
    try:
        api_request('POST', '/api/log', {'level': level, 'message': message})
    except:
        pass  # Silent fail for logging

def update_status(key, value):
    """Push status update to bridge"""
    try:
        api_request('POST', '/api/status', {'key': key, 'value': value})
        return True
    except Exception as e:
        log('error', f'Status update failed: {e}')
        return False

def get_pending_commands():
    """Poll for pending commands"""
    try:
        result = api_request('GET', '/api/commands/pending')
        return result.get('commands', []) if result else []
    except Exception as e:
        log('error', f'Poll failed: {e}')
    return []

def complete_command(cmd_id, result):
    """Mark command as complete"""
    try:
        api_request('POST', f'/api/commands/{cmd_id}/complete', {'result': result})
    except Exception as e:
        log('error', f'Complete failed: {e}')

def fail_command(cmd_id, error):
    """Mark command as failed"""
    try:
        api_request('POST', f'/api/commands/{cmd_id}/fail', {'error': str(error)})
    except Exception as e:
        log('error', f'Fail report failed: {e}')

def execute_command(cmd):
    """Execute a command and return result"""
    command_name = cmd['command']
    params = cmd.get('params', {})
    
    log('info', f'Executing: {command_name}')
    
    try:
        if command_name == 'check_email':
            return check_email()
        elif command_name == 'check_calendar':
            return check_calendar()
        elif command_name == 'memory_update':
            return memory_update()
        elif command_name == 'git_status':
            return git_status()
        elif command_name == 'system_info':
            return system_info()
        else:
            return f"Unknown command: {command_name}"
    except Exception as e:
        raise e

def check_email():
    """Check recent emails via gog"""
    try:
        result = subprocess.run(
            ['gog', 'gmail', 'search', 'newer_than:1d', '--max', '5'],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            count = len([l for l in lines if l.startswith('19')])
            return f"{count} new emails"
        return "Gmail check failed"
    except Exception as e:
        return f"Error: {str(e)[:50]}"

def check_calendar():
    """Check calendar events"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        result = subprocess.run(
            ['gog', 'calendar', 'events', 'primary', 
             '--from', f'{today}T00:00:00', 
             '--to', f'{today}T23:59:59'],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            count = max(0, len(lines) - 1)
            return f"{count} events today"
        return "No events or check failed"
    except Exception as e:
        return f"Error: {str(e)[:50]}"

def memory_update():
    """Update memory files"""
    try:
        mem_dir = os.path.expanduser('~/clawd/memory')
        if os.path.exists(mem_dir):
            files = len([f for f in os.listdir(mem_dir) if f.endswith('.md')])
            return f"{files} memory files"
        return "Memory dir not found"
    except Exception as e:
        return f"Error: {str(e)[:50]}"

def git_status():
    """Check git status of projects"""
    try:
        projects = ['~/clawd', '~/Projects/fitnito.com', '~/Projects/wemble.com']
        results = []
        for proj in projects:
            path = os.path.expanduser(proj)
            if os.path.exists(path):
                result = subprocess.run(
                    ['git', '-C', path, 'status', '--short'],
                    capture_output=True, text=True, timeout=10
                )
                if result.stdout.strip():
                    name = os.path.basename(path)
                    results.append(f"{name}: changes")
        return ', '.join(results) if results else 'All clean'
    except Exception as e:
        return f"Error: {str(e)[:50]}"

def system_info():
    """Get basic system info"""
    try:
        result = subprocess.run(['uptime'], capture_output=True, text=True, timeout=5)
        uptime = result.stdout.strip().split('up ')[-1].split(',')[0] if result.returncode == 0 else '?'
        load = os.getloadavg()[0] if hasattr(os, 'getloadavg') else '?'
        return f"Up: {uptime}, Load: {load}"
    except Exception as e:
        return f"Error: {str(e)[:50]}"

def main_loop():
    """Main polling loop"""
    log('info', 'GarageBot Client Started')
    log('info', f'Bridge: {BRIDGE_URL}')
    
    # Wait a bit for network/DNS on boot
    time.sleep(5)
    
    # Initial status push
    update_status('service_client', 'connected')
    update_status('system', {
        'status': 'online',
        'version': '1.0.0',
        'location': '🚗 Garage'
    })
    update_status('service_gmail', 'connected')
    update_status('service_calendar', 'connected')
    
    while True:
        try:
            # Get pending commands
            commands = get_pending_commands()
            
            if commands:
                log('info', f'Found {len(commands)} pending command(s)')
                
                for cmd in commands:
                    try:
                        result = execute_command(cmd)
                        complete_command(cmd['id'], result)
                        log('success', f'Command {cmd["command"]} completed: {result}')
                    except Exception as e:
                        fail_command(cmd['id'], str(e))
                        log('error', f'Command {cmd["command"]} failed: {e}')
            
            # Update heartbeat
            update_status('last_heartbeat', datetime.now().isoformat())
            
        except Exception as e:
            log('error', f'Main loop error: {e}')
        
        time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    main_loop()
