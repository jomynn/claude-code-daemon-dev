import asyncio
import aiohttp
from bs4 import BeautifulSoup
from typing import Dict, List, Any
from .base_collector import BaseCollector
import json
from datetime import datetime

class Code4renaCollector(BaseCollector):
    """Collector for Code4rena audit reports"""

    def __init__(self):
        super().__init__("Code4rena")
        self.base_url = "https://code4rena.com"
        self.contests_url = f"{self.base_url}/contests"

    async def collect(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Collect recent audit reports from Code4rena"""
        self.logger.info(f"Starting collection from Code4rena (limit: {limit})")

        async with aiohttp.ClientSession() as session:
            contests = await self.get_contests(session, limit)
            reports = []

            for contest in contests:
                try:
                    report = await self.collect_contest_data(session, contest)
                    if report:
                        reports.append(report)
                        self.save_raw_data(report, contest['slug'])
                except Exception as e:
                    self.logger.error(f"Error collecting {contest['slug']}: {e}")

        self.logger.info(f"Collected {len(reports)} reports")
        return reports

    async def get_contests(self, session: aiohttp.ClientSession, limit: int) -> List[Dict]:
        """Get list of recent contests"""
        async with session.get(self.contests_url) as response:
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')

            contests = []
            # Parse contest list (simplified for demo)
            contest_elements = soup.find_all('div', class_='contest-card')[:limit]

            for element in contest_elements:
                contests.append({
                    'slug': element.get('data-slug', ''),
                    'title': element.find('h3').text.strip(),
                    'url': f"{self.base_url}/contests/{element.get('data-slug', '')}"
                })

            return contests

    async def collect_contest_data(self, session: aiohttp.ClientSession, contest: Dict) -> Dict:
        """Collect detailed data for a specific contest"""
        async with session.get(contest['url']) as response:
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')

            return {
                'platform': 'Code4rena',
                'title': contest['title'],
                'url': contest['url'],
                'date': datetime.now().isoformat(),
                'findings': self.extract_findings(soup),
                'prize_pool': self.extract_prize_pool(soup),
                'participants': self.extract_participants(soup)
            }

    def extract_findings(self, soup: BeautifulSoup) -> List[Dict]:
        """Extract vulnerability findings from report"""
        findings = []
        # Simplified extraction logic
        finding_elements = soup.find_all('div', class_='finding')

        for element in finding_elements:
            findings.append({
                'severity': element.get('data-severity', 'unknown'),
                'title': element.find('h4').text.strip() if element.find('h4') else '',
                'description': element.find('p').text.strip() if element.find('p') else ''
            })

        return findings

    def extract_prize_pool(self, soup: BeautifulSoup) -> str:
        """Extract prize pool information"""
        prize_element = soup.find('div', class_='prize-pool')
        return prize_element.text.strip() if prize_element else 'N/A'

    def extract_participants(self, soup: BeautifulSoup) -> int:
        """Extract number of participants"""
        participants_element = soup.find('span', class_='participants-count')
        return int(participants_element.text) if participants_element else 0