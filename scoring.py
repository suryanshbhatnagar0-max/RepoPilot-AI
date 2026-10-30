from typing import List, Dict

def classify_issue(issue: Dict) -> str:
    """Classify issue difficulty based on labels.
    Returns one of "Beginner", "Intermediate", "Advanced".
    """
    labels = [lbl.lower() for lbl in issue.get("labels", [])]
    # Simple heuristic
    if any(keyword in labels for keyword in ["good first issue", "easy", "starter", "beginner"]):
        return "Beginner"
    if any(keyword in labels for keyword in ["help wanted", "documentation", "good first issue"]):
        return "Beginner"
    if any(keyword in labels for keyword in ["enhancement", "feature", "medium"]):
        return "Intermediate"
    return "Advanced"


def score_issue(issue: Dict) -> Dict:
    """Return a new dict with difficulty and fit_score added.
    Fit score is 100 for Beginner, 70 for Intermediate, 40 for Advanced, adjusted by number of comments (more comments may indicate discussion).
    """
    difficulty = classify_issue(issue)
    base = {"Beginner": 100, "Intermediate": 70, "Advanced": 40}[difficulty]
    comments = issue.get("comments", 0)
    # Slight boost for more comments up to 20 comments
    boost = min(comments, 20) * 0.5
    fit_score = max(0, min(100, base + boost))
    new_issue = issue.copy()
    new_issue["difficulty"] = difficulty
    new_issue["fit_score"] = round(fit_score, 1)
    return new_issue


def score_issues(issues: List[Dict]) -> List[Dict]:
    """Score a list of issues.
    Returns a list of dictionaries with added keys.
    """
    return [score_issue(issue) for issue in issues]

