-- Database initialization script
-- This script sets up the initial database and user permissions

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE claude_daemon'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'claude_daemon');

-- Create dedicated user for the application
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'claude_app') THEN
        CREATE USER claude_app WITH PASSWORD 'claude_secure_2024!';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE claude_daemon TO claude_app;
GRANT USAGE ON SCHEMA public TO claude_app;
GRANT CREATE ON SCHEMA public TO claude_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO claude_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO claude_app;

-- Grant permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO claude_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO claude_app;