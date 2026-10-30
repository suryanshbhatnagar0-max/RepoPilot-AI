from typing import List, Dict
from github_client import GitHubClient


def generate_roadmap(repo_url: str, issue_number: int) -> List[str]:
    """Generate a simple contribution roadmap for a given issue.
    Returns a list of textual steps.
    """
    client = GitHubClient()
    issue = client.fetch_issue(repo_url, issue_number)
    if not issue:
        return ["Unable to retrieve issue details. Please check the URL and issue number."]

    steps: List[str] = []
    steps.append(f"**Issue #{issue_number}: {issue.get('title')}**")
    body = issue.get("body") or "(No description provided)"
    steps.append("Problem Explanation:\n" + body[:500] + ("..." if len(body) > 500 else ""))
    steps.append("Suggested files to investigate: (Check the repository structure and locate relevant modules.)")
    steps.append("Implementation Steps:\n1. Clone the repository locally.\n2. Create a new branch (e.g., `issue-" + str(issue_number) + "`).\n3. Make the required changes.\n4. Write or update tests.\n5. Commit with a clear message.\n6. Push the branch and open a Pull Request linking this issue.")
    steps.append("Testing Checklist:\n- Ensure existing tests still pass.\n- Add unit tests for new functionality.\n- Run the test suite locally.")
    steps.append("Git Commands:\n```
git clone <repo_url>\ncd <repo_name>\ngit checkout -b issue-" + str(issue_number) + "\n# make changes\ngit add .\ngit commit -m \"Fix issue #" + str(issue_number) + "\"\ngit push origin issue-" + str(issue_number) + "\n```")
    steps.append("Pull Request Description Template:\n" + """\n### What does this PR do?\n*Brief description of changes.*\n\n### Related Issue\nCloses #" + str(issue_number) + "\n\n### How to test?\n*Provide steps to verify the changes.*\n""")
    return steps

