from fastapi import FastAPI, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from .schemas import ReportSchema, FindingSchema
from ..database.operations import DatabaseOperations

app = FastAPI(title="Web3 Audit Intelligence API")
db = DatabaseOperations()

@app.get("/")
async def root():
    return {"message": "Web3 Audit Intelligence System API"}

@app.get("/reports", response_model=List[ReportSchema])
async def get_reports(
    platform: Optional[str] = None,
    limit: int = Query(10, ge=1, le=100)
):
    """Get audit reports with optional filtering"""
    reports = db.get_reports(platform=platform, limit=limit)
    return reports

@app.get("/reports/{report_id}", response_model=ReportSchema)
async def get_report(report_id: int):
    """Get specific audit report by ID"""
    report = db.get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@app.get("/findings", response_model=List[FindingSchema])
async def get_findings(
    severity: Optional[str] = None,
    report_id: Optional[int] = None
):
    """Get vulnerability findings with optional filtering"""
    findings = db.get_findings(severity=severity, report_id=report_id)
    return findings

@app.post("/collect")
async def trigger_collection(platform: str):
    """Trigger data collection for specific platform"""
    # Trigger collection process
    return {"message": f"Collection started for {platform}"}