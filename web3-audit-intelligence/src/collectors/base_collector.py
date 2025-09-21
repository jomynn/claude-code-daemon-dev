from abc import ABC, abstractmethod
from typing import Dict, List, Any
import logging
from datetime import datetime

class BaseCollector(ABC):
    """Base class for all audit platform collectors"""

    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(name)
        self.session = None

    @abstractmethod
    async def collect(self, **kwargs) -> List[Dict[str, Any]]:
        """Collect audit data from platform"""
        pass

    @abstractmethod
    async def parse_report(self, raw_data: str) -> Dict[str, Any]:
        """Parse raw report data"""
        pass

    def save_raw_data(self, data: Any, filename: str):
        """Save raw collected data"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filepath = f"data/raw/{self.name}_{filename}_{timestamp}.json"
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        self.logger.info(f"Saved raw data to {filepath}")

    def validate_data(self, data: Dict) -> bool:
        """Validate collected data"""
        required_fields = ['title', 'platform', 'date', 'findings']
        return all(field in data for field in required_fields)