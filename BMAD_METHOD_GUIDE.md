# BMAD Method Guide: Web3 Audit Intelligence System

## Overview
This guide outlines the BMAD Method (Build-Manage-Analyze-Deploy) implementation for developing a comprehensive Web3 audit intelligence system that collects and analyzes audit reports from Code4rena and other platforms.

## Project Brief
Create a Web3 audit intelligence system that:
1. Collects audit reports from Code4rena contests
2. Processes and analyzes vulnerability data
3. Provides intelligence insights for security researchers
4. Maintains a comprehensive database of Web3 security findings

---

## 🏗️ BMAD Phase 1: BUILD

### Role: **Lead Developer**
**Responsibilities**: Project architecture, core development, technical decisions

#### 1.1 Project Structure Setup
```
web3-audit-intelligence/
├── src/
│   ├── collectors/
│   │   ├── __init__.py
│   │   ├── base_collector.py
│   │   ├── code4rena_collector.py
│   │   └── immunefi_collector.py
│   ├── processors/
│   │   ├── __init__.py
│   │   ├── report_processor.py
│   │   └── vulnerability_analyzer.py
│   ├── database/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   └── operations.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py
│   │   └── schemas.py
│   └── utils/
│       ├── __init__.py
│       ├── config.py
│       └── logger.py
├── tests/
│   ├── test_collectors/
│   ├── test_processors/
│   └── test_api/
├── config/
│   ├── config.yaml
│   └── logging.yaml
├── data/
│   ├── raw/
│   ├── processed/
│   └── exports/
├── docs/
│   ├── api.md
│   ├── collectors.md
│   └── deployment.md
├── scripts/
│   ├── setup.sh
│   ├── run_collectors.py
│   └── migrate_db.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── README.md
└── .env.example
```

#### 1.2 Core Implementation Files

**requirements.txt**
```txt
# Web scraping and HTTP requests
requests==2.31.0
beautifulsoup4==4.12.2
selenium==4.15.2
scrapy==2.11.0

# Data processing
pandas==2.1.3
numpy==1.25.2
python-dateutil==2.8.2

# Database
sqlalchemy==2.0.23
alembic==1.13.1
psycopg2-binary==2.9.9

# API Framework
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0

# Configuration and logging
pyyaml==6.0.1
python-dotenv==1.0.0
loguru==0.7.2

# Data validation and processing
marshmallow==3.20.1
jsonschema==4.19.2

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-mock==3.12.0

# Utilities
click==8.1.7
tqdm==4.66.1
schedule==1.2.0
```

**src/collectors/base_collector.py**
```python
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
import requests
from bs4 import BeautifulSoup
import time
import logging
from dataclasses import dataclass
from datetime import datetime

@dataclass
class AuditReport:
    contest_id: str
    title: str
    platform: str
    severity: str
    category: str
    description: str
    findings: List[str]
    date_published: datetime
    url: str
    metadata: Dict

class BaseCollector(ABC):
    """Base class for audit report collectors"""

    def __init__(self, config: Dict):
        self.config = config
        self.session = requests.Session()
        self.logger = logging.getLogger(self.__class__.__name__)
        self._setup_session()

    def _setup_session(self):
        """Configure HTTP session with headers and timeouts"""
        self.session.headers.update({
            'User-Agent': self.config.get('user_agent',
                'Web3AuditIntelligence/1.0 (+https://github.com/your-repo)')
        })
        self.session.timeout = self.config.get('timeout', 30)

    @abstractmethod
    def collect_contests(self) -> List[Dict]:
        """Collect all available contests"""
        pass

    @abstractmethod
    def collect_contest_details(self, contest_id: str) -> Dict:
        """Collect detailed information for a specific contest"""
        pass

    @abstractmethod
    def collect_audit_reports(self, contest_id: str) -> List[AuditReport]:
        """Collect audit reports for a specific contest"""
        pass

    def rate_limit(self, delay: float = 1.0):
        """Implement rate limiting between requests"""
        time.sleep(delay)

    def safe_request(self, url: str, **kwargs) -> Optional[requests.Response]:
        """Make a safe HTTP request with error handling"""
        try:
            response = self.session.get(url, **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            self.logger.error(f"Request failed for {url}: {e}")
            return None
```

