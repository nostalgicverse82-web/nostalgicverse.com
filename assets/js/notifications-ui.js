/**
 * NostalgicVerse Notifications UI Engine (Phase 12)
 * Features:
 * - Category filter tabs: All, Friend Requests, Messages, Support, Submissions, System
 * - Direct inline Accept / Decline actions for friend requests
 * - Contextual action links (Open Chat, View Ticket, View Submission)
 * - Realtime notification delivery via NVRealtime
 * - Loading, Error, Retry, and category-tailored Empty states
 */
document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('notifications-list');
    const markAllBtn = document.getElementById('mark-all-read-btn');
    const categoryTabs = document.querySelectorAll('#notification-category-tabs .social-tab');
    if (!list) return;

    let currentUser = null;
    let allNotifications = [];
    let activeCategory = 'all';

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

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderLoading() {
        list.innerHTML = `
            <div style="text-align:center; padding: 48px 20px;">
                <div style="display:inline-block; width:36px; height:36px; border:3px solid var(--nv-border); border-top-color:var(--nv-cyan); border-radius:50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top:14px; color:var(--nv-text-muted); font-size:0.9rem;">Loading notifications...</p>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
    }

    function renderError(msg) {
        list.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:8px;">
                <h4 style="color:var(--nv-crimson); margin-bottom:8px;">Failed to Load Notifications</h4>
                <p style="color:var(--nv-text-secondary); margin-bottom:16px;">${escapeHtml(msg || 'Network or server error')}</p>
                <button id="notif-retry-btn" class="social-btn primary" style="padding:6px 20px;">Retry</button>
            </div>
        `;
        document.getElementById('notif-retry-btn')?.addEventListener('click', loadNotifications);
    }

    function matchesCategory(n, cat) {
        if (cat === 'all') return true;
        const type = (n.type || '').toUpperCase();
        if (cat === 'friends') {
            return type.includes('FRIEND');
        }
        if (cat === 'messages') {
            return type.includes('MESSAGE');
        }
        if (cat === 'support') {
            return type.includes('SUPPORT') || type.includes('TICKET');
        }
        if (cat === 'submissions') {
            return type.includes('SUBMISSION') || type.includes('IDEA');
        }
        if (cat === 'system') {
            return !type.includes('FRIEND') && !type.includes('MESSAGE') && !type.includes('SUPPORT') && !type.includes('SUBMISSION');
        }
        return true;
    }

    function renderEmptyState(cat) {
        let title = "You're all caught up";
        let desc = "No new notifications at this time.";
        let ctaText = "Discover People";
        let ctaHref = "/friends/";

        if (cat === 'friends') {
            title = "No Pending Friend Requests";
            desc = "Find retro gaming enthusiasts in the community.";
            ctaText = "Discover People";
            ctaHref = "/friends/";
        } else if (cat === 'messages') {
            title = "No New Messages";
            desc = "Chat in real-time with other museum visitors.";
            ctaText = "Open Direct Messages";
            ctaHref = "/messages/";
        } else if (cat === 'support') {
            title = "No Support Notifications";
            desc = "Need help with exhibits or account issues?";
            ctaText = "Open Support Center";
            ctaHref = "/support/";
        } else if (cat === 'submissions') {
            title = "No Submission Updates";
            desc = "Contribute missing games, consoles, or corrections.";
            ctaText = "Community Submissions";
            ctaHref = "/ideas/";
        }

        list.innerHTML = `
            <div style="text-align: center; padding: 48px 20px;">
                <h3 style="color:var(--nv-gold); margin-bottom: 8px; font-size:1.25rem;">${title}</h3>
                <p style="color:var(--nv-text-muted); margin-bottom: 20px; font-size:0.92rem;">${desc}</p>
                <a href="${ctaHref}" class="social-btn primary" style="display:inline-block; text-decoration:none;">${ctaText}</a>
            </div>
        `;
    }

    function renderList() {
        const filtered = allNotifications.filter(n => matchesCategory(n, activeCategory));

        if (filtered.length === 0) {
            renderEmptyState(activeCategory);
            return;
        }

        list.innerHTML = filtered.map(n => {
            const time = new Date(n.created_at || Date.now()).toLocaleString();
            const isUnread = !n.is_read;
            
            let avatar = '/assets/images/branding/logo/logo.png';
            if (window.AvatarPicker && n.actor_avatar_id) {
                avatar = window.AvatarPicker.getAvatarPath(n.actor_avatar_id);
            } else if (n.actor_avatar_id) {
                avatar = `/assets/images/profile-icons/${encodeURIComponent(n.actor_avatar_id)}.png`;
            }

            // Direct actions based on notification type
            let actionsHtml = '';
            if (n.type === 'FRIEND_REQUEST' && n.reference_id) {
                actionsHtml = `
                    <div class="notification-actions" style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
                        <button class="social-btn primary" onclick="acceptFriendRequestFromNotif('${n.reference_id}', '${n.id}')" style="padding:6px 16px;">Accept</button>
                        <button class="social-btn danger" onclick="declineFriendRequestFromNotif('${n.reference_id}', '${n.id}')" style="padding:6px 14px;">Decline</button>
                        <a href="/friends/" class="social-btn" style="padding:6px 12px; text-decoration:none;">View in Friends</a>
                    </div>
                `;
            } else if (n.type.includes('MESSAGE')) {
                actionsHtml = `
                    <div class="notification-actions" style="display:flex; gap:10px; margin-top:10px; align-items:center;">
                        <a href="/messages/${n.reference_id ? `?u=${n.reference_id}` : ''}" class="social-btn primary" style="padding:5px 14px; text-decoration:none; font-size:0.85rem;">Open Chat</a>
                        ${isUnread ? `<button class="social-btn" onclick="markRead('${n.id}')" style="padding:4px 12px; font-size:0.82rem;">Mark Read</button>` : ''}
                    </div>
                `;
            } else if (n.type.includes('SUPPORT') || n.type.includes('TICKET')) {
                actionsHtml = `
                    <div class="notification-actions" style="display:flex; gap:10px; margin-top:10px; align-items:center;">
                        <a href="/support/" class="social-btn primary" style="padding:5px 14px; text-decoration:none; font-size:0.85rem;">View Ticket</a>
                        ${isUnread ? `<button class="social-btn" onclick="markRead('${n.id}')" style="padding:4px 12px; font-size:0.82rem;">Mark Read</button>` : ''}
                    </div>
                `;
            } else if (n.type.includes('SUBMISSION')) {
                actionsHtml = `
                    <div class="notification-actions" style="display:flex; gap:10px; margin-top:10px; align-items:center;">
                        <a href="/ideas/" class="social-btn primary" style="padding:5px 14px; text-decoration:none; font-size:0.85rem;">View Submissions</a>
                        ${isUnread ? `<button class="social-btn" onclick="markRead('${n.id}')" style="padding:4px 12px; font-size:0.82rem;">Mark Read</button>` : ''}
                    </div>
                `;
            } else if (isUnread) {
                actionsHtml = `
                    <div class="notification-actions" style="display:flex; gap:10px; margin-top:10px;">
                        <button class="social-btn" onclick="markRead('${n.id}')" style="padding:4px 12px; font-size:0.82rem;">Mark Read</button>
                    </div>
                `;
            }

            return `
            <div class="social-list-item ${isUnread ? 'unread' : ''}" style="display:flex; gap:16px; align-items:flex-start; background:var(--nv-surface); border:1px solid ${isUnread ? 'var(--nv-cyan)' : 'var(--nv-border)'}; padding:16px 20px; border-radius:8px;">
                <img src="${avatar}" alt="" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1px solid var(--nv-border); flex-shrink:0;">
                <div class="social-info" style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="margin:0; font-size:0.95rem; color:var(--nv-text-primary); font-weight:600;">${escapeHtml((n.type || 'NOTIFICATION').replace(/_/g, ' '))}</h4>
                        <span style="font-size:0.78rem; color:var(--nv-text-muted);">${time}</span>
                    </div>
                    <p style="margin:6px 0 0; color:var(--nv-text-secondary); font-size:0.92rem; line-height:1.45;">${escapeHtml(n.message)}</p>
                    ${actionsHtml}
                </div>
            </div>`;
        }).join('');
    }

    async function loadNotifications() {
        renderLoading();
        try {
            const res = await fetch('/api/users/notifications');
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            allNotifications = data.notifications || [];
            renderList();
        } catch(e) {
            console.error('[Notifications UI] load error:', e);
            renderError(e.message);
        }
    }

    // Category Tabs Switching
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeCategory = tab.dataset.cat || 'all';
            renderList();
        });
    });

    // Direct Action: Accept Friend Request from Notification
    window.acceptFriendRequestFromNotif = async (requestId, notifId) => {
        try {
            const res = await fetch(`/api/users/friends/request/${requestId}/accept`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                await fetch('/api/users/notifications/mark-read', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ids: [notifId]})
                });
                loadNotifications();
                if (window.NVAuth) window.NVAuth.fetchUnreadCounts();
            } else {
                alert(data.error || 'Failed to accept friend request');
            }
        } catch (e) {
            alert('Network error accepting request');
        }
    };

    // Direct Action: Decline Friend Request from Notification
    window.declineFriendRequestFromNotif = async (requestId, notifId) => {
        try {
            const res = await fetch(`/api/users/friends/request/${requestId}/decline`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                await fetch('/api/users/notifications/mark-read', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ids: [notifId]})
                });
                loadNotifications();
                if (window.NVAuth) window.NVAuth.fetchUnreadCounts();
            } else {
                alert(data.error || 'Failed to decline friend request');
            }
        } catch (e) {
            alert('Network error declining request');
        }
    };

    window.markRead = async (id) => {
        await fetch('/api/users/notifications/mark-read', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ids: [id]})
        });
        loadNotifications();
        if (window.NVAuth) window.NVAuth.fetchUnreadCounts();
    };

    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            const unreadIds = allNotifications.filter(n => !n.is_read).map(n => n.id);
            if (unreadIds.length === 0) return;
            await fetch('/api/users/notifications/mark-read', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ids: unreadIds})
            });
            loadNotifications();
            if (window.NVAuth) window.NVAuth.fetchUnreadCounts();
        });
    }

    // Realtime Integration
    if (window.NVRealtime) {
        window.NVRealtime.connect();
        window.NVRealtime.on('notification.created', () => loadNotifications());
        window.NVRealtime.on('NOTIFICATION', () => loadNotifications());
    } else {
        window.addEventListener('nv-realtime-event', (e) => {
            if (e.detail?.type === 'NOTIFICATION' || e.detail?.type === 'notification.created') {
                loadNotifications();
            }
        });
    }

    loadNotifications();
});
