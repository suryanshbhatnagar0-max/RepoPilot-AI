/**
 * RepoPilot AI - Core Application Engine
 * From First Issue to First Contribution.
 * Supports One-Click Complete Offline Demo Mode & Live GitHub API Integration.
 */

// ============================================================================
// 1. STATE MANAGEMENT & APPLICATION STATE
// ============================================================================

const AppState = {
  activePage: 'home',
  demoMode: false,
  demoSession: null,
  demoData: null,
  githubToken: localStorage.getItem('repopilot_gh_token') || '',
  currentRepo: null,
  repoTree: [], // Inspected top-level files/directories
  issues: [],
  filteredIssues: [],
  currentRoadmapIssue: null,
  currentPR: null,
  roadmapProgress: {},
  analyzedReposSet: new Set(),
  kpis: {
    reposAnalyzed: 0,
    issuesDiscovered: 0,
    beginnerFriendly: 0,
    intermediate: 0,
    advanced: 0,
    opportunities: 0
  }
};

const BACKEND_API_BASE = 'http://127.0.0.1:8000';

// ============================================================================
// 2. DEMO BACKEND CLIENT (OFFLINE, LOCAL FASTAPI / SEED DB)
// ============================================================================

/**
 * Fetches demo data from the local backend or bundled seed data.
 * Zero external calls to api.github.com.
 */
