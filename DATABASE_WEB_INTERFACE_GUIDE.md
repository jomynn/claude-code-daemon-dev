# Database Web Interface Guide

## Overview

The Database Configuration Web Interface provides a comprehensive management system for database connections, testing, schema management, and documentation. This interface is accessible at `/database-config` and offers both GUI and API-based database administration.

## 🌐 Interface Overview

### Access URL
```
http://localhost:5001/database-config
```

### Main Features
- **Real-time Connection Status** - Live monitoring of database connectivity
- **Configuration Management** - GUI-based database settings configuration
- **Testing & Debugging** - Comprehensive testing tools and diagnostics
- **Schema Management** - Database schema validation and migration tools
- **Documentation Hub** - Integrated documentation and guides

---

## 📊 Interface Components

### 1. Connection Status Dashboard

**Location:** Top section of the interface

**Features:**
- Real-time connection status indicator
- Database type and connection details
- Connection metrics (active connections, response times)
- Last check timestamp

**Status Indicators:**
- 🟢 **Connected** - Database is accessible and responsive
- 🔴 **Disconnected** - Database connection failed
- 🟡 **Testing** - Connection test in progress

### 2. Configuration Tabs

#### Tab 1: Connection Config
**Purpose:** Configure database connection parameters

**PostgreSQL Settings:**
- Host (default: `claude-database-server`)
- Port (default: `5432`)
- Database Name (default: `claude_daemon`)
- Username (default: `claude_app`)
- Password (secure input)

**SQLite Settings:**
- Database Path (default: `/data/claude-daemon.db`)

**Pool Settings:**
- Max Connections (default: `20`)
- Connection Timeout (default: `2000ms`)
- Idle Timeout (default: `30000ms`)

#### Tab 2: Testing & Debugging
**Purpose:** Test database connectivity and performance

**Available Tests:**
1. **Basic Connection Test** - Verifies database connectivity
2. **Query Test** - Tests basic SELECT operations
3. **Insert Test** - Verifies INSERT operations work
4. **Performance Test** - Measures query execution times
5. **Custom Query** - Execute custom SELECT statements

**Debugging Features:**
- Real-time connection logs
- Query execution results
- Performance metrics
- Error diagnostics

#### Tab 3: Schema Management
**Purpose:** Manage database schema and migrations

**Features:**
- Schema validation checker
- Schema application tool
- SQLite to PostgreSQL migration
- Database backup generation
- Schema reset functionality

#### Tab 4: Documentation
**Purpose:** Comprehensive setup and troubleshooting guides

**Sections:**
- Quick Setup Guide
- Connection Configuration Examples
- Troubleshooting Guide
- Manual Commands Reference
- Security Best Practices
- Related Documentation Links

---

## 🔧 Configuration Guide

### Initial Setup

1. **Access the Interface**
   ```
   http://localhost:5001/database-config
   ```

2. **Check Current Status**
   - View connection status in the top dashboard
   - Click "Refresh" to update status

3. **Configure Connection**
   - Go to "Connection Config" tab
   - Select database type (PostgreSQL/SQLite)
   - Enter connection details
   - Click "Save Configuration"

4. **Test Connection**
   - Go to "Testing & Debugging" tab
   - Click "Test Basic Connection"
   - Verify green success message

### PostgreSQL Configuration

**Docker Environment (Default):**
```
Database Type: PostgreSQL
Host: claude-database-server
Port: 5432
Database: claude_daemon
Username: claude_app
Password: claude_secure_2024!
```

**Local Development:**
```
Database Type: PostgreSQL
Host: localhost
Port: 5432
Database: claude_daemon
Username: claude_app
Password: claude_secure_2024!
```

### SQLite Fallback Configuration

**Docker Environment:**
```
Database Type: SQLite
Path: /data/claude-daemon.db
```

**Local Development:**
```
Database Type: SQLite
Path: ./data/claude-daemon.db
```

---

## 🧪 Testing Features

### Quick Tests

#### 1. Basic Connection Test
**Purpose:** Verify database connectivity
```javascript
// API Call: POST /api/database/test/basic
// Returns: Connection status, response time, database type
```

#### 2. Query Test
**Purpose:** Test SELECT operations on core tables
```javascript
// Tests queries on: usage_data, alerts, predictions
// Returns: Record counts for each table
```

