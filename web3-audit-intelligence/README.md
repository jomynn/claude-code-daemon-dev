# Web3 Audit Intelligence System

## Overview
Automated system for collecting and analyzing Web3 audit reports from multiple platforms.

## Quick Start

### 1. Setup
```bash
python setup.py
```

### 2. Run
```bash
python run.py
```

### 3. Access API
Open http://localhost:8000

## Features
- ✅ Automated collection from Code4rena, Sherlock, ImmuneFi
- ✅ Real-time vulnerability analysis
- ✅ RESTful API
- ✅ PostgreSQL database
- ✅ Docker support

## Project Structure
- `src/collectors/` - Platform collectors
- `src/processors/` - Data processors
- `src/api/` - REST API
- `src/database/` - Database models

## API Endpoints
- `GET /reports` - Get audit reports
- `GET /findings` - Get vulnerability findings
- `POST /collect` - Trigger collection

## Built With BMAD Method
This project was automatically generated and built using the BMAD execution system.