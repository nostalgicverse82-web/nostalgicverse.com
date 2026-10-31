// Phase 12: Unified Global Auth UI Shell & Header Experience
(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        initAccountControl();
        initAuthForms();
    });

    async function initAccountControl() {
        const toggleBtn = document.getElementById('account-toggle-btn');
        const dropdown = document.getElementById('account-dropdown-menu');
        const wrap = document.getElementById('account-control-wrap');
        if (!toggleBtn || !dropdown) return;

        // Toggle menu
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
            if (expanded) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!toggleBtn.contains(e.target) && !dropdown.contains(e.target)) {
                closeMenu();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMenu();
            }
        });

        function openMenu() {
            toggleBtn.setAttribute('aria-expanded', 'true');
            dropdown.removeAttribute('hidden');
        }

        function closeMenu() {
            toggleBtn.setAttribute('aria-expanded', 'false');
            dropdown.setAttribute('hidden', '');
        }

        try {
            if (window.AvatarPicker) window.AvatarPicker.loadRegistry();

            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                if (data.user.force_password_change) {
                    showForcePasswordChangeModal();
                } else {
                    renderLoggedInMenu(data.user);
                    renderHeaderBadges(wrap);
                    fetchUnreadCounts();
                    initGlobalRealtime();
                }
            } else {
                renderLoggedOutMenu();
            }
        } catch (err) {
            renderLoggedOutMenu();
        }
    }

    function showForcePasswordChangeModal() {
        const div = document.createElement('div');
        div.className = 'avatar-picker-modal visible';
        div.style.zIndex = '9999';
        div.innerHTML = `
            <div class="avatar-picker-content">
                <div class="avatar-picker-header">
                    <h2>Action Required</h2>
                    <p>You must change your temporary password before continuing.</p>
                </div>
                <form id="force-password-form" style="display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <label style="display:block;margin-bottom:4px;color:var(--nv-text-secondary);font-size:0.9rem;">Current Password</label>
                        <input type="password" name="currentPassword" required style="width:100%;padding:10px;background:var(--nv-bg-alt);border:1px solid var(--nv-border);color:#fff;border-radius:4px;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;color:var(--nv-text-secondary);font-size:0.9rem;">New Password</label>
                        <input type="password" name="newPassword" required style="width:100%;padding:10px;background:var(--nv-bg-alt);border:1px solid var(--nv-border);color:#fff;border-radius:4px;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;color:var(--nv-text-secondary);font-size:0.9rem;">Confirm New Password</label>
                        <input type="password" name="confirmPassword" required style="width:100%;padding:10px;background:var(--nv-bg-alt);border:1px solid var(--nv-border);color:#fff;border-radius:4px;">
                    </div>
                    <div id="fpc-error" style="color:var(--nv-crimson); font-size:0.9rem; display:none;"></div>
                    <button type="submit" class="auth-btn" style="margin-top:8px;">Change Password</button>
                </form>
            </div>
        `;
        document.body.appendChild(div);

        document.getElementById('force-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const err = document.getElementById('fpc-error');
            const data = new FormData(e.target);
            try {
                const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(data))
                });
                if (res.ok) {
                    window.location.reload();
                } else {
                    const json = await res.json();
                    err.textContent = json.error || 'Failed to change password';
                    err.style.display = 'block';
                }
            } catch (error) {
                err.textContent = 'Network error';
                err.style.display = 'block';
            }
        });
    }

    function renderLoggedOutMenu() {
        const dropdown = document.getElementById('account-dropdown-menu');
        const toggleBtn = document.getElementById('account-toggle-btn');
        const badges = document.getElementById('header-quick-badges');
        if (badges) badges.remove();

        if (toggleBtn) {
            toggleBtn.className = 'account-toggle-btn';
            toggleBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            `;
        }

        if (!dropdown) return;
        dropdown.innerHTML = `
            <div class="account-dropdown-header">
                <span class="account-dropdown-title">ACCOUNT</span>
            </div>
            <a href="/account/" class="account-dropdown-item" role="menuitem">Account</a>
            <a href="/login/" class="account-dropdown-item" role="menuitem">Log In</a>
            <a href="/signup/" class="account-dropdown-item" role="menuitem">Sign Up</a>
        `;
    }

    function getAvatarUrl(avatarId) {
        if (window.AvatarPicker && avatarId) {
            return window.AvatarPicker.getAvatarPath(avatarId);
        }
        if (avatarId) {
            return `/assets/images/profile-icons/${encodeURIComponent(avatarId)}.png`;
        }
        return '/assets/images/branding/logo/logo.png';
    }

    function renderLoggedInMenu(user) {
        const dropdown = document.getElementById('account-dropdown-menu');
        const accountToggleBtn = document.getElementById('account-toggle-btn');
        if (!dropdown) return;

        const avatarPath = getAvatarUrl(user.avatar_id);
        const displayName = user.display_name || user.username;
        const isOwner = user.role === 'OWNER';

        // Render header button pill with avatar, name, and owner tag
        if (accountToggleBtn) {
            accountToggleBtn.className = 'account-toggle-btn is-pill';
            accountToggleBtn.innerHTML = `
                <img src="${avatarPath}" alt="Avatar" class="header-user-avatar">
                <span class="header-user-name">${escapeHtml(displayName)}</span>
                ${isOwner ? '<span class="header-owner-tag">OWNER</span>' : ''}
                <svg class="header-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
        }

        let html = `
            <div class="account-dropdown-header">
                <div class="account-dropdown-user-info">
                    <img src="${avatarPath}" alt="User Avatar" class="account-dropdown-avatar">
                    <div>
                        <div class="account-dropdown-name">${escapeHtml(displayName)}</div>
                        <div class="account-dropdown-handle">@${escapeHtml(user.username)}</div>
                    </div>
                </div>
            </div>
            <a href="/account/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Account</span>
            </a>
            <a href="/profile/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Profile</span>
            </a>
            <a href="/friends/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Friends</span>
                <span class="badge" id="menu-badge-friends" style="display:none;">0</span>
            </a>
            <a href="/messages/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Messages</span>
                <span class="badge" id="menu-badge-messages" style="display:none;">0</span>
            </a>
            <a href="/notifications/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Notifications</span>
                <span class="badge" id="menu-badge-notifications" style="display:none;">0</span>
            </a>
            <a href="/favorites/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Favorites</span>
            </a>
            <a href="/collections/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Collections</span>
            </a>
            <a href="/support/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Support</span>
            </a>
            <a href="/ideas/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Submissions</span>
            </a>
            <a href="/settings/" class="account-dropdown-item" role="menuitem">
                <span class="item-label">Settings</span>
            </a>
        `;

        if (isOwner) {
            html += `
                <div class="account-dropdown-divider"></div>
                <a href="/owner/" class="account-dropdown-item owner-item" role="menuitem">
                    <span class="item-label">Owner Dashboard</span>
                    <span class="badge">OWNER</span>
                </a>
            `;
        }

        html += `
            <div class="account-dropdown-divider"></div>
            <a href="#" id="logout-btn" class="account-dropdown-item logout-item" role="menuitem">
                <span class="item-label">Log Out</span>
            </a>
        `;

        dropdown.innerHTML = html;

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    window.location.href = '/';
                } catch(e) {
                    console.error('Logout failed', e);
                    window.location.reload();
                }
            });
        }
    }

    function renderHeaderBadges(wrap) {
        if (!wrap || document.getElementById('header-quick-badges')) return;

        const cluster = document.createElement('div');
        cluster.className = 'header-quick-badges';
        cluster.id = 'header-quick-badges';
        cluster.innerHTML = `
            <a href="/messages/" class="header-badge-btn" id="header-badge-messages" title="Messages" aria-label="Messages">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="header-badge-count" style="display:none;">0</span>
            </a>
            <a href="/friends/" class="header-badge-btn" id="header-badge-friends" title="Friend Requests" aria-label="Friend Requests">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span class="header-badge-count" style="display:none;">0</span>
            </a>
            <a href="/notifications/" class="header-badge-btn" id="header-badge-notifications" title="Notifications" aria-label="Notifications">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span class="header-badge-count" style="display:none;">0</span>
            </a>
        `;

        wrap.parentNode.insertBefore(cluster, wrap.nextSibling);
    }

    async function fetchUnreadCounts() {
        try {
            const res = await fetch('/api/users/counts');
            if (!res.ok) return;
            const data = await res.json();

            updateBadgeDisplay('messages', data.messages || 0);
            updateBadgeDisplay('friends', data.friendRequests || 0);
            updateBadgeDisplay('notifications', data.notifications || 0);
        } catch (e) {
            // Silently swallow network interruptions
        }
    }

    function updateBadgeDisplay(category, count) {
        const text = count > 99 ? '99+' : String(count);

        // Header icon badge
        const headerBadge = document.getElementById(`header-badge-${category}`);
        if (headerBadge) {
            const countEl = headerBadge.querySelector('.header-badge-count');
            if (countEl) {
                if (count > 0) {
                    countEl.textContent = text;
                    countEl.style.display = 'inline-block';
                } else {
                    countEl.style.display = 'none';
                }
            }
        }

        // Dropdown menu item badge
        const menuBadge = document.getElementById(`menu-badge-${category}`);
        if (menuBadge) {
            if (count > 0) {
                menuBadge.textContent = text;
                menuBadge.style.display = 'inline-block';
            } else {
                menuBadge.style.display = 'none';
            }
        }
    }

    function initGlobalRealtime() {
        if (window.NVRealtime) {
            window.NVRealtime.connect();
            window.NVRealtime.on('notification.created', () => fetchUnreadCounts());
            window.NVRealtime.on('message.created', () => fetchUnreadCounts());
            window.NVRealtime.on('friend_request.created', () => fetchUnreadCounts());
            window.NVRealtime.on('friend_request.accepted', () => fetchUnreadCounts());
            window.NVRealtime.on('NOTIFICATION', () => fetchUnreadCounts());
            window.NVRealtime.on('NEW_MESSAGE', () => fetchUnreadCounts());
            return;
        }

        if (window._globalWs) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}`);
        window._globalWs = ws;

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                window.dispatchEvent(new CustomEvent('nv-realtime-event', { detail: data }));
                const types = [
                    'NOTIFICATION', 'NEW_MESSAGE',
                    'message.created', 'notification.created',
                    'friend_request.created', 'friend_request.accepted'
                ];
                if (types.includes(data.type)) {
                    fetchUnreadCounts();
                }
            } catch (e) {}
        };

        ws.onclose = () => {
            window._globalWs = null;
            setTimeout(initGlobalRealtime, 5000);
        };
    }

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function initAuthForms() {
        // Password visibility toggle
        const toggles = document.querySelectorAll('.password-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const input = toggle.previousElementSibling;
                if (input.type === 'password') {
                    input.type = 'text';
                    toggle.textContent = 'Hide';
                } else {
                    input.type = 'password';
                    toggle.textContent = 'Show';
                }
            });
        });

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = loginForm.querySelector('.auth-btn');
                const err = loginForm.querySelector('.auth-error-msg');
                btn.disabled = true;
                btn.textContent = 'LOGGING IN...';
                err.classList.remove('visible');

                try {
                    const data = new FormData(loginForm);
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(Object.fromEntries(data))
                    });

                    if (res.ok) {
                        window.location.href = '/account/';
                    } else {
                        const errData = await res.json();
                        err.textContent = errData.error || 'Authentication failed';
                        err.classList.add('visible');
                        btn.disabled = false;
                        btn.textContent = 'Log In';
                    }
                } catch (error) {
                    err.textContent = 'Server unavailable';
                    err.classList.add('visible');
                    btn.disabled = false;
                    btn.textContent = 'Log In';
                }
            });
        }

        // Signup form
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = signupForm.querySelector('.auth-btn');
                const err = signupForm.querySelector('.auth-error-msg');
                btn.disabled = true;
                btn.textContent = 'CREATING ACCOUNT...';
                err.classList.remove('visible');

                try {
                    const data = new FormData(signupForm);
                    const res = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(Object.fromEntries(data))
                    });

                    if (res.ok) {
                        window.location.href = '/account/';
                    } else {
                        const errData = await res.json();
                        err.textContent = errData.error || 'Signup failed';
                        err.classList.add('visible');
                        btn.disabled = false;
                        btn.textContent = 'Create Account';
                    }
                } catch (error) {
                    err.textContent = 'Server unavailable';
                    err.classList.add('visible');
                    btn.disabled = false;
                    btn.textContent = 'Create Account';
                }
            });
        }
    }

    // Expose global helper for other scripts
    window.NVAuth = {
        fetchUnreadCounts,
        getAvatarUrl
    };
})();
