/**
 * NostalgicVerse — Enterprise Owner Command Center Engine (Phase 14)
 * ===================================================================
 * Universal operator controller connecting 31 platform subsystems:
 * Overview, Analytics, Users, Submissions, Support, Moderation,
 * Content CMS, Media, Search/SEO, Jobs, AI, Backups, Security, Business,
 * Settings, and Audit Trail.
 *
 * Realtime updates via WebSocket with event deduplication.
 * Zero fake data. Universal 4-state rendering (Loading, Success, Empty, Error).
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const stage = document.getElementById('owner-stage');
    if (!stage) return;

    let currentUser = null;
    const processedEvents = new Set();

    // 1. Authenticate & Authorize Operator
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return window.location.href = '/login/';
        const data = await res.json();
        currentUser = data.user;
        if (!currentUser || currentUser.role !== 'OWNER') {
            return window.location.href = '/';
        }
    } catch (e) {
        return window.location.href = '/login/';
    }

    // Populate header
    const headerUsername = document.getElementById('header-username');
    if (headerUsername) headerUsername.textContent = currentUser.display_name || currentUser.username;
    const headerAvatar = document.getElementById('header-avatar');
    if (headerAvatar && currentUser.avatar_id) {
        headerAvatar.src = `/assets/images/profile-icons/${currentUser.avatar_id}.png`;
    }

    document.getElementById('owner-logout-btn')?.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login/';
    });

    // 2. Navigation State Management
    const navItems = document.querySelectorAll('.nav-item');
    let currentTab = 'overview';

    // Check URL query or hash
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || window.location.hash.replace('#', '') || 'overview';
    currentTab = initialTab;

    function setActiveTab(tabKey) {
        currentTab = tabKey;
        navItems.forEach(item => {
            if (item.dataset.tab === tabKey) item.classList.add('active');
            else item.classList.remove('active');
        });
        history.replaceState(null, '', `/owner/?tab=${tabKey}`);
        renderDomainView();

        // Close mobile drawer if open
        document.getElementById('sidebar')?.classList.remove('open');
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            setActiveTab(item.dataset.tab);
        });
    });

    document.getElementById('mobile-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
    });

    // 3. Centralized API Fetcher
    async function fetchAPI(url, options = {}) {
        try {
            const res = await fetch(url, options);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            return data;
        } catch (e) {
            return { error: e.message };
        }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 4. Universal 4-State UI Helpers
    function renderLoading(msg = 'Fetching administrative data...') {
        stage.innerHTML = `
            <div style="text-align:center; padding: 64px 20px;">
                <div style="display:inline-block; width:36px; height:36px; border:3px solid var(--oc-border); border-top-color:var(--oc-cyan); border-radius:50%; animation: spin 0.8s linear infinite;"></div>
                <p style="margin-top:16px; color:var(--oc-text-muted); font-size:0.9rem;">${escapeHtml(msg)}</p>
            </div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;
    }

    function renderError(msg, retryFn) {
        stage.innerHTML = `
            <div style="text-align:center; padding: 48px 24px; background:var(--oc-surface); border:1px solid var(--oc-border); border-radius:var(--oc-radius); max-width:600px; margin:40px auto;">
                <span style="font-size:2rem; color:var(--oc-crimson);">⚠️</span>
                <h3 style="color:var(--oc-crimson); margin:12px 0 8px 0;">Administrative Operation Failed</h3>
                <p style="color:var(--oc-text-secondary); margin-bottom:20px; font-size:0.92rem;">${escapeHtml(msg || 'An unexpected server error occurred.')}</p>
                ${retryFn ? '<button id="retry-btn" class="btn-primary" style="padding:8px 24px;">Retry Request</button>' : ''}
            </div>
        `;
        if (retryFn) document.getElementById('retry-btn')?.addEventListener('click', retryFn);
    }

    function renderEmpty(title, desc, actionText, actionFn) {
        stage.innerHTML = `
            <div style="text-align:center; padding: 64px 24px; background:var(--oc-surface); border:1px solid var(--oc-border); border-radius:var(--oc-radius); max-width:640px; margin:40px auto;">
                <span style="font-size:2.5rem; color:var(--oc-gold);">📭</span>
                <h3 style="color:var(--oc-text-primary); margin:16px 0 8px 0;">${escapeHtml(title)}</h3>
                <p style="color:var(--oc-text-muted); margin-bottom:24px; font-size:0.92rem;">${escapeHtml(desc)}</p>
                ${actionText ? `<button id="empty-action-btn" class="btn-primary">${escapeHtml(actionText)}</button>` : ''}
            </div>
        `;
        if (actionText && actionFn) document.getElementById('empty-action-btn')?.addEventListener('click', actionFn);
    }

    // 5. Realtime WebSocket Synchronization
    function initWebSocket() {
        const wsStatusPill = document.getElementById('ws-status');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        let socket = null;
        let reconnectTimer = null;

        function connect() {
            try {
                socket = new WebSocket(wsUrl);

                socket.onopen = () => {
                    if (wsStatusPill) {
                        wsStatusPill.className = 'ws-status-pill online';
                        wsStatusPill.innerHTML = '<span>● Live WS</span>';
                    }
                };

                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.event_id && processedEvents.has(data.event_id)) return;
                        if (data.event_id) processedEvents.add(data.event_id);

                        // If on overview, update active counters
                        if (currentTab === 'overview' && (data.type === 'JOB_COMPLETED' || data.type === 'NEW_SUBMISSION')) {
                            renderOverview();
                        } else if (currentTab === 'jobs') {
                            renderJobs();
                        }
                    } catch (_) {}
                };

                socket.onclose = () => {
                    if (wsStatusPill) {
                        wsStatusPill.className = 'ws-status-pill offline';
                        wsStatusPill.innerHTML = '<span>Disconnected</span>';
                    }
                    scheduleReconnect();
                };

                socket.onerror = () => {
                    socket.close();
                };
            } catch (err) {
                scheduleReconnect();
            }
        }

        function scheduleReconnect() {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connect, 3000);
        }

        connect();
    }
    initWebSocket();

    // 6. Command Palette (Ctrl + K)
    const cmdModal = document.getElementById('cmd-modal');
    const cmdInput = document.getElementById('cmd-input');
    const cmdResults = document.getElementById('cmd-results');

    const COMMANDS = [
        { label: '📊 View Overview Dashboard', action: () => setActiveTab('overview'), group: 'Navigation' },
        { label: '📈 Open Analytics & Export', action: () => setActiveTab('analytics'), group: 'Operations' },
        { label: '🎮 Search Games', action: () => { setActiveTab('games'); setTimeout(() => document.querySelector('#games-search-input')?.focus(), 200); }, group: 'Search' },
        { label: '🎮 Open Games CMS', action: () => setActiveTab('games'), group: 'Content' },
        { label: '🕹️ Open Consoles CMS', action: () => setActiveTab('consoles'), group: 'Content' },
        { label: '📝 New Article / Editorial Story', action: () => { setActiveTab('editorial'); setTimeout(() => document.querySelector('#new-story-btn')?.click(), 200); }, group: 'Action' },
        { label: '📰 Editorial, Guides & News', action: () => setActiveTab('editorial'), group: 'Content' },
        { label: '💬 Open AI Chat & Command Center', action: () => setActiveTab('ai-chat'), group: 'Operations' },
        { label: '👥 Search Users & Accounts', action: () => { setActiveTab('users'); setTimeout(() => document.querySelector('#users-search-input')?.focus(), 200); }, group: 'Search' },
        { label: '👥 User Directory & Moderation', action: () => setActiveTab('users'), group: 'Navigation' },
        { label: '🎫 Search Support Tickets', action: () => { setActiveTab('support'); setTimeout(() => document.querySelector('#support-search-input')?.focus(), 200); }, group: 'Search' },
        { label: '🎫 Open Support Helpdesk', action: () => setActiveTab('support'), group: 'Workflow' },
        { label: '📥 Review Submissions Queue', action: () => setActiveTab('submissions'), group: 'Workflow' },
        { label: '🖼️ Media Manager & Image Health', action: () => setActiveTab('media'), group: 'Assets' },
        { label: '🔍 Search & SEO Health Center', action: () => setActiveTab('search-seo'), group: 'Assets' },
        { label: '⚙️ Open Jobs Center & Queues', action: () => setActiveTab('jobs'), group: 'Operations' },
        { label: '🩺 Run System Diagnostics & Health Check', action: async () => { const h = await fetchAPI('/api/owner/health'); alert(`System Status: ${h.status}\nServer Uptime: ${Math.floor(h.checks?.server?.uptime || 0)}s\nDatabase: ${h.checks?.database?.status}`); }, group: 'Action' },
        { label: '🔑 Open Multi-Provider Key Vault', action: () => setActiveTab('ai-chat'), group: 'Operations' },
        { label: '🤖 Open AI Control Center', action: () => setActiveTab('ai'), group: 'Operations' },
        { label: '💾 Open Backups & Disaster Recovery', action: () => setActiveTab('backups'), group: 'Operations' },
        { label: '💾 Trigger Database Online Backup', action: async () => { await fetchAPI('/api/owner/backups/create', { method: 'POST' }); setActiveTab('backups'); }, group: 'Action' },
        { label: '🔄 Rebuild Global Search Index', action: async () => { await fetchAPI('/api/owner/search/rebuild', { method: 'POST' }); setActiveTab('jobs'); }, group: 'Action' },
        { label: '🔔 View Notifications Center', action: () => setActiveTab('notifications'), group: 'Navigation' },
        { label: '🔧 Settings & Maintenance Mode', action: () => setActiveTab('settings'), group: 'Platform' },
        { label: '📜 View System Audit Trail', action: () => setActiveTab('audit'), group: 'Platform' }
    ];

    function openCmdPalette() {
        cmdModal.style.display = 'flex';
        cmdInput.value = '';
        renderCmdResults('');
        cmdInput.focus();
    }

    function closeCmdPalette() {
        cmdModal.style.display = 'none';
    }

    function renderCmdResults(query) {
        const q = query.toLowerCase().trim();
        const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));

        if (!filtered.length) {
            cmdResults.innerHTML = '<div style="padding:16px 20px; color:var(--oc-text-muted); font-size:0.9rem;">No matching commands found.</div>';
            return;
        }

        cmdResults.innerHTML = filtered.map((cmd, idx) => `
            <div class="cmd-item" data-index="${idx}">
                <span style="font-weight:500;">${escapeHtml(cmd.label)}</span>
                <span style="font-size:0.75rem; text-transform:uppercase; color:var(--oc-text-muted); border:1px solid var(--oc-border); padding:2px 6px; border-radius:4px;">${escapeHtml(cmd.group)}</span>
            </div>
        `).join('');

        cmdResults.querySelectorAll('.cmd-item').forEach((item, idx) => {
            item.addEventListener('click', () => {
                filtered[idx].action();
                closeCmdPalette();
            });
        });
    }

    document.getElementById('open-cmd-palette')?.addEventListener('click', openCmdPalette);
    cmdInput?.addEventListener('input', (e) => renderCmdResults(e.target.value));

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (cmdModal.style.display === 'flex') closeCmdPalette();
            else openCmdPalette();
        } else if (e.key === 'Escape' && cmdModal.style.display === 'flex') {
            closeCmdPalette();
        }
    });

    cmdModal?.addEventListener('click', (e) => {
        if (e.target === cmdModal) closeCmdPalette();
    });

    // ==================================================================
    // DOMAIN VIEW RENDERERS
    // ==================================================================

    async function renderDomainView() {
        switch (currentTab) {
            case 'overview': return renderOverview();
            case 'analytics': return renderAnalytics();
            case 'users': return renderUsers();
            case 'submissions': return renderSubmissions();
            case 'support': return renderSupport();
            case 'moderation': return renderModeration();
            case 'games': return renderGamesCMS();
            case 'consoles': return renderConsolesCMS();
            case 'editorial': return renderEditorial();
            case 'timeline-genres': return renderTimelineGenres();
            case 'releases-compat': return renderReleasesCompat();
            case 'media': return renderMediaManager();
            case 'search-seo': return renderSearchSEO();
            case 'content-health': return renderContentHealth();
            case 'jobs': return renderJobs();
            case 'ai': return renderAI();
            case 'ai-chat': return renderAIChat();
            case 'backups': return renderBackups();
            case 'security': return renderSecurity();
            case 'business': return renderBusiness();
            case 'audit': return renderAudit();
            case 'notifications': return renderNotifications();
            case 'settings': return renderSettings();
            default: return renderOverview();
        }
    }

    // 1. OVERVIEW
    async function renderOverview() {
        renderLoading('Loading operational intelligence...');
        const [stats, health, alerts] = await Promise.all([
            fetchAPI('/api/owner/stats'),
            fetchAPI('/api/owner/health'),
            fetchAPI('/api/owner/alerts')
        ]);

        if (stats.error) return renderError(stats.error, renderOverview);

        const healthStatus = health?.status || 'HEALTHY';
        const healthColor = healthStatus === 'HEALTHY' ? 'emerald' : 'crimson';

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Command Center Overview</h1>
                    <p class="view-subtitle">Live status across platform, content, queue, and system infrastructure.</p>
                </div>
                <div style="display:flex; gap:8px;">
                    <span class="status-tag ${healthStatus.toLowerCase()}">System: ${healthStatus}</span>
                    <button id="refresh-overview-btn" class="btn-secondary" style="padding:6px 14px; font-size:0.85rem;">Refresh</button>
                </div>
            </div>

            <!-- Metric Cards Grid -->
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Registered Users</div>
                    <div class="metric-value cyan">${stats.platform.totalUsers}</div>
                    <div style="font-size:0.8rem; color:var(--oc-text-muted); margin-top:6px;">Online right now: ${stats.platform.onlineUsers}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Published Museum Exhibits</div>
                    <div class="metric-value gold">${stats.content.publishedGames + stats.content.publishedConsoles}</div>
                    <div style="font-size:0.8rem; color:var(--oc-text-muted); margin-top:6px;">${stats.content.publishedGames} Games • ${stats.content.publishedConsoles} Consoles</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Operator Queue Backlog</div>
                    <div class="metric-value ${stats.queue.pendingSubmissions + stats.queue.openTickets > 0 ? 'crimson' : 'emerald'}">
                        ${stats.queue.pendingSubmissions + stats.queue.openTickets}
                    </div>
                    <div style="font-size:0.8rem; color:var(--oc-text-muted); margin-top:6px;">${stats.queue.pendingSubmissions} Submissions • ${stats.queue.openTickets} Tickets</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Authoritative Database</div>
                    <div class="metric-value emerald">${stats.system.databaseSize}</div>
                    <div style="font-size:0.8rem; color:var(--oc-text-muted); margin-top:6px;">Mode: ${stats.system.walMode} (WAL)</div>
                </div>
            </div>

            <!-- Quick Operator Actions -->
            <h3 style="font-size:1.1rem; margin-bottom:14px; color:var(--oc-text-primary);">Quick Actions</h3>
            <div class="action-grid">
                <button class="action-btn" id="qa-add-game"><span>🎮</span> Add Game</button>
                <button class="action-btn" id="qa-add-console"><span>🕹️</span> Add Console</button>
                <button class="action-btn" id="qa-review-submissions"><span>📥</span> Submissions (${stats.platform.pendingSubmissions})</button>
                <button class="action-btn" id="qa-open-support"><span>🎫</span> Support Inbox (${stats.platform.openTickets})</button>
                <button class="action-btn" id="qa-rebuild-search"><span>🔍</span> Rebuild Search</button>
                <button class="action-btn" id="qa-trigger-backup"><span>💾</span> Backup Database</button>
            </div>

            <!-- Actionable Alerts -->
            ${alerts?.alerts?.length ? `
                <div style="margin-bottom:28px;">
                    <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Actionable Alerts</h3>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${alerts.alerts.map(a => `
                            <div style="background:var(--oc-surface); border:1px solid ${a.severity === 'CRITICAL' ? 'var(--oc-crimson)' : 'var(--oc-gold)'}; border-radius:var(--oc-radius); padding:14px 20px; display:flex; align-items:center; justify-content:space-between;">
                                <div>
                                    <div style="font-weight:700; color:${a.severity === 'CRITICAL' ? 'var(--oc-crimson)' : 'var(--oc-gold)'}; font-size:0.92rem;">${escapeHtml(a.title)}</div>
                                    <div style="font-size:0.85rem; color:var(--oc-text-secondary); margin-top:2px;">${escapeHtml(a.message)}</div>
                                </div>
                                <button class="btn-secondary alert-jump-btn" data-link="${escapeHtml(a.link)}" style="padding:6px 14px; font-size:0.8rem;">Investigate</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Real Activity Stream -->
            <div>
                <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Realtime Activity Log</h3>
                <div class="table-container">
                    <table class="oc-table">
                        <thead>
                            <tr>
                                <th>Event Summary</th>
                                <th>Category</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.activity.length ? stats.activity.map(act => `
                                <tr>
                                    <td style="font-weight:500;">${escapeHtml(act.event)}</td>
                                    <td><span class="status-tag healthy">${escapeHtml(act.type)}</span></td>
                                    <td style="color:var(--oc-text-muted); font-family:var(--oc-font-mono); font-size:0.82rem;">${new Date(act.created_at).toLocaleString()}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="3" style="text-align:center; color:var(--oc-text-muted);">No recent events recorded.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Event Listeners
        document.getElementById('refresh-overview-btn')?.addEventListener('click', renderOverview);
        document.getElementById('qa-add-game')?.addEventListener('click', () => setActiveTab('games'));
        document.getElementById('qa-add-console')?.addEventListener('click', () => setActiveTab('consoles'));
        document.getElementById('qa-review-submissions')?.addEventListener('click', () => setActiveTab('submissions'));
        document.getElementById('qa-open-support')?.addEventListener('click', () => setActiveTab('support'));
        document.getElementById('qa-rebuild-search')?.addEventListener('click', async () => {
            await fetchAPI('/api/owner/search/rebuild', { method: 'POST' });
            setActiveTab('jobs');
        });
        document.getElementById('qa-trigger-backup')?.addEventListener('click', async () => {
            await fetchAPI('/api/owner/backups/create', { method: 'POST' });
            setActiveTab('backups');
        });
        document.querySelectorAll('.alert-jump-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.link.replace('/owner/', '');
                setActiveTab(target);
            });
        });
    }

    // 2. ANALYTICS
    // 2. ANALYTICS & SEO CONTROL CENTER (Phase 17)
    let currentAnalyticsTab = 'overview';

    async function renderAnalytics() {
        renderLoading('Compiling authentic database telemetry & search health...');
        
        let overviewData = { traffic: {}, users: { registrations: [] }, engagement: {}, topPages: [], topGames: [], topConsoles: [] };
        let searchData = { totalSearches: 0, totalClicks: 0, clickThroughRate: '0.0%', topSearches: [], zeroResults: [] };
        let discoveryData = { impressions: 0, clicks: 0, ctr: '0.0%', topDiscovered: [] };
        let seoData = { status: 'NO_AUDITS_YET', pagesAudited: 0, issuesFound: 0, details: null };
        let searchHealthData = { valid: true, indexedCount: 0, expectedCount: 0, issues: [] };

        try {
            overviewData = await fetchAPI('/api/owner/analytics/overview');
            searchData = await fetchAPI('/api/owner/analytics/search');
            discoveryData = await fetchAPI('/api/owner/analytics/discovery');
            seoData = await fetchAPI('/api/owner/seo/health');
            searchHealthData = await fetchAPI('/api/owner/search/health');
        } catch (e) {
            console.warn('Analytics partial load:', e);
        }

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Platform Analytics & SEO Control</h1>
                    <p class="view-subtitle">Derived strictly from first-party database records, FTS5 telemetry, and crawler health audits.</p>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                    <a href="/api/owner/analytics/export?format=csv&range=30d" target="_blank" class="btn-secondary" style="padding:7px 14px; font-size:0.85rem; text-decoration:none; display:inline-flex; align-items:center;">📥 Export CSV</a>
                    <a href="/api/owner/analytics/export?format=json&range=30d" target="_blank" class="btn-secondary" style="padding:7px 14px; font-size:0.85rem; text-decoration:none; display:inline-flex; align-items:center;">📥 Export JSON</a>
                    <button id="rebuild-search-btn" class="btn-primary" style="padding:7px 14px; font-size:0.85rem;">Rebuild Search Index</button>
                    <button id="run-seo-audit-btn" class="btn-secondary" style="padding:7px 14px; font-size:0.85rem;">Run SEO Audit</button>
                    <button id="rebuild-sitemap-btn" class="btn-secondary" style="padding:7px 14px; font-size:0.85rem;">Rebuild Sitemap</button>
                </div>
            </div>

            <!-- Sub-Navigation Tabs -->
            <div class="filter-bar" style="margin-bottom:20px;">
                <button class="filter-chip ${currentAnalyticsTab === 'overview' ? 'active' : ''}" data-atab="overview">Overview</button>
                <button class="filter-chip ${currentAnalyticsTab === 'search' ? 'active' : ''}" data-atab="search">Search Telemetry</button>
                <button class="filter-chip ${currentAnalyticsTab === 'discovery' ? 'active' : ''}" data-atab="discovery">Discovery & Rotation</button>
                <button class="filter-chip ${currentAnalyticsTab === 'seo' ? 'active' : ''}" data-atab="seo">SEO & Crawl Health</button>
            </div>

            <div id="analytics-tab-content"></div>
        `;

        const tabContent = document.getElementById('analytics-tab-content');

        function renderTab() {
            if (currentAnalyticsTab === 'overview') {
                tabContent.innerHTML = `
                    <div class="metric-grid">
                        <div class="metric-card">
                            <div class="metric-label">Total Page Views</div>
                            <div class="metric-value cyan">${overviewData.traffic?.pageViews || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Unique Sessions</div>
                            <div class="metric-value emerald">${overviewData.traffic?.uniqueSessions || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Active Users</div>
                            <div class="metric-value gold">${overviewData.users?.active || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">User Favorites Saved</div>
                            <div class="metric-value cyan">${overviewData.engagement?.favorites || 0}</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px; margin-top:20px;">
                        <div>
                            <h3 style="font-size:1.05rem; margin-bottom:12px; color:var(--oc-text-primary);">Top Pages Viewed</h3>
                            <div class="table-container">
                                <table class="oc-table">
                                    <thead><tr><th>Path</th><th>Views</th></tr></thead>
                                    <tbody>
                                        ${overviewData.topPages?.length ? overviewData.topPages.map(p => `
                                            <tr>
                                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem;">${escapeHtml(p.path)}</td>
                                                <td style="font-weight:700; color:var(--oc-cyan);">${p.views}</td>
                                            </tr>
                                        `).join('') : '<tr><td colspan="2" style="text-align:center; color:var(--oc-text-muted);">No data yet</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div>
                            <h3 style="font-size:1.05rem; margin-bottom:12px; color:var(--oc-text-primary);">User Registration Trend</h3>
                            <div class="table-container">
                                <table class="oc-table">
                                    <thead><tr><th>Date</th><th>Signups</th></tr></thead>
                                    <tbody>
                                        ${overviewData.users?.registrations?.length ? overviewData.users.registrations.map(r => `
                                            <tr>
                                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem;">${escapeHtml(r.day)}</td>
                                                <td style="font-weight:700; color:var(--oc-emerald);">${r.count}</td>
                                            </tr>
                                        `).join('') : '<tr><td colspan="2" style="text-align:center; color:var(--oc-text-muted);">No data yet</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            } else if (currentAnalyticsTab === 'search') {
                tabContent.innerHTML = `
                    <div class="metric-grid">
                        <div class="metric-card">
                            <div class="metric-label">Indexed Search Entities</div>
                            <div class="metric-value cyan">${searchHealthData.indexedCount || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Total Search Queries</div>
                            <div class="metric-value emerald">${searchData.totalSearches || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Search Result Clicks</div>
                            <div class="metric-value gold">${searchData.totalClicks || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Click-Through Rate</div>
                            <div class="metric-value cyan">${searchData.clickThroughRate || '0.0%'}</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px; margin-top:20px;">
                        <div>
                            <h3 style="font-size:1.05rem; margin-bottom:12px; color:var(--oc-text-primary);">Top Search Queries</h3>
                            <div class="table-container">
                                <table class="oc-table">
                                    <thead><tr><th>Query</th><th>Hits</th><th>Avg Results</th></tr></thead>
                                    <tbody>
                                        ${searchData.topSearches?.length ? searchData.topSearches.map(s => `
                                            <tr>
                                                <td style="font-weight:600; color:var(--oc-text-primary);">${escapeHtml(s.query)}</td>
                                                <td style="color:var(--oc-cyan); font-weight:700;">${s.count}</td>
                                                <td style="font-family:var(--oc-font-mono);">${Math.round(s.avg_results || 0)}</td>
                                            </tr>
                                        `).join('') : '<tr><td colspan="3" style="text-align:center; color:var(--oc-text-muted);">No data yet</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div>
                            <h3 style="font-size:1.05rem; margin-bottom:12px; color:var(--oc-text-primary);">Zero-Result Searches (Content Opportunities)</h3>
                            <div class="table-container">
                                <table class="oc-table">
                                    <thead><tr><th>Query</th><th>Attempts</th><th>Last Attempt</th></tr></thead>
                                    <tbody>
                                        ${searchData.zeroResults?.length ? searchData.zeroResults.map(z => `
                                            <tr>
                                                <td style="font-weight:600; color:var(--oc-crimson);">${escapeHtml(z.query)}</td>
                                                <td style="font-weight:700;">${z.count}</td>
                                                <td style="font-family:var(--oc-font-mono); font-size:0.8rem; color:var(--oc-text-muted);">${new Date(z.last_searched).toLocaleDateString()}</td>
                                            </tr>
                                        `).join('') : '<tr><td colspan="3" style="text-align:center; color:var(--oc-text-muted);">No zero-result searches recorded yet</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            } else if (currentAnalyticsTab === 'discovery') {
                tabContent.innerHTML = `
                    <div class="metric-grid">
                        <div class="metric-card">
                            <div class="metric-label">Discovery Impressions</div>
                            <div class="metric-value cyan">${discoveryData.impressions || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Discovery Exhibit Clicks</div>
                            <div class="metric-value emerald">${discoveryData.clicks || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Discovery CTR</div>
                            <div class="metric-value gold">${discoveryData.ctr || '0.0%'}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Recent History Buffer</div>
                            <div class="metric-value cyan">100 items</div>
                        </div>
                    </div>

                    <h3 style="font-size:1.05rem; margin:20px 0 12px; color:var(--oc-text-primary);">Top Discovered Exhibits</h3>
                    <div class="table-container">
                        <table class="oc-table">
                            <thead><tr><th>Entity Type</th><th>Entity ID</th><th>Clicks</th></tr></thead>
                            <tbody>
                                ${discoveryData.topDiscovered?.length ? discoveryData.topDiscovered.map(d => `
                                    <tr>
                                        <td><span class="status-tag published">${escapeHtml(d.entity_type)}</span></td>
                                        <td style="font-family:var(--oc-font-mono);">${escapeHtml(d.entity_id)}</td>
                                        <td style="font-weight:700; color:var(--oc-cyan);">${d.clicks}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="3" style="text-align:center; color:var(--oc-text-muted);">No discovery click events recorded yet</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (currentAnalyticsTab === 'seo') {
                tabContent.innerHTML = `
                    <div class="metric-grid">
                        <div class="metric-card">
                            <div class="metric-label">Last Audit Status</div>
                            <div class="metric-value ${seoData.status === 'COMPLETED' ? 'emerald' : 'gold'}">${seoData.status}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Pages Audited</div>
                            <div class="metric-value cyan">${seoData.pagesAudited || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Issues Found</div>
                            <div class="metric-value ${seoData.issuesFound > 0 ? 'crimson' : 'emerald'}">${seoData.issuesFound || 0}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Sitemap Coverage</div>
                            <div class="metric-value emerald">${searchHealthData.indexedCount || 0} URLs</div>
                        </div>
                    </div>

                    <h3 style="font-size:1.05rem; margin:20px 0 12px; color:var(--oc-text-primary);">Audit Findings</h3>
                    <div class="table-container">
                        <table class="oc-table">
                            <thead><tr><th>Type</th><th>Entity</th><th>Path / Reason</th></tr></thead>
                            <tbody>
                                ${seoData.details?.sampleIssues?.length ? seoData.details.sampleIssues.map(iss => `
                                    <tr>
                                        <td><span class="status-tag ${iss.type.includes('MISSING') ? 'suspended' : 'pending'}">${escapeHtml(iss.type)}</span></td>
                                        <td>${escapeHtml(iss.entityType || 'General')}</td>
                                        <td style="font-family:var(--oc-font-mono); font-size:0.82rem;">${escapeHtml(iss.url || iss.slug || 'N/A')}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="3" style="text-align:center; color:var(--oc-emerald); font-weight:600;">All audited pages have valid canonical URLs, titles, and descriptions.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }

        renderTab();

        // Sub-tab switching
        document.querySelectorAll('[data-atab]').forEach(btn => {
            btn.addEventListener('click', () => {
                currentAnalyticsTab = btn.getAttribute('data-atab');
                document.querySelectorAll('[data-atab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderTab();
            });
        });

        // Maintenance Action Buttons
        document.getElementById('rebuild-search-btn')?.addEventListener('click', async () => {
            if (!confirm('Rebuild full FTS5 search index and data/search-index.json from canonical database?')) return;
            const res = await fetchAPI('/api/owner/search/rebuild', { method: 'POST' });
            if (res.success) {
                alert(`Search index rebuilt: ${res.totalIndexed} entities in ${res.durationMs}ms`);
                renderAnalytics();
            } else {
                alert('Search rebuild failed: ' + (res.error || 'Server error'));
            }
        });

        document.getElementById('run-seo-audit-btn')?.addEventListener('click', async () => {
            const res = await fetchAPI('/api/owner/seo/audit', { method: 'POST' });
            if (res.status === 'COMPLETED') {
                alert(`SEO audit completed: ${res.pagesAudited} pages checked, ${res.issuesFound} issues found.`);
                renderAnalytics();
            } else {
                alert('SEO audit failed: ' + (res.error || 'Server error'));
            }
        });

        document.getElementById('rebuild-sitemap-btn')?.addEventListener('click', async () => {
            const res = await fetchAPI('/api/owner/sitemap/rebuild', { method: 'POST' });
            if (res.success) {
                alert(`Sitemap generated: ${res.urlCount} canonical URLs written to sitemap.xml in ${res.durationMs}ms`);
                renderAnalytics();
            } else {
                alert('Sitemap generation failed: ' + (res.error || 'Server error'));
            }
        });
    }

    // 3. USERS MANAGEMENT
    async function renderUsers() {
        renderLoading('Loading user directory...');
        const data = await fetchAPI('/api/owner/users');
        if (data.error) return renderError(data.error, renderUsers);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">User Management</h1>
                    <p class="view-subtitle">Search, inspect, warn, suspend, and restore platform identities.</p>
                </div>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Identity</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.users.map(u => `
                            <tr>
                                <td>
                                    <div style="font-weight:700; color:var(--oc-text-primary);">@${escapeHtml(u.username)}</div>
                                    <div style="font-size:0.8rem; color:var(--oc-text-muted);">${escapeHtml(u.email)}</div>
                                </td>
                                <td><span class="status-tag ${u.role === 'OWNER' ? 'published' : 'healthy'}">${escapeHtml(u.role)}</span></td>
                                <td><span class="status-tag ${u.status === 'SUSPENDED' ? 'suspended' : 'active'}">${escapeHtml(u.status || 'ACTIVE')}</span></td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem; color:var(--oc-text-muted);">${new Date(u.created_at).toLocaleDateString()}</td>
                                <td>
                                    ${u.role !== 'OWNER' ? `
                                        ${u.status === 'SUSPENDED' ? `
                                            <button class="btn-secondary restore-user-btn" data-id="${u.id}" style="padding:4px 10px; font-size:0.8rem;">Restore</button>
                                        ` : `
                                            <button class="btn-danger suspend-user-btn" data-id="${u.id}" style="padding:4px 10px; font-size:0.8rem;">Suspend</button>
                                        `}
                                    ` : '<span style="color:var(--oc-gold); font-size:0.8rem;">Protected</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.querySelectorAll('.suspend-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reason = prompt('Enter suspension reason:');
                if (!reason) return;
                await fetchAPI(`/api/owner/users/${btn.dataset.id}/suspend`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason })
                });
                renderUsers();
            });
        });

        document.querySelectorAll('.restore-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/users/${btn.dataset.id}/restore`, { method: 'POST' });
                renderUsers();
            });
        });
    }

    // 4. SUBMISSIONS CENTER
    async function renderSubmissions() {
        renderLoading('Loading curation submissions...');
        const data = await fetchAPI('/api/owner/submissions');
        if (data.error) return renderError(data.error, renderSubmissions);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Community Submissions</h1>
                    <p class="view-subtitle">Review, request enhancement, approve, or reject user contributions.</p>
                </div>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Title & Type</th>
                            <th>Submitted By</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Review Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.submissions.length ? data.submissions.map(sub => `
                            <tr>
                                <td>
                                    <div style="font-weight:700;">${escapeHtml(sub.title)}</div>
                                    <div style="font-size:0.8rem; color:var(--oc-cyan);">${escapeHtml(sub.submission_type)}</div>
                                </td>
                                <td>@${escapeHtml(sub.username)}</td>
                                <td><span class="status-tag ${sub.status === 'APPROVED' ? 'published' : (sub.status === 'REJECTED' ? 'suspended' : 'pending')}">${escapeHtml(sub.status)}</span></td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem; color:var(--oc-text-muted);">${new Date(sub.created_at).toLocaleDateString()}</td>
                                <td>
                                    ${sub.status === 'PENDING_REVIEW' ? `
                                        <button class="btn-primary sub-approve-btn" data-id="${sub.id}" style="padding:4px 10px; font-size:0.8rem;">Approve</button>
                                        <button class="btn-secondary sub-enhance-btn" data-id="${sub.id}" style="padding:4px 10px; font-size:0.8rem; margin:0 4px;">Enhance</button>
                                        <button class="btn-danger sub-reject-btn" data-id="${sub.id}" style="padding:4px 10px; font-size:0.8rem;">Reject</button>
                                    ` : `<span style="color:var(--oc-text-muted); font-size:0.8rem;">Processed</span>`}
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" style="text-align:center; color:var(--oc-text-muted); padding:32px;">No submissions currently waiting in queue.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        document.querySelectorAll('.sub-approve-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/submissions/${btn.dataset.id}/review`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'APPROVED' })
                });
                renderSubmissions();
            });
        });

        document.querySelectorAll('.sub-enhance-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const notes = prompt('Enter enhancement instructions for user:');
                if (!notes) return;
                await fetchAPI(`/api/owner/submissions/${btn.dataset.id}/review`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'ENHANCEMENT_REQUESTED', reviewNotes: notes })
                });
                renderSubmissions();
            });
        });

        document.querySelectorAll('.sub-reject-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const notes = prompt('Enter rejection reason:');
                await fetchAPI(`/api/owner/submissions/${btn.dataset.id}/review`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'REJECTED', reviewNotes: notes })
                });
                renderSubmissions();
            });
        });
    }

    // 5. SUPPORT HELPDESK
    async function renderSupport() {
        renderLoading('Loading support tickets...');
        const data = await fetchAPI('/api/owner/tickets');
        if (data.error) return renderError(data.error, renderSupport);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Support Helpdesk</h1>
                    <p class="view-subtitle">Threaded visitor inquiries and administrative responses.</p>
                </div>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Subject & User</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Updated</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.tickets.length ? data.tickets.map(t => `
                            <tr>
                                <td>
                                    <div style="font-weight:700;">${escapeHtml(t.subject)}</div>
                                    <div style="font-size:0.8rem; color:var(--oc-text-muted);">From: ${escapeHtml(t.username ? '@' + t.username : t.email || 'Visitor')}</div>
                                </td>
                                <td><span class="status-tag ${t.priority === 'URGENT' ? 'suspended' : 'healthy'}">${escapeHtml(t.priority || 'NORMAL')}</span></td>
                                <td><span class="status-tag ${t.status === 'OPEN' ? 'pending' : (t.status === 'CLOSED' ? 'active' : 'healthy')}">${escapeHtml(t.status)}</span></td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem; color:var(--oc-text-muted);">${new Date(t.updated_at).toLocaleString()}</td>
                                <td>
                                    <button class="btn-primary view-ticket-btn" data-id="${t.id}" style="padding:4px 10px; font-size:0.8rem;">Open Thread</button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" style="text-align:center; color:var(--oc-text-muted); padding:32px;">No support tickets found.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        document.querySelectorAll('.view-ticket-btn').forEach(btn => {
            btn.addEventListener('click', () => openTicketDetail(btn.dataset.id));
        });
    }

    async function openTicketDetail(ticketId) {
        renderLoading('Opening ticket thread...');
        const data = await fetchAPI(`/api/owner/tickets/${ticketId}`);
        if (data.error) return renderError(data.error, renderSupport);

        const { ticket, messages } = data;

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <button id="back-to-tickets" class="btn-secondary" style="padding:4px 12px; font-size:0.8rem; margin-bottom:8px;">← Back to Inbox</button>
                    <h1 class="view-title">${escapeHtml(ticket.subject)}</h1>
                    <p class="view-subtitle">User: ${escapeHtml(ticket.username ? '@' + ticket.username : ticket.email)} • Status: ${ticket.status}</p>
                </div>
            </div>

            <!-- Thread -->
            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px;">
                <div style="background:var(--oc-surface); border:1px solid var(--oc-border); border-radius:var(--oc-radius); padding:16px;">
                    <div style="font-weight:700; margin-bottom:6px; color:var(--oc-gold);">Original Inquiry:</div>
                    <div style="line-height:1.6; color:var(--oc-text-primary);">${escapeHtml(ticket.message)}</div>
                </div>

                ${messages.map(m => `
                    <div style="background:${m.is_internal_note ? 'rgba(255, 179, 0, 0.05)' : 'var(--oc-surface)'}; border:1px solid ${m.is_internal_note ? 'var(--oc-gold)' : 'var(--oc-border)'}; border-radius:var(--oc-radius); padding:16px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.82rem; color:var(--oc-text-muted);">
                            <span>${m.is_internal_note ? '🔒 [INTERNAL NOTE]' : (m.sender_name || 'Staff')}</span>
                            <span>${new Date(m.created_at).toLocaleString()}</span>
                        </div>
                        <div style="line-height:1.6;">${escapeHtml(m.message)}</div>
                    </div>
                `).join('')}
            </div>

            <!-- Reply Box -->
            <div class="oc-form">
                <div class="form-group">
                    <label for="ticket-reply-text">Respond to Ticket</label>
                    <textarea class="oc-textarea" id="ticket-reply-text" rows="4" placeholder="Write response to user..."></textarea>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" id="send-ticket-reply">Send Public Reply</button>
                    <button class="btn-secondary" id="send-internal-note">Save Internal Note</button>
                    <button class="btn-danger" id="close-ticket-btn" style="margin-left:auto;">Close Ticket</button>
                </div>
            </div>
        `;

        document.getElementById('back-to-tickets')?.addEventListener('click', renderSupport);
        document.getElementById('send-ticket-reply')?.addEventListener('click', async () => {
            const msg = document.getElementById('ticket-reply-text').value.trim();
            if (!msg) return;
            await fetchAPI(`/api/owner/tickets/${ticketId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, status: 'WAITING' })
            });
            openTicketDetail(ticketId);
        });

        document.getElementById('send-internal-note')?.addEventListener('click', async () => {
            const msg = document.getElementById('ticket-reply-text').value.trim();
            if (!msg) return;
            await fetchAPI(`/api/owner/tickets/${ticketId}/note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: msg })
            });
            openTicketDetail(ticketId);
        });

        document.getElementById('close-ticket-btn')?.addEventListener('click', async () => {
            await fetchAPI(`/api/owner/tickets/${ticketId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CLOSED' })
            });
            renderSupport();
        });
    }

    // 6. MODERATION
    async function renderModeration() {
        renderLoading('Loading moderation queues...');
        const [reports, comments, reviews] = await Promise.all([
            fetchAPI('/api/owner/reports'),
            fetchAPI('/api/owner/comments'),
            fetchAPI('/api/owner/reviews')
        ]);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Community Moderation</h1>
                    <p class="view-subtitle">Review reports, hide abusive comments, and curate user reviews.</p>
                </div>
            </div>

            <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Pending Reports (${reports.reports ? reports.reports.length : 0})</h3>
            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Target</th>
                            <th>Reporter</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reports.reports && reports.reports.length ? reports.reports.map(r => `
                            <tr>
                                <td><span class="status-tag pending">${escapeHtml(r.target_type)}</span></td>
                                <td>@${escapeHtml(r.reporter_username)}</td>
                                <td>${escapeHtml(r.reason)}</td>
                                <td><span class="status-tag ${r.status === 'RESOLVED' ? 'published' : 'pending'}">${escapeHtml(r.status)}</span></td>
                                <td>
                                    <button class="btn-primary mod-resolve-btn" data-id="${r.id}" style="padding:4px 8px; font-size:0.75rem;">Resolve</button>
                                    <button class="btn-danger mod-hide-btn" data-id="${r.id}" style="padding:4px 8px; font-size:0.75rem;">Hide Target</button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" style="text-align:center; color:var(--oc-text-muted);">No reports currently pending.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        document.querySelectorAll('.mod-resolve-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/reports/${btn.dataset.id}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'RESOLVE' })
                });
                renderModeration();
            });
        });

        document.querySelectorAll('.mod-hide-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/reports/${btn.dataset.id}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'HIDE_TARGET' })
                });
                renderModeration();
            });
        });
    }

    // 7. GAMES CMS
    async function renderGamesCMS() {
        renderLoading('Loading games catalogue...');
        const data = await fetchAPI('/api/owner/content/games?limit=50');
        if (data.error) return renderError(data.error, renderGamesCMS);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Games Archive CMS</h1>
                    <p class="view-subtitle">Full catalog of interactive exhibits (${data.total} games in database).</p>
                </div>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Title & Slug</th>
                            <th>Year</th>
                            <th>Developer</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map(g => `
                            <tr>
                                <td>
                                    <div style="font-weight:700;">${escapeHtml(g.title)}</div>
                                    <div style="font-size:0.8rem; color:var(--oc-text-muted); font-family:var(--oc-font-mono);">/${escapeHtml(g.slug)}/</div>
                                </td>
                                <td>${escapeHtml(g.release_year || 'N/A')}</td>
                                <td>${escapeHtml(g.developer || 'Unknown')}</td>
                                <td><span class="status-tag ${g.status === 'PUBLISHED' ? 'published' : 'draft'}">${escapeHtml(g.status)}</span></td>
                                <td>
                                    <a href="/games/${escapeHtml(g.slug)}/" target="_blank" class="btn-secondary" style="padding:4px 8px; font-size:0.75rem; text-decoration:none;">Public Exhibit</a>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 8. CONSOLES CMS
    async function renderConsolesCMS() {
        renderLoading('Loading hardware consoles...');
        const data = await fetchAPI('/api/owner/content/consoles?limit=100');
        if (data.error) return renderError(data.error, renderConsolesCMS);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Consoles Hardware CMS</h1>
                    <p class="view-subtitle">Museum hardware archives (${data.total} console machines).</p>
                </div>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Machine Name</th>
                            <th>Manufacturer</th>
                            <th>Release Year</th>
                            <th>Status</th>
                            <th>Exhibit Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map(c => `
                            <tr>
                                <td style="font-weight:700;">${escapeHtml(c.title)}</td>
                                <td>${escapeHtml(c.manufacturer || 'Unknown')}</td>
                                <td>${escapeHtml(c.release_year || 'N/A')}</td>
                                <td><span class="status-tag ${c.status === 'PUBLISHED' ? 'published' : 'draft'}">${escapeHtml(c.status || 'PUBLISHED')}</span></td>
                                <td><a href="/consoles/${escapeHtml(c.slug)}/" target="_blank" class="btn-secondary" style="padding:4px 8px; font-size:0.75rem; text-decoration:none;">View</a></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 9. EDITORIAL & LORE
    async function renderEditorial() {
        renderLoading('Loading editorial content...');
        const [stories, guides, news] = await Promise.all([
            fetchAPI('/api/owner/content/stories'),
            fetchAPI('/api/owner/content/guides'),
            fetchAPI('/api/owner/content/news_articles')
        ]);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Editorial, Guides & News</h1>
                    <p class="view-subtitle">Archival retrospectives, gameplay preservation guides, and historical news.</p>
                </div>
            </div>

            <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Curated Retrospective Stories (${stories.items ? stories.items.length : 0})</h3>
            <div class="table-container" style="margin-bottom:28px;">
                <table class="oc-table">
                    <thead>
                        <tr><th>Title</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${stories.items ? stories.items.map(s => `<tr><td style="font-weight:700;">${escapeHtml(s.title)}</td><td><span class="status-tag published">${escapeHtml(s.status || 'PUBLISHED')}</span></td></tr>`).join('') : ''}
                    </tbody>
                </table>
            </div>

            <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Preservation Guides (${guides.items ? guides.items.length : 0})</h3>
            <div class="table-container" style="margin-bottom:28px;">
                <table class="oc-table">
                    <thead>
                        <tr><th>Title</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${guides.items ? guides.items.map(g => `<tr><td style="font-weight:700;">${escapeHtml(g.title)}</td><td><span class="status-tag published">${escapeHtml(g.status || 'PUBLISHED')}</span></td></tr>`).join('') : ''}
                    </tbody>
                </table>
            </div>

            <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">News Articles with Factual Status (${news.items ? news.items.length : 0})</h3>
            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr><th>Headline</th><th>Factual Status</th><th>Publication</th></tr>
                    </thead>
                    <tbody>
                        ${news.items ? news.items.map(n => `
                            <tr>
                                <td style="font-weight:700;">${escapeHtml(n.title)}</td>
                                <td><span class="status-tag healthy">${escapeHtml(n.factual_status || 'CONFIRMED')}</span></td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem;">${escapeHtml(n.published_date || 'N/A')}</td>
                            </tr>
                        `).join('') : ''}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 10. TIMELINE & GENRES
    async function renderTimelineGenres() {
        renderLoading('Loading timeline events & genres...');
        const [timeline, genres] = await Promise.all([
            fetchAPI('/api/owner/content/timeline_events?limit=50'),
            fetchAPI('/api/owner/content/genres')
        ]);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Timeline & Genres</h1>
                    <p class="view-subtitle">Chronological historical milestones and taxonomy mapping.</p>
                </div>
            </div>

            <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Historical Timeline Milestones (${timeline.items ? timeline.items.length : 0})</h3>
            <div class="table-container" style="margin-bottom:28px;">
                <table class="oc-table">
                    <thead>
                        <tr><th>Year</th><th>Title</th></tr>
                    </thead>
                    <tbody>
                        ${timeline.items ? timeline.items.map(t => `<tr><td style="font-weight:700; color:var(--oc-gold); font-family:var(--oc-font-mono);">${escapeHtml(t.year)}</td><td>${escapeHtml(t.title)}</td></tr>`).join('') : ''}
                    </tbody>
                </table>
            </div>

            <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Museum Genre Taxonomy (${genres.items ? genres.items.length : 0})</h3>
            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr><th>Genre Name</th><th>Slug</th></tr>
                    </thead>
                    <tbody>
                        ${genres.items ? genres.items.map(gn => `<tr><td style="font-weight:700;">${escapeHtml(gn.title)}</td><td style="font-family:var(--oc-font-mono); color:var(--oc-cyan);">${escapeHtml(gn.slug)}</td></tr>`).join('') : ''}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 11. RELEASES & COMPATIBILITY
    async function renderReleasesCompat() {
        renderLoading('Loading releases & compatibility matrix...');
        const data = await fetchAPI('/api/owner/compatibility');

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Releases & System Compatibility</h1>
                    <p class="view-subtitle">Website-side emulator compatibility verification matrix (NES to PS3).</p>
                </div>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Game</th>
                            <th>Hardware System</th>
                            <th>Compatibility Status</th>
                            <th>Version Tested</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.records && data.records.length ? data.records.map(r => `
                            <tr>
                                <td style="font-weight:700;">${escapeHtml(r.game_title)}</td>
                                <td style="font-family:var(--oc-font-mono); color:var(--oc-cyan);">${escapeHtml(r.system)}</td>
                                <td><span class="status-tag ${r.status === 'VERIFIED_PLAYABLE' ? 'active' : 'pending'}">${escapeHtml(r.status)}</span></td>
                                <td>${escapeHtml(r.tested_version || 'Latest')}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align:center; color:var(--oc-text-muted); padding:32px;">No compatibility records created yet. Use API or bulk importer to register verified systems.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 12. MEDIA MANAGER & ASSET PROVENANCE
    let mediaFilterState = { status: 'ALL', q: '', page: 1 };

    async function renderMediaManager() {
        renderLoading('Loading media registry & provenance data...');
        const { status, q, page } = mediaFilterState;
        const queryParams = new URLSearchParams({
            page: page || 1,
            limit: 25,
            status: status || 'ALL',
            q: q || ''
        });

        const data = await fetchAPI(`/api/owner/media?${queryParams.toString()}`);
        if (data.error) return renderError(data.error, renderMediaManager);

        const totalPages = Math.max(1, Math.ceil((data.total || 0) / 25));
        const counts = data.counts || { total: 0, local: 0, remote: 0, fallback: 0, broken: 0 };

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Digital Media Manager & Provenance</h1>
                    <p class="view-subtitle">Authoritative media registry, accession plates, and candidate curation pipeline.</p>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button id="view-domains-btn" class="btn-secondary" style="font-size:0.85rem;">🌐 Domain Health</button>
                    <button id="add-candidate-btn" class="btn-secondary" style="font-size:0.85rem;">+ New Candidate</button>
                    <button id="trigger-media-audit-btn" class="btn-primary" style="font-size:0.85rem;">⚡ Run Media Audit</button>
                </div>
            </div>

            <!-- Core Safeguard Banner -->
            <div style="background:var(--oc-surface); border:1px solid var(--oc-border); border-radius:var(--oc-radius); padding:14px 18px; margin-bottom:20px; display:flex; align-items:center; gap:12px;">
                <span style="font-size:1.4rem;">🔒</span>
                <div>
                    <div style="font-weight:700; color:var(--oc-gold); font-size:0.88rem;">Core Asset Safeguards Enforced</div>
                    <div style="font-size:0.82rem; color:var(--oc-text-secondary); margin-top:2px;">
                        The 50 official user profile icons, approved console transparent PNGs, and creator QR support asset are protected and cannot be deleted or mutated by automated runs.
                    </div>
                </div>
            </div>

            <!-- Aggregate Metric Cards -->
            <div class="metric-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom:20px;">
                <div class="metric-card">
                    <div class="metric-label">Total Registered</div>
                    <div class="metric-value cyan">${counts.total}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Local Verified WebP</div>
                    <div class="metric-value emerald">${counts.local}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Remote Verified</div>
                    <div class="metric-value cyan">${counts.remote}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Museum Fallback Plates</div>
                    <div class="metric-value gold">${counts.fallback}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Broken / Errors</div>
                    <div class="metric-value crimson">${counts.broken}</div>
                </div>
            </div>

            <!-- Filter and Search Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; background:var(--oc-surface); padding:12px 16px; border:1px solid var(--oc-border); border-radius:var(--oc-radius);">
                <div style="display:flex; gap:8px; flex-wrap:wrap;" id="media-status-tabs">
                    ${['ALL', 'LOCAL', 'REMOTE', 'FALLBACK', 'BROKEN'].map(st => `
                        <button class="media-tab-btn" data-status="${st}" style="padding:6px 12px; font-size:0.8rem; border-radius:4px; border:1px solid ${status === st ? 'var(--oc-cyan)' : 'var(--oc-border)'}; background:${status === st ? 'var(--oc-cyan-glow)' : 'transparent'}; color:${status === st ? 'var(--oc-cyan)' : 'var(--oc-text-secondary)'}; cursor:pointer; font-weight:600;">
                            ${st}
                        </button>
                    `).join('')}
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="text" id="media-search-input" placeholder="Search title, slug, domain..." value="${escapeHtml(q)}" style="background:var(--oc-surface-raised); border:1px solid var(--oc-border); border-radius:4px; padding:6px 12px; color:var(--oc-text-primary); font-size:0.85rem; width:240px;">
                    <button id="media-search-btn" class="btn-secondary" style="padding:6px 12px; font-size:0.82rem;">Search</button>
                    ${q ? `<button id="media-search-clear" class="btn-secondary" style="padding:6px 10px; font-size:0.82rem; color:var(--oc-crimson);">Clear</button>` : ''}
                </div>
            </div>

            <!-- Media Table -->
            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th style="width:60px;">Preview</th>
                            <th>Exhibit Title</th>
                            <th>Status & Type</th>
                            <th>Dimensions & Format</th>
                            <th>Source & Provenance</th>
                            <th style="text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.images && data.images.length ? data.images.map(img => {
                            let statusClass = 'pending';
                            let statusLabel = img.verification_status || 'UNKNOWN';
                            if (img.verification_status === 'VERIFIED_LOCAL' || img.image_type === 'local') {
                                statusClass = 'active';
                                statusLabel = 'LOCAL WEBP';
                            } else if (img.verification_status === 'VERIFIED_REMOTE' || (img.image_type === 'remote' && img.verification_status === 'verified')) {
                                statusClass = 'published';
                                statusLabel = 'REMOTE';
                            } else if (img.verification_status === 'FALLBACK' || img.image_type === 'fallback') {
                                statusClass = 'waiting';
                                statusLabel = 'FALLBACK PLATE';
                            } else if (['BROKEN', 'NOT_FOUND', 'FORBIDDEN', 'INVALID_MIME', 'TIMEOUT'].includes(img.verification_status)) {
                                statusClass = 'suspended';
                                statusLabel = `BROKEN (${img.last_http_status || img.failure_reason || 'ERR'})`;
                            }

                            const imgSrc = img.local_path || img.image_url || '/assets/images/museum-fallback.svg';
                            const specs = (img.width && img.height) ? `${img.width}×${img.height} (${img.aspect_ratio || '1:1'})` : '—';
                            const mime = img.mime_type ? img.mime_type.replace('image/', '').toUpperCase() : (img.image_type || 'IMG').toUpperCase();

                            return `
                                <tr>
                                    <td>
                                        <div style="width:44px; height:44px; border-radius:4px; overflow:hidden; background:var(--oc-surface-raised); border:1px solid var(--oc-border); display:flex; align-items:center; justify-content:center;">
                                            <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(img.game_title || '')}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='/assets/images/museum-fallback.svg';">
                                        </div>
                                    </td>
                                    <td>
                                        <div style="font-weight:700; color:var(--oc-text-primary);">${escapeHtml(img.game_title || 'General Asset')}</div>
                                        <div style="font-family:var(--oc-font-mono); font-size:0.75rem; color:var(--oc-cyan);">${escapeHtml(img.game_slug || img.game_id || '')}</div>
                                    </td>
                                    <td>
                                        <span class="status-tag ${statusClass}">${escapeHtml(statusLabel)}</span>
                                    </td>
                                    <td>
                                        <div style="font-size:0.82rem; color:var(--oc-text-primary); font-family:var(--oc-font-mono);">${escapeHtml(specs)}</div>
                                        <div style="font-size:0.75rem; color:var(--oc-text-muted);">${escapeHtml(mime)}</div>
                                    </td>
                                    <td>
                                        <div style="font-size:0.82rem; color:var(--oc-text-secondary); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(img.source_domain || 'Curated / Local')}">
                                            ${escapeHtml(img.source_domain || 'Internal Archive')}
                                        </div>
                                        <div style="font-size:0.75rem; color:var(--oc-text-muted);">
                                            License: ${escapeHtml(img.license_status || 'FAIR_USE')}
                                        </div>
                                    </td>
                                    <td style="text-align:right;">
                                        <button class="btn-secondary replace-img-btn" data-id="${img.id}" data-game="${escapeHtml(img.game_title || '')}" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;">Replace</button>
                                        <button class="btn-secondary cand-img-btn" data-gameid="${img.game_id}" data-game="${escapeHtml(img.game_title || '')}" style="padding:4px 8px; font-size:0.75rem;">+ Candidate</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="6" style="text-align:center; color:var(--oc-text-muted); padding:36px;">
                                    No media records found matching current query and filter.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- Pagination Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; font-size:0.85rem; color:var(--oc-text-muted);">
                <div>Showing Page ${data.page || 1} of ${totalPages} (${data.total || 0} items)</div>
                <div style="display:flex; gap:8px;">
                    <button id="media-prev-btn" class="btn-secondary" style="padding:4px 12px; font-size:0.8rem;" ${mediaFilterState.page <= 1 ? 'disabled' : ''}>← Previous</button>
                    <button id="media-next-btn" class="btn-secondary" style="padding:4px 12px; font-size:0.8rem;" ${mediaFilterState.page >= totalPages ? 'disabled' : ''}>Next →</button>
                </div>
            </div>

            <!-- Domain Health Modal -->
            <div id="domain-health-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:2000; align-items:center; justify-content:center; padding:20px;">
                <div style="background:var(--oc-surface); border:1px solid var(--oc-border); border-radius:var(--oc-radius); width:100%; max-width:700px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden;">
                    <div style="padding:16px 20px; border-bottom:1px solid var(--oc-border); display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="font-size:1.1rem; color:var(--oc-text-primary);">Remote Domain Health & Throttle Distribution</h3>
                        <button id="close-domain-modal" style="background:none; border:none; color:var(--oc-text-muted); font-size:1.2rem; cursor:pointer;">✕</button>
                    </div>
                    <div id="domain-health-body" style="padding:20px; overflow-y:auto; flex:1;">
                        Loading domain health metrics...
                    </div>
                </div>
            </div>
        `;

        // Event Listeners for Media Manager
        document.querySelectorAll('.media-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                mediaFilterState.status = btn.dataset.status;
                mediaFilterState.page = 1;
                renderMediaManager();
            });
        });

        const searchInput = document.getElementById('media-search-input');
        const searchBtn = document.getElementById('media-search-btn');
        const clearBtn = document.getElementById('media-search-clear');

        searchBtn?.addEventListener('click', () => {
            mediaFilterState.q = searchInput ? searchInput.value.trim() : '';
            mediaFilterState.page = 1;
            renderMediaManager();
        });

        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                mediaFilterState.q = searchInput.value.trim();
                mediaFilterState.page = 1;
                renderMediaManager();
            }
        });

        clearBtn?.addEventListener('click', () => {
            mediaFilterState.q = '';
            mediaFilterState.page = 1;
            renderMediaManager();
        });

        document.getElementById('media-prev-btn')?.addEventListener('click', () => {
            if (mediaFilterState.page > 1) {
                mediaFilterState.page--;
                renderMediaManager();
            }
        });

        document.getElementById('media-next-btn')?.addEventListener('click', () => {
            if (mediaFilterState.page < totalPages) {
                mediaFilterState.page++;
                renderMediaManager();
            }
        });

        document.getElementById('trigger-media-audit-btn')?.addEventListener('click', async () => {
            if (confirm('Enqueue full catalogue media audit in the background jobs queue?')) {
                const res = await fetchAPI('/api/owner/media/audit', { method: 'POST' });
                if (res.error) alert('Error: ' + res.error);
                else {
                    alert('Full catalogue media audit job enqueued successfully!');
                    setActiveTab('jobs');
                }
            }
        });

        document.getElementById('view-domains-btn')?.addEventListener('click', async () => {
            const modal = document.getElementById('domain-health-modal');
            const body = document.getElementById('domain-health-body');
            if (modal && body) {
                modal.style.display = 'flex';
                body.innerHTML = '<div style="color:var(--oc-text-muted);">Fetching domain health distribution...</div>';
                const domData = await fetchAPI('/api/owner/sources/health');
                if (domData.error) {
                    body.innerHTML = `<div style="color:var(--oc-crimson);">Error loading domain health: ${escapeHtml(domData.error)}</div>`;
                } else {
                    body.innerHTML = `
                        <table class="oc-table" style="font-size:0.85rem;">
                            <thead>
                                <tr>
                                    <th>Domain</th>
                                    <th>Total Records</th>
                                    <th>Verified</th>
                                    <th>Broken</th>
                                    <th>Throttled</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${domData.domains && domData.domains.length ? domData.domains.map(d => `
                                    <tr>
                                        <td style="font-family:var(--oc-font-mono); color:var(--oc-cyan); font-weight:700;">${escapeHtml(d.source_domain)}</td>
                                        <td>${d.total_records}</td>
                                        <td style="color:var(--oc-emerald);">${d.verified_count}</td>
                                        <td style="${d.broken_count > 0 ? 'color:var(--oc-crimson); font-weight:700;' : ''}">${d.broken_count}</td>
                                        <td style="${d.throttled_count > 0 ? 'color:var(--oc-gold); font-weight:700;' : ''}">${d.throttled_count}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" style="text-align:center; color:var(--oc-text-muted);">No external source domains registered.</td></tr>'}
                            </tbody>
                        </table>
                    `;
                }
            }
        });

        document.getElementById('close-domain-modal')?.addEventListener('click', () => {
            const modal = document.getElementById('domain-health-modal');
            if (modal) modal.style.display = 'none';
        });

        document.querySelectorAll('.replace-img-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const newUrl = prompt(`Enter new verified image URL for "${btn.dataset.game || 'asset'}":`);
                if (!newUrl) return;
                const res = await fetchAPI('/api/owner/media/replace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageId: btn.dataset.id, newUrl: newUrl.trim() })
                });
                if (res.error) alert('Error: ' + res.error);
                else {
                    alert('Asset updated successfully!');
                    renderMediaManager();
                }
            });
        });

        const handleAddCandidate = async (prefillGameId, prefillGameName) => {
            const gameId = prefillGameId || prompt('Enter Game ID (e.g. game-pacman or UUID):');
            if (!gameId) return;
            const imageUrl = prompt(`Enter new artwork image URL for "${prefillGameName || gameId}":`);
            if (!imageUrl) return;
            const sourceUrl = prompt('Enter source webpage URL (provenance):', '');
            const attribution = prompt('Enter artist/archival attribution:', 'Publisher Press Archive');
            const res = await fetchAPI('/api/owner/media/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_id: gameId.trim(),
                    image_url: imageUrl.trim(),
                    source_url: (sourceUrl || '').trim(),
                    attribution: (attribution || '').trim(),
                    license_status: 'FAIR_USE'
                })
            });
            if (res.error) alert('Error: ' + res.error);
            else {
                alert('Media candidate submitted successfully! ID: ' + res.candidateId);
                renderMediaManager();
            }
        };

        document.querySelectorAll('.cand-img-btn').forEach(btn => {
            btn.addEventListener('click', () => handleAddCandidate(btn.dataset.gameid, btn.dataset.game));
        });

        document.getElementById('add-candidate-btn')?.addEventListener('click', () => handleAddCandidate());
    }

    // 13. SEARCH & SEO
    async function renderSearchSEO() {
        renderLoading('Loading search & SEO diagnostics...');
        const [seo, stats] = await Promise.all([
            fetchAPI('/api/owner/seo/audit'),
            fetchAPI('/api/owner/stats')
        ]);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Search & SEO Center</h1>
                    <p class="view-subtitle">Search index integrity, sitemap synchronization, and metadata auditing.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="rebuild-search-btn" class="btn-primary">Rebuild Search Index</button>
                    <button id="rebuild-sitemap-btn" class="btn-secondary">Rebuild Sitemap</button>
                </div>
            </div>

            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Indexed Documents</div>
                    <div class="metric-value cyan">${stats.system.searchIndexCount}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">SEO Audit Status</div>
                    <div class="metric-value ${seo.status === 'HEALTHY' ? 'emerald' : 'gold'}">${seo.status}</div>
                </div>
            </div>

            <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Content Missing Complete SEO Metadata (${seo.missingCount})</h3>
            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Title</th>
                            <th>Slug</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${seo.records && seo.records.length ? seo.records.map(r => `
                            <tr>
                                <td><span class="status-tag pending">${escapeHtml(r.type)}</span></td>
                                <td style="font-weight:700;">${escapeHtml(r.title)}</td>
                                <td style="font-family:var(--oc-font-mono); color:var(--oc-cyan);">${escapeHtml(r.slug)}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="3" style="text-align:center; color:var(--oc-text-muted);">All exhibits have valid SEO metadata.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('rebuild-search-btn')?.addEventListener('click', async () => {
            await fetchAPI('/api/owner/search/rebuild', { method: 'POST' });
            setActiveTab('jobs');
        });
        document.getElementById('rebuild-sitemap-btn')?.addEventListener('click', async () => {
            await fetchAPI('/api/owner/sitemap/rebuild', { method: 'POST' });
            setActiveTab('jobs');
        });
    }

    // 14. CONTENT HEALTH DIAGNOSTICS & CURATION
    let healthFilterState = { severity: 'ALL', status: 'OPEN', page: 1 };

    async function renderContentHealth() {
        renderLoading('Auditing content integrity & issue triage...');
        const { severity, status, page } = healthFilterState;
        const queryParams = new URLSearchParams({
            severity: severity || 'ALL',
            status: status || 'OPEN',
            page: page || 1,
            limit: 50
        });

        const data = await fetchAPI(`/api/owner/content-health?${queryParams.toString()}`);
        if (data.error) return renderError(data.error, renderContentHealth);

        const summary = data.summary || { critical: 0, warning: 0, info: 0, total_open: 0 };
        const totalPages = Math.max(1, Math.ceil((data.total || 0) / 50));

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Content Health & Quality Engine</h1>
                    <p class="view-subtitle">Automated defect detection, curatorial exceptions, and entity verification.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="run-health-audit-btn" class="btn-primary" style="font-size:0.85rem;">⚡ Run Health Audit</button>
                </div>
            </div>

            <!-- Health Metric Grid -->
            <div class="metric-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom:20px;">
                <div class="metric-card">
                    <div class="metric-label">Open Critical Defects</div>
                    <div class="metric-value crimson">${summary.critical}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Open Warnings</div>
                    <div class="metric-value gold">${summary.warning}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Open Info Findings</div>
                    <div class="metric-value cyan">${summary.info}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Unresolved Issues</div>
                    <div class="metric-value ${summary.total_open === 0 ? 'emerald' : 'gold'}">${summary.total_open}</div>
                </div>
            </div>

            <!-- Filter Controls -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; background:var(--oc-surface); padding:12px 16px; border:1px solid var(--oc-border); border-radius:var(--oc-radius);">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <span style="font-size:0.8rem; color:var(--oc-text-muted); font-weight:600; margin-right:4px;">SEVERITY:</span>
                    ${['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(sev => `
                        <button class="health-sev-tab" data-severity="${sev}" style="padding:6px 12px; font-size:0.8rem; border-radius:4px; border:1px solid ${severity === sev ? 'var(--oc-cyan)' : 'var(--oc-border)'}; background:${severity === sev ? 'var(--oc-cyan-glow)' : 'transparent'}; color:${severity === sev ? 'var(--oc-cyan)' : 'var(--oc-text-secondary)'}; cursor:pointer; font-weight:600;">
                            ${sev}
                        </button>
                    `).join('')}
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <span style="font-size:0.8rem; color:var(--oc-text-muted); font-weight:600; margin-right:4px;">STATUS:</span>
                    <select id="health-status-select" style="background:var(--oc-surface-raised); border:1px solid var(--oc-border); border-radius:4px; padding:6px 10px; color:var(--oc-text-primary); font-size:0.82rem; cursor:pointer;">
                        <option value="OPEN" ${status === 'OPEN' ? 'selected' : ''}>OPEN</option>
                        <option value="IGNORED" ${status === 'IGNORED' ? 'selected' : ''}>IGNORED</option>
                        <option value="ALL" ${status === 'ALL' ? 'selected' : ''}>ALL STATUSES</option>
                    </select>
                </div>
            </div>

            <!-- Issues Table -->
            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th style="width:90px;">Severity</th>
                            <th style="width:140px;">Entity</th>
                            <th>Diagnostic Finding & Code</th>
                            <th style="width:90px;">Status</th>
                            <th style="width:110px;">Detected</th>
                            <th style="text-align:right; width:180px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.issues && data.issues.length ? data.issues.map(iss => {
                            let sevTag = 'pending';
                            if (iss.severity === 'CRITICAL') sevTag = 'suspended';
                            else if (iss.severity === 'INFO') sevTag = 'active';

                            return `
                                <tr>
                                    <td><span class="status-tag ${sevTag}">${escapeHtml(iss.severity)}</span></td>
                                    <td>
                                        <div style="font-weight:700; color:var(--oc-cyan); text-transform:uppercase; font-size:0.75rem;">${escapeHtml(iss.entity_type || 'exhibit')}</div>
                                        <div style="font-family:var(--oc-font-mono); font-size:0.8rem; color:var(--oc-text-primary);">${escapeHtml(iss.entity_id || '')}</div>
                                    </td>
                                    <td>
                                        <div style="font-weight:600; color:var(--oc-text-primary);">${escapeHtml(iss.message || iss.issue || '')}</div>
                                        <div style="font-family:var(--oc-font-mono); font-size:0.75rem; color:var(--oc-gold); margin-top:2px;">CODE: ${escapeHtml(iss.issue_code || 'DEFECT')}</div>
                                        ${iss.status === 'IGNORED' && iss.ignored_reason ? `
                                            <div style="font-size:0.75rem; color:var(--oc-text-muted); margin-top:4px; font-style:italic;">
                                                Curatorial Exception: ${escapeHtml(iss.ignored_reason)}
                                            </div>
                                        ` : ''}
                                    </td>
                                    <td>
                                        <span class="status-tag ${iss.status === 'OPEN' ? 'draft' : (iss.status === 'IGNORED' ? 'waiting' : 'healthy')}">${escapeHtml(iss.status || 'OPEN')}</span>
                                    </td>
                                    <td style="font-family:var(--oc-font-mono); font-size:0.78rem; color:var(--oc-text-muted);">
                                        ${iss.created_at ? new Date(iss.created_at).toLocaleDateString() : '—'}
                                    </td>
                                    <td style="text-align:right;">
                                        ${iss.status === 'OPEN' ? `
                                            <button class="btn-secondary ignore-issue-btn" data-id="${iss.id}" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;">Ignore</button>
                                        ` : ''}
                                        <button class="btn-secondary recheck-entity-btn" data-type="${iss.entity_type}" data-id="${iss.entity_id}" style="padding:4px 8px; font-size:0.75rem;">Recheck</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="6" style="text-align:center; color:var(--oc-emerald); padding:36px; font-weight:600;">
                                    ✓ Zero content defects found under selected criteria. Catalogue integrity verified.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- Pagination Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; font-size:0.85rem; color:var(--oc-text-muted);">
                <div>Showing Page ${data.page || 1} of ${totalPages} (${data.total || 0} issues)</div>
                <div style="display:flex; gap:8px;">
                    <button id="health-prev-btn" class="btn-secondary" style="padding:4px 12px; font-size:0.8rem;" ${healthFilterState.page <= 1 ? 'disabled' : ''}>← Previous</button>
                    <button id="health-next-btn" class="btn-secondary" style="padding:4px 12px; font-size:0.8rem;" ${healthFilterState.page >= totalPages ? 'disabled' : ''}>Next →</button>
                </div>
            </div>
        `;

        // Event Listeners for Content Health
        document.querySelectorAll('.health-sev-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                healthFilterState.severity = btn.dataset.severity;
                healthFilterState.page = 1;
                renderContentHealth();
            });
        });

        const statusSelect = document.getElementById('health-status-select');
        statusSelect?.addEventListener('change', () => {
            healthFilterState.status = statusSelect.value;
            healthFilterState.page = 1;
            renderContentHealth();
        });

        document.getElementById('health-prev-btn')?.addEventListener('click', () => {
            if (healthFilterState.page > 1) {
                healthFilterState.page--;
                renderContentHealth();
            }
        });

        document.getElementById('health-next-btn')?.addEventListener('click', () => {
            if (healthFilterState.page < totalPages) {
                healthFilterState.page++;
                renderContentHealth();
            }
        });

        document.getElementById('run-health-audit-btn')?.addEventListener('click', async () => {
            renderLoading('Running comprehensive health audit across all catalogue entities...');
            const res = await fetchAPI('/api/owner/content-health/audit', { method: 'POST' });
            if (res.error) {
                alert('Error running audit: ' + res.error);
            } else {
                alert(`Audit finished: ${res.summary.critical} critical defects, ${res.summary.warning} warnings, ${res.summary.info} informational findings.`);
            }
            renderContentHealth();
        });

        document.querySelectorAll('.ignore-issue-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reason = prompt('Enter mandatory curatorial justification for ignoring this issue:');
                if (!reason || !reason.trim()) {
                    alert('Curatorial justification is required to ignore an issue.');
                    return;
                }
                const res = await fetchAPI('/api/owner/content-health/ignore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ issueId: btn.dataset.id, reason: reason.trim() })
                });
                if (res.error) alert('Error: ' + res.error);
                else {
                    alert('Issue marked as IGNORED and logged to audit trail.');
                    renderContentHealth();
                }
            });
        });

        document.querySelectorAll('.recheck-entity-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const { type, id } = btn.dataset;
                const res = await fetchAPI('/api/owner/content-health/recheck', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entityType: type, entityId: id })
                });
                if (res.error) alert('Error: ' + res.error);
                else {
                    alert(`Recheck complete for ${type} [${id}]. Open issues: ${res.openCount}`);
                    renderContentHealth();
                }
            });
        });
    }

    // 15. JOBS CENTER
    async function renderJobs() {
        renderLoading('Loading background jobs queue...');
        const data = await fetchAPI('/api/owner/jobs');
        if (data.error) return renderError(data.error, renderJobs);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Background Automation Jobs</h1>
                    <p class="view-subtitle">Allowlisted asynchronous tasks with persistent state tracking and retry logic.</p>
                </div>
                <div>
                    <button id="trigger-audit-job-btn" class="btn-primary">Run SEO Audit Job</button>
                </div>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Job Type</th>
                            <th>Status</th>
                            <th>Attempts</th>
                            <th>Started</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.jobs.length ? data.jobs.map(j => `
                            <tr>
                                <td style="font-weight:700; font-family:var(--oc-font-mono);">${escapeHtml(j.job_type)}</td>
                                <td><span class="status-tag ${j.status === 'COMPLETED' ? 'active' : (j.status === 'FAILED' ? 'suspended' : 'pending')}">${escapeHtml(j.status)}</span></td>
                                <td>${j.attempts} / ${j.max_attempts}</td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem; color:var(--oc-text-muted);">${j.started_at ? new Date(j.started_at).toLocaleString() : 'Queued'}</td>
                                <td>
                                    ${j.status === 'FAILED' ? `<button class="btn-secondary retry-job-btn" data-id="${j.id}" style="padding:4px 8px; font-size:0.75rem;">Retry</button>` : ''}
                                    ${j.status === 'QUEUED' ? `<button class="btn-danger cancel-job-btn" data-id="${j.id}" style="padding:4px 8px; font-size:0.75rem;">Cancel</button>` : ''}
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" style="text-align:center; color:var(--oc-text-muted); padding:32px;">No jobs recorded in history.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('trigger-audit-job-btn')?.addEventListener('click', async () => {
            await fetchAPI('/api/owner/jobs/enqueue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobType: 'SEO_AUDIT' })
            });
            renderJobs();
        });

        document.querySelectorAll('.retry-job-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/jobs/${btn.dataset.id}/retry`, { method: 'POST' });
                renderJobs();
            });
        });

        document.querySelectorAll('.cancel-job-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/jobs/${btn.dataset.id}/cancel`, { method: 'POST' });
                renderJobs();
            });
        });
    }

    // 16. AI CONTROL CENTER (PHASE 16)
    async function renderAI(subSection = 'queue') {
        renderLoading('Loading AI intelligence dashboard...');
        const [overviewRes, jobsRes, configRes] = await Promise.all([
            fetchAPI('/api/owner/ai/overview'),
            fetchAPI('/api/owner/ai/jobs?limit=50'),
            fetchAPI('/api/owner/ai/config')
        ]);

        if (overviewRes.error) return renderError(overviewRes.error, renderAI);

        const q = overviewRes.queue || {};
        const usage = overviewRes.usageToday || { totalTokens: 0, totalCostUSD: 0, calls: 0 };
        const ks = overviewRes.killSwitch || { state: 'ENABLED' };
        const jobs = jobsRes.jobs || [];

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Private AI Control Center</h1>
                    <p class="view-subtitle">Server-side intelligence, fact verification, source discovery, and owner approval gates.</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <button id="ai-kill-switch-btn" class="btn-${ks.state === 'ENABLED' ? 'danger' : 'primary'}" style="font-size:0.82rem;">
                        ${ks.state === 'ENABLED' ? 'Disable Automation (Kill Switch)' : 'Enable Automation'}
                    </button>
                    <button id="trigger-ai-test-btn" class="btn-primary" style="font-size:0.82rem;">+ Enqueue Specimen Draft</button>
                </div>
            </div>

            <!-- Metric Cards -->
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom:24px;">
                <div class="stat-card">
                    <div class="stat-label">Active Queue</div>
                    <div class="stat-val" style="color:var(--oc-cyan);">${(q.QUEUED || 0) + (q.PROCESSING || 0)}</div>
                    <div class="stat-sub">${q.PROCESSING || 0} processing</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Awaiting Owner</div>
                    <div class="stat-val" style="color:var(--oc-gold);">${q.AWAITING_OWNER || 0}</div>
                    <div class="stat-sub">Review required</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Completed Jobs</div>
                    <div class="stat-val" style="color:var(--oc-emerald);">${q.COMPLETED || 0}</div>
                    <div class="stat-sub">${q.FAILED || 0} failed / ${q.HELD || 0} held</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Today's Usage</div>
                    <div class="stat-val" style="color:var(--oc-purple);">${usage.calls} calls</div>
                    <div class="stat-sub">${usage.totalTokens.toLocaleString()} tokens (~$${usage.totalCostUSD})</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Engine Health</div>
                    <div class="stat-val" style="color:${ks.state === 'ENABLED' ? 'var(--oc-emerald)' : 'var(--oc-crimson)'}; font-size:1.1rem; line-height:1.8;">
                        ${escapeHtml(ks.state)}
                    </div>
                    <div class="stat-sub">${escapeHtml(configRes.activeProvider || 'mock')} (${escapeHtml(configRes.activeModel || 'flash')})</div>
                </div>
            </div>

            <!-- Subsystem Sub-Tabs -->
            <div class="filter-bar" style="margin-bottom:20px; display:flex; gap:8px;">
                <button class="btn-filter ${subSection === 'queue' ? 'active' : ''}" id="tab-sub-queue">Jobs Queue</button>
                <button class="btn-filter ${subSection === 'news' ? 'active' : ''}" id="tab-sub-news">News Candidates</button>
                <button class="btn-filter ${subSection === 'games' ? 'active' : ''}" id="tab-sub-games">Game Candidates</button>
                <button class="btn-filter ${subSection === 'releases' ? 'active' : ''}" id="tab-sub-releases">Release Watch</button>
                <button class="btn-filter ${subSection === 'sources' ? 'active' : ''}" id="tab-sub-sources">Monitored Sources</button>
                <button class="btn-filter ${subSection === 'config' ? 'active' : ''}" id="tab-sub-config">Config & Budget</button>
            </div>

            <!-- Tab Content Container -->
            <div id="ai-sub-content">
                ${renderSubSectionContent(subSection, jobs, configRes)}
            </div>
        `;

        // Subtab Click Handlers
        document.getElementById('tab-sub-queue')?.addEventListener('click', () => renderAI('queue'));
        document.getElementById('tab-sub-news')?.addEventListener('click', () => renderAI('news'));
        document.getElementById('tab-sub-games')?.addEventListener('click', () => renderAI('games'));
        document.getElementById('tab-sub-releases')?.addEventListener('click', () => renderAI('releases'));
        document.getElementById('tab-sub-sources')?.addEventListener('click', () => renderAI('sources'));
        document.getElementById('tab-sub-config')?.addEventListener('click', () => renderAI('config'));

        // Kill Switch Handler
        document.getElementById('ai-kill-switch-btn')?.addEventListener('click', async () => {
            const nextState = ks.state === 'ENABLED' ? 'DISABLED' : 'ENABLED';
            await fetchAPI('/api/owner/ai/kill-switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: nextState, reason: `Manual toggle via Command Center` })
            });
            renderAI(subSection);
        });

        // Trigger AI Test
        document.getElementById('trigger-ai-test-btn')?.addEventListener('click', async () => {
            await fetchAPI('/api/owner/ai/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobType: 'GAME_ENRICHMENT',
                    entityType: 'GAME',
                    entityId: 'demo-pacman',
                    priority: 'NORMAL',
                    payload: { title: 'Pac-Man', platform: 'Arcade', releaseYear: 1980 }
                })
            });
            setTimeout(() => renderAI(subSection), 600);
        });

        // Table Action Delegations
        attachAIActionListeners(subSection);
    }

    function renderSubSectionContent(subSection, jobs, configRes) {
        if (subSection === 'config') {
            return `
                <div class="form-card" style="max-width:700px;">
                    <h3 style="margin-top:0; color:var(--oc-gold);">AI Provider & Budget Controls</h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px;">
                        <div>
                            <label class="form-label">Active Provider</label>
                            <input class="form-input" value="${escapeHtml(configRes.activeProvider || 'mock')}" readonly>
                        </div>
                        <div>
                            <label class="form-label">Active Model</label>
                            <input class="form-input" value="${escapeHtml(configRes.activeModel || 'gemini-3.1-flash-lite')}" readonly>
                        </div>
                        <div>
                            <label class="form-label">Timeout (ms)</label>
                            <input class="form-input" value="${configRes.timeoutMs || 15000}" readonly>
                        </div>
                        <div>
                            <label class="form-label">Max Retries</label>
                            <input class="form-input" value="${configRes.maxRetries || 3}" readonly>
                        </div>
                        <div>
                            <label class="form-label">Daily Budget (USD)</label>
                            <input class="form-input" value="$${configRes.dailyBudgetUSD || '5.00'}" readonly>
                        </div>
                        <div>
                            <label class="form-label">Test Mode</label>
                            <input class="form-input" value="${configRes.testMode ? 'ACTIVE (Deterministic Mock)' : 'PRODUCTION'}" readonly>
                        </div>
                    </div>
                    <p style="color:var(--oc-text-muted); font-size:0.8rem; margin-top:16px;">
                        Note: AI provider API credentials are strictly configured via server environment secrets and are never exposed in browser runtime.
                    </p>
                </div>
            `;
        }

        // Default: Jobs Queue Table
        return `
            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Job ID / Type</th>
                            <th>Target Entity</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Model / Version</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${jobs.length ? jobs.map(j => `
                            <tr>
                                <td>
                                    <div style="font-weight:700;">${escapeHtml(j.job_type)}</div>
                                    <div style="font-family:var(--oc-font-mono); font-size:0.75rem; color:var(--oc-text-muted);">${escapeHtml(j.id.slice(0, 8))}...</div>
                                </td>
                                <td>${escapeHtml(j.entity_type || 'N/A')}: ${escapeHtml(j.entity_id || 'Global')}</td>
                                <td><span class="status-tag ${j.priority === 'CRITICAL' ? 'danger' : (j.priority === 'HIGH' ? 'pending' : 'active')}">${escapeHtml(j.priority)}</span></td>
                                <td><span class="status-tag ${j.status === 'COMPLETED' ? 'active' : (j.status === 'AWAITING_OWNER' ? 'pending' : (j.status === 'FAILED' ? 'danger' : 'healthy'))}">${escapeHtml(j.status)}</span></td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.8rem;">${escapeHtml(j.model)} (${escapeHtml(j.prompt_version || 'v1')})</td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.8rem; color:var(--oc-text-muted);">${new Date(j.created_at).toLocaleTimeString()}</td>
                                <td>
                                    ${j.status === 'AWAITING_OWNER' ? `
                                        <button class="btn-primary ai-approve-job-btn" data-id="${j.id}" style="padding:4px 8px; font-size:0.75rem;">Approve</button>
                                        <button class="btn-danger ai-reject-job-btn" data-id="${j.id}" style="padding:4px 8px; font-size:0.75rem;">Reject</button>
                                    ` : (j.status === 'FAILED' ? `
                                        <button class="btn-secondary ai-retry-job-btn" data-id="${j.id}" style="padding:4px 8px; font-size:0.75rem;">Retry</button>
                                    ` : (j.status === 'QUEUED' ? `
                                        <button class="btn-danger ai-cancel-job-btn" data-id="${j.id}" style="padding:4px 8px; font-size:0.75rem;">Cancel</button>
                                    ` : `<span style="color:var(--oc-text-muted); font-size:0.8rem;">Completed</span>`))}
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="7" style="text-align:center; color:var(--oc-text-muted); padding:32px;">No AI jobs are waiting.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    function attachAIActionListeners(subSection) {
        document.querySelectorAll('.ai-approve-job-btn').forEach(b => {
            b.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/ai/jobs/${b.dataset.id}/approve`, { method: 'POST' });
                renderAI(subSection);
            });
        });

        document.querySelectorAll('.ai-reject-job-btn').forEach(b => {
            b.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/ai/jobs/${b.dataset.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: 'Rejected by owner' }) });
                renderAI(subSection);
            });
        });

        document.querySelectorAll('.ai-retry-job-btn').forEach(b => {
            b.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/ai/jobs/${b.dataset.id}/retry`, { method: 'POST' });
                renderAI(subSection);
            });
        });

        document.querySelectorAll('.ai-cancel-job-btn').forEach(b => {
            b.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/ai/jobs/${b.dataset.id}/cancel`, { method: 'POST' });
                renderAI(subSection);
            });
        });
    }

    // 17. BACKUPS & DISASTER RECOVERY
    async function renderBackups() {
        renderLoading('Inspecting backup snapshots...');
        const data = await fetchAPI('/api/owner/backups');
        if (data.error) return renderError(data.error, renderBackups);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Backups & Disaster Recovery</h1>
                    <p class="view-subtitle">Point-in-time online SQLite snapshots with corruption verification and dry-run restores.</p>
                </div>
                <div>
                    <button id="create-backup-btn" class="btn-primary">Create Live Backup Snapshot</button>
                </div>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Snapshot Filename</th>
                            <th>Size</th>
                            <th>Timestamp</th>
                            <th>Integrity Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.backups.length ? data.backups.map(b => `
                            <tr>
                                <td style="font-family:var(--oc-font-mono); font-weight:700;">${escapeHtml(b.filename)}</td>
                                <td>${escapeHtml(b.size)}</td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem; color:var(--oc-text-muted);">${new Date(b.created_at).toLocaleString()}</td>
                                <td>
                                    <button class="btn-secondary verify-backup-btn" data-name="${escapeHtml(b.filename)}" style="padding:4px 8px; font-size:0.75rem;">Verify Integrity</button>
                                    <button class="btn-secondary restore-sandbox-btn" data-name="${escapeHtml(b.filename)}" style="padding:4px 8px; font-size:0.75rem; margin-left:4px;">Sandbox Restore</button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align:center; color:var(--oc-text-muted); padding:32px;">No backup files found.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('create-backup-btn')?.addEventListener('click', async () => {
            await fetchAPI('/api/owner/backups/create', { method: 'POST' });
            setActiveTab('jobs');
        });

        document.querySelectorAll('.verify-backup-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const res = await fetchAPI(`/api/owner/backups/${encodeURIComponent(btn.dataset.name)}/verify`, { method: 'POST' });
                alert(res.error ? 'Verification failed: ' + res.error : 'Integrity Verified: Corruption-Free SQLite Database.');
            });
        });

        document.querySelectorAll('.restore-sandbox-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const res = await fetchAPI(`/api/owner/backups/${encodeURIComponent(btn.dataset.name)}/restore-sandbox`, { method: 'POST' });
                alert(res.error ? 'Restore dry-run failed: ' + res.error : 'Sandbox Restoration Passed: All tables restored and integrity confirmed in isolation.');
            });
        });
    }

    // 18. SECURITY CENTER
    async function renderSecurity() {
        renderLoading('Loading security overview...');
        const [overview, sessions] = await Promise.all([
            fetchAPI('/api/owner/security/overview'),
            fetchAPI('/api/owner/security/sessions')
        ]);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Security & Sessions Center</h1>
                    <p class="view-subtitle">Failed authentication events, rate-limit activity, and active session controls.</p>
                </div>
            </div>

            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Active Platform Sessions</div>
                    <div class="metric-value cyan">${overview.activeSessionsCount}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Recent Error Audits</div>
                    <div class="metric-value ${overview.failedAudits.length > 0 ? 'crimson' : 'emerald'}">${overview.failedAudits.length}</div>
                </div>
            </div>

            <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Owner Active Sessions</h3>
            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr><th>IP Address</th><th>User Agent</th><th>Last Seen</th><th>Revoke</th></tr>
                    </thead>
                    <tbody>
                        ${sessions.sessions && sessions.sessions.length ? sessions.sessions.map(s => `
                            <tr>
                                <td style="font-family:var(--oc-font-mono);">${escapeHtml(s.ip_address || '127.0.0.1')}</td>
                                <td style="font-size:0.8rem; color:var(--oc-text-secondary); max-width:300px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(s.user_agent || 'Browser')}</td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem; color:var(--oc-text-muted);">${s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : 'Active'}</td>
                                <td><button class="btn-danger revoke-session-btn" data-id="${s.id}" style="padding:4px 8px; font-size:0.75rem;">Revoke</button></td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align:center; color:var(--oc-text-muted);">No other active sessions.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        document.querySelectorAll('.revoke-session-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/security/sessions/${btn.dataset.id}/revoke`, { method: 'POST' });
                renderSecurity();
            });
        });
    }

    // 19. BUSINESS & ADS
    async function renderBusiness() {
        renderLoading('Loading business & sponsorships...');
        const [inquiries, ads] = await Promise.all([
            fetchAPI('/api/owner/business/inquiries'),
            fetchAPI('/api/owner/business/ad-slots')
        ]);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Business, Sponsorships & Ad Slots</h1>
                    <p class="view-subtitle">Sponsor inquiry pipelines, creator support verification, and ad slot placement.</p>
                </div>
            </div>

            <h3 style="font-size:1.1rem; margin-bottom:12px; color:var(--oc-text-primary);">Sponsor Inquiries (${inquiries.inquiries ? inquiries.inquiries.length : 0})</h3>
            <div class="table-container" style="margin-bottom:28px;">
                <table class="oc-table">
                    <thead>
                        <tr><th>Company & Contact</th><th>Campaign / Message</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${inquiries.inquiries && inquiries.inquiries.length ? inquiries.inquiries.map(inq => `
                            <tr>
                                <td><div style="font-weight:700;">${escapeHtml(inq.company)}</div><div style="font-size:0.8rem; color:var(--oc-text-muted);">${escapeHtml(inq.email)}</div></td>
                                <td>${escapeHtml(inq.message)}</td>
                                <td><span class="status-tag active">${escapeHtml(inq.status)}</span></td>
                            </tr>
                        `).join('') : '<tr><td colspan="3" style="text-align:center; color:var(--oc-text-muted); padding:24px;">No commercial sponsor inquiries received yet.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 20. AUDIT TRAIL
    async function renderAudit() {
        renderLoading('Loading system audit trail...');
        const data = await fetchAPI('/api/owner/audit-logs');
        if (data.error) return renderError(data.error, renderAudit);

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Immutable Audit Trail</h1>
                    <p class="view-subtitle">Cryptographically safe record of every privileged administrative mutation.</p>
                </div>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Action</th>
                            <th>Entity</th>
                            <th>Actor</th>
                            <th>Result</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.logs.length ? data.logs.map(log => `
                            <tr>
                                <td style="font-family:var(--oc-font-mono); font-weight:700; color:var(--oc-cyan);">${escapeHtml(log.action)}</td>
                                <td>${escapeHtml(log.entity_type)} ${log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ''}</td>
                                <td>@${escapeHtml(log.actor_username || 'system')}</td>
                                <td><span class="status-tag ${log.result === 'SUCCESS' ? 'active' : 'suspended'}">${escapeHtml(log.result)}</span></td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem; color:var(--oc-text-muted);">${new Date(log.created_at).toLocaleString()}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" style="text-align:center; color:var(--oc-text-muted);">No audit logs found.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 21. NOTIFICATION CENTER (Section 28)
    async function renderNotifications(filter = 'all') {
        renderLoading('Loading notifications...');
        const data = await fetchAPI(`/api/owner/notifications?status=${filter}`);
        if (data.error) return renderError(data.error, () => renderNotifications(filter));

        const notifs = data.notifications || [];
        const unreadCount = data.unreadCount || 0;

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Notification Center</h1>
                    <p class="view-subtitle">System alerts, automated job status, security events, and administrative notifications.</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    ${unreadCount > 0 ? `<button class="btn btn-secondary" id="notif-mark-all-read-btn">Mark All Read (${unreadCount})</button>` : ''}
                </div>
            </div>

            <div style="display:flex; gap:8px; margin-bottom:20px;">
                <button class="btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} notif-filter-btn" data-filter="all">All (${data.total || notifs.length})</button>
                <button class="btn ${filter === 'unread' ? 'btn-primary' : 'btn-secondary'} notif-filter-btn" data-filter="unread">Unread (${unreadCount})</button>
                <button class="btn ${filter === 'read' ? 'btn-primary' : 'btn-secondary'} notif-filter-btn" data-filter="read">Read</button>
                <button class="btn ${filter === 'archived' ? 'btn-primary' : 'btn-secondary'} notif-filter-btn" data-filter="archived">Archived</button>
            </div>

            <div class="table-container">
                <table class="oc-table">
                    <thead>
                        <tr>
                            <th>Severity</th>
                            <th>Type</th>
                            <th>Message</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${notifs.length ? notifs.map(n => `
                            <tr style="${n.is_read ? 'opacity:0.8;' : 'background:rgba(0,229,255,0.03); font-weight:600;'}">
                                <td>
                                    <span class="status-tag ${n.severity === 'CRITICAL' ? 'suspended' : (n.severity === 'WARNING' ? 'pending' : 'active')}">
                                        ${escapeHtml(n.severity || 'INFO')}
                                    </span>
                                </td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.82rem; color:var(--oc-cyan);">${escapeHtml(n.type)}</td>
                                <td style="max-width:400px; word-break:break-word;">${escapeHtml(n.message)}</td>
                                <td style="font-family:var(--oc-font-mono); font-size:0.8rem; color:var(--oc-text-muted);">${new Date(n.created_at).toLocaleString()}</td>
                                <td>
                                    <div style="display:flex; gap:6px;">
                                        ${!n.is_read ? `<button class="btn btn-sm btn-secondary notif-read-btn" data-id="${n.id}">Read</button>` : ''}
                                        ${!n.is_archived ? `<button class="btn btn-sm btn-secondary notif-archive-btn" data-id="${n.id}">Archive</button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--oc-text-muted);">No notifications in this view.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        stage.querySelectorAll('.notif-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => renderNotifications(btn.dataset.filter));
        });

        stage.querySelectorAll('.notif-read-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/notifications/${btn.dataset.id}/read`, { method: 'POST' });
                renderNotifications(filter);
            });
        });

        stage.querySelectorAll('.notif-archive-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetchAPI(`/api/owner/notifications/${btn.dataset.id}/archive`, { method: 'POST' });
                renderNotifications(filter);
            });
        });

        stage.querySelector('#notif-mark-all-read-btn')?.addEventListener('click', async () => {
            await fetchAPI('/api/owner/notifications/mark-all-read', { method: 'POST' });
            renderNotifications(filter);
        });
    }

    // 22. SETTINGS & MAINTENANCE
    async function renderSettings() {
        renderLoading('Loading site settings...');
        const data = await fetchAPI('/api/owner/settings');
        if (data.error) return renderError(data.error, renderSettings);

        const isMaintenance = data.settings?.maintenance_mode === 'true' || data.settings?.maintenance_mode === '1';

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Settings & Maintenance</h1>
                    <p class="view-subtitle">Platform configuration, owner identity preferences, and maintenance controls.</p>
                </div>
            </div>

            <div class="oc-form" style="margin-bottom:28px;">
                <h3 style="color:var(--oc-text-primary); margin-bottom:12px;">Maintenance Mode</h3>
                <p style="font-size:0.88rem; color:var(--oc-text-muted); margin-bottom:16px;">
                    When enabled, all public visitor requests receive an HTTP 503 maintenance page. The Owner Command Center remains fully accessible to you.
                </p>
                <div style="display:flex; align-items:center; gap:16px;">
                    <span class="status-tag ${isMaintenance ? 'suspended' : 'active'}">${isMaintenance ? 'MAINTENANCE ACTIVE' : 'SYSTEM ONLINE'}</span>
                    <button id="toggle-maint-btn" class="${isMaintenance ? 'btn-primary' : 'btn-danger'}">
                        ${isMaintenance ? 'Disable Maintenance (Go Live)' : 'Enable Maintenance Mode'}
                    </button>
                </div>
            </div>

            <div class="oc-form">
                <h3 style="color:var(--oc-text-primary); margin-bottom:16px;">Owner Display Name</h3>
                <div class="form-group">
                    <label for="owner-display-name">Display Name</label>
                    <input type="text" class="oc-input" id="owner-display-name" value="${escapeHtml(data.ownerProfile?.displayName || 'owner')}">
                </div>
                <button class="btn-primary" id="save-display-name-btn">Save Display Name</button>
            </div>
        `;

        document.getElementById('toggle-maint-btn')?.addEventListener('click', async () => {
            const nextVal = !isMaintenance;
            if (nextVal) {
                const reason = prompt('Enter maintenance message for public visitors:');
                await fetchAPI('/api/owner/settings/maintenance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: true, reason })
                });
            } else {
                await fetchAPI('/api/owner/settings/maintenance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: false })
                });
            }
            renderSettings();
        });

        document.getElementById('save-display-name-btn')?.addEventListener('click', async () => {
            const val = document.getElementById('owner-display-name').value.trim();
            if (!val) return;
            const res = await fetchAPI('/api/owner/settings/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: val })
            });
            if (res.success) {
                alert('Display name updated successfully.');
                const headerUsername = document.getElementById('header-username');
                if (headerUsername) headerUsername.textContent = val;
            }
        });
    }

    // ==================================================================
    // 21. OWNER AI ENGINEERING CHAT & KEY VAULT (PHASE 20)
    // ==================================================================
    let aiChatActiveConvId = null;
    let aiChatActiveMode = 'plan_approve';
    let aiChatActiveProvider = 'GOOGLE';
    let aiChatActiveModel = 'gemini-3.1-flash-lite';
    let aiChatThinkingLevel = 'off';
    let aiChatAutoFallback = false;

    async function renderAIChat() {
        renderLoading('Loading Autonomous AI Command Center & Key Vault...');

        const [convRes, vaultRes, modelsRes] = await Promise.all([
            fetchAPI('/api/owner/ai/conversations'),
            fetchAPI('/api/owner/ai/vault/providers'),
            fetchAPI('/api/owner/ai/models')
        ]);

        if (vaultRes.error) return renderError(vaultRes.error, renderAIChat);

        const conversations = convRes.conversations || [];
        const vaultProviders = vaultRes.providers || {};
        const models = modelsRes.models || [];

        // Select or create default conversation
        if (!aiChatActiveConvId && conversations.length > 0) {
            aiChatActiveConvId = conversations[0].id;
        }

        let currentConv = null;
        let messages = [];

        if (aiChatActiveConvId) {
            const detailRes = await fetchAPI(`/api/owner/ai/conversations/${aiChatActiveConvId}`);
            if (detailRes.success) {
                currentConv = detailRes.conversation;
                messages = detailRes.messages || [];
                aiChatActiveProvider = currentConv.provider || aiChatActiveProvider;
                aiChatActiveModel = currentConv.model || aiChatActiveModel;
                aiChatActiveMode = currentConv.mode || aiChatActiveMode;
            }
        }

        // Helper: Render Dynamic Model Options for Selected Provider
        function renderModelOptions(provider, selectedModel) {
            const provUpper = (provider || 'GOOGLE').toUpperCase();
            
            if (provUpper === 'GOOGLE') {
                return `
                    <optgroup label="Standard Capability Aliases">
                        <option value="FAST" ${selectedModel === 'FAST' ? 'selected' : ''}>⚡ FAST (Gemini 3.1 Flash-Lite)</option>
                        <option value="BALANCED" ${selectedModel === 'BALANCED' ? 'selected' : ''}>⚖️ BALANCED (Gemini 3.5 Flash)</option>
                        <option value="POWERFUL" ${selectedModel === 'POWERFUL' ? 'selected' : ''}>🧠 POWERFUL (Gemini 3.8 Flash)</option>
                        <option value="IMAGE" ${selectedModel === 'IMAGE' ? 'selected' : ''}>🎨 IMAGE (Visual Reconstruction)</option>
                    </optgroup>
                    <optgroup label="Google Gemini 3 Authoritative Models">
                        <option value="gemini-3.1-flash-lite" ${selectedModel === 'gemini-3.1-flash-lite' ? 'selected' : ''}>Gemini 3.1 Flash-Lite (Default)</option>
                        <option value="gemini-3.5-flash-lite" ${selectedModel === 'gemini-3.5-flash-lite' ? 'selected' : ''}>Gemini 3.5 Flash-Lite</option>
                        <option value="gemini-3.5-flash" ${selectedModel === 'gemini-3.5-flash' ? 'selected' : ''}>Gemini 3.5 Flash</option>
                        <option value="gemini-3.6-flash" ${selectedModel === 'gemini-3.6-flash' ? 'selected' : ''}>Gemini 3.6 Flash</option>
                        <option value="gemini-3.7-flash" ${selectedModel === 'gemini-3.7-flash' ? 'selected' : ''}>Gemini 3.7 Flash</option>
                        <option value="gemini-3.8-flash" ${selectedModel === 'gemini-3.8-flash' ? 'selected' : ''}>Gemini 3.8 Flash</option>
                    </optgroup>
                `;
            }

            const providerSpecific = models.filter(m => (m.provider || '').toUpperCase() === provUpper);
            return `
                <optgroup label="Standard Capability Aliases">
                    <option value="FAST" ${selectedModel === 'FAST' ? 'selected' : ''}>⚡ FAST</option>
                    <option value="BALANCED" ${selectedModel === 'BALANCED' ? 'selected' : ''}>⚖️ BALANCED</option>
                    <option value="POWERFUL" ${selectedModel === 'POWERFUL' ? 'selected' : ''}>🧠 POWERFUL</option>
                </optgroup>
                <optgroup label="${escapeHtml(provUpper)} Native Models">
                    ${providerSpecific.map(m => `
                        <option value="${escapeHtml(m.modelId)}" ${selectedModel === m.modelId ? 'selected' : ''}>
                            ${escapeHtml(m.displayName)}
                        </option>
                    `).join('')}
                </optgroup>
            `;
        }

        // Helper: Render Supported Thinking Levels
        function renderThinkingOptions(currentModelId, currentThinkingLevel) {
            const thinkingSupportMap = {
                'gemini-3.1-flash-lite': ['minimal', 'low'],
                'gemini-3.5-flash-lite': ['minimal', 'low'],
                'gemini-3.5-flash': ['minimal', 'low', 'medium'],
                'gemini-3.6-flash': ['minimal', 'low', 'medium', 'high'],
                'gemini-3.7-flash': ['minimal', 'low', 'medium', 'high'],
                'gemini-3.8-flash': ['minimal', 'low', 'medium', 'high'],
                'FAST': ['minimal', 'low'],
                'BALANCED': ['minimal', 'low', 'medium'],
                'POWERFUL': ['minimal', 'low', 'medium', 'high']
            };

            const supported = thinkingSupportMap[currentModelId] || [];
            if (!supported.length) {
                return '<option value="off" selected>Off (Not supported by model)</option>';
            }

            return `
                <option value="off" ${currentThinkingLevel === 'off' ? 'selected' : ''}>Off (Disabled)</option>
                ${supported.map(lvl => `
                    <option value="${escapeHtml(lvl)}" ${currentThinkingLevel === lvl ? 'selected' : ''}>
                        ${escapeHtml(lvl.charAt(0).toUpperCase() + lvl.slice(1))}
                    </option>
                `).join('')}
            `;
        }

        stage.innerHTML = `
            <div class="view-header">
                <div>
                    <h1 class="view-title">Autonomous AI Engineering Command Center</h1>
                    <p class="view-subtitle">Private operator AI with controlled project workspace execution, safety snapshots, and multi-key vault.</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <button id="ai-new-chat-btn" class="btn-primary" style="font-size:0.82rem;">+ New Chat</button>
                    <button id="ai-rollback-btn" class="btn-secondary" style="font-size:0.82rem; border-color:var(--oc-crimson); color:var(--oc-crimson);" title="Rollback last project change">↺ Rollback Last</button>
                    <button id="ai-snapshots-btn" class="btn-secondary" style="font-size:0.82rem;">Snapshots</button>
                    <button id="ai-add-key-btn" class="btn-primary" style="font-size:0.82rem; background:var(--oc-gold); border-color:var(--oc-gold); color:#000;">+ Add API Key</button>
                </div>
            </div>

            <div class="ai-chat-layout">
                <!-- MAIN / LEFT: Chat & Engineering Controls -->
                <div class="ai-chat-main">
                    <!-- Session Header -->
                    <div class="ai-chat-header">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.1rem; color:var(--oc-cyan);">⚡</span>
                            <span style="font-weight:700; font-size:0.95rem; color:var(--oc-text-primary);" id="ai-conv-title">${escapeHtml(currentConv?.title || 'New Engineering Session')}</span>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <span class="status-tag active" style="font-size:0.72rem;">MODE: ${escapeHtml(aiChatActiveMode.toUpperCase())}</span>
                            <button id="ai-clear-chat-btn" class="btn-secondary" style="padding:4px 8px; font-size:0.75rem;">Clear</button>
                        </div>
                    </div>

                    <!-- Message Stream -->
                    <div class="ai-chat-stream" id="ai-chat-stream">
                        ${messages.length === 0 ? `
                            <div style="text-align:center; padding: 28px 16px; background:var(--oc-surface-raised); border:1px solid var(--oc-border); border-radius:var(--oc-radius); margin:auto 0;">
                                <span style="font-size:2.2rem; color:var(--oc-cyan);">🤖</span>
                                <h3 style="color:var(--oc-text-primary); margin:10px 0 6px 0;">NostalgicVerse Curatorial Agent Ready</h3>
                                <p style="color:var(--oc-text-muted); font-size:0.88rem; max-width:540px; margin:0 auto 16px auto;">
                                    Type engineering requests in natural language. The agent inspects repositories, plans diffs, generates exhibits, updates search, and executes verified snapshots.
                                </p>
                                <div class="example-chips" style="justify-content:center;">
                                    <div class="example-chip" data-prompt="Add a new game for Gran Turismo 7 with full metadata, search entry, and SEO.">🎮 Add Gran Turismo 7</div>
                                    <div class="example-chip" data-prompt="Fix the Games page so all 528 games are accessible with Load More pagination.">📄 Fix 528 Games Catalogue</div>
                                    <div class="example-chip" data-prompt="Audit the entire website for broken image references and generate missing assets.">🖼️ Audit & Repair Media</div>
                                    <div class="example-chip" data-prompt="Add 20 new timeline events to enhance the 1990s 3D revolution era.">⏳ Add 20 Timeline Events</div>
                                    <div class="example-chip" data-prompt="Inspect why search is returning incomplete results and rebuild the global index.">🔍 Rebuild Global Search Index</div>
                                    <div class="example-chip" data-prompt="Improve SEO metadata and JSON-LD structured data for all console pages.">📈 Upgrade Console SEO</div>
                                </div>
                            </div>
                        ` : ''}

                        ${messages.map(m => renderChatMessage(m)).join('')}
                    </div>

                    <!-- Composer -->
                    <div class="ai-composer">
                        <!-- Mode Selector Bar -->
                        <div class="ai-mode-bar">
                            <span style="font-size:0.75rem; color:var(--oc-text-muted); font-weight:600; text-transform:uppercase;">Execution Mode:</span>
                            <button class="mode-pill ${aiChatActiveMode === 'plan_approve' ? 'active' : ''}" data-mode="plan_approve" title="Formulate plan and require explicit approval before modifying workspace">Plan + Ask Approval</button>
                            <button class="mode-pill ${aiChatActiveMode === 'plan_only' ? 'active' : ''}" data-mode="plan_only" title="Inspect and output plan without executing">Plan Only</button>
                            <button class="mode-pill ${aiChatActiveMode === 'execute' ? 'active' : ''}" data-mode="execute" title="Immediately execute with automated safety snapshot">Execute</button>
                            <button class="mode-pill ${aiChatActiveMode === 'dry_run' ? 'active' : ''}" data-mode="dry_run" title="Simulate schema checks and diffs with zero filesystem changes">Dry Run</button>
                        </div>

                        <!-- Prompt Input -->
                        <textarea class="ai-prompt-input" id="ai-prompt-input" placeholder="Type engineering command or instruction... (Ctrl+Enter to send)"></textarea>

                        <!-- Attachments Context Bar -->
                        <div style="display:flex; gap:10px; align-items:center; margin-top:8px;">
                            <input type="text" class="oc-input" id="ai-attachments-input" placeholder="Optional context files (e.g. data/games.json, games/index.html)" style="padding:6px 10px; font-size:0.8rem; flex:1;">
                            <button id="ai-send-btn" class="btn-primary" style="padding:8px 22px; font-size:0.85rem; font-weight:700;">Send Command ➔</button>
                        </div>
                    </div>
                </div>

                <!-- RIGHT: Model Selector & Multi-Provider Key Vault -->
                <div class="vault-panel">
                    <!-- Model & Alias Selector -->
                    <div class="vault-card">
                        <div class="vault-card-header">
                            <span style="font-weight:700; color:var(--oc-text-primary); font-size:0.9rem;">Intelligence Router</span>
                            <span class="status-tag active" style="font-size:0.7rem;">Active</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div>
                                <label style="font-size:0.75rem; color:var(--oc-text-muted); display:block; margin-bottom:4px; font-weight:600;">ACTIVE PROVIDER</label>
                                <select class="oc-input" id="ai-provider-select" style="padding:6px 10px; font-size:0.85rem;">
                                    <option value="GOOGLE" ${aiChatActiveProvider === 'GOOGLE' ? 'selected' : ''}>Google Gemini</option>
                                    <option value="ANTHROPIC" ${aiChatActiveProvider === 'ANTHROPIC' ? 'selected' : ''}>Anthropic Claude</option>
                                    <option value="OPENAI" ${aiChatActiveProvider === 'OPENAI' ? 'selected' : ''}>OpenAI</option>
                                    <option value="XAI" ${aiChatActiveProvider === 'XAI' ? 'selected' : ''}>xAI Grok</option>
                                    <option value="CUSTOM" ${aiChatActiveProvider === 'CUSTOM' ? 'selected' : ''}>Custom / OpenAI-Compatible</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size:0.75rem; color:var(--oc-text-muted); display:block; margin-bottom:4px; font-weight:600;">MODEL</label>
                                <select class="oc-input" id="ai-model-select" style="padding:6px 10px; font-size:0.85rem;">
                                    ${renderModelOptions(aiChatActiveProvider, aiChatActiveModel)}
                                </select>
                            </div>
                            <div>
                                <label style="font-size:0.75rem; color:var(--oc-text-muted); display:block; margin-bottom:4px; font-weight:600;">THINKING LEVEL</label>
                                <select class="oc-input" id="ai-thinking-select" style="padding:6px 10px; font-size:0.85rem;">
                                    ${renderThinkingOptions(aiChatActiveModel, aiChatThinkingLevel)}
                                </select>
                            </div>
                            <div>
                                <label style="font-size:0.75rem; color:var(--oc-text-muted); display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-weight:600;">
                                    <span>AUTO FALLBACK</span>
                                    <span class="status-tag ${aiChatAutoFallback ? 'active' : 'waiting'}" id="ai-fallback-badge" style="font-size:0.65rem;">
                                        ${aiChatAutoFallback ? 'ON' : 'OFF'}
                                    </span>
                                </label>
                                <div style="display:flex; align-items:center; gap:8px; background:var(--oc-bg); padding:6px 10px; border:1px solid var(--oc-border); border-radius:4px;">
                                    <input type="checkbox" id="ai-auto-fallback-toggle" ${aiChatAutoFallback ? 'checked' : ''} style="cursor:pointer; accent-color:var(--oc-cyan);">
                                    <label for="ai-auto-fallback-toggle" style="font-size:0.75rem; color:var(--oc-text-secondary); cursor:pointer;">
                                        Downgrade on rate limit or 429 quota exhaustion
                                    </label>
                                </div>
                            </div>
                            <div style="font-size:0.75rem; color:var(--oc-text-muted); display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px solid var(--oc-border);">
                                <span>Google Keys:</span>
                                <span style="color:var(--oc-cyan); font-weight:700;">${vaultProviders['GOOGLE']?.healthyKeys || 0} healthy / ${vaultProviders['GOOGLE']?.totalKeys || 0} configured</span>
                            </div>
                        </div>
                    </div>

                    <!-- Multi-Provider Key Vault Dashboard -->
                    <div class="vault-card" style="flex:1; overflow-y:auto; max-height:480px;">
                        <div class="vault-card-header">
                            <div>
                                <span style="font-weight:700; color:var(--oc-text-primary); font-size:0.9rem;">API Key Vault</span>
                                <div style="font-size:0.75rem; color:var(--oc-text-muted);">Encrypted at Rest • Auto-Rotation • .env Fallback</div>
                            </div>
                            <span class="status-tag healthy" style="font-size:0.7rem;">AES-256</span>
                        </div>

                        <!-- Provider Cards Grid -->
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
                            ${['GOOGLE', 'ANTHROPIC', 'OPENAI', 'XAI'].map(pName => {
                                const pData = vaultProviders[pName] || { totalKeys: 0, healthyKeys: 0, rateLimitedKeys: 0 };
                                return `
                                    <div style="background:var(--oc-bg); border:1px solid var(--oc-border); border-radius:4px; padding:8px 10px;">
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <div style="font-weight:700; font-size:0.78rem; color:var(--oc-text-primary);">${pName}</div>
                                            <button class="btn-secondary test-provider-btn" data-provider="${pName}" style="padding:2px 6px; font-size:0.65rem; border-color:var(--oc-cyan); color:var(--oc-cyan);" title="Test connection for ${pName}">⚡ Test</button>
                                        </div>
                                        <div style="font-size:0.72rem; color:var(--oc-cyan); margin-top:2px;">${pData.healthyKeys} / ${pData.totalKeys} Healthy</div>
                                        ${pData.rateLimitedKeys > 0 ? `<div style="font-size:0.7rem; color:var(--oc-gold);">(${pData.rateLimitedKeys} cooldown)</div>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <!-- Configured Keys List for Active Provider -->
                        <div style="margin-top:12px;">
                            <div style="font-size:0.78rem; font-weight:700; color:var(--oc-text-secondary); margin-bottom:8px;">
                                Configured ${escapeHtml(aiChatActiveProvider)} Keys
                            </div>

                            <div id="ai-keys-list-container">
                                ${renderKeysList(vaultProviders[aiChatActiveProvider]?.keys || [])}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Add Key Modal -->
            <div id="ai-key-modal" class="cmd-modal-backdrop" style="display:none; align-items:center; justify-content:center;">
                <div class="cmd-modal" style="max-width:500px; padding:24px; background:var(--oc-surface); border:1px solid var(--oc-border); border-radius:var(--oc-radius);">
                    <h3 style="color:var(--oc-text-primary); margin-bottom:16px;">Add Provider API Key</h3>
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <label style="font-size:0.75rem; color:var(--oc-text-muted); display:block; margin-bottom:4px;">PROVIDER</label>
                            <select class="oc-input" id="modal-key-provider">
                                <option value="GOOGLE">Google Gemini</option>
                                <option value="ANTHROPIC">Anthropic Claude</option>
                                <option value="OPENAI">OpenAI</option>
                                <option value="XAI">xAI Grok</option>
                                <option value="OPENROUTER">OpenRouter</option>
                                <option value="GROQ">Groq</option>
                                <option value="MISTRAL">Mistral</option>
                                <option value="TOGETHER">Together</option>
                                <option value="DEEPSEEK">DeepSeek</option>
                                <option value="CUSTOM">Custom OpenAI-Compatible</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.75rem; color:var(--oc-text-muted); display:block; margin-bottom:4px;">KEY LABEL</label>
                            <input type="text" class="oc-input" id="modal-key-label" placeholder="e.g. Google Key 01 (Production)">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; color:var(--oc-text-muted); display:block; margin-bottom:4px;">API SECRET (Stored encrypted, never exposed)</label>
                            <input type="password" class="oc-input" id="modal-key-secret" placeholder="Paste API key secret here...">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; color:var(--oc-text-muted); display:block; margin-bottom:4px;">PRIORITY (1 = Highest)</label>
                            <input type="number" class="oc-input" id="modal-key-priority" value="1" min="1" max="10">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; color:var(--oc-text-muted); display:block; margin-bottom:4px;">CUSTOM BASE URL (Optional for custom gateways)</label>
                            <input type="text" class="oc-input" id="modal-key-url" placeholder="https://api.openai.com/v1">
                        </div>
                        <div id="modal-test-feedback" style="display:none; padding:8px 10px; border-radius:4px; font-size:0.78rem;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
                        <button type="button" id="modal-test-key-btn" class="btn-secondary" style="font-size:0.8rem; border-color:var(--oc-cyan); color:var(--oc-cyan);">⚡ Test Key</button>
                        <div style="display:flex; gap:10px;">
                            <button id="modal-cancel-key-btn" class="btn-secondary">Cancel</button>
                            <button id="modal-save-key-btn" class="btn-primary">Save to Vault</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Helper: Render Messages
        function renderChatMessage(m) {
            const isUser = m.role === 'user';
            const plan = (m.plan_json && m.plan_json.summary) ? m.plan_json : null;
            const exec = m.execution_json;
            const fallback = m.fallback || m.execution_json?.fallback || m.plan_json?.fallback;

            return `
                <div class="ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-asst'}">
                    <div class="ai-msg-avatar">${isUser ? '👤' : '🤖'}</div>
                    <div class="ai-msg-body">
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.75rem; color:var(--oc-text-muted);">
                            <span style="font-weight:700; color:var(--oc-text-secondary);">${isUser ? 'OWNER' : 'PROJECT AGENT'}</span>
                            <span>${new Date(m.created_at).toLocaleTimeString()}</span>
                        </div>
                        <div style="color:var(--oc-text-primary); white-space:pre-wrap;">${escapeHtml(m.content)}</div>

                        <!-- Fallback Notice Banner (if model fallback occurred) -->
                        ${fallback ? `
                            <div style="background:rgba(255, 179, 0, 0.12); border:1px solid var(--oc-gold); border-radius:6px; padding:10px 14px; margin-top:10px; display:flex; align-items:center; gap:10px;">
                                <span style="font-size:1.1rem; color:var(--oc-gold);">⚠️</span>
                                <div style="font-size:0.8rem; color:var(--oc-text-primary);">
                                    <strong style="color:var(--oc-gold);">AUTO FALLBACK APPLIED:</strong> 
                                    Requested <code style="color:var(--oc-text-muted);">${escapeHtml(fallback.originalModel || 'selected model')}</code> ➔ Active <code style="color:var(--oc-cyan); font-weight:700;">${escapeHtml(fallback.activeModel || 'fallback model')}</code>
                                    <div style="color:var(--oc-text-muted); font-size:0.75rem; margin-top:2px;">Reason: ${escapeHtml(fallback.reason || 'Quota limit or unavailability')}</div>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Structured Action Plan Card -->
                        ${plan ? `
                            <div class="ai-plan-card">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <span style="font-weight:700; color:var(--oc-gold); font-size:0.82rem;">📋 CURATORIAL EXECUTION PLAN</span>
                                    ${!exec ? `<span class="status-tag pending" style="font-size:0.7rem;">Awaiting Approval</span>` : `<span class="status-tag active" style="font-size:0.7rem;">Executed</span>`}
                                </div>
                                <div style="font-weight:600; font-size:0.85rem; color:var(--oc-text-primary);">${escapeHtml(plan.summary || '')}</div>

                                ${plan.filesToChange?.length ? `
                                    <div style="margin-top:8px;">
                                        <span style="font-size:0.72rem; color:var(--oc-text-muted); font-weight:600;">FILES TO MODIFY:</span>
                                        <div class="ai-tag-group">${plan.filesToChange.map(f => `<span class="ai-badge change">${escapeHtml(f)}</span>`).join('')}</div>
                                    </div>
                                ` : ''}

                                ${plan.filesToCreate?.length ? `
                                    <div style="margin-top:6px;">
                                        <span style="font-size:0.72rem; color:var(--oc-text-muted); font-weight:600;">FILES TO CREATE:</span>
                                        <div class="ai-tag-group">${plan.filesToCreate.map(f => `<span class="ai-badge create">${escapeHtml(f)}</span>`).join('')}</div>
                                    </div>
                                ` : ''}

                                ${!exec ? `
                                    <div style="display:flex; gap:10px; margin-top:14px;">
                                        <button class="btn-primary approve-plan-btn" data-msg-id="${m.id}" style="padding:6px 16px; font-size:0.82rem; background:var(--oc-emerald); border-color:var(--oc-emerald); color:#000; font-weight:700;">
                                            ✓ Approve & Execute Plan
                                        </button>
                                        <button class="btn-secondary cancel-plan-btn" data-msg-id="${m.id}" style="padding:6px 14px; font-size:0.82rem;">
                                            Dismiss
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}

                        <!-- Execution Results Card -->
                        ${exec ? `
                            <div class="ai-exec-card">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <span style="font-weight:700; color:var(--oc-emerald); font-size:0.82rem;">⚡ EXECUTION REPORT & VERIFICATION</span>
                                    <span class="status-tag healthy" style="font-size:0.7rem;">SNAPSHOT SAVED</span>
                                </div>

                                ${exec.filesCreated?.length ? `
                                    <div style="margin-top:6px;">
                                        <span style="font-size:0.72rem; color:var(--oc-text-muted); font-weight:600;">CREATED:</span>
                                        <div class="ai-tag-group">${exec.filesCreated.map(f => `<span class="ai-badge create">+ ${escapeHtml(f)}</span>`).join('')}</div>
                                    </div>
                                ` : ''}

                                ${exec.filesChanged?.length ? `
                                    <div style="margin-top:6px;">
                                        <span style="font-size:0.72rem; color:var(--oc-text-muted); font-weight:600;">MODIFIED:</span>
                                        <div class="ai-tag-group">${exec.filesChanged.map(f => `<span class="ai-badge change">✎ ${escapeHtml(f)}</span>`).join('')}</div>
                                    </div>
                                ` : ''}

                                ${exec.dataChanges?.length ? `
                                    <div style="margin-top:6px; font-size:0.8rem; color:var(--oc-text-secondary);">
                                        <strong>DATABASE:</strong> ${exec.dataChanges.map(d => escapeHtml(d)).join(' • ')}
                                    </div>
                                ` : ''}

                                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; font-size:0.75rem; color:var(--oc-text-muted);">
                                    <span>Snapshot ID: <code style="color:var(--oc-cyan);">${escapeHtml(exec.snapshotId?.slice(0, 8))}...</code></span>
                                    <button class="btn-secondary rollback-snapshot-btn" data-snapshot-id="${exec.snapshotId}" style="padding:4px 10px; font-size:0.75rem; border-color:var(--oc-crimson); color:var(--oc-crimson);">
                                        ↺ Rollback This Change
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // Helper: Render Keys List
        function renderKeysList(keyList = []) {
            if (!keyList.length) {
                return '<div style="color:var(--oc-text-muted); font-size:0.8rem; padding:12px 0;">No keys configured for this provider. Click "+ Add API Key" above.</div>';
            }

            return keyList.map(k => `
                <div class="key-item">
                    <div>
                        <div style="font-weight:600; color:var(--oc-text-primary);">${escapeHtml(k.label)}</div>
                        <div style="font-family:var(--oc-font-mono); font-size:0.75rem; color:var(--oc-cyan); margin-top:2px;">
                            ${escapeHtml(k.key_suffix)} • Priority ${k.priority}
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="status-tag ${k.is_cooling_down ? 'waiting' : (k.health === 'HEALTHY' ? 'healthy' : 'suspended')}" style="font-size:0.68rem;">
                            ${k.is_cooling_down ? 'COOLDOWN' : escapeHtml(k.health)}
                        </span>
                        <button class="btn-secondary test-key-btn" data-id="${k.id}" style="padding:3px 7px; font-size:0.72rem;">Test</button>
                        <button class="btn-secondary toggle-key-btn" data-id="${k.id}" data-enabled="${k.is_enabled}" style="padding:3px 7px; font-size:0.72rem;">
                            ${k.is_enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn-danger delete-key-btn" data-id="${k.id}" style="padding:3px 7px; font-size:0.72rem;">✕</button>
                    </div>
                </div>
            `).join('');
        }

        // Event Handlers for Composer & Chat
        const promptInput = document.getElementById('ai-prompt-input');
        const sendBtn = document.getElementById('ai-send-btn');
        const streamContainer = document.getElementById('ai-chat-stream');

        // Scroll to bottom
        if (streamContainer) streamContainer.scrollTop = streamContainer.scrollHeight;

        // Example chips click
        document.querySelectorAll('.example-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                if (promptInput) {
                    promptInput.value = chip.dataset.prompt;
                    promptInput.focus();
                }
            });
        });

        // Mode switchers
        document.querySelectorAll('.mode-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                aiChatActiveMode = btn.dataset.mode;
                document.querySelectorAll('.mode-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Send Command
        async function sendCommand() {
            const prompt = promptInput?.value.trim();
            if (!prompt) return;

            const attachments = document.getElementById('ai-attachments-input')?.value.split(',').map(s => s.trim()).filter(Boolean);
            sendBtn.disabled = true;
            sendBtn.textContent = 'Executing...';

            // Immediate optimistic message append
            const userMsgHtml = `
                <div class="ai-msg ai-msg-user">
                    <div class="ai-msg-avatar">👤</div>
                    <div class="ai-msg-body">
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.75rem; color:var(--oc-text-muted);">
                            <span style="font-weight:700; color:var(--oc-text-secondary);">OWNER</span>
                            <span>${new Date().toLocaleTimeString()}</span>
                        </div>
                        <div style="color:var(--oc-text-primary); white-space:pre-wrap;">${escapeHtml(prompt)}</div>
                    </div>
                </div>
            `;
            const typingHtml = `
                <div id="ai-typing-indicator" class="ai-msg ai-msg-asst">
                    <div class="ai-msg-avatar">🤖</div>
                    <div class="ai-msg-body">
                        <div style="display:flex; align-items:center; gap:8px; color:var(--oc-cyan); font-size:0.85rem;">
                            <span>Project Agent thinking via ${escapeHtml(aiChatActiveProvider)} (${escapeHtml(aiChatActiveModel)})${aiChatThinkingLevel !== 'off' ? ` [Thinking: ${escapeHtml(aiChatThinkingLevel)}]` : ''}...</span>
                            <span style="display:inline-block; width:12px; height:12px; border:2px solid var(--oc-border); border-top-color:var(--oc-cyan); border-radius:50%; animation: spin 0.8s linear infinite;"></span>
                        </div>
                    </div>
                </div>
            `;

            if (streamContainer) {
                // Clear welcome placeholder if present
                const placeholder = streamContainer.querySelector('.example-chips')?.closest('div');
                if (placeholder) placeholder.remove();

                streamContainer.insertAdjacentHTML('beforeend', userMsgHtml);
                streamContainer.insertAdjacentHTML('beforeend', typingHtml);
                streamContainer.scrollTop = streamContainer.scrollHeight;
            }

            if (promptInput) promptInput.value = '';

            try {
                const res = await fetchAPI('/api/owner/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversationId: aiChatActiveConvId,
                        prompt,
                        mode: aiChatActiveMode,
                        provider: aiChatActiveProvider,
                        model: aiChatActiveModel,
                        thinkingLevel: aiChatThinkingLevel === 'off' ? null : aiChatThinkingLevel,
                        autoFallback: !!aiChatAutoFallback,
                        attachments
                    })
                });

                if (res.error) {
                    alert('Error: ' + res.error);
                    document.getElementById('ai-typing-indicator')?.remove();
                } else {
                    aiChatActiveConvId = res.conversationId;
                    renderAIChat();
                }
            } catch (e) {
                alert('Fatal: ' + e.message);
                document.getElementById('ai-typing-indicator')?.remove();
            } finally {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send Command ➔';
            }
        }

        sendBtn?.addEventListener('click', sendCommand);
        promptInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendCommand();
            }
        });

        // Approve Plan
        document.querySelectorAll('.approve-plan-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.textContent = 'Executing Plan...';
                const res = await fetchAPI('/api/owner/ai/chat/approve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId: btn.dataset.msgId })
                });
                if (res.error) alert('Execution failed: ' + res.error);
                renderAIChat();
            });
        });

        // Rollback buttons
        document.querySelectorAll('.rollback-snapshot-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to rollback this change? Files will be restored to their pre-execution state.')) return;
                const res = await fetchAPI('/api/owner/ai/chat/rollback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ snapshotId: btn.dataset.snapshotId })
                });
                if (res.error) alert('Rollback error: ' + res.error);
                else {
                    alert(res.message || 'Rollback completed successfully.');
                    renderAIChat();
                }
            });
        });

        document.getElementById('ai-rollback-btn')?.addEventListener('click', async () => {
            if (!confirm('Rollback the most recent autonomous change?')) return;
            const res = await fetchAPI('/api/owner/ai/chat/rollback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            if (res.error) alert('Rollback error: ' + res.error);
            else {
                alert(res.message || 'Rollback completed successfully.');
                renderAIChat();
            }
        });

        // New Chat
        document.getElementById('ai-new-chat-btn')?.addEventListener('click', async () => {
            const res = await fetchAPI('/api/owner/ai/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Engineering Session #' + (conversations.length + 1),
                    provider: aiChatActiveProvider,
                    model: aiChatActiveModel,
                    mode: aiChatActiveMode
                })
            });
            if (res.success) {
                aiChatActiveConvId = res.conversation.id;
                renderAIChat();
            }
        });

        // Clear Chat
        document.getElementById('ai-clear-chat-btn')?.addEventListener('click', async () => {
            if (aiChatActiveConvId) {
                await fetchAPI(`/api/owner/ai/conversations/${aiChatActiveConvId}`, { method: 'DELETE' });
                aiChatActiveConvId = null;
                renderAIChat();
            }
        });

        // Provider & Model Selectors
        const providerSelect = document.getElementById('ai-provider-select');
        providerSelect?.addEventListener('change', () => {
            aiChatActiveProvider = providerSelect.value;
            // Set default model for the new provider if previous model wasn't an alias
            if (!['FAST', 'BALANCED', 'POWERFUL', 'IMAGE'].includes(aiChatActiveModel)) {
                aiChatActiveModel = aiChatActiveProvider === 'GOOGLE' ? 'gemini-3.1-flash-lite' : 'FAST';
            }
            renderAIChat();
        });

        const modelSelect = document.getElementById('ai-model-select');
        const thinkingSelect = document.getElementById('ai-thinking-select');
        const fallbackToggle = document.getElementById('ai-auto-fallback-toggle');
        const fallbackBadge = document.getElementById('ai-fallback-badge');

        modelSelect?.addEventListener('change', () => {
            aiChatActiveModel = modelSelect.value;
            // Dynamically update supported thinking levels for this model
            if (thinkingSelect) {
                thinkingSelect.innerHTML = renderThinkingOptions(aiChatActiveModel, aiChatThinkingLevel);
                aiChatThinkingLevel = thinkingSelect.value;
            }
        });

        thinkingSelect?.addEventListener('change', () => {
            aiChatThinkingLevel = thinkingSelect.value;
        });

        fallbackToggle?.addEventListener('change', () => {
            aiChatAutoFallback = fallbackToggle.checked;
            if (fallbackBadge) {
                fallbackBadge.textContent = aiChatAutoFallback ? 'ON' : 'OFF';
                fallbackBadge.className = `status-tag ${aiChatAutoFallback ? 'active' : 'waiting'}`;
            }
        });

        // Provider Connection Test Buttons (Grid)
        document.querySelectorAll('.test-provider-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const p = btn.dataset.provider;
                btn.disabled = true;
                btn.textContent = '...';
                try {
                    const testPayload = (p === aiChatActiveProvider && aiChatActiveModel)
                        ? { model: aiChatActiveModel }
                        : {};
                    const res = await fetchAPI(`/api/owner/ai/providers/${p.toLowerCase()}/test`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(testPayload)
                    });
                    if (res.success) {
                        alert(`[${p}] Connection Test Passed!\nStatus: ${res.status}\nModel: ${res.model || 'default'}\nLatency: ${res.latencyMs || 0}ms`);
                    } else {
                        alert(`[${p}] Connection Test Result:\nStatus: ${res.status}\nDetails: ${res.error || 'Not configured'}`);
                    }
                } catch (err) {
                    alert(`[${p}] Test request failed: ${err.message}`);
                } finally {
                    btn.disabled = false;
                    btn.textContent = '⚡ Test';
                }
            });
        });

        // Key Vault Operations
        document.querySelectorAll('.test-key-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.textContent = 'Testing...';
                const res = await fetchAPI(`/api/owner/ai/vault/keys/${btn.dataset.id}/test`, { method: 'POST' });
                if (res.success) alert(res.message);
                else alert('Test Failed: ' + (res.error || 'Unknown error'));
                renderAIChat();
            });
        });

        document.querySelectorAll('.toggle-key-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const next = btn.dataset.enabled !== '1';
                await fetchAPI(`/api/owner/ai/vault/keys/${btn.dataset.id}/toggle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isEnabled: next })
                });
                renderAIChat();
            });
        });

        document.querySelectorAll('.delete-key-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this API key from the vault?')) return;
                await fetchAPI(`/api/owner/ai/vault/keys/${btn.dataset.id}`, { method: 'DELETE' });
                renderAIChat();
            });
        });

        // Add Key Modal
        const keyModal = document.getElementById('ai-key-modal');
        const testFeedback = document.getElementById('modal-test-feedback');
        document.getElementById('ai-add-key-btn')?.addEventListener('click', () => {
            if (keyModal) {
                if (testFeedback) {
                    testFeedback.style.display = 'none';
                    testFeedback.innerHTML = '';
                }
                keyModal.style.display = 'flex';
            }
        });

        document.getElementById('modal-cancel-key-btn')?.addEventListener('click', () => {
            if (keyModal) keyModal.style.display = 'none';
        });

        // Test Raw Key inside Add Modal
        document.getElementById('modal-test-key-btn')?.addEventListener('click', async () => {
            const provider = document.getElementById('modal-key-provider').value;
            const apiKey = document.getElementById('modal-key-secret').value.trim();
            const customBaseUrl = document.getElementById('modal-key-url').value.trim();
            const testBtn = document.getElementById('modal-test-key-btn');

            if (!apiKey) {
                alert('Please enter an API secret to test.');
                return;
            }

            testBtn.disabled = true;
            testBtn.textContent = 'Testing...';
            if (testFeedback) {
                testFeedback.style.display = 'block';
                testFeedback.style.background = 'var(--oc-surface-raised)';
                testFeedback.style.color = 'var(--oc-cyan)';
                testFeedback.style.border = '1px solid var(--oc-border)';
                testFeedback.innerHTML = `Testing ${escapeHtml(provider)} key connectivity via official SDK...`;
            }

            try {
                const res = await fetchAPI('/api/owner/ai/vault/test-raw-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider, apiKey, customBaseUrl })
                });

                if (res.success) {
                    testFeedback.style.background = 'rgba(0, 230, 118, 0.15)';
                    testFeedback.style.border = '1px solid var(--oc-emerald)';
                    testFeedback.style.color = 'var(--oc-emerald)';
                    testFeedback.innerHTML = `✓ Connection Successful! Status: ${escapeHtml(res.status)} (${res.latencyMs || 0}ms)`;
                } else {
                    testFeedback.style.background = 'rgba(255, 42, 109, 0.15)';
                    testFeedback.style.border = '1px solid var(--oc-crimson)';
                    testFeedback.style.color = 'var(--oc-crimson)';
                    testFeedback.innerHTML = `✕ Test Failed: ${escapeHtml(res.status || 'ERROR')} — ${escapeHtml(res.error || 'Unauthorized')}`;
                }
            } catch (err) {
                if (testFeedback) {
                    testFeedback.style.background = 'rgba(255, 42, 109, 0.15)';
                    testFeedback.style.border = '1px solid var(--oc-crimson)';
                    testFeedback.style.color = 'var(--oc-crimson)';
                    testFeedback.innerHTML = `✕ Network error testing key: ${escapeHtml(err.message)}`;
                }
            } finally {
                testBtn.disabled = false;
                testBtn.textContent = '⚡ Test Key';
            }
        });

        document.getElementById('modal-save-key-btn')?.addEventListener('click', async () => {
            const provider = document.getElementById('modal-key-provider').value;
            const label = document.getElementById('modal-key-label').value.trim();
            const apiKey = document.getElementById('modal-key-secret').value.trim();
            const priority = document.getElementById('modal-key-priority').value;
            const customBaseUrl = document.getElementById('modal-key-url').value.trim();

            if (!label || !apiKey) {
                alert('Label and API Key are required.');
                return;
            }

            const res = await fetchAPI('/api/owner/ai/vault/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, label, apiKey, priority, customBaseUrl })
            });

            if (res.error) alert('Error: ' + res.error);
            else {
                alert('API Key safely encrypted and stored in vault.');
                if (keyModal) keyModal.style.display = 'none';
                renderAIChat();
            }
        });
    }

    // Initial render
    setActiveTab(currentTab);
});