**src/collectors/code4rena_collector.py**
```python
import re
from typing import Dict, List
from datetime import datetime
from .base_collector import BaseCollector, AuditReport

class Code4renaCollector(BaseCollector):
    """Collector for Code4rena audit contests and reports"""

    def __init__(self, config: Dict):
        super().__init__(config)
        self.base_url = "https://code4rena.com"
        self.api_url = "https://code4rena.com/api"

    def collect_contests(self) -> List[Dict]:
        """Collect all Code4rena contests"""
        contests = []

        # Collect active contests
        active_url = f"{self.api_url}/contests"
        response = self.safe_request(active_url)

        if response:
            data = response.json()
            for contest in data.get('contests', []):
                contests.append({
                    'id': contest.get('contestid'),
                    'title': contest.get('title'),
                    'status': contest.get('status'),
                    'start_time': contest.get('start_time'),
                    'end_time': contest.get('end_time'),
                    'prize_pool': contest.get('amount'),
                    'sponsor': contest.get('sponsor'),
                    'url': f"{self.base_url}/contests/{contest.get('contestid')}"
                })

        self.rate_limit()
        return contests

    def collect_contest_details(self, contest_id: str) -> Dict:
        """Collect detailed information for a specific contest"""
        url = f"{self.base_url}/contests/{contest_id}"
        response = self.safe_request(url)

        if not response:
            return {}

        soup = BeautifulSoup(response.content, 'html.parser')

        details = {
            'contest_id': contest_id,
            'title': self._extract_title(soup),
            'description': self._extract_description(soup),
            'scope': self._extract_scope(soup),
            'prize_pool': self._extract_prize_pool(soup),
            'timeline': self._extract_timeline(soup),
            'sponsors': self._extract_sponsors(soup)
        }

        self.rate_limit()
        return details

    def collect_audit_reports(self, contest_id: str) -> List[AuditReport]:
        """Collect audit reports for a specific contest"""
        reports = []

        # Get contest findings/reports
        reports_url = f"{self.base_url}/reports/{contest_id}"
        response = self.safe_request(reports_url)

        if not response:
            return reports

        soup = BeautifulSoup(response.content, 'html.parser')

        # Extract individual findings
        findings = soup.find_all('div', class_='finding')

        for finding in findings:
            report = self._parse_finding(finding, contest_id)
            if report:
                reports.append(report)

        self.rate_limit()
        return reports

    def _extract_title(self, soup) -> str:
        """Extract contest title from HTML"""
        title_elem = soup.find('h1') or soup.find('title')
        return title_elem.get_text(strip=True) if title_elem else ""

    def _extract_description(self, soup) -> str:
        """Extract contest description"""
        desc_elem = soup.find('div', class_='contest-description')
        return desc_elem.get_text(strip=True) if desc_elem else ""

    def _extract_scope(self, soup) -> List[str]:
        """Extract contest scope/contracts"""
        scope_section = soup.find('section', id='scope')
        if not scope_section:
            return []

        contracts = []
        for item in scope_section.find_all('li'):
            contracts.append(item.get_text(strip=True))

        return contracts

    def _extract_prize_pool(self, soup) -> str:
        """Extract prize pool information"""
        prize_elem = soup.find('span', string=re.compile(r'\$[\d,]+'))
        return prize_elem.get_text(strip=True) if prize_elem else ""

    def _extract_timeline(self, soup) -> Dict:
        """Extract contest timeline"""
        timeline = {}

        start_elem = soup.find('time', {'data-start': True})
        if start_elem:
            timeline['start'] = start_elem.get('data-start')

        end_elem = soup.find('time', {'data-end': True})
        if end_elem:
            timeline['end'] = end_elem.get('data-end')

        return timeline

    def _extract_sponsors(self, soup) -> List[str]:
        """Extract sponsor information"""
        sponsors = []
        sponsor_section = soup.find('div', class_='sponsors')

        if sponsor_section:
            for sponsor in sponsor_section.find_all('a'):
                sponsors.append(sponsor.get_text(strip=True))

        return sponsors

    def _parse_finding(self, finding_elem, contest_id: str) -> Optional[AuditReport]:
        """Parse individual finding/report"""
        try:
            # Extract finding details
            title = finding_elem.find('h3')
            severity = finding_elem.find('span', class_='severity')
            description = finding_elem.find('div', class_='description')

            if not all([title, severity, description]):
                return None

            return AuditReport(
                contest_id=contest_id,
                title=title.get_text(strip=True),
                platform="Code4rena",
                severity=severity.get_text(strip=True),
                category=self._extract_category(finding_elem),
                description=description.get_text(strip=True),
                findings=self._extract_findings_list(finding_elem),
                date_published=datetime.now(),
                url=f"{self.base_url}/reports/{contest_id}#{title.get('id', '')}",
                metadata={
                    'contest_id': contest_id,
                    'platform': 'Code4rena'
                }
            )

        except Exception as e:
            self.logger.error(f"Error parsing finding: {e}")
            return None

    def _extract_category(self, finding_elem) -> str:
        """Extract vulnerability category"""
        category_elem = finding_elem.find('span', class_='category')
        return category_elem.get_text(strip=True) if category_elem else "Unknown"

    def _extract_findings_list(self, finding_elem) -> List[str]:
        """Extract list of findings/issues"""
        findings = []
        findings_list = finding_elem.find('ul', class_='findings')

        if findings_list:
            for item in findings_list.find_all('li'):
                findings.append(item.get_text(strip=True))

        return findings
```