async function fetchDemoEndpoint(endpoint) {
  // 1. Attempt local FastAPI backend (api_server.py)
  try {
    const res = await fetch(`${BACKEND_API_BASE}/api/demo/${endpoint}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // API server may not be running on 8000 or running offline on 5500
  }

  // 2. Attempt local static data/demo_seed.json (served on port 5500)
  if (!AppState.demoData) {
    try {
      const res = await fetch('data/demo_seed.json');
      if (res.ok) {
        AppState.demoData = await res.json();
      }
    } catch (e) {
      console.warn('Could not load data/demo_seed.json directly:', e.message);
    }
  }

  // 3. Fallback to in-memory seed database
  if (AppState.demoData) {
    if (endpoint === 'health') {
      return { status: 'healthy', mode: 'DEMO', offline: true, database_loaded: true, version: '1.0.0' };
    }
    if (endpoint === 'session') return AppState.demoData.session;
    if (endpoint === 'repository') return AppState.demoData.repository;
    if (endpoint === 'issues') return AppState.demoData.issues;
    if (endpoint === 'pull-request') return AppState.demoData.pull_request;
    if (endpoint === 'analytics') return AppState.demoData.analytics;
    if (endpoint.startsWith('roadmap/')) {
      const issueId = endpoint.split('/')[1];
      const target = AppState.demoData.issues.find(i => 
        String(i.id) === String(issueId) || 
        String(i.number) === String(issueId) || 
        i.demo_id === issueId
      );
      if (target) {
        return {
          issue_id: target.id,
          demo_id: target.demo_id,
          title: target.title,
          difficulty: target.difficulty,
          fit_score: target.fit_score,
          suggested_skills: target.suggested_skills || [],
          roadmap: target.roadmap
        };
      }
    }
  }

  return null;
}

// ============================================================================
// 3. DEMO MODE ACTIVATION & SEPARATION
// ============================================================================

/**
 * Activates Demo Mode globally, loads seeded data, and auto-populates all modules.
 * NEVER calls api.github.com.
 */
async function activateDemoMode() {
  AppState.demoMode = true;

  // UI state updates
  const demoSwitch = document.getElementById('demo-mode-switch');
  const demoLabel = document.getElementById('demo-mode-label');
  const topBadge = document.getElementById('top-demo-badge');
  const homeBanner = document.getElementById('home-demo-banner');

  if (demoSwitch) demoSwitch.checked = true;
  if (demoLabel) {
    demoLabel.textContent = 'Demo Mode (ON)';
    demoLabel.style.color = '#F59E0B';
  }
  if (topBadge) topBadge.style.display = 'inline-flex';
  if (homeBanner) homeBanner.style.display = 'flex';

  showLoadingSkeleton(true);

  try {
    // 1. Fetch demo session
    const session = await fetchDemoEndpoint('session') || {
      session_id: 'demo-session-pallets-flask',
      repository_url: 'https://github.com/pallets/flask',
      pull_request_url: 'https://github.com/pallets/flask/pulls',
      active: true,
      mode: 'DEMO'
    };
    AppState.demoSession = session;

    // 2. Automatically populate repository & PR URL inputs
    const repoInput = document.getElementById('repo-url-input');
    const prInput = document.getElementById('pr-url-input');
    if (repoInput) repoInput.value = session.repository_url;
    if (prInput) prInput.value = session.pull_request_url;

    // 3. Fetch demo repository metadata and 12 sample issues
    const repoData = await fetchDemoEndpoint('repository');
    const issuesData = await fetchDemoEndpoint('issues');

    if (repoData && issuesData) {
      loadDemoRepositoryData(repoData, issuesData);
    }

    // 4. Fetch and render demo PR report
    const prData = await fetchDemoEndpoint('pull-request');
    if (prData) {
      AppState.currentPR = prData;
      renderPRResults(prData, true);
    }

    // 5. Fetch and render demo analytics
    const analyticsData = await fetchDemoEndpoint('analytics');
    if (analyticsData) {
      renderSeededAnalytics(analyticsData);
    }

    // 6. Preload first recommended issue in roadmap
    if (AppState.issues && AppState.issues.length > 0) {
      const topIssue = [...AppState.issues].sort((a, b) => b.fit_score - a.fit_score)[0];
      loadRoadmap(topIssue);
    }

    showToast('Demo Data Loaded Successfully', 'success');
  } catch (err) {
    console.error('Failed to load demo dataset:', err);
    showToast('Failed to load demo data', 'error');
  } finally {
    showLoadingSkeleton(false);
  }
}

/**
 * Deactivates Demo Mode and restores clean Live Mode.
 * Clears demo state and ensures demo statistics are never retained in live metrics.
 */
function deactivateDemoMode() {
  AppState.demoMode = false;
  AppState.demoSession = null;

  // UI state updates
  const demoSwitch = document.getElementById('demo-mode-switch');
  const demoLabel = document.getElementById('demo-mode-label');
  const topBadge = document.getElementById('top-demo-badge');
  const homeBanner = document.getElementById('home-demo-banner');

  if (demoSwitch) demoSwitch.checked = false;
  if (demoLabel) {
    demoLabel.textContent = 'Demo Mode';
    demoLabel.style.color = 'var(--text-muted)';
  }
  if (topBadge) topBadge.style.display = 'none';
  if (homeBanner) homeBanner.style.display = 'none';

  // Reset state to avoid mixing demo data with live data
  AppState.currentRepo = null;
  AppState.repoTree = [];
  AppState.issues = [];
  AppState.filteredIssues = [];
  AppState.currentRoadmapIssue = null;
  AppState.currentPR = null;
  AppState.analyzedReposSet.clear();
  AppState.kpis = {
    reposAnalyzed: 0,
    issuesDiscovered: 0,
    beginnerFriendly: 0,
    intermediate: 0,
    advanced: 0,
    opportunities: 0
  };

  // Hide cards & simulated banners
  const repoCard = document.getElementById('repo-info-card');
  if (repoCard) repoCard.style.display = 'none';
  const repoDisclaimer = document.getElementById('repo-simulated-disclaimer');
  if (repoDisclaimer) repoDisclaimer.style.display = 'none';

  const prCard = document.getElementById('pr-results-card');
  if (prCard) prCard.style.display = 'none';
  const prDisclaimer = document.getElementById('pr-simulated-disclaimer');
  if (prDisclaimer) prDisclaimer.style.display = 'none';

  updateKPIUI(false);
  renderIssueCards([]);
  populateRoadmapIssueDropdown([]);
  renderAnalytics();

  showToast('Demo Mode deactivated. Switched to Live GitHub API Mode.', 'info');
}

function loadDemoRepositoryData(meta, rawIssues) {
  AppState.currentRepo = meta;
  AppState.repoTree = meta.contents || [];
  AppState.issues = rawIssues.map(i => {
    // Ensure all demo fields are mapped
    return {
      ...i,
      id: i.id || i.number,
      number: i.number || i.id,
      body: i.body || i.description,
      description: i.description || i.body,
      score_explanations: i.score_explanation || []
    };
  });
  AppState.filteredIssues = [...AppState.issues];

  AppState.analyzedReposSet.clear();
  AppState.analyzedReposSet.add(meta.full_name.toLowerCase());

  AppState.kpis.reposAnalyzed = 1;
  AppState.kpis.issuesDiscovered = AppState.issues.length;
  AppState.kpis.beginnerFriendly = AppState.issues.filter(i => i.difficulty === 'Beginner').length;
  AppState.kpis.intermediate = AppState.issues.filter(i => i.difficulty === 'Intermediate').length;
  AppState.kpis.advanced = AppState.issues.filter(i => i.difficulty === 'Advanced').length;
  AppState.kpis.opportunities = AppState.issues.filter(i => i.fit_score >= 70).length;

  updateKPIUI(true);
  renderRepoMetaCard(meta, true);
  renderIssueCards(AppState.filteredIssues);
  populateRoadmapIssueDropdown(AppState.issues);
  renderAnalytics();
}

// ============================================================================
// 4. LIVE GITHUB REST API CLIENT (LIVE MODE ONLY)
// ============================================================================

function parseRepoUrl(url) {
  if (!url) return null;
  const clean = url.trim().replace(/\/$/, '').replace(/\.git$/, '');
  const match = clean.match(/github\.com\/([^\/]+)\/([^\/]+)$/i) || clean.match(/^([^\/]+)\/([^\/]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function parsePRUrl(url) {
  if (!url) return null;
  const clean = url.trim().replace(/\/$/, '');
  const match = clean.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i) || clean.match(/^([^\/]+)\/([^\/]+)\/pull\/(\d+)$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: match[3] };
}

/**
 * Executes a GET request to api.github.com ONLY in Live Mode.
 * Strictly blocked in Demo Mode.
 */
async function fetchFromGitHub(endpoint) {
  if (AppState.demoMode) {
    throw new Error('DEMO_MODE_ACTIVE: External GitHub API calls are disabled in Demo Mode.');
  }

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'RepoPilot-AI-App'
  };
  if (AppState.githubToken) {
    headers['Authorization'] = `token ${AppState.githubToken}`;
  }

  let response;
  try {
    response = await fetch(`https://api.github.com/${endpoint}`, { headers });
  } catch (netErr) {
    throw new Error('NETWORK_ERROR: Unable to connect to GitHub API. Please check your internet connection.');
  }

  const remaining = response.headers.get('X-RateLimit-Remaining');
  const limit = response.headers.get('X-RateLimit-Limit');
  const resetEpoch = response.headers.get('X-RateLimit-Reset');
  if (remaining && limit) {
    updateRateLimitUI(parseInt(remaining, 10), parseInt(limit, 10), resetEpoch ? parseInt(resetEpoch, 10) : null);
  }

  if (response.status === 403 || response.status === 429) {
    const errorData = await response.json().catch(() => ({}));
    const resetMsg = resetEpoch ? `Rate limit resets at ${new Date(parseInt(resetEpoch, 10) * 1000).toLocaleTimeString()}.` : '';
    throw new Error(`RATE_LIMITED: ${errorData.message || 'GitHub API rate limit exceeded.'} ${resetMsg}`);
  }

  if (response.status === 404) {
    throw new Error('NOT_FOUND: The requested repository, issue, or pull request was not found on GitHub.');
  }

  if (!response.ok) {
    throw new Error(`HTTP_ERROR_${response.status}: Failed to fetch from GitHub API (${response.statusText}).`);
  }

  return await response.json();
}

function updateRateLimitUI(remaining, limit, resetEpoch) {
  const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
  const elText = document.getElementById('rate-limit-text');
  const elBar = document.getElementById('rate-limit-bar');
  const elReset = document.getElementById('rate-reset-label');

  if (elText) elText.textContent = `${remaining} / ${limit} reqs`;
  if (elBar) {
    elBar.style.width = `${pct}%`;
    if (pct < 15) elBar.style.background = '#EF4444';
    else if (pct < 40) elBar.style.background = '#F59E0B';
    else elBar.style.background = 'var(--accent-gradient)';
  }
  if (elReset && resetEpoch) {
    const resetTime = new Date(resetEpoch * 1000).toLocaleTimeString();
    elReset.textContent = `Resets at ${resetTime}`;
  }
}

// ============================================================================
// 5. TRANSPARENT SCORING & CLASSIFICATION (LIVE MODE)
// ============================================================================

function classifyIssue(issue) {
  const labels = (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  const title = (issue.title || '').toLowerCase();
  
  const beginnerKeywords = [
    'good first issue', 'good-first-issue', 'easy', 'starter', 'beginner',
    'help wanted', 'documentation', 'docs', 'first-timers-only', 'up-for-grabs'
  ];
  if (labels.some(lbl => beginnerKeywords.some(k => lbl.includes(k)))) {
    return 'Beginner';
  }
  if (title.includes('typo') || title.includes('readme') || title.includes('documentation') || title.includes('fix doc')) {
    return 'Beginner';
  }

  const intermediateKeywords = [
    'enhancement', 'feature', 'medium', 'ui', 'ux', 'cli', 'refactor', 'test', 'routing'
  ];
  if (labels.some(lbl => intermediateKeywords.some(k => lbl.includes(k)))) {
    return 'Intermediate';
  }

  return 'Advanced';
}

function scoreIssue(issue) {
  const difficulty = issue.difficulty || classifyIssue(issue);
  const baseScores = { 'Beginner': 90, 'Intermediate': 70, 'Advanced': 45 };
  let score = baseScores[difficulty] || 60;
  const explanations = [];

  explanations.push(`Base score for ${difficulty} difficulty: +${score}`);

  const comments = issue.comments || 0;
  if (comments > 0 && comments <= 8) {
    const boost = comments * 1;
    score += boost;
    explanations.push(`Active focused discussion (${comments} comments): +${boost}`);
  } else if (comments > 15) {
    score -= 10;
    explanations.push(`High contention/complex thread (${comments} comments): -10`);
  }

  if (issue.assignee) {
    score -= 20;
    const name = issue.assignee.login || issue.assignee;
    explanations.push(`Already claimed by @${name}: -20`);
  } else {
    score += 5;
    explanations.push(`Unassigned & open for contributors: +5`);
  }

  const bodyLen = (issue.body || issue.description || '').trim().length;
  if (bodyLen > 200) {
    score += 5;
    explanations.push(`Comprehensive issue details provided (${bodyLen} chars): +5`);
  } else if (bodyLen < 50) {
    score -= 10;
    explanations.push(`Sparse or missing problem description: -10`);
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ...issue,
    id: issue.id || issue.number,
    number: issue.number || issue.id,
    difficulty,
    fit_score: issue.fit_score || finalScore,
    score_explanations: issue.score_explanation || explanations
  };
}

// ============================================================================
// 6. REPOSITORY ANALYZER
// ============================================================================

async function analyzeRepository(repoInput) {
  hideRepoError();

  // DEMO MODE CHECK: Never call GitHub API in Demo Mode
  if (AppState.demoMode) {
    showLoadingSkeleton(true);
    const repoData = await fetchDemoEndpoint('repository');
    const issuesData = await fetchDemoEndpoint('issues');
    showLoadingSkeleton(false);

    if (repoData && issuesData) {
      loadDemoRepositoryData(repoData, issuesData);
      showToast(`Loaded seeded demo repository for ${repoData.full_name} (DEMO MODE)`, 'info');
    }
    return;
  }

  // LIVE MODE: Execute actual GitHub REST API requests
  const parsed = parseRepoUrl(repoInput);
  if (!parsed) {
    showToast('Please enter a valid GitHub repository URL or "owner/repo" (e.g. pallets/flask).', 'error');
    return;
  }

  showLoadingSkeleton(true);
  try {
    const meta = await fetchFromGitHub(`repos/${parsed.owner}/${parsed.repo}`);
    const rawIssues = await fetchFromGitHub(`repos/${parsed.owner}/${parsed.repo}/issues?state=open&per_page=100`);
    const pureIssues = Array.isArray(rawIssues) ? rawIssues.filter(i => !i.pull_request) : [];

    let contents = [];
    try {
      const rawContents = await fetchFromGitHub(`repos/${parsed.owner}/${parsed.repo}/contents`);
      if (Array.isArray(rawContents)) {
        contents = rawContents.map(c => c.type === 'dir' ? `${c.name}/` : c.name);
      }
    } catch (e) {
      console.warn('Contents endpoint skipped:', e.message);
    }

    loadLiveRepositoryData(meta, pureIssues, contents);
    showToast(`Successfully analyzed ${meta.full_name} (${pureIssues.length} open issues found)!`, 'success');
  } catch (err) {
    console.error('Live API request failed:', err.message);
    showRepoError(err.message);
    showToast(err.message, 'error');
  } finally {
    showLoadingSkeleton(false);
  }
}

function loadLiveRepositoryData(meta, rawIssues, contents) {
  AppState.currentRepo = meta;
  AppState.repoTree = contents || [];
  AppState.issues = rawIssues.map(scoreIssue);
  AppState.filteredIssues = [...AppState.issues];

  const repoKey = meta.full_name.toLowerCase();
  AppState.analyzedReposSet.add(repoKey);

  AppState.kpis.reposAnalyzed = AppState.analyzedReposSet.size;
  AppState.kpis.issuesDiscovered = AppState.issues.length;
  AppState.kpis.beginnerFriendly = AppState.issues.filter(i => i.difficulty === 'Beginner').length;
  AppState.kpis.intermediate = AppState.issues.filter(i => i.difficulty === 'Intermediate').length;
  AppState.kpis.advanced = AppState.issues.filter(i => i.difficulty === 'Advanced').length;
  AppState.kpis.opportunities = AppState.issues.filter(i => i.fit_score >= 70).length;

  updateKPIUI(false);
  renderRepoMetaCard(meta, false);
  renderIssueCards(AppState.filteredIssues);
  populateRoadmapIssueDropdown(AppState.issues);
  renderAnalytics();

  const topIssue = [...AppState.issues].sort((a, b) => b.fit_score - a.fit_score)[0];
  if (topIssue) {
    loadRoadmap(topIssue);
  }
}

function showRepoError(msg) {
  const banner = document.getElementById('repo-error-banner');
  const msgEl = document.getElementById('repo-error-message');
  if (banner && msgEl) {
    msgEl.textContent = msg;
    banner.style.display = 'block';
  }
}

function hideRepoError() {
  const banner = document.getElementById('repo-error-banner');
  if (banner) banner.style.display = 'none';
}

function updateKPIUI(isDemo) {
  const elRepos = document.getElementById('kpi-repos');
  const elIssues = document.getElementById('kpi-issues');
  const elBeginner = document.getElementById('kpi-beginner');
  const elOpps = document.getElementById('kpi-opps');
  const demoBanner = document.getElementById('home-demo-banner');

  if (demoBanner) demoBanner.style.display = isDemo ? 'flex' : 'none';

  const demoLabel = isDemo ? ' <span style="font-size:11px;color:#f59e0b;font-weight:700;">(DEMO)</span>' : '';

  if (elRepos) elRepos.innerHTML = `${AppState.kpis.reposAnalyzed}${demoLabel}`;
  if (elIssues) elIssues.innerHTML = `${AppState.kpis.issuesDiscovered}`;
  if (elBeginner) elBeginner.innerHTML = `${AppState.kpis.beginnerFriendly}`;
  if (elOpps) elOpps.innerHTML = `${AppState.kpis.opportunities}`;
}

function renderRepoMetaCard(meta, isDemo) {
  const card = document.getElementById('repo-info-card');
  if (!card) return;

  document.getElementById('repo-avatar').src = meta.owner?.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
  const nameLink = document.getElementById('repo-name-link');
  nameLink.textContent = meta.full_name;
  nameLink.href = meta.html_url;
  
  const ghBtn = document.getElementById('repo-github-btn');
  if (ghBtn) ghBtn.href = meta.html_url;

  document.getElementById('repo-desc').textContent = meta.description || 'No description provided by repository maintainers.';
  
  // Simulated demo indicators
  const demoTag = document.getElementById('repo-demo-indicator');
  if (demoTag) {
    demoTag.style.display = isDemo ? 'inline-block' : 'none';
  }
  const simDisclaimer = document.getElementById('repo-simulated-disclaimer');
  if (simDisclaimer) {
    simDisclaimer.style.display = isDemo ? 'flex' : 'none';
  }

  // Topics
  const tagsContainer = document.getElementById('repo-tags');
  tagsContainer.innerHTML = '';
  if (meta.topics && meta.topics.length > 0) {
    meta.topics.slice(0, 8).forEach(topic => {
      const tag = document.createElement('span');
      tag.className = 'repo-tag';
      tag.textContent = topic;
      tagsContainer.appendChild(tag);
    });
  }

  // Repository statistics
  document.getElementById('repo-stars').textContent = Number(meta.stargazers_count || 0).toLocaleString();
  document.getElementById('repo-forks').textContent = Number(meta.forks_count || 0).toLocaleString();
  document.getElementById('repo-open-issues').textContent = Number(meta.open_issues_count || 0).toLocaleString();
  document.getElementById('repo-lang').textContent = meta.language || 'Multi-language';
  document.getElementById('repo-license').textContent = meta.license?.name || 'Open Source';

  card.style.display = 'block';
}

// ============================================================================
// 7. SMART ISSUE MATCHER & DETAIL VIEW MODAL
// ============================================================================

function renderIssueCards(issuesList) {
  const container = document.getElementById('issues-grid');
  const countBadge = document.getElementById('matcher-count-badge');
  if (!container) return;

  if (countBadge) countBadge.textContent = `${issuesList.length} issues`;

  if (!issuesList || issuesList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h3>No matching issues found</h3>
        <p>No issues match the selected difficulty, search keyword, or repository.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = issuesList.map(issue => {
    const diffClass = (issue.difficulty || 'intermediate').toLowerCase();
    const repoTag = AppState.currentRepo ? AppState.currentRepo.full_name : 'pallets/flask';
    const issueNum = issue.number || issue.id;
    const demoIdTag = issue.demo_id ? `<span style="font-size:10px; background:rgba(245,158,11,0.2); color:#f59e0b; padding:1px 6px; border-radius:6px; font-weight:700;">${issue.demo_id}</span>` : '';
    
    // Labels
    const labelsHTML = (issue.labels || []).map(lbl => {
      const name = typeof lbl === 'string' ? lbl : lbl.name;
      return `<span class="github-label">${escapeHtml(name)}</span>`;
    }).join('');

    // Suggested Skills tags
    const skillsHTML = (issue.suggested_skills || []).map(skill => {
      return `<span class="skill-tag">${escapeHtml(skill)}</span>`;
    }).join('');

    // Explanations list
    const explanationsHTML = (issue.score_explanations || issue.score_explanation || []).map(exp => `<li>${escapeHtml(exp)}</li>`).join('');

    return `
      <div class="issue-card" data-issue-id="${issueNum}">
        <div class="issue-card-top">
          <div class="issue-card-main">
            <div class="issue-meta-row">
              <span class="issue-number">#${issueNum}</span>
              ${demoIdTag}
              <span class="issue-repo-tag">${escapeHtml(repoTag)}</span>
              <span class="badge-difficulty ${diffClass}">${issue.difficulty}</span>
              ${AppState.demoMode ? '<span style="font-size:10px; background:rgba(245,158,11,0.2); color:#f59e0b; padding:1px 6px; border-radius:6px;">DEMO</span>' : ''}
            </div>
            <h4 class="issue-title">${escapeHtml(issue.title)}</h4>
            <p class="issue-snippet">${escapeHtml((issue.body || issue.description || '').slice(0, 260))}</p>
            <div class="issue-labels-row">${labelsHTML}</div>
            ${skillsHTML ? `<div style="margin-top:6px;">${skillsHTML}</div>` : ''}
          </div>

          <div class="fit-score-box">
            <div class="fit-score-num">${issue.fit_score || 0}</div>
            <div class="fit-score-label">Fit Score</div>
            <button class="score-breakdown-hint btn-toggle-score" data-issue-number="${issueNum}" style="background:none; border:none; cursor:pointer;">Score breakdown &darr;</button>
          </div>
        </div>

        <!-- Score Breakdown Accordion -->
        <div class="score-breakdown-details" id="score-breakdown-${issueNum}" style="display:none;">
          <strong style="color:#fff;">Score Calculation Logic:</strong>
          <ul>${explanationsHTML}</ul>
        </div>

        <div class="issue-card-actions">
          <div class="issue-card-stats">
            <span>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              ${issue.comments || 0} comments
            </span>
            <span>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              ${issue.assignee ? (issue.assignee.login || issue.assignee) : 'Unassigned'}
            </span>
          </div>

          <div class="issue-btn-group">
            <button class="btn btn-secondary btn-sm btn-view-details" data-issue-number="${issueNum}">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              View Details
            </button>
            <a href="${issue.reference_url || issue.html_url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              GitHub
            </a>
            <button class="btn btn-primary btn-sm btn-generate-roadmap" data-issue-number="${issueNum}">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              Roadmap
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Wire up score breakdown buttons
  container.querySelectorAll('.btn-toggle-score').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.getAttribute('data-issue-number');
      const details = document.getElementById(`score-breakdown-${num}`);
      if (details) {
        const isHidden = details.style.display === 'none';
        details.style.display = isHidden ? 'block' : 'none';
        btn.innerHTML = isHidden ? 'Hide breakdown &uarr;' : 'Score breakdown &darr;';
      }
    });
  });

  // Wire up view details modal buttons
  container.querySelectorAll('.btn-view-details').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.getAttribute('data-issue-number');
      const targetIssue = AppState.issues.find(i => String(i.number || i.id) === String(num));
      if (targetIssue) {
        openIssueDetailModal(targetIssue);
      }
    });
  });

  // Wire up roadmap buttons
  container.querySelectorAll('.btn-generate-roadmap').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.getAttribute('data-issue-number');
      const targetIssue = AppState.issues.find(i => String(i.number || i.id) === String(num));
      if (targetIssue) {
        loadRoadmap(targetIssue);
        navigateTo('roadmap');
        showToast(`Roadmap generated for issue #${num}!`, 'success');
      }
    });
  });
}

