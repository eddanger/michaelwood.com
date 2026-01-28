#!/usr/bin/env python3
"""
GarageBot Local Client
Runs on Mike's computer, polls the web bridge for commands
and executes them, then reports back status.
"""

import requests
import json
import time
import os
import subprocess
from datetime import datetime

# Configuration
BRIDGE_URL = os.environ.get('GARAGEBOT_BRIDGE', 'https://michaelwood.com/garagebot-bridge')
POLL_INTERVAL = 30  # seconds

def log(level, message):
    """Log locally and to the bridge"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {level.upper()}: {message}")
    
    # Also send to bridge
    try:
        requests.post(f"{BRIDGE_URL}/api/log", json={
            'level': level,
            'message': message
        }, timeout=5)
    except:
        pass  # Silent fail for logging

def update_status(key, value):
    """Push status update to bridge"""
    try:
        resp = requests.post(f"{BRIDGE_URL}/api/status", json={
            'key': key,
            'value': value
        }, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        log('error', f'Status update failed: {e}')
        return False

def get_pending_commands():
    """Poll for pending commands"""
    try:
        resp = requests.get(f"{BRIDGE_URL}/api/commands/pending", timeout=10)
        if resp.status_code == 200:
            return resp.json().get('commands', [])
    except Exception as e:
        log('error', f'Poll failed: {e}')
    return []

def complete_command(cmd_id, result):
    """Mark command as complete"""
    try:
        requests.post(f"{BRIDGE_URL}/api/commands/{cmd_id}/complete", json={
            'result': result
        }, timeout=10)
    except Exception as e:
        log('error', f'Complete failed: {e}')

def fail_command(cmd_id, error):
    """Mark command as failed"""
    try:
        requests.post(f"{BRIDGE_URL}/api/commands/{cmd_id}/fail", json={
            'error': str(error)
        }, timeout=10)
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
        elif command_name == 'web_search':
            query = params.get('query', 'latest tech news')
            return web_search(query)
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
            count = len([l for l in lines if l.startswith('19')])  # Message IDs start with 19
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
            count = max(0, len(lines) - 1)  # Subtract header
            return f"{count} events today"
        return "No events or check failed"
    except Exception as e:
        return f"Error: {str(e)[:50]}"

def memory_update():
    """Update memory files"""
    try:
        # Just check if memory files exist
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
        # Uptime
        result = subprocess.run(['uptime'], capture_output=True, text=True, timeout=5)
        uptime = result.stdout.strip().split('up ')[-1].split(',')[0] if result.returncode == 0 else '?'
        
        # Load
        load = os.getloadavg()[0] if hasattr(os, 'getloadavg') else '?'
        
        return f"Up: {uptime}, Load: {load}"
    except Exception as e:
        return f"Error: {str(e)[:50]}"

def web_search(query):
    """Perform web search"""
    # This is a placeholder - would need Brave API integration
    return f"Search queued: {query[:30]}..."

def main_loop():
    """Main polling loop"""
    log('info', 'GarageBot Client Started')
    
    # Initial status push
    update_status('service_client', 'connected')
    update_status('system', {
        'status': 'online',
        'version': '1.0.0',
        'location': '🚗 Garage'
    })
    
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
                        log('success', f'Command {cmd["command"]} completed')
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