#### 1.3 Configuration Files

**config/config.yaml**
```yaml
# Web3 Audit Intelligence System Configuration

collectors:
  code4rena:
    enabled: true
    base_url: "https://code4rena.com"
    api_url: "https://code4rena.com/api"
    rate_limit: 1.0  # seconds between requests
    user_agent: "Web3AuditIntelligence/1.0"
    timeout: 30

  immunefi:
    enabled: false
    base_url: "https://immunefi.com"
    rate_limit: 2.0

database:
  url: "postgresql://user:password@localhost:5432/audit_intelligence"
  pool_size: 10
  echo: false

api:
  host: "0.0.0.0"
  port: 8000
  debug: false

logging:
  level: "INFO"
  format: "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
  file: "logs/audit_intelligence.log"

processing:
  batch_size: 100
  concurrent_requests: 5
  retry_attempts: 3
  retry_delay: 5
```

---

## 📊 BMAD Phase 2: MANAGE

### Role: **Project Manager / DevOps Engineer**
**Responsibilities**: Process orchestration, data management, system monitoring

#### 2.1 Data Pipeline Management

**scripts/run_collectors.py**
```python
#!/usr/bin/env python3
"""
Data collection orchestration script
"""
import asyncio
import click
from datetime import datetime, timedelta
from src.collectors.code4rena_collector import Code4renaCollector
from src.database.operations import DatabaseManager
from src.utils.config import load_config
from src.utils.logger import setup_logging

@click.command()
@click.option('--platform', default='code4rena', help='Platform to collect from')
@click.option('--days', default=7, help='Number of days to look back')
@click.option('--full-sync', is_flag=True, help='Perform full synchronization')
def main(platform, days, full_sync):
    """Run audit report collection"""

    # Setup
    config = load_config()
    logger = setup_logging()
    db_manager = DatabaseManager(config['database'])

    # Initialize collector
    if platform == 'code4rena':
        collector = Code4renaCollector(config['collectors']['code4rena'])
    else:
        raise ValueError(f"Unknown platform: {platform}")

    logger.info(f"Starting collection for {platform}")

    try:
        if full_sync:
            # Collect all historical data
            contests = collector.collect_contests()
            logger.info(f"Found {len(contests)} contests")

            for contest in contests:
                process_contest(collector, db_manager, contest, logger)

        else:
            # Collect recent data only
            cutoff_date = datetime.now() - timedelta(days=days)
            recent_contests = get_recent_contests(collector, cutoff_date)

            for contest in recent_contests:
                process_contest(collector, db_manager, contest, logger)

    except Exception as e:
        logger.error(f"Collection failed: {e}")
        raise

    logger.info("Collection completed successfully")

def process_contest(collector, db_manager, contest, logger):
    """Process a single contest"""
    contest_id = contest['id']
    logger.info(f"Processing contest {contest_id}")

    # Get contest details
    details = collector.collect_contest_details(contest_id)

    # Get audit reports
    reports = collector.collect_audit_reports(contest_id)

    # Save to database
    db_manager.save_contest(details)
    db_manager.save_reports(reports)

    logger.info(f"Processed {len(reports)} reports for contest {contest_id}")

if __name__ == '__main__':
    main()
```