function filterAndSortIssues() {
  const activeFilter = document.querySelector('.filter-pill.active')?.getAttribute('data-filter') || 'all';
  const sortMode = document.getElementById('sort-select')?.value || 'fit-desc';
  const query = (document.getElementById('issue-search')?.value || '').toLowerCase().trim();

  let filtered = [...AppState.issues];

  if (activeFilter === 'top5') {
    filtered = filtered.sort((a, b) => b.fit_score - a.fit_score).slice(0, 5);
  } else if (activeFilter !== 'all') {
    filtered = filtered.filter(i => (i.difficulty || '').toLowerCase() === activeFilter.toLowerCase());
  }

  if (query) {
    filtered = filtered.filter(i => 
      (i.title || '').toLowerCase().includes(query) ||
      (i.body || i.description || '').toLowerCase().includes(query) ||
      String(i.number || i.id).includes(query) ||
      (i.demo_id || '').toLowerCase().includes(query) ||
      (i.labels || []).some(l => (typeof l === 'string' ? l : l.name || '').toLowerCase().includes(query)) ||
      (i.suggested_skills || []).some(s => s.toLowerCase().includes(query))
    );
  }

  if (activeFilter !== 'top5') {
    if (sortMode === 'fit-desc') {
      filtered.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));
    } else if (sortMode === 'fit-asc') {
      filtered.sort((a, b) => (a.fit_score || 0) - (b.fit_score || 0));
    } else if (sortMode === 'comments') {
      filtered.sort((a, b) => (b.comments || 0) - (a.comments || 0));
    } else if (sortMode === 'newest') {
      filtered.sort((a, b) => (b.number || b.id) - (a.number || a.id));
    }
  }

  AppState.filteredIssues = filtered;
  renderIssueCards(filtered);
}

