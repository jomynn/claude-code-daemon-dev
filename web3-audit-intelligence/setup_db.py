
import sqlite3
conn = sqlite3.connect('/Volumes/Extreme SSD/Workspace/claude-code-daemon/claude-code-daemon-dev/web3-audit-intelligence/data/audit.db')
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS audit_reports (
    id INTEGER PRIMARY KEY,
    platform TEXT,
    title TEXT,
    url TEXT,
    date_collected TIMESTAMP,
    raw_data TEXT
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY,
    report_id INTEGER,
    severity TEXT,
    title TEXT,
    description TEXT,
    FOREIGN KEY (report_id) REFERENCES audit_reports(id)
)
''')

conn.commit()
conn.close()
print("Database setup complete")