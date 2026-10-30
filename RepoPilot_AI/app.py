import streamlit as st
import pandas as pd
import plotly.express as px
from github_client import GitHubClient
from scoring import score_issues, classify_issue
from roadmap import generate_roadmap
from pr_checker import check_pr

st.set_page_config(
    page_title="RepoPilot AI — From First Issue to First Contribution",
    layout="wide",
    page_icon="🚀",
    initial_sidebar_state="expanded"
)

# Custom Design System CSS
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', -apple-system, sans-serif;
    }
    .stApp {
        background-color: #080D19;
        color: #F8FAFC;
    }
    [data-testid="stSidebar"] {
        background-color: #0E1526;
        border-right: 1px solid #25334D;
    }
    .kpi-card {
        background-color: #111C30;
        border: 1px solid #25334D;
        border-radius: 12px;
        padding: 18px 22px;
        margin-bottom: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .kpi-card h4 {
        margin: 0 0 6px 0;
        font-size: 13px;
        color: #94A3B8;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .kpi-card .value {
        font-size: 28px;
        font-weight: 800;
        color: #F8FAFC;
    }
    .gradient-hero {
        background: linear-gradient(135deg, rgba(17, 28, 48, 0.9) 0%, rgba(14, 21, 38, 0.95) 100%);
        border: 1px solid #25334D;
        border-radius: 16px;
        padding: 28px 32px;
        margin-bottom: 24px;
    }
    .badge-pill {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
    }
    .badge-beginner { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-intermediate { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-advanced { background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); }
</style>
""", unsafe_allow_html=True)

client = GitHubClient()

# Sidebar Header
st.sidebar.markdown("""
<div style="display:flex; align-items:center; gap:10px; margin-bottom: 14px;">
    <div style="width:36px; height:36px; border-radius:8px; background:linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:18px;">⚡</div>
    <div>
        <h2 style="margin:0; font-size:18px; font-weight:800; background:linear-gradient(135deg, #8B5CF6, #3B82F6); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">RepoPilot AI</h2>
        <span style="font-size:10px; color:#94A3B8;">First Issue to Contribution</span>
    </div>
</div>
""", unsafe_allow_html=True)

page = st.sidebar.radio(
    "Navigation",
    ["Home", "Repository Analyzer", "Smart Issue Matcher", "Contribution Roadmap", "PR Readiness Checker", "Analytics"],
    label_visibility="collapsed"
)

# Sidebar rate limit status
st.sidebar.markdown("""
<div style="margin-top: 30px; padding: 12px; background: #111C30; border: 1px solid #25334D; border-radius: 8px; font-size: 11px;">
    <span style="color:#10B981; font-weight:600;">● GitHub REST API</span><br>
    <span style="color:#94A3B8;">Direct live public data access</span>
</div>
""", unsafe_allow_html=True)

if page == "Home":
    st.markdown("""
    <div class="gradient-hero">
        <span style="display:inline-block; padding:3px 10px; border-radius:20px; background:rgba(139,92,246,0.15); color:#8B5CF6; border:1px solid rgba(139,92,246,0.3); font-size:11px; font-weight:600; margin-bottom:12px;">
            Next-Gen Open-Source Navigator
        </span>
        <h1 style="margin:0 0 10px 0; font-size:32px; font-weight:800; color:#FFFFFF;">Welcome back, Developer!</h1>
        <p style="margin:0; color:#94A3B8; font-size:15px; max-width:700px; line-height:1.6;">
            Your journey from first issue to first contribution starts here. Discover vetted beginner-friendly tasks, understand repo difficulty, follow step-by-step roadmaps, and submit review-ready pull requests.
        </p>
    </div>
    """, unsafe_allow_html=True)

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown('<div class="kpi-card"><h4>Repositories</h4><div class="value">Ready</div></div>', unsafe_allow_html=True)
    with col2:
        st.markdown('<div class="kpi-card"><h4>Smart Scoring</h4><div class="value">0-100</div></div>', unsafe_allow_html=True)
    with col3:
        st.markdown('<div class="kpi-card"><h4>Difficulty</h4><div class="value">3 Tiers</div></div>', unsafe_allow_html=True)
    with col4:
        st.markdown('<div class="kpi-card"><h4>PR Checker</h4><div class="value">Heuristics</div></div>', unsafe_allow_html=True)

    st.subheader("Quick Presets")
    st.write("Navigate to **Repository Analyzer** or **Smart Issue Matcher** from the sidebar to analyze live repositories such as `streamlit/streamlit` or `pallets/flask`.")

elif page == "Repository Analyzer":
    st.title("GitHub Repository Analyzer")
    st.caption("Enter any public GitHub repository URL to fetch real metadata, issues, and labels.")
    
    repo_url = st.text_input("Enter public GitHub repository URL", "https://github.com/streamlit/streamlit")
    if st.button("Analyze Repository", type="primary"):
        with st.spinner("Fetching repository data via GitHub REST API..."):
            repo_data, issues = client.fetch_repo_and_issues(repo_url)
        if repo_data is None:
            st.error("Failed to fetch repository. Please check the URL or try again later.")
        else:
            st.success(f"Successfully analyzed {repo_data.get('full_name')}!")
            
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Stars", f"{repo_data.get('stargazers_count', 0):,}")
            c2.metric("Forks", f"{repo_data.get('forks_count', 0):,}")
            c3.metric("Open Issues", f"{repo_data.get('open_issues_count', 0):,}")
            c4.metric("Language", repo_data.get('language') or "Multi-language")

            st.write(f"**Description:** {repo_data.get('description') or 'No description provided.'}")

            st.subheader(f"Open Issues (excluding PRs) — {len(issues)} fetched")
            if issues:
                df = pd.DataFrame(issues)
                st.dataframe(df, use_container_width=True)

elif page == "Smart Issue Matcher":
    st.title("Smart Issue Matcher")
    st.caption("AI contribution suitability scoring (0 to 100) and difficulty classification.")
    
    repo_url = st.text_input("Repository URL for matching", "https://github.com/streamlit/streamlit")
    if st.button("Find Suitable Issues", type="primary"):
        with st.spinner("Analyzing and scoring open issues..."):
            _, issues = client.fetch_repo_and_issues(repo_url)
            if not issues:
                st.error("Could not retrieve issues for this repository.")
            else:
                scored = score_issues(issues)
                df = pd.DataFrame(scored)
                df = df.sort_values("fit_score", ascending=False)
                
                st.subheader("Top Recommended Beginner & Starter Issues")
                st.dataframe(df[["number", "title", "difficulty", "fit_score", "comments", "assignee"]], use_container_width=True)

elif page == "Contribution Roadmap":
    st.title("Contribution Roadmap")
    st.caption("Generates step-by-step guidance, git commands, and pull request description templates.")
    
    col_a, col_b = st.columns([1, 2])
    with col_a:
        issue_number = st.number_input("Enter Issue Number", min_value=1, value=8421, step=1)
    with col_b:
        repo_url = st.text_input("Repository URL", "https://github.com/streamlit/streamlit")
        
    if st.button("Generate Roadmap", type="primary"):
        with st.spinner("Generating step-by-step roadmap..."):
            roadmap = generate_roadmap(repo_url, int(issue_number))
        st.subheader(f"Roadmap for Issue #{issue_number}")
        for step in roadmap:
            st.markdown(step)

elif page == "PR Readiness Checker":
    st.title("PR Readiness Checker")
    st.caption("Analyze public PRs to check description quality, linked issues, and review readiness.")
    
    pr_url = st.text_input("Enter public PR URL", "https://github.com/streamlit/streamlit/pull/8435")
    if st.button("Check PR Readiness", type="primary"):
        with st.spinner("Fetching and evaluating PR metadata..."):
            result = check_pr(pr_url)
        if result is None:
            st.error("Failed to fetch PR details. Please verify the URL.")
        else:
            st.subheader(f"PR #{result.get('number')}: {result.get('title')}")
            col1, col2, col3 = st.columns(3)
            col1.metric("State", result.get("state", "open").capitalize())
            col2.metric("Lines Added", f"+{result.get('additions', 0)}")
            col3.metric("Lines Removed", f"-{result.get('deletions', 0)}")
            
            st.markdown("#### Automated Readiness Checklist")
            cl = result.get("readiness_checklist", {})
            st.checkbox("Description Provided", value=cl.get("has_description", False), disabled=True)
            st.checkbox("Issue Reference Detected (#)", value=cl.get("linked_issue", False), disabled=True)
            st.checkbox("Files Changed Recorded", value=cl.get("files_changed", False), disabled=True)
            
            st.warning("⚠️ **Notice:** Heuristics only. Never guarantee PR acceptance. Final approval rests with repository maintainers.")

elif page == "Analytics":
    st.title("Analytics Dashboard")
    st.caption("Issue difficulty distribution and repository statistics.")
    
    repo_url = st.text_input("Repository URL for analytics", "https://github.com/streamlit/streamlit")
    if st.button("Load Analytics", type="primary"):
        with st.spinner("Collecting issue analytics..."):
            _, issues = client.fetch_repo_and_issues(repo_url)
        if not issues:
            st.error("Could not load issues.")
        else:
            df = pd.DataFrame(issues)
            df["difficulty"] = df["labels"].apply(lambda lbls: "Beginner" if any(k in [l.lower() for l in lbls] for k in ["good first issue", "easy", "documentation"]) else "Intermediate")
            
            fig = px.pie(
                df,
                names="difficulty",
                title="Issue Difficulty Distribution",
                color_discrete_sequence=["#10B981", "#8B5CF6", "#3B82F6"]
            )
            fig.update_layout(
                paper_bgcolor="#080D19",
                plot_bgcolor="#080D19",
                font_color="#F8FAFC"
            )
            st.plotly_chart(fig, use_container_width=True)
