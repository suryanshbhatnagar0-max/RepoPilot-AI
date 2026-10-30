import re
import requests
from typing import Tuple, List, Optional, Dict

GITHUB_API = "https://api.github.com"

class GitHubClient:
    """Simple client for public GitHub REST API calls.

    Does not require authentication for public data, respects rate limits.
    """

    def __init__(self, token: Optional[str] = None):
        self.session = requests.Session()
        if token:
            self.session.headers.update({"Authorization": f"token {token}"})
        # Generic headers
        self.session.headers.update({"Accept": "application/vnd.github.v3+json", "User-Agent": "RepoPilot-AI"})

    @staticmethod
    def _parse_repo_url(url: str) -> Tuple[Optional[str], Optional[str]]:
        """Extract owner and repo name from a GitHub URL.
        Supports URLs like:
          https://github.com/owner/repo
          https://github.com/owner/repo.git
        Returns (owner, repo) or (None, None) on failure.
        """
        pattern = r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?$"
        match = re.match(pattern, url.strip())
        if not match:
            return None, None
        return match.group(1), match.group(2)

    def fetch_repo_and_issues(self, repo_url: str) -> Tuple[Optional[Dict], Optional[List[Dict]]]:
        """Fetch repository metadata and open issues (excluding pull requests).
        Returns a tuple of (repo_data, issues) where each is ``None`` on error.
        """
        owner, repo = self._parse_repo_url(repo_url)
        if not owner or not repo:
            return None, None
        repo_endpoint = f"{GITHUB_API}/repos/{owner}/{repo}"
        issues_endpoint = f"{GITHUB_API}/repos/{owner}/{repo}/issues"
        try:
            repo_resp = self.session.get(repo_endpoint)
            repo_resp.raise_for_status()
            repo_data = repo_resp.json()

            # Fetch issues, paging through up to 200 issues for demo purposes
            params = {"state": "open", "per_page": 100}
            issues: List[Dict] = []
            page = 1
            while True:
                params["page"] = page
                resp = self.session.get(issues_endpoint, params=params)
                resp.raise_for_status()
                batch = resp.json()
                # Exclude pull requests – they have a "pull_request" key
                batch = [i for i in batch if "pull_request" not in i]
                if not batch:
                    break
                issues.extend(batch)
                if len(batch) < 100:
                    break
                page += 1
                if page > 2:  # limit to 2 pages = 200 issues
                    break
            # Simplify issue dicts for downstream use
            simplified: List[Dict] = []
            for i in issues:
                simplified.append({
                    "number": i.get("number"),
                    "title": i.get("title"),
                    "labels": [lbl["name"] for lbl in i.get("labels", [])],
                    "assignee": i.get("assignee", {}).get("login") if i.get("assignee") else None,
                    "comments": i.get("comments"),
                    "url": i.get("html_url"),
                })
            return repo_data, simplified
        except requests.RequestException:
            return None, None

    def fetch_issue(self, repo_url: str, number: int) -> Optional[Dict]:
        """Fetch a single issue by number (excluding PRs)."""
        owner, repo = self._parse_repo_url(repo_url)
        if not owner or not repo:
            return None
        endpoint = f"{GITHUB_API}/repos/{owner}/{repo}/issues/{number}"
        try:
            resp = self.session.get(endpoint)
            resp.raise_for_status()
            i = resp.json()
            if "pull_request" in i:
                return None
            return {
                "number": i.get("number"),
                "title": i.get("title"),
                "body": i.get("body"),
                "labels": [lbl["name"] for lbl in i.get("labels", [])],
                "assignee": i.get("assignee", {}).get("login") if i.get("assignee") else None,
                "comments": i.get("comments"),
                "url": i.get("html_url"),
            }
        except requests.RequestException:
            return None

    def fetch_pull(self, pr_url: str) -> Optional[Dict]:
        """Fetch pull request details given its public URL.
        Returns a dict with a subset of fields or ``None`` on error.
        """
        # Extract owner/repo from the URL
        m_repo = re.match(r"https?://github\.com/([^/]+)/([^/]+)/pull/(\d+)$", pr_url.strip())
        if not m_repo:
            return None
        owner, repo, number = m_repo.group(1), m_repo.group(2), m_repo.group(3)
        endpoint = f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{number}"
        try:
            resp = self.session.get(endpoint)
            resp.raise_for_status()
            pr = resp.json()
            return {
                "number": pr.get("number"),
                "title": pr.get("title"),
                "body": pr.get("body"),
                "state": pr.get("state"),
                "merged": pr.get("merged"),
                "additions": pr.get("additions"),
                "deletions": pr.get("deletions"),
                "changed_files": pr.get("changed_files"),
                "html_url": pr.get("html_url"),
                "user": pr.get("user", {}).get("login"),
            }
        except requests.RequestException:
            return None