#### 2.2 Database Management

**src/database/models.py**
```python
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Contest(Base):
    __tablename__ = 'contests'

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    status = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    prize_pool = Column(String)
    sponsor = Column(String)
    description = Column(Text)
    scope = Column(JSON)
    metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    reports = relationship("AuditReport", back_populates="contest")

class AuditReport(Base):
    __tablename__ = 'audit_reports'

    id = Column(Integer, primary_key=True)
    contest_id = Column(String, ForeignKey('contests.id'), nullable=False)
    title = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    severity = Column(String)
    category = Column(String)
    description = Column(Text)
    findings = Column(JSON)
    date_published = Column(DateTime)
    url = Column(String)
    metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    contest = relationship("Contest", back_populates="reports")

class VulnerabilityPattern(Base):
    __tablename__ = 'vulnerability_patterns'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String)
    description = Column(Text)
    pattern_signature = Column(Text)
    severity_distribution = Column(JSON)
    frequency = Column(Integer, default=0)
    platforms = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### 2.3 Monitoring and Alerting

**src/utils/monitoring.py**
```python
import logging
from datetime import datetime, timedelta
from typing import Dict, List
from dataclasses import dataclass

@dataclass
class SystemMetrics:
    timestamp: datetime
    collections_completed: int
    collections_failed: int
    reports_processed: int
    processing_time: float
    error_rate: float

