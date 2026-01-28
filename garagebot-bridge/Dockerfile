FROM python:3.11-alpine

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create data directory for SQLite
RUN mkdir -p /app/data

# Copy application
COPY . .

# Initialize database on startup
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV ADMIN_PASSWORD=${ADMIN_PASSWORD:-garagebot123}
ENV SECRET_KEY=${SECRET_KEY:-change-me-in-production}

# Run with gunicorn
CMD gunicorn -b 0.0.0.0:5000 -w 1 --timeout 60 --preload "app:create_app()"
