"""
Unit tests for RepoPilot AI Offline Demo Mode & Backend API.
Verifies demo data integrity, schema consistency, and all /api/demo/* endpoints.
"""

import json
from pathlib import Path
import pytest
from starlette.testclient import TestClient
from api_server import app, DATA_FILE

client = TestClient(app)


def test_seed_file_exists_and_valid():
    """Verify demo_seed.json exists and is valid JSON."""
    assert DATA_FILE.exists(), f"Seed data file not found at {DATA_FILE}"
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "session" in data
    assert "repository" in data
    assert "issues" in data
    assert "pull_request" in data
    assert "analytics" in data


def test_api_demo_health():
    """GET /api/demo/health returns healthy offline status."""
    resp = client.get("/api/demo/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["mode"] == "DEMO"
    assert data["offline"] is True
    assert data["database_loaded"] is True


def test_api_demo_session():
    """GET /api/demo/session returns repository and PR auto-fill URLs."""
    resp = client.get("/api/demo/session")
    assert resp.status_code == 200
    data = resp.json()
    assert data["repository_url"] == "https://github.com/pallets/flask"
    assert data["pull_request_url"] == "https://github.com/pallets/flask/pulls"
    assert data["active"] is True
    assert data["mode"] == "DEMO"


def test_api_demo_repository():
    """GET /api/demo/repository returns simulated repository details."""
    resp = client.get("/api/demo/repository")
    assert resp.status_code == 200
    repo = resp.json()
    assert repo["name"] == "flask"
    assert repo["full_name"] == "pallets/flask"
    assert repo["owner"]["login"] == "pallets"
    assert repo["language"] == "Python"
    assert repo["simulated"] is True
    assert "SIMULATED" in repo.get("simulation_note", "")
    assert repo["stargazers_count"] == 74900
    assert repo["forks_count"] == 16100
    assert repo["open_issues_count"] == 12
    assert "difficulty_distribution" in repo
    assert repo["difficulty_distribution"]["Beginner"] >= 1
    assert repo["difficulty_distribution"]["Intermediate"] >= 1
    assert repo["difficulty_distribution"]["Advanced"] >= 1


def test_api_demo_issues_count_and_distribution():
    """GET /api/demo/issues returns exactly 12 issues with required fields."""
    resp = client.get("/api/demo/issues")
    assert resp.status_code == 200
    issues = resp.json()
    assert len(issues) == 12, f"Expected 12 demo issues, got {len(issues)}"

    difficulties = [i["difficulty"] for i in issues]
    assert "Beginner" in difficulties
    assert "Intermediate" in difficulties
    assert "Advanced" in difficulties

    beginner_count = difficulties.count("Beginner")
    intermediate_count = difficulties.count("Intermediate")
    advanced_count = difficulties.count("Advanced")

    assert beginner_count >= 3
    assert intermediate_count >= 3
    assert advanced_count >= 2

    # Check schema of every issue
    for issue in issues:
        assert "demo_id" in issue
        assert "id" in issue or "number" in issue
        assert "title" in issue and len(issue["title"]) > 0
        assert "description" in issue or "body" in issue
        assert "labels" in issue and isinstance(issue["labels"], list)
        assert issue["difficulty"] in ["Beginner", "Intermediate", "Advanced"]
        assert "fit_score" in issue
        assert 0 <= issue["fit_score"] <= 100
        assert "score_explanation" in issue and len(issue["score_explanation"]) > 0
        assert "suggested_skills" in issue
        assert "suggested_implementation_steps" in issue or "suggested_steps" in issue
        assert "reference_url" in issue or "html_url" in issue
        assert "roadmap" in issue


def test_api_demo_roadmap_endpoints():
    """GET /api/demo/roadmap/{issue_id} returns working roadmaps for every demo issue."""
    resp_issues = client.get("/api/demo/issues")
    issues = resp_issues.json()

    for issue in issues:
        issue_id = issue.get("id") or issue.get("number")
        resp = client.get(f"/api/demo/roadmap/{issue_id}")
        assert resp.status_code == 200, f"Roadmap for issue #{issue_id} returned status {resp.status_code}"
        data = resp.json()
        assert "roadmap" in data
        roadmap = data["roadmap"]
        assert "problem_breakdown" in roadmap
        assert "suggested_files" in roadmap and len(roadmap["suggested_files"]) > 0
        assert "branch_name" in roadmap
        assert "git_commands" in roadmap
        assert "plan_checklist" in roadmap and len(roadmap["plan_checklist"]) > 0
        assert "test_commands" in roadmap
        assert "pr_template" in roadmap


def test_api_demo_roadmap_404():
    """GET /api/demo/roadmap/{nonexistent} returns HTTP 404."""
    resp = client.get("/api/demo/roadmap/999999")
    assert resp.status_code == 404


def test_api_demo_pull_request():
    """GET /api/demo/pull-request returns simulated PR report with checklist."""
    resp = client.get("/api/demo/pull-request")
    assert resp.status_code == 200
    pr = resp.json()
    assert "demo_pr_id" in pr
    assert pr["number"] == 6168
    assert pr["title"] == "drop support for Python 3.10"
    assert "davidism" in (pr.get("author") or pr.get("user", {}).get("login", ""))
    assert "changed_files" in pr
    assert "files" in pr and len(pr["files"]) == 3
    assert pr["linked_issue"] == "#6140"
    assert "review_status" in pr
    assert "readiness_checklist" in pr
    assert "suggested_improvements" in pr
    assert "SIMULATED" in pr.get("simulated_notice", "")


def test_api_demo_analytics():
    """GET /api/demo/analytics returns derived metrics matching the 12 issues."""
    resp = client.get("/api/demo/analytics")
    assert resp.status_code == 200
    analytics = resp.json()
    assert analytics["repositories_analyzed"] >= 1
    assert analytics["total_issues_discovered"] == 12
    assert analytics["beginner_issues"] == 4
    assert analytics["intermediate_issues"] == 5
    assert analytics["advanced_issues"] == 3
    assert analytics["high_fit_opportunities"] == 9
    assert "difficulty_distribution" in analytics
    assert "labels_distribution" in analytics
    assert "contribution_opportunities" in analytics
    assert len(analytics["contribution_opportunities"]) == 5

