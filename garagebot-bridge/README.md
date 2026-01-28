# GarageBot Bridge

Two-way communication bridge for GarageBot.

## Components

### 1. Bridge Server (Flask App)
Runs on Dokku at `michaelwood.com/garagebot-bridge/`
- SQLite database for state
- Public status page
- Private admin panel with password
- REST API for bot communication

### 2. Local Client (runs on your Mac)
Polls the bridge every 30 seconds for commands
- Executes commands
- Pushes status updates
- Reports results back

## Setup

### Deploy Bridge Server
```bash
cd garagebot-bridge
git init
git add .
git commit -m "Initial"
dokku apps:create garagebot-bridge
git push dokku master
```

### Run Local Client
```bash
# Set bridge URL (defaults to michaelwood.com)
export GARAGEBOT_BRIDGE=https://michaelwood.com/garagebot-bridge

# Run
python3 client.py
```

Or use launchd to keep it running:
```bash
# Create plist file for auto-start
```

## Admin Password
Set via environment variable:
```
dokku config:set garagebot-bridge ADMIN_PASSWORD=your-secret-password
```

Default is `garagebot123` (change this!).

## API Endpoints

### Bot → Bridge
- `POST /api/status` - Push status update
- `GET /api/commands/pending` - Get pending commands
- `POST /api/commands/{id}/complete` - Mark command done
- `POST /api/commands/{id}/fail` - Mark command failed
- `POST /api/log` - Add log entry

### Admin → Bridge  
- `POST /api/command` - Create new command (auth required)

## Commands

| Command | Description |
|---------|-------------|
| check_email | Check recent Gmail |
| check_calendar | Check today's calendar |
| memory_update | Update memory files |
| git_status | Check project git status |
| system_info | Get system uptime/load |
| web_search | Search the web |