#### 3. Insert Test
**Purpose:** Verify INSERT operations work
```javascript
// Inserts test record into usage_data table
// Returns: Insert confirmation and record ID
```

#### 4. Performance Test
**Purpose:** Measure query execution performance
```javascript
// Tests: Simple query, Count query, Complex aggregation
// Returns: Execution times for each test
```

### Custom Query Testing

**Safe Query Execution:**
- Only SELECT statements allowed
- Dangerous keywords blocked (DROP, DELETE, etc.)
- Real-time query results
- Execution time measurement

**Example Queries:**
```sql
-- View recent usage data
SELECT * FROM usage_data
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 10;

-- Check alert summary
SELECT level, COUNT(*) as count
FROM alerts
GROUP BY level;

-- Performance analysis
SELECT DATE(timestamp) as date,
       AVG(avg_response_time) as avg_response
FROM usage_data
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

---

## 🗄️ Schema Management

### Schema Validation

**Check Schema Status:**
1. Go to "Schema Management" tab
2. Click "Check Schema"
3. Review table list and status

**Expected Tables:**
- `users` - User management
- `usage_data` - Usage tracking
- `alerts` - Alert notifications
- `predictions` - Usage predictions
- `projects` - Project management
- `project_builds` - Build tracking
- `bmad_executions` - BMAD execution logs
- `system_logs` - System logging
- `api_keys` - API key management
- `settings` - Configuration settings
- `slack_workspaces` - Slack integration
- `performance_metrics` - Performance data

### Schema Operations

#### Apply Schema
**Purpose:** Create database tables and indexes
```bash
# Applies: /database/schema.sql
# Creates: All tables, indexes, triggers, default data
```

#### Migrate from SQLite
**Purpose:** Transfer data from SQLite to PostgreSQL
```bash
# Reads: /data/claude-daemon.db
# Transfers: usage_data, alerts, predictions
# Preserves: All historical data
```

#### Reset Schema
**Purpose:** Completely rebuild database schema
```bash
# WARNING: Deletes all data
# Drops: All tables and data
# Recreates: Fresh schema structure
```

---

## 🔍 Debugging & Troubleshooting

### Connection Issues

#### Issue: "Connection Failed"
**Symptoms:**
- Red status indicator
- Error message in test results

**Solutions:**
1. **Check Database Server**
   ```bash
   docker-compose ps postgres
   docker logs claude-database-server
   ```

2. **Verify Network Connectivity**
   ```bash
   docker exec claude-daemon-enhanced ping claude-database-server
   ```

3. **Check User Permissions**
   ```sql
   -- Connect to database as admin
   docker exec -it claude-database-server psql -U postgres -d claude_daemon

   -- Check user exists
   \du claude_app

   -- Grant permissions if needed
   GRANT ALL PRIVILEGES ON DATABASE claude_daemon TO claude_app;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO claude_app;
   ```

#### Issue: "Authentication Failed"
**Symptoms:**
- "password authentication failed for user" error

**Solutions:**
1. **Reset User Password**
   ```sql
   ALTER USER claude_app PASSWORD 'claude_secure_2024!';
   ```

2. **Check Environment Variables**
   ```bash
   # In docker-compose.yml or .env
   DB_PASSWORD=claude_secure_2024!
   ```

#### Issue: "Schema Not Found"
**Symptoms:**
- "relation does not exist" errors
- Empty table list in schema check

**Solutions:**
1. **Apply Schema**
   - Use "Apply Schema" button in interface
   - Or manually run: `docker exec claude-database-server psql -U postgres -d claude_daemon -f /docker-entrypoint-initdb.d/02-schema.sql`

2. **Check Database Initialization**
   ```bash
   # Verify schema file exists
   docker exec claude-database-server ls -la /docker-entrypoint-initdb.d/
   ```

### Performance Issues

#### Issue: Slow Query Response
**Symptoms:**
- High response times in performance tests
- Timeouts in custom queries

**Solutions:**
1. **Check Database Load**
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   ```

