# RepoPilot AI 🧭

> **Tagline:** *From First Issue to First Contribution.*

RepoPilot AI is an open-source contribution navigator designed to help developers discover real GitHub issues, evaluate contribution fit, follow structured action roadmaps, and submit review-ready pull requests.

RepoPilot AI features **One-Click Complete Offline Demo Mode**: every major feature can be experienced instantly offline without GitHub authentication, tokens, or network access.

---

## ⚡ Quick Start & Startup Commands

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Web browser (Chrome, Edge, Firefox, Safari)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the Application

You can run RepoPilot AI using either the static web server or alongside the FastAPI backend:

#### Option A: One-Click Offline Web Server (Port 5500)
```bash
python -m http.server 5500
```
Open your browser to:
```
http://localhost:5500/
```

#### Option B: FastAPI Backend API Server (Port 8000)
```bash
python api_server.py
```
Or with Uvicorn:
```bash
uvicorn api_server:app --host 127.0.0.1 --port 8000 --reload
```
Swagger API docs available at: `http://127.0.0.1:8000/docs`

#### Option C: Python Streamlit Dashboard
```bash
streamlit run app.py
```

---

## 🚀 One-Click Complete Demo Mode

When **Demo Mode** is activated (via the top-bar switch or the **"⚡ Load Complete Demo"** button):
1. **Zero External Calls:** `api.github.com` is completely blocked. Works 100% offline.
2. **Auto-Populated Repository:** Automatically fills `https://github.com/pallets/flask` and loads simulated repository metadata.
3. **12 Preloaded Issues:** Loads 12 curated tasks across Beginner, Intermediate, and Advanced difficulties.
4. **Issue Detail Modal:** Interactive modal with problem statements, suggested skills, and step-by-step implementation guidance.
5. **Actionable Roadmap:** Preloaded 7-step roadmap with copyable Git commands, interactive checkboxes, and PR templates.
6. **Simulated PR Readiness:** Pre-fills `https://github.com/pallets/flask/pulls`, scores PR #6168, and inspects diffs and review readiness.
7. **Pre-Populated Analytics:** Derives charts and KPIs directly from the 12 seeded issues.

---

## 🔌 Local Backend Endpoints (`api_server.py`)

All demo endpoints read from `data/demo_seed.json` and support CORS for local development:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/demo/health` | `GET` | Verifies demo database availability and offline status |
| `/api/demo/session` | `GET` | Returns pre-populated session URLs and configuration |
| `/api/demo/repository` | `GET` | Returns simulated repository report for `pallets/flask` |
| `/api/demo/issues` | `GET` | Returns the 12 sample issues across Beginner, Intermediate, and Advanced |
| `/api/demo/roadmap/{issue_id}` | `GET` | Returns step-by-step roadmap for specific demo issue |
| `/api/demo/pull-request` | `GET` | Returns pre-populated sample pull request record |
| `/api/demo/analytics` | `GET` | Returns derived metrics and distributions |

---

## 🧪 Testing

Run automated tests with `pytest`:

```bash
# Run backend and demo data integrity tests
python -m pytest tests/test_demo_backend.py -v

# Run complete test suite (scoring logic + backend endpoints)
python -m pytest tests/ -v
```

All tests execute offline and verify:
- Demo database structure and schema completeness.
- All 7 `/api/demo/*` endpoints.
- 12 sample issues with required metadata.
- Preloaded roadmap availability for every issue.
- PR readiness scoring and checklist validation.
- Clean separation between Demo Mode and Live Mode.

---

## 📁 Project Structure

```text
RepoPilot AI/
├── .gitignore               # Git ignore rules
├── README.md                # Documentation and startup guide
├── requirements.txt         # Python package dependencies
├── api_server.py            # FastAPI offline demo backend server
├── index.html               # Main Single-Page Application (SPA)
├── style.css                # Dark-mode dashboard stylesheet
├── script.js                # Frontend engine & state management
│
├── data/
│   └── demo_seed.json       # Deterministic offline demo database
│
└── tests/
    ├── test_demo_backend.py # Backend API & seed data unit tests
    └── test_scoring.py      # Issue scoring & classification tests
```

---

## 🛡️ Live Mode vs Demo Mode Separation

- **Demo Mode:**
  - Loads data exclusively from `data/demo_seed.json` or `api_server.py`.
  - Never accesses `api.github.com`.
  - Clearly displays `DEMO ACTIVE` and `SIMULATED` notices.
  - Requires no GitHub credentials or internet connection.
- **Live Mode:**
  - Connects to real GitHub REST API endpoints.
  - Honors rate limits with live visual indicators.
  - Stores personal access tokens securely in browser `localStorage`.
  - Switching Demo Mode OFF purges demo session state immediately so demo statistics are never mixed with live metrics.
