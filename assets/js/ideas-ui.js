/**
 * NostalgicVerse Community Ideas & Submissions UI (Phase 12)
 * Manages public ideas, user submissions, status tracking, and new submissions.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const contentArea = document.getElementById('ideas-content-area');
    if (!contentArea) return;

    let currentUser = null;
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) currentUser = (await res.json()).user;
    } catch(e) {}

    const tabs = document.querySelectorAll('.social-tab');
    let currentTab = 'ideas-public';

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            render();
        });
    });

    async function fetchAPI(url, options={}) {
        try {
            const res = await fetch(url, options);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            return data;
        } catch(e) { return { error: e.message }; }
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

    function render() {
        if (currentTab === 'ideas-public') {
            loadPublicIdeas();
        } else if (currentTab === 'ideas-my') {
            if (!currentUser) return window.location.href = '/login/';
            loadMySubmissions();
        } else if (currentTab === 'ideas-new') {
            if (!currentUser) return window.location.href = '/login/';
            contentArea.innerHTML = `
                <form id="new-idea-form" class="form-block" style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:28px; border-radius:8px; max-width:650px;">
                    <h3 style="margin-top:0; color:var(--nv-text-primary); margin-bottom:16px;">Contribute to NostalgicVerse</h3>
                    <div style="margin-bottom:14px;">
                        <label class="auth-label">Contribution Category</label>
                        <select id="idea-type" class="auth-input" required style="background:var(--nv-bg); color:var(--nv-text-primary);">
                            <option value="Idea">Site Idea or Feature</option>
                            <option value="Game">Missing Game Exhibit</option>
                            <option value="Console">Missing Console Hardware</option>
                            <option value="Correction">Archive Correction</option>
                            <option value="Compatibility">Emulator Compatibility Record</option>
                        </select>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label class="auth-label">Title</label>
                        <input type="text" id="idea-title" class="auth-input" placeholder="Title or name of the exhibit" required>
                    </div>
                    <div style="margin-bottom:16px;">
                        <label class="auth-label">Details & Historical Sources</label>
                        <textarea id="idea-desc" class="auth-input" rows="5" placeholder="Description, release facts, references, or verified documentation..." required style="resize:vertical;"></textarea>
                    </div>
                    <button type="submit" id="idea-submit-btn" class="social-btn primary" style="width:auto; padding:10px 24px;">Submit for Review</button>
                    <div id="idea-err" style="color:var(--nv-crimson); font-size:0.9rem; margin-top:12px; display:none;"></div>
                </form>
            `;
            document.getElementById('new-idea-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('idea-submit-btn');
                const errDiv = document.getElementById('idea-err');
                btn.disabled = true;
                btn.textContent = 'Submitting...';
                errDiv.style.display = 'none';

                const type = document.getElementById('idea-type').value;
                const title = document.getElementById('idea-title').value;
                const description = document.getElementById('idea-desc').value;
                const res = await fetchAPI('/api/submissions', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({type, title, description})
                });
                if (res.success) {
                    const myTab = document.querySelector('[data-tab="ideas-my"]');
                    if (myTab) myTab.click();
                } else {
                    errDiv.textContent = res.error || 'Failed to submit';
                    errDiv.style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'Submit for Review';
                }
            });
        }
    }

    async function loadPublicIdeas() {
        contentArea.innerHTML = `
            <div style="text-align:center; padding: 48px 20px;">
                <div style="display:inline-block; width:36px; height:36px; border:3px solid var(--nv-border); border-top-color:var(--nv-cyan); border-radius:50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top:14px; color:var(--nv-text-muted); font-size:0.9rem;">Loading community ideas...</p>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;

        const data = await fetchAPI('/api/submissions/public/ideas');
        if (data.error) {
            contentArea.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:8px;">
                    <h4 style="color:var(--nv-crimson); margin-bottom:8px;">Failed to Load Public Ideas</h4>
                    <p style="color:var(--nv-text-secondary); margin-bottom:16px;">${escapeHtml(data.error)}</p>
                    <button id="ideas-retry-btn" class="social-btn primary" style="padding:6px 20px;">Retry</button>
                </div>
            `;
            document.getElementById('ideas-retry-btn')?.addEventListener('click', loadPublicIdeas);
            return;
        }
        
        if (!data.ideas || data.ideas.length === 0) {
            contentArea.innerHTML = `
                <div style="text-align:center; padding: 48px 20px; background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:8px;">
                    <h3 style="color:var(--nv-gold); margin-bottom: 8px;">No approved community ideas yet</h3>
                    <p style="color:var(--nv-text-muted); margin-bottom: 20px; font-size:0.92rem;">Have a proposal for a missing game or site feature?</p>
                    <button class="social-btn primary" onclick="document.querySelector('[data-tab=\\'ideas-new\\']').click()">Submit an Idea</button>
                </div>
            `;
        } else {
            contentArea.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${data.ideas.map(i => `
                        <div class="social-list-item" style="flex-direction:column; align-items:flex-start; gap:8px; background:var(--nv-surface); border:1px solid var(--nv-border); padding:16px 20px; border-radius:8px;">
                            <h4 style="margin:0; font-size:1.05rem; color:var(--nv-text-primary);">${escapeHtml(i.title)}</h4>
                            <p style="margin:0; font-size:0.92rem; color:var(--nv-text-secondary); line-height:1.45;">${escapeHtml(i.description || '')}</p>
                            <p style="margin:4px 0 0; font-size:0.8rem; color:var(--nv-text-muted);">Submitted by ${escapeHtml(i.display_name || i.username)} &bull; ${new Date(i.created_at).toLocaleDateString()}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    async function loadMySubmissions() {
        contentArea.innerHTML = `
            <div style="text-align:center; padding: 48px 20px;">
                <div style="display:inline-block; width:36px; height:36px; border:3px solid var(--nv-border); border-top-color:var(--nv-cyan); border-radius:50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top:14px; color:var(--nv-text-muted); font-size:0.9rem;">Loading your submissions...</p>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;

        const data = await fetchAPI('/api/submissions');
        if (data.error) {
            contentArea.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:8px;">
                    <h4 style="color:var(--nv-crimson); margin-bottom:8px;">Failed to Load Submissions</h4>
                    <p style="color:var(--nv-text-secondary); margin-bottom:16px;">${escapeHtml(data.error)}</p>
                    <button id="subs-retry-btn" class="social-btn primary" style="padding:6px 20px;">Retry</button>
                </div>
            `;
            document.getElementById('subs-retry-btn')?.addEventListener('click', loadMySubmissions);
            return;
        }
        
        if (!data.submissions || data.submissions.length === 0) {
            contentArea.innerHTML = `
                <div style="text-align:center; padding: 48px 20px; background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:8px;">
                    <h3 style="color:var(--nv-gold); margin-bottom: 8px;">No submissions found</h3>
                    <p style="color:var(--nv-text-muted); margin-bottom: 20px; font-size:0.92rem;">You haven't submitted any suggestions or exhibits yet.</p>
                    <button class="social-btn primary" onclick="document.querySelector('[data-tab=\\'ideas-new\\']').click()">Submit New Idea</button>
                </div>
            `;
        } else {
            contentArea.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${data.submissions.map(s => {
                        let badgeBg = 'var(--nv-border)';
                        let badgeColor = 'var(--nv-text-secondary)';
                        if (s.status === 'APPROVED' || s.status === 'PUBLISHED') {
                            badgeBg = 'var(--nv-cyan)';
                            badgeColor = '#000';
                        } else if (s.status === 'PENDING_REVIEW') {
                            badgeBg = 'var(--nv-gold)';
                            badgeColor = '#000';
                        } else if (s.status === 'REJECTED') {
                            badgeBg = 'var(--nv-crimson)';
                            badgeColor = '#fff';
                        } else if (s.status === 'ENHANCEMENT_REQUESTED') {
                            badgeBg = 'rgba(0, 229, 255, 0.2)';
                            badgeColor = 'var(--nv-cyan)';
                        }

                        return `
                            <div class="social-list-item" style="justify-content:space-between; align-items:center; background:var(--nv-surface); border:1px solid var(--nv-border); padding:16px 20px; border-radius:8px; flex-wrap:wrap; gap:10px;">
                                <div class="social-info" style="flex:1; min-width:200px;">
                                    <h4 style="margin:0; font-size:1.05rem; color:var(--nv-text-primary);">${escapeHtml(s.title)}</h4>
                                    <p style="margin:4px 0 0; font-size:0.85rem; color:var(--nv-text-muted);">Type: ${escapeHtml(s.submission_type)} &bull; Submitted ${new Date(s.created_at).toLocaleDateString()}</p>
                                </div>
                                <span style="font-size:0.75rem; font-weight:700; background:${badgeBg}; color:${badgeColor}; padding:3px 10px; border-radius:4px; text-transform:uppercase;">${escapeHtml(s.status.replace(/_/g, ' '))}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    render();
});
