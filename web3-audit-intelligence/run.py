#!/usr/bin/env python3
import asyncio
import uvicorn
from src.collectors.code4rena_collector import Code4renaCollector
from src.api.routes import app

async def start_collectors():
    """Start all collectors"""
    collector = Code4renaCollector()
    while True:
        try:
            await collector.collect(limit=5)
            await asyncio.sleep(3600)  # Run every hour
        except Exception as e:
            print(f"Collector error: {e}")
            await asyncio.sleep(60)

def main():
    """Main entry point"""
    print("🚀 Starting Web3 Audit Intelligence System...")

    # Start API server in background
    config = uvicorn.Config(app, host="0.0.0.0", port=8000)
    server = uvicorn.Server(config)

    # Run collectors and API
    loop = asyncio.get_event_loop()
    loop.create_task(server.serve())
    loop.create_task(start_collectors())
    loop.run_forever()

if __name__ == "__main__":
    main()