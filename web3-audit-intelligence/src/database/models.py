from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class AuditReport(Base):
    __tablename__ = 'audit_reports'

    id = Column(Integer, primary_key=True)
    platform = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    url = Column(String(500))
    date_collected = Column(DateTime, default=datetime.utcnow)
    date_published = Column(DateTime)
    prize_pool = Column(String(100))
    participants = Column(Integer)
    raw_data = Column(JSON)

    findings = relationship("Finding", back_populates="report")

class Finding(Base):
    __tablename__ = 'findings'

    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey('audit_reports.id'))
    severity = Column(String(20))
    title = Column(String(500))
    description = Column(String)
    impact = Column(String)
    recommendation = Column(String)

    report = relationship("AuditReport", back_populates="findings")