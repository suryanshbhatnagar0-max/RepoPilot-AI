import pytest
from scoring import classify_issue, score_issue, score_issues

sample_issue_beginner = {
    "number": 1,
    "title": "Add documentation",
    "labels": ["good first issue", "documentation"],
    "assignee": None,
    "comments": 2,
    "url": "https://github.com/example/repo/issues/1"
}

sample_issue_intermediate = {
    "number": 2,
    "title": "Implement feature X",
    "labels": ["enhancement", "feature"],
    "assignee": "alice",
    "comments": 5,
    "url": "https://github.com/example/repo/issues/2"
}

sample_issue_advanced = {
    "number": 3,
    "title": "Refactor core module",
    "labels": ["refactor"],
    "assignee": "bob",
    "comments": 0,
    "url": "https://github.com/example/repo/issues/3"
}


def test_classify_issue():
    assert classify_issue(sample_issue_beginner) == "Beginner"
    assert classify_issue(sample_issue_intermediate) == "Intermediate"
    assert classify_issue(sample_issue_advanced) == "Advanced"


def test_score_issue():
    beginner_scored = score_issue(sample_issue_beginner)
    assert beginner_scored["difficulty"] == "Beginner"
    # base 100 + 0.5*comments (2) = 101 capped at 100
    assert beginner_scored["fit_score"] == 100

    intermediate_scored = score_issue(sample_issue_intermediate)
    assert intermediate_scored["difficulty"] == "Intermediate"
    # base 70 + 0.5*5 = 72.5
    assert intermediate_scored["fit_score"] == 72.5

    advanced_scored = score_issue(sample_issue_advanced)
    assert advanced_scored["difficulty"] == "Advanced"
    # base 40 + 0 boost
    assert advanced_scored["fit_score"] == 40


def test_score_issues_returns_list():
    result = score_issues([sample_issue_beginner, sample_issue_intermediate, sample_issue_advanced])
    assert isinstance(result, list)
    assert len(result) == 3
    assert all("fit_score" in r for r in result)