function openIssueDetailModal(issue) {
  const modal = document.getElementById('issue-detail-modal');
  if (!modal) return;

  const issueNum = issue.number || issue.id;
  document.getElementById('modal-issue-num').textContent = `#${issueNum}`;
  document.getElementById('modal-issue-title').textContent = issue.title;

  const diffBadge = document.getElementById('modal-issue-diff');
  diffBadge.textContent = issue.difficulty;
  diffBadge.className = `badge-difficulty ${(issue.difficulty || 'beginner').toLowerCase()}`;

  const demoPill = document.getElementById('modal-demo-pill');
  if (demoPill) {
    demoPill.textContent = issue.demo_id || 'DEMO ISSUE';
    demoPill.style.display = AppState.demoMode ? 'inline-block' : 'none';
  }

  document.getElementById('modal-fit-score').textContent = issue.fit_score || 0;
  
  const explanations = issue.score_explanations || issue.score_explanation || [];
  const explanationsList = document.getElementById('modal-score-explanations');
  explanationsList.innerHTML = explanations.map(exp => `<li>${escapeHtml(exp)}</li>`).join('');

  document.getElementById('modal-issue-desc').textContent = issue.body || issue.description || 'No description provided.';

  // Suggested skills
  const skillsContainer = document.getElementById('modal-suggested-skills');
  const skillsSection = document.getElementById('modal-skills-section');
  if (issue.suggested_skills && issue.suggested_skills.length > 0) {
    skillsContainer.innerHTML = issue.suggested_skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');
    skillsSection.style.display = 'block';
  } else {
    skillsSection.style.display = 'none';
  }

  // Suggested implementation steps
  const stepsList = document.getElementById('modal-implementation-steps');
  const stepsSection = document.getElementById('modal-steps-section');
  const steps = issue.suggested_implementation_steps || issue.suggested_steps || [];
  if (steps.length > 0) {
    stepsList.innerHTML = steps.map(st => `<li>${escapeHtml(st)}</li>`).join('');
    stepsSection.style.display = 'block';
  } else {
    stepsSection.style.display = 'none';
  }

  // GitHub / Demo Link
  const ghLink = document.getElementById('modal-github-link');
  ghLink.href = issue.reference_url || issue.html_url || '#';

  // Roadmap trigger button
  const roadmapBtn = document.getElementById('modal-roadmap-btn');
  roadmapBtn.onclick = () => {
    closeIssueDetailModal();
    loadRoadmap(issue);
    navigateTo('roadmap');
    showToast(`Roadmap generated for issue #${issueNum}!`, 'success');
  };

  modal.style.display = 'flex';
}

