/**
 * NostalgicVerse Support UI Engine (Phase 12)
 * Manages ticket creation, conversation reply threads, and ticket statuses.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const contentArea = document.getElementById('support-content-area');
    if (!contentArea) return;

    let currentUser = null;
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) currentUser = (await res.json()).user;
        else return window.location.href = '/login/';
    } catch(e) { return window.location.href = '/login/'; }

    const tabs = document.querySelectorAll('.social-tab');
    let currentTab = 'support-my';

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
        if (currentTab === 'support-new') {
            contentArea.innerHTML = `
                <form id="new-ticket-form" class="form-block" style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:28px; border-radius:8px; max-width:650px;">
                    <h3 style="margin-top:0; color:var(--nv-text-primary); margin-bottom:16px;">Create Support Request</h3>
                    <div style="margin-bottom:14px;">
                        <label class="auth-label">Subject</label>
                        <input type="text" id="ticket-subject" class="auth-input" placeholder="Summary of the issue" required>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label class="auth-label">Category</label>
                        <select id="ticket-category" class="auth-input" required style="background:var(--nv-bg); color:var(--nv-text-primary);">
                            <option value="">Select Category...</option>
                            <option value="Website Issue">Website Issue</option>
                            <option value="Account Problem">Account Problem</option>
                            <option value="Content Correction">Content Correction</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div style="margin-bottom:16px;">
                        <label class="auth-label">Message Details</label>
                        <textarea id="ticket-message" class="auth-input" rows="5" placeholder="Describe what happened or how we can assist..." required style="resize:vertical;"></textarea>
                    </div>
                    <button type="submit" id="ticket-submit-btn" class="social-btn primary" style="width:auto; padding:10px 24px;">Submit Ticket</button>
                    <div id="ticket-err" style="color:var(--nv-crimson); font-size:0.9rem; margin-top:12px; display:none;"></div>
                </form>
            `;
            document.getElementById('new-ticket-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('ticket-submit-btn');
                const errDiv = document.getElementById('ticket-err');
                btn.disabled = true;
                btn.textContent = 'Submitting...';
                errDiv.style.display = 'none';

                const subject = document.getElementById('ticket-subject').value;
                const category = document.getElementById('ticket-category').value;
                const message = document.getElementById('ticket-message').value;
                const res = await fetchAPI('/api/support/tickets', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({subject, category, message})
                });
                if (res.success) {
                    const myTab = document.querySelector('[data-tab="support-my"]');
                    if (myTab) myTab.click();
                } else {
                    errDiv.textContent = res.error || 'Failed to submit ticket';
                    errDiv.style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'Submit Ticket';
                }
            });
        } 
        else if (currentTab === 'support-my') {
            loadTickets();
        }
    }

    async function loadTickets() {
        contentArea.innerHTML = `
            <div style="text-align:center; padding: 48px 20px;">
                <div style="display:inline-block; width:36px; height:36px; border:3px solid var(--nv-border); border-top-color:var(--nv-cyan); border-radius:50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top:14px; color:var(--nv-text-muted); font-size:0.9rem;">Loading your support requests...</p>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;

        const data = await fetchAPI('/api/support/tickets');
        if (data.error) {
            contentArea.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:8px;">
                    <h4 style="color:var(--nv-crimson); margin-bottom:8px;">Unable to Load Support Requests</h4>
                    <p style="color:var(--nv-text-secondary); margin-bottom:16px;">${escapeHtml(data.error)}</p>
                    <button id="support-retry-btn" class="social-btn primary" style="padding:6px 20px;">Retry</button>
                </div>
            `;
            document.getElementById('support-retry-btn')?.addEventListener('click', loadTickets);
            return;
        }
        
        if (!data.tickets || data.tickets.length === 0) {
            contentArea.innerHTML = `
                <div style="text-align:center; padding: 48px 20px; background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:8px;">
                    <h3 style="color:var(--nv-gold); margin-bottom: 8px;">No support requests yet</h3>
                    <p style="color:var(--nv-text-muted); margin-bottom: 20px; font-size:0.92rem;">Need assistance with your account, museum exhibits, or the archive?</p>
                    <button class="social-btn primary" onclick="document.querySelector('[data-tab=\\'support-new\\']').click()">Create Support Request</button>
                </div>
            `;
        } else {
            contentArea.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${data.tickets.map(t => {
                        const isClosed = t.status === 'CLOSED';
                        const isOpen = t.status === 'OPEN';
                        const badgeColor = isOpen ? 'var(--nv-gold)' : (isClosed ? 'var(--nv-text-muted)' : 'var(--nv-cyan)');
                        return `
                            <div class="social-list-item" style="flex-direction:column; align-items:flex-start; gap:10px; background:var(--nv-surface); border:1px solid var(--nv-border); padding:16px 20px; border-radius:8px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:8px;">
                                    <h4 style="margin:0; font-size:1.05rem; color:var(--nv-text-primary);">${escapeHtml(t.subject)}</h4>
                                    <span style="font-size:0.75rem; font-weight:700; color:#000; background:${badgeColor}; padding:2px 8px; border-radius:4px; text-transform:uppercase;">${escapeHtml(t.status)}</span>
                                </div>
                                <p style="margin:0; font-size:0.85rem; color:var(--nv-text-muted);">Category: ${escapeHtml(t.category)} &bull; Updated: ${new Date(t.updated_at || t.created_at).toLocaleString()}</p>
                                <button class="social-btn primary" onclick="viewTicket('${t.id}')" style="padding:5px 16px; font-size:0.85rem;">View Thread &rarr;</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    window.viewTicket = async (id) => {
        contentArea.innerHTML = '<p style="text-align:center; color:var(--nv-text-muted); padding:30px;">Loading ticket details...</p>';
        const data = await fetchAPI('/api/support/tickets/' + id);
        if (data.error) {
            contentArea.innerHTML = `<p style="color:var(--nv-crimson); padding:20px;">${escapeHtml(data.error)}</p>`;
            return;
        }
        
        const t = data.ticket;
        let html = `
            <button class="social-btn" onclick="document.querySelector('[data-tab=\\'support-my\\']').click()" style="margin-bottom:20px;">&larr; Back to Tickets</button>
            <div style="background:var(--nv-surface); padding:24px; border-radius:8px; border:1px solid var(--nv-border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <h2 style="margin:0; font-size:1.4rem; color:var(--nv-text-primary);">${escapeHtml(t.subject)}</h2>
                    <span style="font-size:0.8rem; font-weight:700; padding:3px 10px; border-radius:4px; background:${t.status === 'OPEN' ? 'var(--nv-gold)' : 'var(--nv-border)'}; color:${t.status === 'OPEN' ? '#000' : 'var(--nv-text-secondary)'};">${escapeHtml(t.status)}</span>
                </div>
                <p style="color:var(--nv-text-muted); font-size:0.85rem; margin-bottom:20px;">Category: ${escapeHtml(t.category)} &bull; Created ${new Date(t.created_at).toLocaleString()}</p>
                <hr style="border:0; border-bottom:1px solid var(--nv-border); margin:16px 0;">
                
                <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:24px;">
        `;
        
        (data.messages || []).forEach(m => {
            const isMe = m.sender_user_id === currentUser.id;
            html += `
                <div style="background:${isMe ? 'var(--nv-bg-alt)' : 'var(--nv-surface-raised)'}; padding:14px 18px; border-radius:8px; border:1px solid ${isMe ? 'var(--nv-border)' : 'var(--nv-border-strong)'};">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <strong style="color:${m.role === 'OWNER' ? 'var(--nv-gold)' : 'var(--nv-cyan)'}; font-size:0.9rem;">${escapeHtml(m.display_name || m.username || 'User')} ${m.role === 'OWNER' ? '(Staff)' : ''}</strong>
                        <span style="font-size:0.75rem; color:var(--nv-text-muted);">${new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <p style="margin:0; color:var(--nv-text-primary); font-size:0.92rem; line-height:1.45;">${escapeHtml(m.message)}</p>
                </div>
            `;
        });
        
        html += `
                </div>
                ${t.status !== 'CLOSED' ? `
                <form id="reply-form" style="display:flex; gap:10px;">
                    <input type="text" id="reply-input" class="auth-input" style="flex:1" placeholder="Type a reply to staff..." required>
                    <button type="submit" id="reply-submit-btn" class="social-btn primary" style="width:auto; padding:10px 20px;">Send</button>
                </form>` : '<p style="color:var(--nv-text-muted); font-style:italic;">This support ticket is closed.</p>'}
            </div>
        `;
        
        contentArea.innerHTML = html;

        if (t.status !== 'CLOSED') {
            document.getElementById('reply-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('reply-submit-btn');
                const msg = document.getElementById('reply-input').value;
                btn.disabled = true;
                btn.textContent = 'Sending...';

                const res = await fetchAPI('/api/support/tickets/' + id + '/reply', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({message: msg})
                });
                if (res.success) {
                    viewTicket(id);
                } else {
                    alert(res.error || 'Failed to reply');
                    btn.disabled = false;
                    btn.textContent = 'Send';
                }
            });
        }
    };

    render();
});
