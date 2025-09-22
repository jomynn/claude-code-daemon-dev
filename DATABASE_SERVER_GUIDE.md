# Database Server Implementation Guide

## Overview

This guide covers the complete implementation, setup, connection, and debugging procedures for the Claude Code Daemon Database Server. The system uses PostgreSQL as the primary database with SQLite as a fallback option.

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Implementation Details](#implementation-details)
3. [Setup & Installation](#setup--installation)
4. [Connection Management](#connection-management)
5. [Database Schema](#database-schema)
6. [Migration Guide](#migration-guide)
7. [Debugging & Troubleshooting](#debugging--troubleshooting)
8. [Performance Optimization](#performance-optimization)
9. [Security Considerations](#security-considerations)
10. [Maintenance & Backup](#maintenance--backup)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                Claude Code Daemon Stack                     │
├─────────────────────────────────────────────────────────────┤
│  Application Layer                                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│  │   Web Interface │ │   API Server    │ │  BMAD Engine  │  │
│  │   (Dashboard)   │ │   (Express.js)  │ │  (Execution)  │  │
│  └─────────────────┘ └─────────────────┘ └───────────────┘  │
│                              │                              │
├─────────────────────────────────────────────────────────────┤
│  Data Access Layer                                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           Database Connection Manager                   │ │
│  │         (PostgreSQL + SQLite Fallback)                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                              │
├─────────────────────────────────────────────────────────────┤
│  Storage Layer                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│  │   PostgreSQL    │ │      Redis      │ │    Volumes    │  │
│  │   (Primary DB)  │ │     (Cache)     │ │   (Backups)   │  │
│  └─────────────────┘ └─────────────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Service Ports

| Service | Internal Port | External Port | Description |
|---------|---------------|---------------|-------------|
| Claude Daemon | 5000 | 5001 | Main application API |
| PostgreSQL | 5432 | 5432 | Database server |
| Redis | 6379 | 6379 | Cache server |
| Nginx | 80 | 80 | Load balancer |

---

## Implementation Details

### 1. Database Connection Manager

**File:** `src/database/connection.js`

```javascript
// Core connection class supporting both PostgreSQL and SQLite
class DatabaseConnection {
    constructor() {
        this.pgPool = null;
        this.sqliteDb = null;
        this.dbType = process.env.DB_TYPE || 'postgresql';
    }

    async initialize() {
        // Attempts PostgreSQL first, falls back to SQLite
        if (this.dbType === 'postgresql') {
            await this.initializePostgreSQL();
        } else {
            await this.initializeSQLite();
        }
    }
}
```

**Key Features:**
- Automatic failover from PostgreSQL to SQLite
- Connection pooling for PostgreSQL
- Unified API for both database types
- Environment-based configuration

### 2. Enhanced Usage Monitor

**File:** `src/daemon/usage-monitor-v2.js`

```javascript
// Enhanced monitor with database server support
class UsageMonitorV2 extends EventEmitter {
    async collectUsageData() {
        const usage = {
            timestamp: new Date().toISOString(),
            tokens_used: this.currentUsage.tokens + Math.floor(Math.random() * 1000),
            requests_count: this.currentUsage.requests + Math.floor(Math.random() * 50),
            // ... other metrics
        };

        await dbConnection.insert('usage_data', usage);
        this.emit('usage-collected', usage);
    }
}
```

### 3. Migration System

**File:** `database/migrate-from-sqlite.js`

Handles automatic migration from existing SQLite databases to PostgreSQL.

---

## Setup & Installation

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL client tools (optional, for debugging)

### 1. Environment Configuration

Create or update `.env` file:

```bash
# Database Configuration
DB_TYPE=postgresql
DB_HOST=claude-database-server
DB_PORT=5432
DB_NAME=claude_daemon
DB_USER=claude_app
DB_PASSWORD=claude_secure_2024!

# Legacy SQLite (fallback)
DATABASE_PATH=/data/claude-daemon.db

# Redis Configuration
REDIS_URL=redis://redis:6379

# Application Settings
NODE_ENV=production
BMAD_EXECUTION_ENABLED=true
AUTO_PROJECT_GENERATION=true
```

### 2. Docker Compose Setup

The complete stack is defined in `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: claude-database-server
    environment:
      - POSTGRES_DB=claude_daemon
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=claude_db_2024!
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/02-schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d claude_daemon || exit 1"]
```

### 3. Initial Setup

```bash
# Clone and navigate to project
git clone <repository>
cd claude-code-daemon-dev

# Build and start services
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Create application user (if not auto-created)
docker exec claude-database-server psql -U postgres -d claude_daemon -c \
  "CREATE USER claude_app WITH PASSWORD 'claude_secure_2024!';
   GRANT ALL PRIVILEGES ON DATABASE claude_daemon TO claude_app;"
```

### 4. Verification

```bash
# Test database connection
docker exec claude-daemon-enhanced node scripts/test-database.js

# Check service health
curl http://localhost:5001/health

# View logs
docker-compose logs -f claude-daemon-enhanced
```

---

## Connection Management

### Connection Lifecycle

1. **Application Startup**
   ```javascript
   // Automatic initialization on app start
   await dbConnection.initialize();
   ```

2. **Connection Pooling**
   ```javascript
   // PostgreSQL pool configuration
   const pgConfig = {
       host: process.env.DB_HOST,
       port: process.env.DB_PORT,
       database: process.env.DB_NAME,
       user: process.env.DB_USER,
       password: process.env.DB_PASSWORD,
       max: 20,                    // Max connections
       idleTimeoutMillis: 30000,   // Idle timeout
       connectionTimeoutMillis: 2000 // Connection timeout
   };
   ```

3. **Automatic Failover**
   ```javascript
   try {
       await this.initializePostgreSQL();
   } catch (error) {
       console.log('🔄 Falling back to SQLite...');
       this.dbType = 'sqlite';
       await this.initializeSQLite();
   }
   ```

### Connection Methods

#### Standard Query
```javascript
// Universal query method
const results = await dbConnection.query(
    'SELECT * FROM usage_data WHERE timestamp >= $1',
    [oneHourAgo]
);
```

#### Insert Operations
```javascript
// Insert with automatic handling
const newRecord = await dbConnection.insert('usage_data', {
    timestamp: new Date().toISOString(),
    tokens_used: 1000,
    requests_count: 50
});
```

#### Select Operations
```javascript
// Select with options
const records = await dbConnection.select('alerts',
    { level: 'warning' },
    { orderBy: 'timestamp DESC', limit: 10 }
);
```

#### Update Operations
```javascript
// Update records
await dbConnection.update('alerts',
    { acknowledged: true },
    { id: alertId }
);
```

---

## Database Schema

### Core Tables

#### 1. Usage Data (`usage_data`)
```sql
CREATE TABLE usage_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tokens_used INTEGER DEFAULT 0,
    requests_count INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    cost_usd DECIMAL(10, 4) DEFAULT 0.0,
    session_id VARCHAR(255),
    endpoint VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Alerts (`alerts`)
```sql
CREATE TABLE alerts (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'warning', 'error', 'success')),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    timestamp TIMESTAMP NOT NULL,
    acknowledged BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. Predictions (`predictions`)
```sql
CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    predicted_tokens INTEGER,
    predicted_cost DECIMAL(10, 4),
    confidence DECIMAL(3, 2),
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Performance Indexes

```sql
-- Usage data indexes
CREATE INDEX idx_usage_data_timestamp ON usage_data(timestamp);
CREATE INDEX idx_usage_data_user_id ON usage_data(user_id);

-- Alerts indexes
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX idx_alerts_level ON alerts(level);

-- Predictions indexes
CREATE INDEX idx_predictions_date ON predictions(date);
```

---

## Migration Guide

### Automatic Migration

The system includes automatic migration from SQLite to PostgreSQL:

```javascript
// Startup script handles migration
const DatabaseMigrator = require('./database/migrate-from-sqlite');
const migrator = new DatabaseMigrator();
await migrator.migrate();
```

### Manual Migration Steps

1. **Export SQLite Data**
   ```bash
   # Backup existing SQLite database
   docker exec claude-daemon-enhanced sqlite3 /data/claude-daemon.db .dump > backup.sql
   ```

2. **Run Migration Script**
   ```bash
   # Execute migration
   docker exec claude-daemon-enhanced node database/migrate-from-sqlite.js
   ```

3. **Verify Migration**
   ```bash
   # Check data counts
   docker exec claude-database-server psql -U claude_app -d claude_daemon -c \
     "SELECT 'usage_data' as table, count(*) from usage_data
      UNION SELECT 'alerts', count(*) from alerts
      UNION SELECT 'predictions', count(*) from predictions;"
   ```

### Migration Verification

```sql
-- Verify data integrity
SELECT
    table_name,
    count(*) as record_count,
    min(created_at) as oldest_record,
    max(created_at) as newest_record
FROM (
    SELECT 'usage_data' as table_name, created_at FROM usage_data
    UNION ALL
    SELECT 'alerts', created_at FROM alerts
    UNION ALL
    SELECT 'predictions', created_at FROM predictions
) t
GROUP BY table_name;
```

---

## Debugging & Troubleshooting

### Common Issues

#### 1. Connection Failed

**Symptoms:**
```
❌ PostgreSQL initialization failed: error: password authentication failed
```

**Solutions:**
```bash
# Check user exists
docker exec claude-database-server psql -U postgres -d claude_daemon -c "\du"

# Create user if missing
docker exec claude-database-server psql -U postgres -d claude_daemon -c \
  "CREATE USER claude_app WITH PASSWORD 'claude_secure_2024!';"

# Grant permissions
docker exec claude-database-server psql -U postgres -d claude_daemon -c \
  "GRANT ALL PRIVILEGES ON DATABASE claude_daemon TO claude_app;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO claude_app;"
```

#### 2. Schema Not Applied

**Symptoms:**
```
ERROR: relation "usage_data" does not exist
```

**Solutions:**
```bash
# Check if schema was applied
docker exec claude-database-server psql -U postgres -d claude_daemon -c "\dt"

# Manually apply schema
docker exec claude-database-server psql -U postgres -d claude_daemon -f /docker-entrypoint-initdb.d/02-schema.sql
```

#### 3. Container Restart Loop

**Symptoms:**
```
Container claude-database-server restarting (1) 30 seconds ago
```

**Debug Steps:**
```bash
# Check container logs
docker logs claude-database-server

# Check resource usage
docker stats claude-database-server

# Inspect container
docker inspect claude-database-server
```

### Debugging Tools

#### 1. Database Connection Test
```bash
# Test PostgreSQL connection
docker exec claude-daemon-enhanced node -e "
const dbConnection = require('./src/database/connection');
dbConnection.initialize().then(() => {
    console.log('✅ Connection successful');
    return dbConnection.close();
}).catch(console.error);
"
```

#### 2. Query Testing
```bash
# Test specific queries
docker exec claude-database-server psql -U claude_app -d claude_daemon -c \
  "SELECT count(*) FROM usage_data WHERE timestamp >= NOW() - INTERVAL '1 hour';"
```

#### 3. Performance Analysis
```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Log Analysis

#### Application Logs
```bash
# Filter database-related logs
docker logs claude-daemon-enhanced 2>&1 | grep -E "(database|connection|postgresql|sqlite)"

# Real-time monitoring
docker logs -f claude-daemon-enhanced | grep -E "(ERROR|WARN|database)"
```

#### Database Logs
```bash
# PostgreSQL logs
docker logs claude-database-server 2>&1 | grep -E "(ERROR|FATAL|LOG)"

# Connection monitoring
docker exec claude-database-server psql -U postgres -d claude_daemon -c \
  "SELECT datname, usename, client_addr, state FROM pg_stat_activity WHERE state = 'active';"
```

---

## Performance Optimization

### Connection Pooling

```javascript
// Optimal pool configuration
const pgConfig = {
    max: 20,                      // Maximum connections
    min: 2,                       // Minimum connections
    idleTimeoutMillis: 30000,     // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Timeout for new connections
    acquireTimeoutMillis: 60000,  // Timeout for acquiring connection
    createTimeoutMillis: 3000,    // Timeout for creating connection
    destroyTimeoutMillis: 5000,   // Timeout for destroying connection
    reapIntervalMillis: 1000,     // How often to check for idle connections
    createRetryIntervalMillis: 200 // How long to wait before retrying create
};
```

### Query Optimization

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_usage_data_timestamp_user
ON usage_data(timestamp, user_id) WHERE timestamp >= NOW() - INTERVAL '30 days';

-- Analyze table statistics
ANALYZE usage_data;
ANALYZE alerts;
ANALYZE predictions;
```

### Database Tuning

```sql
-- Update PostgreSQL configuration
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Reload configuration
SELECT pg_reload_conf();
```

---

## Security Considerations

### 1. User Permissions

```sql
-- Principle of least privilege
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO claude_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO claude_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO claude_app;
```

### 2. Connection Security

```javascript
// SSL configuration for production
const pgConfig = {
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
        ca: fs.readFileSync('/path/to/ca-certificate.crt'),
        key: fs.readFileSync('/path/to/client-key.key'),
        cert: fs.readFileSync('/path/to/client-certificate.crt')
    } : false
};
```

### 3. Environment Variables

```bash
# Use Docker secrets in production
docker secret create postgres_password - <<< "your_secure_password"

# Reference in docker-compose.yml
secrets:
  - postgres_password

environment:
  - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
```

---

## Maintenance & Backup

### Automated Backups

```bash
#!/bin/bash
# backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Create backup
docker exec claude-database-server pg_dump -U postgres -d claude_daemon > \
  "$BACKUP_DIR/claude_daemon_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/claude_daemon_$DATE.sql"

# Keep only last 7 days
find "$BACKUP_DIR" -name "claude_daemon_*.sql.gz" -mtime +7 -delete

echo "Backup completed: claude_daemon_$DATE.sql.gz"
```

### Restore Procedure

```bash
# Stop application
docker-compose stop claude-daemon

# Restore database
docker exec -i claude-database-server psql -U postgres -d claude_daemon < backup.sql

# Restart application
docker-compose start claude-daemon
```

### Health Monitoring

```bash
#!/bin/bash
# monitor-database.sh

# Check database connectivity
if docker exec claude-database-server pg_isready -U postgres -d claude_daemon > /dev/null 2>&1; then
    echo "✅ Database is healthy"
else
    echo "❌ Database is not responding"
    exit 1
fi

# Check connection count
CONNECTIONS=$(docker exec claude-database-server psql -U postgres -d claude_daemon -t -c \
  "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")

echo "📊 Active connections: $CONNECTIONS"

# Check disk usage
DISK_USAGE=$(docker exec claude-database-server df -h /var/lib/postgresql/data | tail -1 | awk '{print $5}')
echo "💾 Disk usage: $DISK_USAGE"
```

---

## Quick Reference

### Useful Commands

```bash
# Start services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f [service_name]

# Access database shell
docker exec -it claude-database-server psql -U claude_app -d claude_daemon

# Test database connection
docker exec claude-daemon-enhanced node scripts/test-database.js

# View real-time metrics
docker exec claude-database-server psql -U postgres -d claude_daemon -c \
  "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Manual backup
docker exec claude-database-server pg_dump -U postgres -d claude_daemon > backup.sql

# Check table sizes
docker exec claude-database-server psql -U postgres -d claude_daemon -c \
  "SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
   FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service orchestration |
| `database/schema.sql` | Database schema definition |
| `src/database/connection.js` | Connection manager |
| `database/migrate-from-sqlite.js` | Migration script |
| `scripts/test-database.js` | Connection testing |
| `.env` | Environment configuration |

---

## Support & Resources

- **Database Schema**: `/database/schema.sql`
- **Connection Manager**: `/src/database/connection.js`
- **Migration Tools**: `/database/migrate-from-sqlite.js`
- **Test Scripts**: `/scripts/test-database.js`
- **Docker Configuration**: `docker-compose.yml`

For additional support, check the application logs and database server logs for specific error messages and follow the troubleshooting guide above.