function closeIssueDetailModal() {
  const modal = document.getElementById('issue-detail-modal');
  if (modal) modal.style.display = 'none';
}

// ============================================================================
// 8. CONTRIBUTION ROADMAP
// ============================================================================

function populateRoadmapIssueDropdown(issues) {
  const select = document.getElementById('roadmap-issue-select');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose Analyzed Issue --</option>' +
    issues.map(i => {
      const num = i.number || i.id;
      return `<option value="${num}">#${num}: ${escapeHtml(i.title.slice(0, 60))}</option>`;
    }).join('');

  select.onchange = () => {
    const num = select.value;
    const target = AppState.issues.find(i => String(i.number || i.id) === String(num));
    if (target) loadRoadmap(target);
  };
}

function loadRoadmap(issue) {
  AppState.currentRoadmapIssue = issue;
  const issueNum = issue.number || issue.id;
  const repoName = AppState.currentRepo ? AppState.currentRepo.name : 'flask';
  const repoOwner = AppState.currentRepo ? (AppState.currentRepo.owner?.login || 'pallets') : 'pallets';
  const repoFull = AppState.currentRepo ? AppState.currentRepo.full_name : `${repoOwner}/${repoName}`;
  const repoLang = AppState.currentRepo ? (AppState.currentRepo.language || 'Python') : 'Python';
  const branchName = issue.roadmap?.branch_name || `fix/issue-${issueNum}-${slugify(issue.title).slice(0, 25)}`;

  // Header display
  document.getElementById('roadmap-issue-title').textContent = `#${issueNum}: ${issue.title}`;
  document.getElementById('roadmap-repo-tag').textContent = repoFull;
  
  const badge = document.getElementById('roadmap-difficulty-badge');
  badge.textContent = issue.difficulty;
  badge.className = `badge-difficulty ${(issue.difficulty || 'beginner').toLowerCase()}`;

  const demoBadge = document.getElementById('roadmap-demo-badge');
  if (demoBadge) demoBadge.style.display = AppState.demoMode ? 'inline-block' : 'none';

  // Step 1: Understand problem
  document.getElementById('roadmap-problem-body').textContent = 
    issue.roadmap?.problem_breakdown || issue.body || issue.description || 'No description provided by author.';

  // Step 2: Explore relevant files
  const filesList = document.getElementById('roadmap-suggested-files');
  const filesDesc = document.getElementById('roadmap-files-desc');
  
  if (issue.roadmap && issue.roadmap.suggested_files && issue.roadmap.suggested_files.length > 0) {
    filesDesc.textContent = 'Curated relevant repository source files & docs:';
    filesList.innerHTML = issue.roadmap.suggested_files.map(f => {
      return `<li><code>${escapeHtml(f.path)}</code> &mdash; ${escapeHtml(f.description)}</li>`;
    }).join('');
  } else if (AppState.repoTree && AppState.repoTree.length > 0) {
    filesDesc.textContent = 'Actual inspected top-level repository files & modules:';
    filesList.innerHTML = AppState.repoTree.map(f => {
      const isDir = f.endsWith('/');
      return `<li><code>${escapeHtml(f)}</code> &mdash; ${isDir ? 'Directory containing source modules/tests' : 'Project configuration / documentation file'}</li>`;
    }).join('');
  } else {
    filesDesc.textContent = `General codebase structure for ${repoLang}:`;
    filesList.innerHTML = `
      <li><code>src/ or lib/</code> &mdash; Core implementation code</li>
      <li><code>tests/</code> &mdash; Automated test suite</li>
      <li><code>docs/ or README.md</code> &mdash; Project documentation</li>
    `;
  }

  // Step 3: Git commands
  const gitCmds = issue.roadmap?.git_commands || 
    `git clone https://github.com/${repoFull}.git\ncd ${repoName}\ngit checkout -b ${branchName}`;
  document.getElementById('roadmap-git-clone-code').textContent = gitCmds;

  // Step 4: Plan implementation checklist
  const planList = document.getElementById('roadmap-plan-checklist');
  if (issue.roadmap && issue.roadmap.plan_checklist && issue.roadmap.plan_checklist.length > 0) {
    planList.innerHTML = issue.roadmap.plan_checklist.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  } else if (issue.difficulty === 'Beginner') {
    planList.innerHTML = `
      <li>Isolate the specific file or typo mentioned in the issue.</li>
      <li>Review existing pull request style guidelines in CONTRIBUTING.md.</li>
      <li>Draft the fix with minimal, surgical code changes.</li>
    `;
  } else if (issue.difficulty === 'Intermediate') {
    planList.innerHTML = `
      <li>Trace the execution path from the entrypoint to the component.</li>
      <li>Formulate a backward-compatible design for the feature or fix.</li>
      <li>Identify adjacent modules that might be impacted by this change.</li>
    `;
  } else {
    planList.innerHTML = `
      <li>Reproduce the edge case with an isolated failing test case first.</li>
      <li>Audit performance and memory implications of the proposed architecture.</li>
      <li>Seek feedback in the GitHub issue before submitting a massive PR.</li>
    `;
  }

  // Step 6: Test commands
  const testCmd = issue.roadmap?.test_commands || getLangTestCmd(repoLang);
  document.getElementById('roadmap-test-cmd').textContent = testCmd;

  // Step 7: PR Template
  const prTemplate = issue.roadmap?.pr_template || `### What does this PR do?
Resolves issue #${issueNum}: "${issue.title}".

### Related Issue
Closes #${issueNum}

### How Has This Been Tested?
- [x] Ran project test suite locally (\`${testCmd.split('\n')[0]}\`).
- [x] Verified zero regressions on affected components.`;
  
  document.getElementById('roadmap-pr-template-code').textContent = prTemplate;

  // Sync select dropdown
  const select = document.getElementById('roadmap-issue-select');
  if (select && select.value !== String(issueNum)) {
    select.value = String(issueNum);
  }

  // Restore checklist progress
  AppState.roadmapProgress[issueNum] = AppState.roadmapProgress[issueNum] || {};
  document.querySelectorAll('.step-checkbox').forEach(cb => {
    const stepId = cb.getAttribute('data-step');
    cb.checked = !!AppState.roadmapProgress[issueNum][stepId];
  });
  updateRoadmapProgress();
}

function getLangTestCmd(language) {
  const lang = (language || '').toLowerCase();
  if (lang.includes('python')) return 'pytest\n# Or: python -m unittest';
  if (lang.includes('javascript') || lang.includes('typescript')) return 'npm test\n# Or: npx jest';
  if (lang.includes('go')) return 'go test -v ./...';
  if (lang.includes('rust')) return 'cargo test';
  return '# Run project test runner';
}

function updateRoadmapProgress() {
  const checkboxes = document.querySelectorAll('.step-checkbox');
  let checkedCount = 0;
  checkboxes.forEach(cb => {
    const stepCard = cb.closest('.timeline-step');
    if (cb.checked) {
      checkedCount++;
      stepCard.classList.add('completed');
    } else {
      stepCard.classList.remove('completed');
    }
    if (AppState.currentRoadmapIssue) {
      const issueNum = AppState.currentRoadmapIssue.number || AppState.currentRoadmapIssue.id;
      const stepId = cb.getAttribute('data-step');
      AppState.roadmapProgress[issueNum] = AppState.roadmapProgress[issueNum] || {};
      AppState.roadmapProgress[issueNum][stepId] = cb.checked;
    }
  });

  const total = checkboxes.length || 7;
  const pct = Math.round((checkedCount / total) * 100);
  const progressBar = document.getElementById('roadmap-progress-bar');
  const progressText = document.getElementById('roadmap-progress-text');
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressText) progressText.textContent = `${pct}% Completed (${checkedCount}/${total} Steps)`;
}

