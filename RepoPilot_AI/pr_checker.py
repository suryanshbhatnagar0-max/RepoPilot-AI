from github_client import GitHubClient

def check_pr(pr_url: str) -> dict | None:
    """Fetch PR details using GitHubClient and return a readiness checklist dict.
    The returned dict includes basic PR metadata and a simple checklist.
    """
    client = GitHubClient()
    pr = client.fetch_pull(pr_url)
    if not pr:
        return None
    # Simple checklist logic
    checklist = {
        "has_description": bool(pr.get("body")),
        "linked_issue": any("#" in (pr.get("body") or "")),
        "files_changed": pr.get("changed_files", 0) > 0,
        "reviews_requested": False,  # placeholder as we don't fetch reviews without auth
    }
    pr["readiness_checklist"] = checklist
    return pr

