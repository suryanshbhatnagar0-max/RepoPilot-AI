"""
RepoPilot AI - Offline Demo API Server
Provides high-performance, deterministic local backend endpoints for Demo Mode.
Works completely offline without GitHub authentication, tokens, or external API access.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Locate demo_seed.json relative to this file
BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "demo_seed.json"

if not DATA_FILE.exists():
    alt_file = BASE_DIR.parent / "data" / "demo_seed.json"
    if alt_file.exists():
        DATA_FILE = alt_file

app = FastAPI(
    title="RepoPilot AI - Demo Backend API",
    description="Offline seed data endpoints for RepoPilot AI Demo Mode",
    version="1.0.0"
)

# Enable CORS for local development (Live Server on 5500, Vite, or direct file access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_seed_data() -> Dict[str, Any]:
    """Loads deterministic demo data from demo_seed.json."""
    if not DATA_FILE.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Seed database missing at {DATA_FILE}"
        )
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error parsing seed database: {str(e)}"
        )


@app.get("/")
def root():
    return {
        "app": "RepoPilot AI",
        "mode": "DEMO BACKEND",
        "endpoints": [
            "/api/demo/health",
            "/api/demo/session",
            "/api/demo/repository",
            "/api/demo/issues",
            "/api/demo/roadmap/{issue_id}",
            "/api/demo/pull-request",
            "/api/demo/analytics"
        ]
    }


@app.get("/api/demo/health")
def get_demo_health():
    """Health check endpoint confirming offline demo mode availability."""
    return {
        "status": "healthy",
        "mode": "DEMO",
        "offline": True,
        "database_loaded": DATA_FILE.exists(),
        "version": "1.0.0"
    }


@app.get("/api/demo/session")
def get_demo_session():
    """Returns the pre-populated demo session parameters."""
    data = load_seed_data()
    return data.get("session", {})


@app.get("/api/demo/repository")
def get_demo_repository():
    """Returns simulated demo repository metadata for pallets/flask."""
    data = load_seed_data()
    return data.get("repository", {})


@app.get("/api/demo/issues")
def get_demo_issues():
    """Returns the 12 preloaded sample issues across Beginner, Intermediate, and Advanced."""
    data = load_seed_data()
    return data.get("issues", [])


@app.get("/api/demo/roadmap/{issue_id}")
def get_demo_roadmap(issue_id: str):
    """Returns step-by-step roadmap for a specific demo issue."""
    data = load_seed_data()
    issues = data.get("issues", [])

    target_issue = None
    for issue in issues:
        if str(issue.get("id")) == str(issue_id) or str(issue.get("number")) == str(issue_id) or issue.get("demo_id") == issue_id:
            target_issue = issue
            break

    if not target_issue:
        raise HTTPException(
            status_code=404,
            detail=f"Demo issue #{issue_id} not found in seeded database."
        )

    roadmap_data = target_issue.get("roadmap", {})
    return {
        "issue_id": target_issue.get("id"),
        "demo_id": target_issue.get("demo_id"),
        "title": target_issue.get("title"),
        "difficulty": target_issue.get("difficulty"),
        "fit_score": target_issue.get("fit_score"),
        "suggested_skills": target_issue.get("suggested_skills", []),
        "roadmap": roadmap_data
    }


@app.get("/api/demo/pull-request")
def get_demo_pull_request():
    """Returns the simulated demo pull request record."""
    data = load_seed_data()
    return data.get("pull_request", {})


@app.get("/api/demo/analytics")
def get_demo_analytics():
    """Returns derived analytics metrics derived from the seeded demo dataset."""
    data = load_seed_data()
    return data.get("analytics", {})


if __name__ == "__main__":
    import uvicorn
    print("Starting RepoPilot AI Demo Backend on http://127.0.0.1:8000 ...")
    uvicorn.run("api_server:app", host="127.0.0.1", port=8000, reload=True)

