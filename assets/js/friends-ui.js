/**
 * NostalgicVerse Friends UI Engine
 * Features:
 * - 5 Tabs: Friends, Discover People, Incoming Requests, Outgoing Requests, Blocked
 * - Automatic DB user discovery with pagination and sorting
 * - Direct inline Actions: Message, Remove, Block, Accept, Decline, Cancel, Unblock
 * - Realtime updates via NVRealtime
 */
document.addEventListener('DOMContentLoaded', async () => {
    const contentArea = document.getElementById('friends-content-area');
    if (!contentArea) return;

    let currentUser = null;
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            currentUser = (await res.json()).user;
            if (window.AvatarPicker) await window.AvatarPicker.loadRegistry();
        } else {
            return window.location.href = '/login/';
        }
    } catch(e) { 
        return window.location.href = '/login/'; 
    }

    const tabs = document.querySelectorAll('.social-tab');
    let currentTab = 'friends-list';
    let discoverPage = 0;
    const discoverLimit = 20;
    let discoverSort = 'recent';
    let discoverSearchQuery = '';

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            render();
        });
    });

    async function fetchAPI(url, options = {}) {
        try {
            const res = await fetch(url, options);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch(e) { 
            return { error: e.message }; 
        }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function render() {
        contentArea.innerHTML = '<p style="text-align:center; color:var(--nv-text-muted); padding:30px;">Loading...</p>';
        
        // ==========================================
        // TAB 1: FRIENDS LIST
        // ==========================================
        if (currentTab === 'friends-list') {
            const data = await fetchAPI('/api/users/friends');
            if (data.error) return contentArea.innerHTML = `<p style="color:red;padding:20px;">${data.error}</p>`;
            
            const friends = data.friends || [];
            if (friends.length === 0) {
                contentArea.innerHTML = `
                    <div style="text-align: center; padding: 48px 20px;">
                        <h3 style="color:var(--nv-gold); margin-bottom: 10px; font-size:1.25rem;">No friends yet</h3>
                        <p style="color:var(--nv-text-muted); margin-bottom: 24px; font-size:0.95rem;">Connect with members of the retro gaming community.</p>
                        <button class="social-btn primary" onclick="document.querySelector('[data-tab=\\'friends-discover\\']').click()">Discover People</button>
                    </div>
                `;
            } else {
                contentArea.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        ${friends.map(f => {
                            let avatar = '/assets/images/branding/logo/logo.png';
                            if (window.AvatarPicker) avatar = window.AvatarPicker.getAvatarPath(f.avatarId || f.avatar_id);
                            const presence = f.isOnline 
                                ? '<span style="color:#4ade80;font-size:0.75rem;margin-left:6px;">● Online</span>' 
                                : '';
                            return `
                            <div class="social-list-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--nv-surface); border:1px solid var(--nv-border); padding:14px 18px; border-radius:8px;">
                                <div style="display:flex; align-items:center; gap:14px;">
                                    <a href="/u/${escapeHtml(f.username)}">
                                        <img src="${avatar}" class="social-avatar" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1px solid var(--nv-border);">
                                    </a>
                                    <div class="social-info">
                                        <h4 style="margin:0; font-size:1.05rem;"><a href="/u/${escapeHtml(f.username)}" style="color:var(--nv-text-primary);">${escapeHtml(f.displayName || f.username)}</a>${presence}</h4>
                                        <p style="margin:2px 0 0; color:var(--nv-text-muted); font-size:0.85rem;">@${escapeHtml(f.username)}</p>
                                    </div>
                                </div>
                                <div class="social-actions" style="display:flex; gap:10px;">
                                    <a href="/messages/?u=${f.id}" class="social-btn primary" style="text-decoration:none; padding:6px 14px;">Message</a>
                                    <button class="social-btn danger" onclick="removeFriend('${f.id}')" style="padding:6px 12px;">Remove</button>
                                    <button class="social-btn" onclick="blockUser('${f.id}')" style="padding:6px 12px; color:var(--nv-text-muted);">Block</button>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                `;
            }
        } 
        
        // ==========================================
        // TAB 2: DISCOVER PEOPLE
        // ==========================================
        else if (currentTab === 'friends-discover') {
            const offset = discoverPage * discoverLimit;
            let url = `/api/users/discover?limit=${discoverLimit}&offset=${offset}&sort=${discoverSort}`;
            if (discoverSearchQuery) {
                url = `/api/users/search?q=${encodeURIComponent(discoverSearchQuery)}`;
            }

            const data = await fetchAPI(url);
            if (data.error) return contentArea.innerHTML = `<p style="color:red;padding:20px;">${data.error}</p>`;

            const users = data.users || [];
            const total = data.total || users.length;
            const hasMore = !!data.hasMore;

            contentArea.innerHTML = `
                <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; align-items:center;">
                    <input type="text" id="discover-search-input" class="auth-input" placeholder="Filter members by name..." value="${escapeHtml(discoverSearchQuery)}" style="flex:1; min-width:200px;">
                    <select id="discover-sort-select" style="padding:10px 14px; background:var(--nv-bg-alt); border:1px solid var(--nv-border); color:var(--nv-text-primary); border-radius:4px;">
                        <option value="recent" ${discoverSort === 'recent' ? 'selected' : ''}>Recently Active</option>
                        <option value="new" ${discoverSort === 'new' ? 'selected' : ''}>Newest Members</option>
                        <option value="alpha" ${discoverSort === 'alpha' ? 'selected' : ''}>Alphabetical</option>
                    </select>
                </div>
                <div id="discover-list" style="display:flex; flex-direction:column; gap:12px;">
                    ${users.length === 0 ? `
                        <div style="text-align:center; padding:40px 20px; color:var(--nv-text-muted);">
                            <p style="font-size:1.1rem; color:var(--nv-text-secondary); margin-bottom:6px;">No other community members yet</p>
                            <p style="font-size:0.88rem;">New accounts will appear here automatically when they register.</p>
                        </div>
                    ` : users.map(u => {
                        let avatar = '/assets/images/branding/logo/logo.png';
                        if (window.AvatarPicker) avatar = window.AvatarPicker.getAvatarPath(u.avatarId || u.avatar_id);
                        
                        const presence = u.isOnline 
                            ? '<span style="color:#4ade80;font-size:0.75rem;margin-left:6px;">● Online</span>' 
                            : '';

                        let actionBtn = '';
                        if (u.friendStatus === 'SELF') {
                            actionBtn = `<span style="font-size:0.85rem; color:var(--nv-text-muted);">You</span>`;
                        } else if (u.friendStatus === 'FRIENDS') {
                            actionBtn = `
                                <div style="display:flex; gap:8px;">
                                    <span style="font-size:0.85rem; color:#4ade80; align-self:center;">Friends</span>
                                    <a href="/messages/?u=${u.id}" class="social-btn primary" style="text-decoration:none; padding:6px 12px;">Message</a>
                                </div>
                            `;
                        } else if (u.friendStatus === 'REQUEST_SENT') {
                            actionBtn = `
                                <div style="display:flex; gap:8px; align-items:center;">
                                    <span style="font-size:0.85rem; color:var(--nv-gold);">Request Sent</span>
                                    <button class="social-btn danger" onclick="cancelRequestByUser('${u.id}')" style="padding:4px 10px; font-size:0.8rem;">Cancel</button>
                                </div>
                            `;
                        } else if (u.friendStatus === 'REQUEST_RECEIVED') {
                            actionBtn = `
                                <div style="display:flex; gap:8px;">
                                    <button class="social-btn primary" onclick="acceptRequestByUser('${u.id}')" style="padding:6px 12px;">Accept</button>
                                    <button class="social-btn" onclick="declineRequestByUser('${u.id}')" style="padding:6px 12px;">Decline</button>
                                </div>
                            `;
                        } else if (u.friendStatus === 'BLOCKED') {
                            actionBtn = `<button class="social-btn" onclick="unblockUser('${u.id}')" style="padding:6px 12px;">Unblock</button>`;
                        } else {
                            actionBtn = `<button class="social-btn primary" onclick="sendFriendRequest('${u.id}')" style="padding:6px 14px;">Add Friend</button>`;
                        }

                        return `
                        <div class="social-list-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--nv-surface); border:1px solid var(--nv-border); padding:14px 18px; border-radius:8px;">
                            <div style="display:flex; align-items:center; gap:14px;">
                                <a href="/u/${escapeHtml(u.username)}">
                                    <img src="${avatar}" class="social-avatar" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1px solid var(--nv-border);">
                                </a>
                                <div class="social-info">
                                    <h4 style="margin:0; font-size:1.05rem;"><a href="/u/${escapeHtml(u.username)}" style="color:var(--nv-text-primary);">${escapeHtml(u.displayName || u.username)}</a>${presence}</h4>
                                    <p style="margin:2px 0 0; color:var(--nv-text-muted); font-size:0.85rem;">@${escapeHtml(u.username)}</p>
                                </div>
                            </div>
                            <div class="social-actions">
                                ${actionBtn}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                ${(!discoverSearchQuery && (discoverPage > 0 || hasMore)) ? `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding-top:16px; border-top:1px solid var(--nv-border);">
                        <button class="social-btn" ${discoverPage === 0 ? 'disabled' : ''} id="discover-prev-btn">&larr; Previous</button>
                        <span style="font-size:0.85rem; color:var(--nv-text-muted);">Page ${discoverPage + 1}</span>
                        <button class="social-btn" ${!hasMore ? 'disabled' : ''} id="discover-next-btn">Next &rarr;</button>
                    </div>
                ` : ''}
            `;

            // Attach search and sort events
            const searchInput = document.getElementById('discover-search-input');
            let debounceTimer = null;
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        discoverSearchQuery = e.target.value.trim();
                        discoverPage = 0;
                        render();
                    }, 300);
                });
            }

            const sortSelect = document.getElementById('discover-sort-select');
            if (sortSelect) {
                sortSelect.addEventListener('change', (e) => {
                    discoverSort = e.target.value;
                    discoverPage = 0;
                    render();
                });
            }

            const prevBtn = document.getElementById('discover-prev-btn');
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (discoverPage > 0) {
                        discoverPage--;
                        render();
                    }
                });
            }

            const nextBtn = document.getElementById('discover-next-btn');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    discoverPage++;
                    render();
                });
            }
        }

        // ==========================================
        // TAB 3: INCOMING REQUESTS
        // ==========================================
        else if (currentTab === 'friends-incoming') {
            const data = await fetchAPI('/api/users/friends/requests');
            if (data.error) return contentArea.innerHTML = `<p style="color:red;padding:20px;">${data.error}</p>`;

            const incoming = data.incoming || [];
            if (incoming.length === 0) {
                contentArea.innerHTML = `
                    <div style="text-align:center; padding:48px 20px; color:var(--nv-text-muted);">
                        <p style="font-size:1.1rem; color:var(--nv-text-secondary); margin-bottom:6px;">No incoming friend requests</p>
                        <p style="font-size:0.88rem;">When someone sends you a friend request, it will appear here.</p>
                    </div>
                `;
            } else {
                contentArea.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        ${incoming.map(r => {
                            let avatar = '/assets/images/branding/logo/logo.png';
                            if (window.AvatarPicker) avatar = window.AvatarPicker.getAvatarPath(r.avatar_id);
                            const timeStr = new Date(r.created_at || Date.now()).toLocaleDateString();
                            return `
                            <div class="social-list-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--nv-surface); border:1px solid var(--nv-border); padding:14px 18px; border-radius:8px;">
                                <div style="display:flex; align-items:center; gap:14px;">
                                    <a href="/u/${escapeHtml(r.username)}">
                                        <img src="${avatar}" class="social-avatar" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1px solid var(--nv-border);">
                                    </a>
                                    <div class="social-info">
                                        <h4 style="margin:0; font-size:1.05rem;"><a href="/u/${escapeHtml(r.username)}" style="color:var(--nv-text-primary);">${escapeHtml(r.display_name || r.username)}</a></h4>
                                        <p style="margin:2px 0 0; color:var(--nv-text-muted); font-size:0.85rem;">@${escapeHtml(r.username)} &bull; ${timeStr}</p>
                                    </div>
                                </div>
                                <div class="social-actions" style="display:flex; gap:10px;">
                                    <button class="social-btn primary" onclick="acceptRequestById('${r.request_id || r.id}')" style="padding:6px 16px;">Accept</button>
                                    <button class="social-btn danger" onclick="declineRequestById('${r.request_id || r.id}')" style="padding:6px 14px;">Decline</button>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                `;
            }
        }

        // ==========================================
        // TAB 4: OUTGOING REQUESTS
        // ==========================================
        else if (currentTab === 'friends-outgoing') {
            const data = await fetchAPI('/api/users/friends/requests');
            if (data.error) return contentArea.innerHTML = `<p style="color:red;padding:20px;">${data.error}</p>`;

            const outgoing = data.outgoing || [];
            if (outgoing.length === 0) {
                contentArea.innerHTML = `
                    <div style="text-align:center; padding:48px 20px; color:var(--nv-text-muted);">
                        <p style="font-size:1.1rem; color:var(--nv-text-secondary); margin-bottom:6px;">No outgoing requests</p>
                        <p style="font-size:0.88rem;">Friend requests you send to others will appear here until answered.</p>
                    </div>
                `;
            } else {
                contentArea.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        ${outgoing.map(r => {
                            let avatar = '/assets/images/branding/logo/logo.png';
                            if (window.AvatarPicker) avatar = window.AvatarPicker.getAvatarPath(r.avatar_id);
                            return `
                            <div class="social-list-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--nv-surface); border:1px solid var(--nv-border); padding:14px 18px; border-radius:8px;">
                                <div style="display:flex; align-items:center; gap:14px;">
                                    <a href="/u/${escapeHtml(r.username)}">
                                        <img src="${avatar}" class="social-avatar" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1px solid var(--nv-border);">
                                    </a>
                                    <div class="social-info">
                                        <h4 style="margin:0; font-size:1.05rem;"><a href="/u/${escapeHtml(r.username)}" style="color:var(--nv-text-primary);">${escapeHtml(r.display_name || r.username)}</a></h4>
                                        <p style="margin:2px 0 0; color:var(--nv-text-muted); font-size:0.85rem;">@${escapeHtml(r.username)}</p>
                                    </div>
                                </div>
                                <div class="social-actions" style="display:flex; gap:10px; align-items:center;">
                                    <span style="font-size:0.85rem; color:var(--nv-gold);">Request Sent</span>
                                    <button class="social-btn danger" onclick="cancelRequestById('${r.request_id || r.id}')" style="padding:6px 12px;">Cancel</button>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                `;
            }
        }

        // ==========================================
        // TAB 5: BLOCKED USERS
        // ==========================================
        else if (currentTab === 'friends-blocked') {
            const data = await fetchAPI('/api/users/blocks');
            if (data.error) return contentArea.innerHTML = `<p style="color:red;padding:20px;">${data.error}</p>`;

            const blocked = data.blocked || [];
            if (blocked.length === 0) {
                contentArea.innerHTML = `
                    <div style="text-align:center; padding:48px 20px; color:var(--nv-text-muted);">
                        <p style="font-size:1.1rem; color:var(--nv-text-secondary); margin-bottom:6px;">No blocked users</p>
                    </div>
                `;
            } else {
                contentArea.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        ${blocked.map(b => {
                            let avatar = '/assets/images/branding/logo/logo.png';
                            if (window.AvatarPicker) avatar = window.AvatarPicker.getAvatarPath(b.avatar_id);
                            return `
                            <div class="social-list-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--nv-surface); border:1px solid var(--nv-border); padding:14px 18px; border-radius:8px;">
                                <div style="display:flex; align-items:center; gap:14px;">
                                    <img src="${avatar}" class="social-avatar" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1px solid var(--nv-border);">
                                    <div class="social-info">
                                        <h4 style="margin:0; font-size:1.05rem;">${escapeHtml(b.display_name || b.username)}</h4>
                                        <p style="margin:2px 0 0; color:var(--nv-text-muted); font-size:0.85rem;">@${escapeHtml(b.username)}</p>
                                    </div>
                                </div>
                                <div class="social-actions">
                                    <button class="social-btn primary" onclick="unblockUser('${b.id}')" style="padding:6px 14px;">Unblock</button>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                `;
            }
        }
    }

    // ==========================================
    // ACTION HANDLERS (EXPOSED GLOBALLY)
    // ==========================================

    window.sendFriendRequest = async (recipientId) => {
        const res = await fetchAPI('/api/users/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: recipientId })
        });
        if (res.success) {
            render();
        } else {
            alert(res.error || 'Failed to send friend request');
        }
    };

    window.acceptRequestById = async (requestId) => {
        const res = await fetchAPI(`/api/users/friends/request/${requestId}/accept`, {
            method: 'POST'
        });
        if (res.success) {
            render();
        } else {
            alert(res.error || 'Failed to accept friend request');
        }
    };

    window.declineRequestById = async (requestId) => {
        const res = await fetchAPI(`/api/users/friends/request/${requestId}/decline`, {
            method: 'POST'
        });
        if (res.success) {
            render();
        } else {
            alert(res.error || 'Failed to decline friend request');
        }
    };

    window.cancelRequestById = async (requestId) => {
        const res = await fetchAPI(`/api/users/friends/request/${requestId}/cancel`, {
            method: 'POST'
        });
        if (res.success) {
            render();
        } else {
            alert(res.error || 'Failed to cancel friend request');
        }
    };

    window.removeFriend = async (friendId) => {
        if (!confirm('Are you sure you want to remove this friend?')) return;
        const res = await fetchAPI(`/api/users/friends/${friendId}`, { method: 'DELETE' });
        if (res.success) {
            render();
        } else {
            alert(res.error || 'Failed to remove friend');
        }
    };

    window.blockUser = async (userId) => {
        if (!confirm('Are you sure you want to block this user?')) return;
        const res = await fetchAPI('/api/users/blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocked_id: userId })
        });
        if (res.success) {
            render();
        } else {
            alert(res.error || 'Failed to block user');
        }
    };

    window.unblockUser = async (userId) => {
        const res = await fetchAPI(`/api/users/blocks/${userId}`, { method: 'DELETE' });
        if (res.success) {
            render();
        } else {
            alert(res.error || 'Failed to unblock user');
        }
    };

    // Helper wrappers for discover tab
    window.acceptRequestByUser = async (userId) => {
        const reqs = await fetchAPI('/api/users/friends/requests');
        const match = (reqs.incoming || []).find(r => r.user_id === userId);
        if (match) {
            await window.acceptRequestById(match.request_id || match.id);
        }
    };

    window.declineRequestByUser = async (userId) => {
        const reqs = await fetchAPI('/api/users/friends/requests');
        const match = (reqs.incoming || []).find(r => r.user_id === userId);
        if (match) {
            await window.declineRequestById(match.request_id || match.id);
        }
    };

    window.cancelRequestByUser = async (userId) => {
        const reqs = await fetchAPI('/api/users/friends/requests');
        const match = (reqs.outgoing || []).find(r => r.user_id === userId);
        if (match) {
            await window.cancelRequestById(match.request_id || match.id);
        }
    };

    // Realtime listener
    if (window.NVRealtime) {
        window.NVRealtime.connect();
        window.NVRealtime.on('friend_request.created', () => {
            if (currentTab === 'friends-incoming' || currentTab === 'friends-discover') render();
        });
        window.NVRealtime.on('friend_request.accepted', () => {
            if (currentTab === 'friends-list' || currentTab === 'friends-outgoing' || currentTab === 'friends-discover') render();
        });
    }

    render();
});