class MonitoringService:
    """System monitoring and alerting service"""

    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(self.__class__.__name__)
        self.metrics_history: List[SystemMetrics] = []

    def record_collection_success(self, platform: str, reports_count: int, duration: float):
        """Record successful collection event"""
        self.logger.info(f"Collection success: {platform} - {reports_count} reports in {duration:.2f}s")

        metrics = SystemMetrics(
            timestamp=datetime.utcnow(),
            collections_completed=1,
            collections_failed=0,
            reports_processed=reports_count,
            processing_time=duration,
            error_rate=0.0
        )

        self.metrics_history.append(metrics)
        self._cleanup_old_metrics()

    def record_collection_failure(self, platform: str, error: str):
        """Record failed collection event"""
        self.logger.error(f"Collection failure: {platform} - {error}")

        metrics = SystemMetrics(
            timestamp=datetime.utcnow(),
            collections_completed=0,
            collections_failed=1,
            reports_processed=0,
            processing_time=0.0,
            error_rate=1.0
        )

        self.metrics_history.append(metrics)
        self._check_alert_conditions()

    def get_system_health(self) -> Dict:
        """Get current system health status"""
        if not self.metrics_history:
            return {"status": "unknown", "message": "No metrics available"}

        recent_metrics = self._get_recent_metrics()

        total_collections = sum(m.collections_completed + m.collections_failed for m in recent_metrics)
        failed_collections = sum(m.collections_failed for m in recent_metrics)

        if total_collections == 0:
            error_rate = 0.0
        else:
            error_rate = failed_collections / total_collections

        if error_rate > 0.5:
            status = "critical"
        elif error_rate > 0.2:
            status = "warning"
        else:
            status = "healthy"

        return {
            "status": status,
            "error_rate": error_rate,
            "total_collections": total_collections,
            "failed_collections": failed_collections,
            "last_update": self.metrics_history[-1].timestamp.isoformat()
        }

    def _get_recent_metrics(self, hours: int = 24) -> List[SystemMetrics]:
        """Get metrics from recent time period"""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        return [m for m in self.metrics_history if m.timestamp > cutoff]

    def _cleanup_old_metrics(self, days: int = 7):
        """Remove metrics older than specified days"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        self.metrics_history = [m for m in self.metrics_history if m.timestamp > cutoff]

    def _check_alert_conditions(self):
        """Check if any alert conditions are met"""
        recent_metrics = self._get_recent_metrics(hours=1)
        recent_failures = sum(m.collections_failed for m in recent_metrics)

        if recent_failures >= 3:
            self._send_alert("High failure rate detected", f"{recent_failures} failures in the last hour")

    def _send_alert(self, title: str, message: str):
        """Send alert notification"""
        self.logger.critical(f"ALERT: {title} - {message}")
        # Implement actual alerting (email, Slack, etc.)
```

---

## 🔍 BMAD Phase 3: ANALYZE

### Role: **Data Scientist / Security Researcher**
**Responsibilities**: Vulnerability analysis, pattern recognition, intelligence generation

#### 3.1 Vulnerability Analysis Engine

**src/processors/vulnerability_analyzer.py**
```python
import re
from collections import Counter, defaultdict
from typing import Dict, List, Tuple
import pandas as pd
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class VulnerabilityInsight:
    pattern_id: str
    name: str
    frequency: int
    severity_distribution: Dict[str, int]
    affected_platforms: List[str]
    trend: str  # 'increasing', 'decreasing', 'stable'
    recommendations: List[str]

class VulnerabilityAnalyzer:
    """Advanced vulnerability pattern analysis and intelligence"""

    def __init__(self, config: Dict):
        self.config = config
        self.vulnerability_patterns = self._load_patterns()
        self.severity_weights = {
            'critical': 10,
            'high': 7,
            'medium': 4,
            'low': 1
        }

    def analyze_vulnerability_trends(self, reports: List[Dict], days: int = 30) -> List[VulnerabilityInsight]:
        """Analyze vulnerability trends over time"""

        # Filter recent reports
        cutoff_date = datetime.now() - timedelta(days=days)
        recent_reports = [r for r in reports if r['date_published'] > cutoff_date]

        # Group by vulnerability patterns
        pattern_groups = self._group_by_patterns(recent_reports)

        insights = []
        for pattern_id, pattern_reports in pattern_groups.items():
            insight = self._analyze_pattern(pattern_id, pattern_reports, days)
            insights.append(insight)

        # Sort by risk score (frequency * severity)
        insights.sort(key=lambda x: self._calculate_risk_score(x), reverse=True)

        return insights

    def identify_emerging_threats(self, reports: List[Dict]) -> List[Dict]:
        """Identify new and emerging threat patterns"""

        # Analyze patterns over different time windows
        windows = [7, 30, 90]  # days
        emerging_threats = []

        for window in windows:
            recent_patterns = self._get_patterns_in_window(reports, window)
            previous_patterns = self._get_patterns_in_window(reports, window * 2, offset=window)

            # Find patterns that are new or significantly increasing
            for pattern, current_count in recent_patterns.items():
                previous_count = previous_patterns.get(pattern, 0)

                # New pattern or significant increase
                if previous_count == 0 or (current_count / max(previous_count, 1)) > 2:
                    emerging_threats.append({
                        'pattern': pattern,
                        'current_frequency': current_count,
                        'previous_frequency': previous_count,
                        'growth_rate': (current_count - previous_count) / max(previous_count, 1),
                        'window_days': window,
                        'first_seen': self._get_first_occurrence(reports, pattern)
                    })

        return emerging_threats

    def generate_security_recommendations(self, analysis_results: List[VulnerabilityInsight]) -> Dict:
        """Generate actionable security recommendations"""

        recommendations = {
            'immediate_actions': [],
            'preventive_measures': [],
            'monitoring_focuses': [],
            'training_needs': []
        }

        # Analyze top vulnerabilities
        top_vulns = analysis_results[:10]

        for vuln in top_vulns:
            if vuln.frequency > 10 and 'critical' in vuln.severity_distribution:
                recommendations['immediate_actions'].extend([
                    f"Immediate audit focus: {vuln.name}",
                    f"Review existing code for {vuln.pattern_id} patterns"
                ])

            if vuln.trend == 'increasing':
                recommendations['monitoring_focuses'].append(
                    f"Monitor for {vuln.name} - showing upward trend"
                )

            # Add pattern-specific recommendations
            recommendations['preventive_measures'].extend(vuln.recommendations)

        # Identify training needs based on common vulnerabilities
        common_categories = self._get_common_categories(analysis_results)
        for category in common_categories:
            recommendations['training_needs'].append(
                f"Developer training needed: {category} security patterns"
            )

        return recommendations

    def create_vulnerability_dashboard_data(self, reports: List[Dict]) -> Dict:
        """Create data structure for vulnerability dashboard"""

        # Time series data
        time_series = self._create_time_series_data(reports)

        # Severity distribution
        severity_dist = self._calculate_severity_distribution(reports)

        # Platform comparison
        platform_stats = self._calculate_platform_statistics(reports)

        # Top vulnerabilities
        top_vulns = self._get_top_vulnerabilities(reports, limit=20)

        # Category breakdown
        category_breakdown = self._calculate_category_breakdown(reports)

        return {
            'time_series': time_series,
            'severity_distribution': severity_dist,
            'platform_statistics': platform_stats,
            'top_vulnerabilities': top_vulns,
            'category_breakdown': category_breakdown,
            'total_reports': len(reports),
            'unique_patterns': len(set(r.get('pattern_id') for r in reports if r.get('pattern_id'))),
            'last_updated': datetime.now().isoformat()
        }

    def _load_patterns(self) -> Dict:
        """Load known vulnerability patterns"""
        # This would typically load from a database or configuration file
        return {
            'reentrancy': {
                'keywords': ['reentrancy', 'reentrant', 'external call', 'state change'],
                'severity': 'high',
                'category': 'Smart Contract Logic'
            },
            'integer_overflow': {
                'keywords': ['overflow', 'underflow', 'integer', 'arithmetic'],
                'severity': 'medium',
                'category': 'Arithmetic'
            },
            'access_control': {
                'keywords': ['access control', 'permission', 'unauthorized', 'privilege'],
                'severity': 'critical',
                'category': 'Access Control'
            },
            'front_running': {
                'keywords': ['front run', 'mev', 'sandwich', 'mempool'],
                'severity': 'medium',
                'category': 'MEV'
            }
        }

    def _group_by_patterns(self, reports: List[Dict]) -> Dict[str, List[Dict]]:
        """Group reports by vulnerability patterns"""
        groups = defaultdict(list)

        for report in reports:
            pattern_id = self._identify_pattern(report)
            groups[pattern_id].append(report)

        return dict(groups)

    def _identify_pattern(self, report: Dict) -> str:
        """Identify vulnerability pattern from report"""
        text = f"{report.get('title', '')} {report.get('description', '')}".lower()

        for pattern_id, pattern_info in self.vulnerability_patterns.items():
            keywords = pattern_info['keywords']
            if any(keyword in text for keyword in keywords):
                return pattern_id

        return 'unknown'

    def _analyze_pattern(self, pattern_id: str, reports: List[Dict], window_days: int) -> VulnerabilityInsight:
        """Analyze a specific vulnerability pattern"""

        # Calculate severity distribution
        severity_dist = Counter(r.get('severity', 'unknown').lower() for r in reports)

        # Get affected platforms
        platforms = list(set(r.get('platform', 'unknown') for r in reports))

        # Calculate trend
        trend = self._calculate_trend(reports, window_days)

        # Get recommendations
        recommendations = self._get_pattern_recommendations(pattern_id)

        return VulnerabilityInsight(
            pattern_id=pattern_id,
            name=self.vulnerability_patterns.get(pattern_id, {}).get('name', pattern_id),
            frequency=len(reports),
            severity_distribution=dict(severity_dist),
            affected_platforms=platforms,
            trend=trend,
            recommendations=recommendations
        )

    def _calculate_risk_score(self, insight: VulnerabilityInsight) -> float:
        """Calculate risk score for vulnerability insight"""
        frequency_score = insight.frequency

        severity_score = sum(
            count * self.severity_weights.get(severity, 1)
            for severity, count in insight.severity_distribution.items()
        )

        trend_multiplier = {
            'increasing': 1.5,
            'stable': 1.0,
            'decreasing': 0.7
        }.get(insight.trend, 1.0)

        return (frequency_score + severity_score) * trend_multiplier

    def _calculate_trend(self, reports: List[Dict], window_days: int) -> str:
        """Calculate trend direction for vulnerability pattern"""

        if len(reports) < 2:
            return 'stable'

        # Split into two halves of the time window
        mid_date = datetime.now() - timedelta(days=window_days // 2)

        recent_count = len([r for r in reports if r['date_published'] > mid_date])
        older_count = len([r for r in reports if r['date_published'] <= mid_date])

        if recent_count > older_count * 1.2:
            return 'increasing'
        elif recent_count < older_count * 0.8:
            return 'decreasing'
        else:
            return 'stable'

    def _get_pattern_recommendations(self, pattern_id: str) -> List[str]:
        """Get security recommendations for specific pattern"""
        recommendations_map = {
            'reentrancy': [
                "Implement checks-effects-interactions pattern",
                "Use reentrancy guards (OpenZeppelin ReentrancyGuard)",
                "Minimize external calls in critical functions"
            ],
            'integer_overflow': [
                "Use SafeMath library or Solidity 0.8+ built-in overflow checks",
                "Validate all arithmetic operations",
                "Implement proper bounds checking"
            ],
            'access_control': [
                "Implement role-based access control",
                "Use OpenZeppelin AccessControl contracts",
                "Regular access control audits"
            ],
            'front_running': [
                "Implement commit-reveal schemes",
                "Use time locks for sensitive operations",
                "Consider private mempools"
            ]
        }

        return recommendations_map.get(pattern_id, ["General security review recommended"])
```

---

## 🚀 BMAD Phase 4: DEPLOY

### Role: **DevOps Engineer / Site Reliability Engineer**
**Responsibilities**: Production deployment, scaling, maintenance

#### 4.1 Containerization and Orchestration

**Dockerfile**
```dockerfile
# Multi-stage build for Web3 Audit Intelligence System
FROM python:3.11-slim as builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Production stage
FROM python:3.11-slim as production

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set work directory
WORKDIR /app

# Copy application code
COPY src/ /app/src/
COPY config/ /app/config/
COPY scripts/ /app/scripts/

# Create necessary directories
RUN mkdir -p /app/logs /app/data/raw /app/data/processed /app/data/exports && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Default command
CMD ["python", "-m", "uvicorn", "src.api.routes:app", "--host", "0.0.0.0", "--port", "8000"]
```

**docker-compose.yml**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: audit_intelligence
      POSTGRES_USER: audit_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U audit_user -d audit_intelligence"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis for caching and task queue
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Main API application
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    environment:
      - DATABASE_URL=postgresql://audit_user:${POSTGRES_PASSWORD}@postgres:5432/audit_intelligence
      - REDIS_URL=redis://redis:6379/0
      - ENVIRONMENT=production
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
      - ./data:/app/data
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.audit-intelligence.local`)"
      - "traefik.http.services.api.loadbalancer.server.port=8000"

  # Data collection workers
  collector-worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    environment:
      - DATABASE_URL=postgresql://audit_user:${POSTGRES_PASSWORD}@postgres:5432/audit_intelligence
      - REDIS_URL=redis://redis:6379/0
      - WORKER_TYPE=collector
    command: python scripts/run_collectors.py
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
      - ./data:/app/data
    restart: unless-stopped
    scale: 2

  # Data processing workers
  processor-worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    environment:
      - DATABASE_URL=postgresql://audit_user:${POSTGRES_PASSWORD}@postgres:5432/audit_intelligence
      - REDIS_URL=redis://redis:6379/0
      - WORKER_TYPE=processor
    command: python scripts/run_processor.py
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
      - ./data:/app/data
    restart: unless-stopped

  # Reverse proxy and load balancer
  traefik:
    image: traefik:v3.0
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped

  # Monitoring with Prometheus
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    restart: unless-stopped

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  default:
    name: audit-intelligence-network
```

#### 4.2 Deployment Scripts

**scripts/deploy.sh**
```bash
#!/bin/bash
# Production deployment script for Web3 Audit Intelligence System

set -e

# Configuration
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
BACKUP_RETENTION_DAYS=30

echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Pre-deployment checks
echo "📋 Running pre-deployment checks..."

# Check if required environment variables are set
required_vars=("POSTGRES_PASSWORD" "GRAFANA_PASSWORD")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Check if Docker and Docker Compose are available
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed"
    exit 1
fi

# Backup existing data
echo "💾 Creating backup..."
backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

# Backup database
if docker-compose ps postgres | grep -q "Up"; then
    echo "Backing up PostgreSQL database..."
    docker-compose exec -T postgres pg_dump -U audit_user audit_intelligence > "$backup_dir/database.sql"
fi

# Backup application data
if [[ -d "data" ]]; then
    echo "Backing up application data..."
    tar -czf "$backup_dir/data.tar.gz" data/
fi

# Cleanup old backups
find backups/ -type d -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true

# Build and deploy
echo "🔨 Building application..."
docker-compose build --parallel

echo "🎯 Deploying services..."

# Deploy with zero-downtime strategy
if [[ "$ENVIRONMENT" == "production" ]]; then
    # Blue-green deployment simulation
    docker-compose up -d --scale api=2 --scale collector-worker=2

    # Health check
    echo "🏥 Performing health checks..."
    for i in {1..30}; do
        if curl -f http://localhost:8000/health > /dev/null 2>&1; then
            echo "✅ Health check passed"
            break
        fi
        echo "⏳ Waiting for service to be healthy... ($i/30)"
        sleep 10
    done

    if ! curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo "❌ Health check failed, rolling back..."
        docker-compose down
        echo "Please check logs and try again"
        exit 1
    fi
else
    # Development deployment
    docker-compose up -d
fi

# Run database migrations
echo "🗃️ Running database migrations..."
docker-compose exec api python scripts/migrate_db.py

# Post-deployment verification
echo "✅ Running post-deployment verification..."

# Test API endpoints
api_endpoints=(
    "/health"
    "/api/v1/contests"
    "/api/v1/reports"
)

for endpoint in "${api_endpoints[@]}"; do
    if curl -f "http://localhost:8000$endpoint" > /dev/null 2>&1; then
        echo "✅ Endpoint $endpoint is responding"
    else
        echo "⚠️ Warning: Endpoint $endpoint is not responding"
    fi
done

# Check all services are running
echo "📊 Service status:"
docker-compose ps

# Display deployment summary
echo "
🎉 Deployment completed successfully!

📊 Access points:
- API: http://localhost:8000
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- Traefik Dashboard: http://localhost:8080

📂 Important directories:
- Logs: ./logs/
- Data: ./data/
- Backups: ./backups/

🔧 Management commands:
- View logs: docker-compose logs -f [service]
- Scale services: docker-compose up -d --scale [service]=[count]
- Stop services: docker-compose down
- Update configuration: docker-compose restart [service]

🚨 Monitoring:
- Check system health: curl http://localhost:8000/health
- View metrics: http://localhost:9090/targets
- View dashboards: http://localhost:3000
"

echo "✨ Deployment completed at $(date)"
```

#### 4.3 Production Configuration

**monitoring/prometheus.yml**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'audit-intelligence-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

#### 4.4 Production Monitoring and Alerts

**monitoring/alert_rules.yml**
```yaml
groups:
  - name: audit_intelligence_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: DatabaseConnectionDown
        expr: up{job="postgres-exporter"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection down"
          description: "PostgreSQL database is not responding"

      - alert: CollectorFailure
        expr: increase(collection_failures_total[1h]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Multiple collector failures"
          description: "{{ $value }} collection failures in the last hour"

      - alert: DiskSpaceUsage
        expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High disk usage"
          description: "Disk usage is at {{ $value | humanizePercentage }}"

      - alert: MemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage"
          description: "Memory usage is at {{ $value | humanizePercentage }}"
```

---

## 🔄 BMAD Integration & Team Coordination

### Cross-Role Communication Matrix

| Phase | Role | Deliverables | Dependencies | Communication Points |
|-------|------|--------------|--------------|---------------------|
| **BUILD** | Lead Developer | Code architecture, core modules | Requirements, tech stack | Weekly standups, code reviews |
| **MANAGE** | Project Manager | Process workflows, data pipelines | Development completion | Daily check-ins, sprint planning |
| **ANALYZE** | Data Scientist | Intelligence algorithms, insights | Data availability | Bi-weekly analysis reviews |
| **DEPLOY** | DevOps Engineer | Production infrastructure | All phases | Release planning, incident response |

### Quality Gates

1. **Build → Manage**: Code review, unit tests pass, documentation complete
2. **Manage → Analyze**: Data pipeline operational, quality metrics met
3. **Analyze → Deploy**: Analysis algorithms validated, performance benchmarks met
4. **Deploy → Production**: Security audit passed, monitoring configured

### Success Metrics

- **Build Phase**: Code coverage >80%, API response time <200ms
- **Manage Phase**: Data collection uptime >99%, processing latency <5min
- **Analyze Phase**: Pattern detection accuracy >90%, insight generation <1hr
- **Deploy Phase**: Zero-downtime deployments, system availability >99.9%

This comprehensive BMAD Method guide provides a structured approach to building a production-ready Web3 audit intelligence system with clear role separation, deliverables, and quality standards.