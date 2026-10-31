/**
 * NostalgicVerse Public Profile UI Engine (Phase 12)
 * Renders user avatar, display name, username, bio, joined date,
 * public collections, public contributions, and mutual friend status.
 */
document.addEventListener('DOMContentLoaded', () => {
    const area = document.getElementById('public-profile-area');
    if (!area) return;

    // Extract username from URL path /u/:username
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const username = pathParts[1];

    if (!username) {
        area.innerHTML = '<p class="error">No user specified.</p>';
        return;
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

    function renderLoading() {
        area.innerHTML = `
            <div style="text-align:center; padding: 48px 20px;">
                <div style="display:inline-block; width:40px; height:40px; border:3px solid var(--nv-border); border-top-color:var(--nv-cyan); border-radius:50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top:14px; color:var(--nv-text-muted); font-size:0.9rem;">Loading user profile from database...</p>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
    }

    function renderError(msg) {
        area.innerHTML = `
            <div style="text-align:center; padding: 48px 20px;">
                <h3 style="color:var(--nv-crimson); margin-bottom:8px;">Profile Not Available</h3>
                <p style="color:var(--nv-text-secondary); margin-bottom:16px;">${escapeHtml(msg || 'User not found')}</p>
                <button id="profile-retry-btn" class="social-btn primary" style="padding:6px 20px;">Retry</button>
            </div>
        `;
        document.getElementById('profile-retry-btn')?.addEventListener('click', loadProfile);
    }

    async function loadProfile() {
        renderLoading();
        try {
            if (window.AvatarPicker) await window.AvatarPicker.loadRegistry();

            const res = await fetch(`/api/users/profile/${encodeURIComponent(username)}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to load profile');

            const { user, friendStatus } = data;

            let actionHtml = '';

            if (friendStatus === 'SELF') {
                actionHtml = `
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <a href="/account/" class="social-btn primary" style="text-decoration:none;">Account Dashboard</a>
                        <button class="social-btn" id="self-change-avatar-btn">Change Avatar</button>
                    </div>
                `;
            } else if (friendStatus === 'FRIENDS') {
                actionHtml = `
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <a href="/messages/?u=${user.id}" class="social-btn primary" style="text-decoration:none;">Send Message</a>
                        <button class="social-btn danger" onclick="removeFriend('${user.id}')">Remove Friend</button>
                        <button class="social-btn" onclick="blockUser('${user.id}')">Block</button>
                    </div>
                `;
            } else if (friendStatus === 'REQUEST_SENT') {
                actionHtml = `
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button class="social-btn" disabled style="opacity:0.7;">Friend Request Sent</button>
                        <button class="social-btn danger" onclick="cancelRequest('${user.id}')">Cancel Request</button>
                    </div>
                `;
            } else if (friendStatus === 'REQUEST_RECEIVED') {
                actionHtml = `
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button class="social-btn primary" onclick="acceptRequest('${user.id}')">Accept Friend Request</button>
                        <button class="social-btn danger" onclick="declineRequest('${user.id}')">Decline</button>
                    </div>
                `;
            } else if (friendStatus === 'BLOCKED') {
                actionHtml = `
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button class="social-btn" disabled>Blocked</button>
                        <button class="social-btn primary" onclick="unblockUser('${user.id}')">Unblock</button>
                    </div>
                `;
            } else {
                actionHtml = `
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <a href="/messages/?u=${user.id}" class="social-btn primary" style="text-decoration:none;">Message</a>
                        <button class="social-btn" onclick="addFriend('${user.id}')">Add Friend</button>
                    </div>
                `;
            }

            let avatarPath = '/assets/images/branding/logo/logo.png';
            if (window.AvatarPicker) {
                avatarPath = window.AvatarPicker.getAvatarPath(user.avatarId || user.avatar_id);
            } else if (user.avatar_id || user.avatarId) {
                avatarPath = `/assets/images/profile-icons/${encodeURIComponent(user.avatarId || user.avatar_id)}.png`;
            }

            const dispName = escapeHtml(user.displayName || user.display_name || user.username);
            const usrName = escapeHtml(user.username);
            const bioText = escapeHtml(user.bio || 'Preserving the heritage of gaming, one cartridge at a time.');
            const joinedDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Permanent Archive';

            // Collections HTML
            let collectionsHtml = '';
            if (user.collections && user.collections.length > 0) {
                collectionsHtml = `
                    <div style="margin-top:28px; text-align:left;">
                        <h3 style="color:var(--nv-gold); font-size:1.1rem; margin-bottom:12px;">Public Collections (${user.collections.length})</h3>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                            ${user.collections.map(c => `
                                <div style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:14px; border-radius:6px;">
                                    <h4 style="margin:0 0 4px; color:var(--nv-text-primary); font-size:0.95rem;">${escapeHtml(c.name)}</h4>
                                    <p style="margin:0; font-size:0.82rem; color:var(--nv-text-muted);">${escapeHtml(c.description || 'Curated exhibit list')}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Contributions HTML
            let contributionsHtml = '';
            if (user.contributions && user.contributions.length > 0) {
                contributionsHtml = `
                    <div style="margin-top:28px; text-align:left;">
                        <h3 style="color:var(--nv-cyan); font-size:1.1rem; margin-bottom:12px;">Recent Contributions (${user.contributions.length})</h3>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${user.contributions.map(r => `
                                <div style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:14px; border-radius:6px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                        <a href="/${r.target_type === 'GAME' ? 'games' : 'consoles'}/${r.target_id}/" style="color:var(--nv-cyan); text-decoration:none; font-weight:600; font-size:0.95rem;">${escapeHtml(r.title || r.target_id)}</a>
                                        <span style="background:var(--nv-gold); color:#000; font-weight:800; font-size:0.75rem; padding:2px 6px; border-radius:4px;">${r.rating}/10</span>
                                    </div>
                                    <p style="margin:0; font-size:0.85rem; color:var(--nv-text-secondary);">${escapeHtml(r.body || '')}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            area.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <img src="${avatarPath}" alt="Avatar" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:3px solid var(--nv-gold); box-shadow:0 0 20px rgba(0,0,0,0.5);">
                    <h1 style="color:var(--nv-gold); margin: 14px 0 4px 0; font-size:1.8rem;">${dispName}</h1>
                    <p style="color:var(--nv-text-muted); font-family:var(--nv-font-mono, monospace); margin: 0 0 10px 0;">@${usrName}</p>
                    <p style="color:var(--nv-text-secondary); max-width:550px; margin:0 auto 16px; font-size:0.95rem; line-height:1.5;">${bioText}</p>
                    ${actionHtml}
                </div>
                
                <div style="border-top: 1px solid var(--nv-border); padding-top:20px; text-align:left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <h2 style="color:var(--nv-text-primary); font-size:1.15rem; margin:0;">Archive Stats</h2>
                        <span style="color:var(--nv-text-muted); font-size:0.85rem;">Member since ${joinedDate}</span>
                    </div>
                    ${user.stats ? `
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:12px; margin-top:14px; text-align:center;">
                            <div style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:12px; border-radius:6px;">
                                <div style="font-size:1.4rem; font-weight:700; color:var(--nv-cyan);">${user.stats.friends}</div>
                                <div style="font-size:0.75rem; color:var(--nv-text-muted);">Friends</div>
                            </div>
                            <div style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:12px; border-radius:6px;">
                                <div style="font-size:1.4rem; font-weight:700; color:var(--nv-gold);">${user.stats.favorites}</div>
                                <div style="font-size:0.75rem; color:var(--nv-text-muted);">Favorites</div>
                            </div>
                            <div style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:12px; border-radius:6px;">
                                <div style="font-size:1.4rem; font-weight:700; color:var(--nv-text-primary);">${user.stats.reviews}</div>
                                <div style="font-size:0.75rem; color:var(--nv-text-muted);">Reviews</div>
                            </div>
                            <div style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:12px; border-radius:6px;">
                                <div style="font-size:1.4rem; font-weight:700; color:var(--nv-text-primary);">${user.stats.comments}</div>
                                <div style="font-size:0.75rem; color:var(--nv-text-muted);">Comments</div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                ${collectionsHtml}
                ${contributionsHtml}
            `;

            // If SELF, attach avatar picker trigger
            document.getElementById('self-change-avatar-btn')?.addEventListener('click', () => {
                if (window.AvatarPicker) {
                    window.AvatarPicker.show({
                        currentAvatarId: user.avatarId,
                        onSave: async (newAvatarId) => {
                            try {
                                await fetch('/api/account/profile', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ avatar_id: newAvatarId })
                                });
                                loadProfile();
                            } catch (e) {
                                console.error('Failed to change avatar', e);
                            }
                        }
                    });
                }
            });

            // Re-attach realtime listener once
            if (!window._profileRealtimeAttached) {
                window.addEventListener('nv-realtime-event', (e) => {
                    const detail = e.detail;
                    if (detail.type === 'FRIEND_REQUEST_RECEIVED' || detail.type === 'FRIEND_REQUEST_ACCEPTED' ||
                        detail.type === 'friend_request.created' || detail.type === 'friend_request.accepted') {
                        loadProfile();
                    }
                });
                window._profileRealtimeAttached = true;
            }

        } catch (err) {
            renderError(err.message);
        }
    }

    loadProfile();
    window.refreshProfile = loadProfile;
});

