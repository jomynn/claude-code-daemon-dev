FROM postgres:15-alpine

# Enhanced PostgreSQL database server for Claude Code Daemon
LABEL version="2.0.0" \
      description="Dedicated PostgreSQL database server for Claude Code Daemon" \
      maintainer="Claude Code Team"

# Install additional extensions
RUN apk add --no-cache \
    postgresql-contrib \
    postgis \
    postgresql-plpython3

# Create application directory
WORKDIR /docker-entrypoint-initdb.d

# Copy initialization scripts
COPY init.sql 01-init.sql
COPY schema.sql 02-schema.sql

# Copy migration scripts
COPY migrate-from-sqlite.js /usr/local/bin/migrate-from-sqlite.js
RUN chmod +x /usr/local/bin/migrate-from-sqlite.js

# Set environment variables
ENV POSTGRES_DB=claude_daemon
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=claude_db_2024!
ENV POSTGRES_INITDB_ARGS="--encoding=UTF-8 --locale=C"

# Configure PostgreSQL for better performance
COPY postgresql.conf /tmp/postgresql.conf
RUN cat /tmp/postgresql.conf >> /usr/local/share/postgresql/postgresql.conf.sample

# Create custom entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pg_isready -U postgres -d claude_daemon || exit 1

# Expose PostgreSQL port
EXPOSE 5432

# Use custom entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["postgres"]