// ============================================================================
// 9. PR READINESS CHECKER
// ============================================================================

async function checkPullRequest(prUrlInput) {
  hidePRError();

  // DEMO MODE CHECK: Preloaded offline demo PR without external API calls
  if (AppState.demoMode) {
    const prData = await fetchDemoEndpoint('pull-request');
    if (prData) {
      renderPRResults(prData, true);
      showToast(`Loaded preloaded demo PR #${prData.number} (DEMO MODE)`, 'info');
    }
    return;
  }

  // LIVE MODE: Fetch actual PR from GitHub
  const parsed = parsePRUrl(prUrlInput);
  if (!parsed) {
    showToast('Please enter a valid GitHub Pull Request URL (e.g. https://github.com/pallets/flask/pull/6168).', 'error');
    return;
  }

  const btn = document.getElementById('check-pr-btn');
  if (btn) btn.innerHTML = `<span class="status-dot"></span> Checking PR...`;

  try {
    const prData = await fetchFromGitHub(`repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`);

    let filesData = [];
    try {
      filesData = await fetchFromGitHub(`repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/files`);
    } catch (e) {
      console.warn('Files endpoint failed:', e.message);
    }

    let reviewsData = [];
    try {
      reviewsData = await fetchFromGitHub(`repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/reviews`);
    } catch (e) {
      console.warn('Reviews endpoint failed:', e.message);
    }

    prData.files = filesData;
    prData.reviews = reviewsData;

    renderPRResults(prData, false);
    showToast(`Checked PR #${prData.number}: readiness analyzed!`, 'success');
  } catch (err) {
    console.error('PR check failed:', err.message);
    showPRError(err.message);
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Check PR Readiness
      `;
    }
  }
}

function showPRError(msg) {
  const banner = document.getElementById('pr-error-banner');
  const msgEl = document.getElementById('pr-error-message');
  if (banner && msgEl) {
    msgEl.textContent = msg;
    banner.style.display = 'block';
  }
}

function hidePRError() {
  const banner = document.getElementById('pr-error-banner');
  if (banner) banner.style.display = 'none';
}

function renderPRResults(pr, isDemo) {
  const container = document.getElementById('pr-results-card');
  if (!container) return;

  const body = pr.body || pr.description || '';
  const hasDesc = body.trim().length > 60;
  const hasIssueLink = /([Cc]loses|[Ff]ixes|[Rr]esolves)\s*#\d+/i.test(body) || /#\d+/.test(body) || !!pr.linked_issue;
  const diffSize = (pr.additions || 0) + (pr.deletions || 0);
  const isDiffReasonable = diffSize < 500;
  const changedFilesCount = pr.changed_files !== undefined ? pr.changed_files : (pr.files ? pr.files.length : 1);
  const isFilesReasonable = changedFilesCount <= 10;
  
  const reviews = pr.reviews || [];
  const latestReview = reviews.length > 0 ? reviews[reviews.length - 1] : null;
  const isApproved = reviews.some(r => r.state === 'APPROVED') || String(pr.review_status).toLowerCase().includes('approved');
  const hasReviews = reviews.length > 0 || !!pr.review_status;

  // Calculate Readiness score or use deterministic seeded score
  let score = pr.readiness_score;
  if (score === undefined) {
    score = 20;
    if (hasDesc) score += 25;
    if (hasIssueLink) score += 25;
    if (isDiffReasonable) score += 15;
    if (isFilesReasonable) score += 10;
    if (isApproved) score += 5;
  }

  // Gauge
  const gaugeEl = document.getElementById('pr-gauge-score');
  gaugeEl.textContent = `${score}%`;
  gaugeEl.className = `pr-gauge-score ${score >= 80 ? 'good' : score >= 50 ? 'moderate' : 'poor'}`;

  // PR Metadata
  const prNum = pr.number || pr.id;
  document.getElementById('pr-title-display').textContent = `#${prNum}: ${pr.title}`;
  document.getElementById('pr-author-display').textContent = `by @${pr.author || pr.user?.login || 'contributor'}`;
  document.getElementById('pr-branch-display').textContent = `${pr.head?.ref || 'feature'} &rarr; ${pr.base?.ref || 'main'}`;
  document.getElementById('pr-diff-display').textContent = `+${pr.additions || 0} / -${pr.deletions || 0} across ${changedFilesCount} files`;

  // Demo pill & Simulated Banner
  const demoPill = document.getElementById('pr-demo-indicator');
  if (demoPill) demoPill.style.display = isDemo ? 'inline-block' : 'none';

  const prDisclaimer = document.getElementById('pr-simulated-disclaimer');
  if (prDisclaimer) prDisclaimer.style.display = isDemo ? 'flex' : 'none';

  // State Badge
  const stateBadge = document.getElementById('pr-state-badge');
  stateBadge.textContent = (pr.state || 'open').toUpperCase();
  stateBadge.className = `badge-difficulty ${pr.state === 'closed' ? 'advanced' : 'beginner'}`;

  // Review Badge
  const reviewBadge = document.getElementById('pr-review-badge');
  if (isApproved) {
    reviewBadge.textContent = pr.review_status || 'Review: Approved';
    reviewBadge.style.color = '#10B981';
    reviewBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
  } else if (latestReview) {
    reviewBadge.textContent = `Review: ${latestReview.state}`;
    reviewBadge.style.color = '#F59E0B';
    reviewBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
  } else {
    reviewBadge.textContent = 'Review: Pending Maintainer Feedback';
    reviewBadge.style.color = '#94A3B8';
    reviewBadge.style.borderColor = 'var(--border-color)';
  }

  // Changed Files List
  const filesList = document.getElementById('pr-files-list');
  if (pr.files && pr.files.length > 0) {
    filesList.innerHTML = pr.files.map(f => `
      <div class="pr-file-item">
        <span>${escapeHtml(f.filename)}</span>
        <div class="pr-file-diff">
          <span class="add">+${f.additions || 0}</span>
          <span class="del">-${f.deletions || 0}</span>
        </div>
      </div>
    `).join('');
  } else {
    filesList.innerHTML = `<div style="color:var(--text-dim); font-size:12px; padding:6px 0;">No individual file details returned.</div>`;
  }

  // 5 Checklist items
  updateCheckItem('check-desc', hasDesc ? 'pass' : 'fail', 
    hasDesc ? `Comprehensive description provided with context and summary.` : 'Description is missing or too brief (< 60 chars). Maintainers need context!');
  
  updateCheckItem('check-linked-issue', hasIssueLink ? 'pass' : 'warn',
    hasIssueLink ? `Linked issue reference detected (${pr.linked_issue || 'Closes #...'}).` : 'No issue reference detected. Include "Closes #<id>" to auto-link issues.');

  updateCheckItem('check-diff-size', isDiffReasonable ? 'pass' : 'warn',
    isDiffReasonable ? `Manageable diff size (${diffSize} total lines changed).` : `Large diff (${diffSize} lines). Consider breaking down into smaller PRs.`);

  updateCheckItem('check-files-count', isFilesReasonable ? 'pass' : 'warn',
    isFilesReasonable ? `${changedFilesCount} files changed (focused change scope).` : `Broad file scope (${changedFilesCount} files changed).`);

  updateCheckItem('check-review-status', isApproved ? 'pass' : hasReviews ? 'warn' : 'warn',
    isApproved ? 'Approved by repository reviewer!' : hasReviews ? `Latest review status: ${latestReview?.state || 'in review'}.` : 'Pending review. Maintainers have not reviewed this PR yet.');

  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateCheckItem(elementId, status, description) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const iconBox = el.querySelector('.check-icon');
  const descEl = el.querySelector('p');

  iconBox.className = `check-icon ${status}`;
  if (status === 'pass') {
    iconBox.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
  } else if (status === 'warn') {
    iconBox.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;
  } else {
    iconBox.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
  }

  if (descEl) descEl.textContent = description;
}

// ============================================================================
// 10. ANALYTICS DASHBOARD & CHARTS
// ============================================================================

let chartInstances = {};

function renderSeededAnalytics(analyticsData) {
  const repoBadge = document.getElementById('analytics-active-repo-badge');
  if (repoBadge) {
    repoBadge.innerHTML = 'pallets/flask <span style="font-size:10px; color:#f59e0b; font-weight:700;">(DEMO)</span>';
  }

  document.getElementById('analytics-kpi-repos').textContent = '1 (DEMO)';
  document.getElementById('analytics-kpi-issues').textContent = analyticsData.total_issues_discovered || 12;
  document.getElementById('analytics-kpi-beginner').textContent = analyticsData.beginner_issues || 4;
  document.getElementById('analytics-kpi-intermediate').textContent = analyticsData.intermediate_issues || 5;
  document.getElementById('analytics-kpi-advanced').textContent = analyticsData.advanced_issues || 3;
  document.getElementById('analytics-kpi-opps').textContent = analyticsData.high_fit_opportunities || 9;

  // Chart 1: Difficulty Distribution (Doughnut)
  renderChart('chart-difficulty', {
    type: 'doughnut',
    data: {
      labels: ['Beginner', 'Intermediate', 'Advanced'],
      datasets: [{
        data: [
          analyticsData.beginner_issues || 4,
          analyticsData.intermediate_issues || 5,
          analyticsData.advanced_issues || 3
        ],
        backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
        borderColor: '#111C30',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94A3B8', font: { family: 'Inter' } } }
      }
    }
  });

  // Chart 2: Fit Score Ranges (Bar)
  const buckets = analyticsData.fit_score_distribution || { '90-100': 4, '75-89': 4, '50-74': 1, '<50': 3 };
  renderChart('chart-fit-scores', {
    type: 'bar',
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        label: 'Issues Count',
        data: Object.values(buckets),
        backgroundColor: '#8B5CF6',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: '#25334D' }, ticks: { color: '#94A3B8', precision: 0 } },
        x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // Chart 3: Top Labels
  const labelsMap = analyticsData.labels_distribution || { 'good first issue': 4, 'enhancement': 4, 'documentation': 3, 'cli': 2, 'routing': 2, 'async': 2 };
  renderChart('chart-labels', {
    type: 'bar',
    data: {
      labels: Object.keys(labelsMap),
      datasets: [{
        label: 'Frequency',
        data: Object.values(labelsMap),
        backgroundColor: '#3B82F6',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#25334D' }, ticks: { color: '#94A3B8', precision: 0 } },
        y: { grid: { display: false }, ticks: { color: '#94A3B8' } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // Opportunities Table
  renderOpportunitiesTable(analyticsData.contribution_opportunities || []);
}

function renderAnalytics() {
  if (AppState.demoMode) {
    if (AppState.demoData?.analytics) {
      renderSeededAnalytics(AppState.demoData.analytics);
    }
    return;
  }

  const issues = AppState.issues;
  const repoBadge = document.getElementById('analytics-active-repo-badge');
  if (repoBadge) {
    repoBadge.textContent = AppState.currentRepo ? AppState.currentRepo.full_name : 'No Repo Loaded';
  }

  document.getElementById('analytics-kpi-repos').textContent = AppState.kpis.reposAnalyzed;
  document.getElementById('analytics-kpi-issues').textContent = AppState.kpis.issuesDiscovered;
  document.getElementById('analytics-kpi-beginner').textContent = AppState.kpis.beginnerFriendly;
  document.getElementById('analytics-kpi-intermediate').textContent = AppState.kpis.intermediate;
  document.getElementById('analytics-kpi-advanced').textContent = AppState.kpis.advanced;
  document.getElementById('analytics-kpi-opps').textContent = AppState.kpis.opportunities;

  if (!issues || issues.length === 0) return;

  const beginnerCount = AppState.kpis.beginnerFriendly;
  const intermediateCount = AppState.kpis.intermediate;
  const advancedCount = AppState.kpis.advanced;

  renderChart('chart-difficulty', {
    type: 'doughnut',
    data: {
      labels: ['Beginner', 'Intermediate', 'Advanced'],
      datasets: [{
        data: [beginnerCount, intermediateCount, advancedCount],
        backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
        borderColor: '#111C30',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#94A3B8', font: { family: 'Inter' } } } }
    }
  });

  const scoreBuckets = { '90-100': 0, '75-89': 0, '50-74': 0, '<50': 0 };
  issues.forEach(i => {
    if (i.fit_score >= 90) scoreBuckets['90-100']++;
    else if (i.fit_score >= 75) scoreBuckets['75-89']++;
    else if (i.fit_score >= 50) scoreBuckets['50-74']++;
    else scoreBuckets['<50']++;
  });

  renderChart('chart-fit-scores', {
    type: 'bar',
    data: {
      labels: Object.keys(scoreBuckets),
      datasets: [{
        label: 'Issues Count',
        data: Object.values(scoreBuckets),
        backgroundColor: '#8B5CF6',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: '#25334D' }, ticks: { color: '#94A3B8', precision: 0 } },
        x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
      },
      plugins: { legend: { display: false } }
    }
  });

  const labelCounts = {};
  issues.forEach(i => {
    (i.labels || []).forEach(l => {
      const name = typeof l === 'string' ? l : l.name;
      labelCounts[name] = (labelCounts[name] || 0) + 1;
    });
  });
  const sortedLabels = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  renderChart('chart-labels', {
    type: 'bar',
    data: {
      labels: sortedLabels.map(s => s[0]),
      datasets: [{
        label: 'Frequency',
        data: sortedLabels.map(s => s[1]),
        backgroundColor: '#3B82F6',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#25334D' }, ticks: { color: '#94A3B8', precision: 0 } },
        y: { grid: { display: false }, ticks: { color: '#94A3B8' } }
      },
      plugins: { legend: { display: false } }
    }
  });

  const topOpps = [...issues].sort((a, b) => b.fit_score - a.fit_score).slice(0, 5).map(i => ({
    id: i.number || i.id,
    title: i.title,
    difficulty: i.difficulty,
    fit_score: i.fit_score
  }));
  renderOpportunitiesTable(topOpps);
}

function renderOpportunitiesTable(opps) {
  const tbody = document.getElementById('analytics-opps-tbody');
  if (!tbody) return;

  if (!opps || opps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-dim); padding:16px;">No high-fit contribution opportunities recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = opps.map(opp => {
    const diffClass = (opp.difficulty || 'beginner').toLowerCase();
    const issueNum = opp.id || opp.number;
    return `
      <tr>
        <td><strong>#${issueNum}</strong></td>
        <td>${escapeHtml(opp.title)}</td>
        <td><span class="badge-difficulty ${diffClass}">${opp.difficulty}</span></td>
        <td><span style="font-weight:700; color:#8B5CF6;">${opp.fit_score}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm btn-opp-roadmap" data-issue-id="${issueNum}" style="padding:4px 8px; font-size:11px;">
            Roadmap
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-opp-roadmap').forEach(btn => {
    btn.addEventListener('click', () => {
      const issueId = btn.getAttribute('data-issue-id');
      const target = AppState.issues.find(i => String(i.number || i.id) === String(issueId));
      if (target) {
        loadRoadmap(target);
        navigateTo('roadmap');
      }
    });
  });
}

function renderChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (typeof Chart !== 'undefined') {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }
    chartInstances[canvasId] = new Chart(canvas, config);
  } else {
    renderSVGChartFallback(canvas, config);
  }
}

function renderSVGChartFallback(canvas, config) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const labels = config.data.labels || [];
  const dataset = config.data.datasets?.[0]?.data || [];
  const max = Math.max(...dataset, 1);

  const bars = labels.map((lbl, idx) => {
    const val = dataset[idx] || 0;
    const pct = Math.round((val / max) * 100);
    return `
      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px; color:#94A3B8;">
          <span>${escapeHtml(lbl)}</span>
          <span style="color:#fff; font-weight:600;">${val}</span>
        </div>
        <div style="background:#080D19; height:8px; border-radius:4px; overflow:hidden;">
          <div style="background:var(--accent-gradient); width:${pct}%; height:100%;"></div>
        </div>
      </div>
    `;
  }).join('');

  parent.innerHTML = `<div style="padding:10px 0;">${bars}</div>`;
}

// ============================================================================
// 11. NAVIGATION & NOTIFICATIONS
// ============================================================================

function navigateTo(pageId) {
  AppState.activePage = pageId;

  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-page') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const breadcrumb = document.getElementById('breadcrumb-current');
  const pageTitles = {
    'home': 'Overview',
    'analyzer': 'Repository Analyzer',
    'matcher': 'Smart Issue Matcher',
    'roadmap': 'Contribution Roadmap',
    'pr-checker': 'PR Readiness Checker',
    'analytics': 'Analytics & Trends',
    'settings': 'Settings & Token'
  };
  if (breadcrumb) breadcrumb.textContent = pageTitles[pageId] || pageId;

  document.querySelectorAll('.page-container').forEach(page => {
    if (page.id === `page-${pageId}`) {
      page.classList.add('active');
    } else {
      page.classList.remove('active');
    }
  });

  document.getElementById('sidebar')?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (pageId === 'analytics') {
    renderAnalytics();
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function showLoadingSkeleton(loading) {
  const skeletonEl = document.getElementById('repo-loading-skeleton');
  if (skeletonEl) skeletonEl.style.display = loading ? 'block' : 'none';
}

function copyToClipboard(text, feedbackBtn) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = feedbackBtn.innerHTML;
    feedbackBtn.innerHTML = `
      <svg fill="none" stroke="currentColor" width="14" height="14" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
      Copied!
    `;
    setTimeout(() => { feedbackBtn.innerHTML = originalText; }, 2000);
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'error');
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// ============================================================================
// 12. INITIALIZATION & EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Navigation event listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = item.getAttribute('data-page');
      navigateTo(pageId);
    });
  });

  // 2. Mobile menu toggle
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // 3. Demo Mode Switch
  const demoSwitch = document.getElementById('demo-mode-switch');
  if (demoSwitch) {
    demoSwitch.checked = AppState.demoMode;
    demoSwitch.addEventListener('change', (e) => {
      if (e.target.checked) {
        activateDemoMode();
      } else {
        deactivateDemoMode();
      }
    });
  }

  // 4. "Load Complete Demo" Button (Alternative one-click demo activation)
  document.getElementById('btn-load-complete-demo')?.addEventListener('click', () => {
    activateDemoMode();
    navigateTo('home');
  });

  // 5. Repository Analyzer Input & Button
  const analyzeBtn = document.getElementById('analyze-btn');
  const repoInput = document.getElementById('repo-url-input');

  if (analyzeBtn && repoInput) {
    analyzeBtn.addEventListener('click', () => {
      analyzeRepository(repoInput.value);
    });
    repoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') analyzeRepository(repoInput.value);
    });
  }

  // 6. Find Issues Button in Issue Matcher
  document.getElementById('btn-find-issues')?.addEventListener('click', () => {
    if (AppState.demoMode) {
      filterAndSortIssues();
      showToast('Loaded sample demo issues dataset (DEMO MODE)', 'info');
    } else {
      const repoVal = repoInput ? repoInput.value : '';
      if (repoVal) {
        analyzeRepository(repoVal);
      } else {
        showToast('Please specify a repository or switch to Demo Mode.', 'info');
      }
    }
  });

  // 7. Preset Suggestion Chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const repo = chip.getAttribute('data-repo');
      if (repo) {
        if (repoInput) repoInput.value = repo;
        analyzeRepository(repo);
        navigateTo('analyzer');
      }
    });
  });

  // 8. Quick Action Buttons on Home
  document.getElementById('home-btn-analyze')?.addEventListener('click', () => {
    navigateTo('analyzer');
  });
  document.getElementById('home-btn-explore')?.addEventListener('click', () => {
    if (AppState.demoMode) {
      navigateTo('matcher');
    } else {
      activateDemoMode();
      navigateTo('matcher');
    }
  });

  // 9. Error Banner Action Buttons
  document.getElementById('repo-error-switch-demo')?.addEventListener('click', () => {
    activateDemoMode();
  });
  document.getElementById('repo-error-open-settings')?.addEventListener('click', () => {
    navigateTo('settings');
  });

  // 10. Filter Pills on Issue Matcher
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filterAndSortIssues();
    });
  });

  document.getElementById('sort-select')?.addEventListener('change', filterAndSortIssues);
  document.getElementById('issue-search')?.addEventListener('input', filterAndSortIssues);

  // 11. Modal Close Buttons
  document.getElementById('modal-close-btn')?.addEventListener('click', closeIssueDetailModal);
  document.getElementById('issue-detail-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'issue-detail-modal') closeIssueDetailModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeIssueDetailModal();
  });

  // 12. Roadmap Checkboxes
  document.querySelectorAll('.step-checkbox').forEach(cb => {
    cb.addEventListener('change', updateRoadmapProgress);
  });

  // 13. Copy Buttons in Roadmap
  document.getElementById('copy-git-cmd-btn')?.addEventListener('click', function() {
    const code = document.getElementById('roadmap-git-clone-code').textContent;
    copyToClipboard(code, this);
  });
  document.getElementById('copy-pr-template-btn')?.addEventListener('click', function() {
    const code = document.getElementById('roadmap-pr-template-code').textContent;
    copyToClipboard(code, this);
  });

  // 14. PR Checker Button & Input
  const checkPrBtn = document.getElementById('check-pr-btn');
  const prInput = document.getElementById('pr-url-input');
  if (checkPrBtn && prInput) {
    checkPrBtn.addEventListener('click', () => {
      checkPullRequest(prInput.value);
    });
    prInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkPullRequest(prInput.value);
    });
  }

  // 15. Sample PR Chips
  document.querySelectorAll('.pr-sample-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.getAttribute('data-pr-url');
      if (prInput) prInput.value = url;
      checkPullRequest(url);
    });
  });

  // 16. Settings: GitHub Token Management
  const tokenInput = document.getElementById('gh-token-input');
  if (tokenInput) {
    tokenInput.value = AppState.githubToken;
    document.getElementById('save-token-btn')?.addEventListener('click', () => {
      const val = tokenInput.value.trim();
      AppState.githubToken = val;
      if (val) {
        localStorage.setItem('repopilot_gh_token', val);
        showToast('Personal Access Token saved securely in browser localStorage!', 'success');
      } else {
        localStorage.removeItem('repopilot_gh_token');
        showToast('Token cleared. Using public rate limits.', 'info');
      }
    });

    document.getElementById('clear-token-btn')?.addEventListener('click', () => {
      tokenInput.value = '';
      AppState.githubToken = '';
      localStorage.removeItem('repopilot_gh_token');
      showToast('Token cleared.', 'info');
    });
  }

  // On page load, auto-activate Demo Mode so application is immediately usable offline
  activateDemoMode();
});