window.addFriend = async (id) => {
    try {
        const res = await fetch('/api/users/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: id })
        });
        const data = await res.json();
        if (res.ok) window.refreshProfile();
        else alert(data.error || 'Error sending request');
    } catch (e) { alert(e.message); }
};

window.acceptRequest = async (id) => {
    try {
        const res = await fetch('/api/users/friends/accept-by-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_id: id })
        });
        const data = await res.json();
        if (res.ok) window.refreshProfile();
        else alert(data.error || 'Error accepting request');
    } catch (e) { alert(e.message); }
};

window.declineRequest = async (id) => {
    try {
        const res = await fetch(`/api/users/friends/decline-by-user/${id}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) window.refreshProfile();
        else alert(data.error || 'Error declining request');
    } catch (e) { alert(e.message); }
};

window.cancelRequest = async (id) => {
    try {
        const res = await fetch(`/api/users/friends/request-by-user/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) window.refreshProfile();
        else alert(data.error || 'Error cancelling request');
    } catch (e) { alert(e.message); }
};

window.removeFriend = async (id) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
        const res = await fetch(`/api/users/friends/by-user/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) window.refreshProfile();
        else alert(data.error || 'Error removing friend');
    } catch (e) { alert(e.message); }
};

window.blockUser = async (id) => {
    if (!confirm('Block this user?')) return;
    try {
        const res = await fetch('/api/users/blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocked_id: id })
        });
        const data = await res.json();
        if (res.ok) window.refreshProfile();
        else alert(data.error || 'Error blocking user');
    } catch (e) { alert(e.message); }
};

window.unblockUser = async (id) => {
    try {
        const res = await fetch(`/api/users/blocks/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) window.refreshProfile();
        else alert(data.error || 'Error unblocking user');
    } catch (e) { alert(e.message); }
};