2. **Analyze Query Performance**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM usage_data WHERE timestamp >= NOW() - INTERVAL '1 hour';
   ```

3. **Update Statistics**
   ```sql
   ANALYZE usage_data;
   ANALYZE alerts;
   ANALYZE predictions;
   ```

---

## 📚 API Documentation

### Endpoints

#### Connection Management
- `GET /api/database/status` - Get connection status
- `GET /api/database/config` - Get current configuration
- `POST /api/database/config` - Update configuration

#### Testing
- `POST /api/database/test/:testType` - Run specific test
- `POST /api/database/query` - Execute custom query

#### Schema Management
- `GET /api/database/schema/check` - Check schema status
- `POST /api/database/schema/apply` - Apply schema
- `POST /api/database/schema/reset` - Reset schema

#### Utilities
- `POST /api/database/migrate` - Migrate from SQLite
- `POST /api/database/backup` - Create backup
- `GET /api/database/logs` - Get connection logs
- `GET /api/database/report` - Generate report

### Example API Usage

#### Check Connection Status
```javascript
fetch('/api/database/status')
  .then(response => response.json())
  .then(data => {
    console.log('Connection Status:', data.data.connected);
    console.log('Database Type:', data.data.type);
    console.log('Response Time:', data.data.metrics.avgResponseTime);
  });
```

#### Execute Test Query
```javascript
fetch('/api/database/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'SELECT COUNT(*) FROM usage_data'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Query Results:', data.data.results);
  console.log('Execution Time:', data.data.executionTime);
});
```

#### Run Performance Test
```javascript
fetch('/api/database/test/performance', { method: 'POST' })
  .then(response => response.json())
  .then(data => {
    data.data.forEach(test => {
      console.log(`${test.test}: ${test.time}`);
    });
  });
```

---

## 🛡️ Security Considerations

### User Permissions
- Database user (`claude_app`) has limited permissions
- Only necessary database operations allowed
- No administrative privileges granted

### Query Safety
- Custom queries restricted to SELECT only
- Dangerous keywords blocked (DROP, DELETE, INSERT, UPDATE)
- Input validation and sanitization

### Connection Security
- Passwords handled securely
- Environment variable configuration
- Connection pooling with timeouts

### Production Hardening
- Use SSL connections in production
- Implement proper authentication
- Regular security updates
- Monitoring and alerting

---

## 📊 Usage Examples

### Daily Operations

#### 1. Morning Health Check
1. Visit `/database-config`
2. Check connection status (should be green)
3. Run "Basic Connection Test"
4. Review connection metrics

#### 2. Performance Monitoring
1. Go to "Testing & Debugging" tab
2. Run "Performance Test"
3. Check response times < 100ms
4. Review connection logs for errors

#### 3. Data Verification
1. Use custom query to check recent data:
   ```sql
   SELECT COUNT(*) FROM usage_data
   WHERE timestamp >= CURRENT_DATE;
   ```
2. Verify alert counts:
   ```sql
   SELECT level, COUNT(*) FROM alerts
   WHERE timestamp >= CURRENT_DATE
   GROUP BY level;
   ```

### Maintenance Tasks

#### 1. Weekly Schema Check
1. Go to "Schema Management" tab
2. Click "Check Schema"
3. Verify all tables present
4. Check table row counts

#### 2. Monthly Backup
1. Go to "Schema Management" tab
2. Click "Create Backup"
3. Download backup file
4. Store securely

#### 3. Quarterly Migration Review
1. Check SQLite database size
2. Run migration if needed
3. Verify data integrity post-migration

---

## 🔗 Related Resources

### Documentation Files
- `DATABASE_SERVER_GUIDE.md` - Complete implementation guide
- `BMAD_METHOD_GUIDE.md` - BMAD execution documentation
- `docker-compose.yml` - Service configuration

### Key Files
- `/src/web/views/database-config.ejs` - Main interface template
- `/src/web/public/js/database-config.js` - Frontend JavaScript
- `/src/api/routes/database.js` - Backend API routes
- `/src/database/connection.js` - Database connection manager
- `/database/schema.sql` - Database schema definition

### Support Commands
```bash
# View application logs
docker logs claude-daemon-enhanced

# Connect to database directly
docker exec -it claude-database-server psql -U claude_app -d claude_daemon

# Check service status
docker-compose ps

# Restart services
docker-compose restart claude-daemon

# View database configuration
docker exec claude-daemon-enhanced env | grep DB_
```

This web interface provides a complete solution for database management, from initial setup through ongoing maintenance and troubleshooting.