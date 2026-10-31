/**
 * NostalgicVerse Account Dashboard Engine (Phase 12)
 * Connects 11 real sections and real calculated database metrics.
 * Zero mock data, zero fake counters, zero dead buttons.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const mainContainer = document.getElementById('account-dashboard-root');
    if (!mainContainer) return;

    let accountData = null;
    let selectedAvatarId = null;

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
        mainContainer.innerHTML = `
            <div style="text-align:center; padding: 60px 20px;">
                <div style="display:inline-block; width:48px; height:48px; border:3px solid var(--nv-border); border-top-color:var(--nv-cyan); border-radius:50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top:16px; color:var(--nv-text-muted); font-size:0.95rem;">Retrieving account state from archive database...</p>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
    }

    function renderError(errorMessage) {
        mainContainer.innerHTML = `
            <div style="text-align:center; padding: 60px 20px; background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md);">
                <h3 style="color:var(--nv-crimson); margin-bottom:8px;">Unable to Load Account</h3>
                <p style="color:var(--nv-text-secondary); margin-bottom:20px;">${escapeHtml(errorMessage || 'Server unavailable')}</p>
                <button id="account-retry-btn" class="social-btn primary" style="padding:8px 24px;">Retry</button>
            </div>
        `;
        document.getElementById('account-retry-btn')?.addEventListener('click', loadAccountData);
    }

    async function loadAccountData() {
        renderLoading();
        try {
            if (window.AvatarPicker) await window.AvatarPicker.loadRegistry();

            const res = await fetch('/api/account/summary');
            if (res.status === 401) {
                window.location.href = '/login/';
                return;
            }
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || `HTTP ${res.status}`);
            }

            accountData = await res.json();
            selectedAvatarId = accountData.user.avatarId;
            renderDashboard();
        } catch (err) {
            console.error('[Account Dashboard] Load failure:', err);
            renderError(err.message);
        }
    }

    function getAvatarPath(avatarId) {
        if (window.AvatarPicker && avatarId) {
            return window.AvatarPicker.getAvatarPath(avatarId);
        }
        if (avatarId) {
            return `/assets/images/profile-icons/${encodeURIComponent(avatarId)}.png`;
        }
        return '/assets/images/branding/logo/logo.png';
    }

    function renderDashboard() {
        const { user, metrics } = accountData;
        const avatarUrl = getAvatarPath(selectedAvatarId || user.avatarId);
        const memberDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Archive Pioneer';
        const isOwner = user.role === 'OWNER';

        mainContainer.innerHTML = `
            <!-- Top Hero Profile Banner -->
            <div class="account-hero-card" style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-lg); padding:32px 28px; margin-bottom:28px; display:flex; flex-wrap:wrap; gap:24px; align-items:center;">
                <div style="position:relative; text-align:center;">
                    <img id="account-avatar-preview" src="${avatarUrl}" alt="Avatar" style="width:104px; height:104px; border-radius:50%; object-fit:cover; border:3px solid ${isOwner ? 'var(--nv-gold)' : 'var(--nv-cyan)'}; box-shadow:0 0 20px rgba(0,0,0,0.5);">
                    <button id="account-change-avatar-btn" class="social-btn" style="display:block; margin:10px auto 0; font-size:0.78rem; padding:4px 10px;">Change Icon</button>
                </div>
                <div style="flex:1; min-width:240px;">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <h1 style="font-size:1.75rem; margin:0; color:var(--nv-text-primary); font-weight:700;">${escapeHtml(user.displayName)}</h1>
                        ${isOwner ? '<span style="background:var(--nv-gold); color:#000; font-weight:800; font-size:0.7rem; padding:2px 8px; border-radius:4px; text-transform:uppercase;">Museum Administrator</span>' : '<span style="background:var(--nv-surface-raised); border:1px solid var(--nv-border); color:var(--nv-cyan); font-weight:600; font-size:0.7rem; padding:2px 8px; border-radius:4px;">Member</span>'}
                    </div>
                    <p style="margin:4px 0 12px; color:var(--nv-text-muted); font-family:var(--nv-font-mono, monospace); font-size:0.92rem;">@${escapeHtml(user.username)} &bull; ${escapeHtml(user.email)}</p>
                    <p style="margin:0 0 14px; color:var(--nv-text-secondary); font-size:0.92rem; line-height:1.5;">${escapeHtml(user.bio || 'Preserving the heritage of gaming, one cartridge at a time.')}</p>
                    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                        <span style="font-size:0.82rem; color:var(--nv-text-muted); display:inline-flex; align-items:center; gap:6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            Member since ${memberDate}
                        </span>
                        <a href="/u/${encodeURIComponent(user.username)}" class="social-btn primary" style="font-size:0.82rem; padding:5px 14px; text-decoration:none;">View Public Profile</a>
                        ${isOwner ? '<a href="/owner/" class="social-btn" style="font-size:0.82rem; padding:5px 14px; text-decoration:none; color:var(--nv-gold); border-color:rgba(255,179,0,0.4);">Open Control Center</a>' : ''}
                    </div>
                </div>
            </div>

            <!-- Navigation Tabs for the 11 Sections -->
            <div class="social-tabs" id="account-section-tabs" style="margin-bottom:24px; overflow-x:auto; display:flex; gap:6px;">
                <button class="social-tab active" data-sec="overview">Overview</button>
                <button class="social-tab" data-sec="profile">Profile</button>
                <button class="social-tab" data-sec="favorites">Favorites (${metrics.favoritesCount})</button>
                <button class="social-tab" data-sec="collections">Collections (${metrics.collectionsCount})</button>
                <button class="social-tab" data-sec="friends">Friends (${metrics.friendsCount})</button>
                <button class="social-tab" data-sec="messages">Messages ${metrics.unreadMessages ? `(${metrics.unreadMessages})` : ''}</button>
                <button class="social-tab" data-sec="notifications">Notifications ${metrics.unreadNotifications ? `(${metrics.unreadNotifications})` : ''}</button>
                <button class="social-tab" data-sec="support">Support (${metrics.openTicketsCount})</button>
                <button class="social-tab" data-sec="submissions">Submissions (${metrics.submissionsCount})</button>
                <button class="social-tab" data-sec="security">Security</button>
                <button class="social-tab" data-sec="settings">Settings</button>
            </div>

            <!-- Dynamic Section Content Area -->
            <div id="account-section-content" style="min-height:300px;">
                <!-- Populated by renderSection() -->
            </div>
        `;

        // Section Tabs Event Listeners
        const tabBtns = mainContainer.querySelectorAll('#account-section-tabs .social-tab');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderSection(btn.dataset.sec);
            });
        });

        // Change Avatar Modal Trigger
        document.getElementById('account-change-avatar-btn')?.addEventListener('click', () => {
            if (window.AvatarPicker) {
                window.AvatarPicker.show({
                    currentAvatarId: selectedAvatarId,
                    onSave: async (newAvatarId) => {
                        selectedAvatarId = newAvatarId;
                        document.getElementById('account-avatar-preview').src = getAvatarPath(newAvatarId);
                        // Persist to server
                        try {
                            await fetch('/api/account/profile', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ avatar_id: newAvatarId })
                            });
                            accountData.user.avatarId = newAvatarId;
                        } catch (e) {
                            console.error('Avatar save failed:', e);
                        }
                    }
                });
            }
        });

        // Initial Section Render
        renderSection('overview');
    }

    function renderSection(sectionKey) {
        const contentArea = document.getElementById('account-section-content');
        if (!contentArea) return;
        const { user, metrics } = accountData;

        switch (sectionKey) {
            case 'overview':
                contentArea.innerHTML = `
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:28px;">
                        <a href="/friends/" style="text-decoration:none; color:inherit;">
                            <div class="account-stat-card" style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:20px; border-radius:var(--nv-radius-md); transition:border-color var(--nv-transition-fast); text-align:center;">
                                <div style="font-size:2rem; font-weight:800; color:var(--nv-cyan); font-family:var(--nv-font-mono);">${metrics.friendsCount}</div>
                                <div style="color:var(--nv-text-secondary); font-size:0.9rem; margin-top:4px;">Friends</div>
                                <span style="font-size:0.75rem; color:var(--nv-text-muted); display:block; margin-top:6px;">View discovery &rarr;</span>
                            </div>
                        </a>
                        <a href="/favorites/" style="text-decoration:none; color:inherit;">
                            <div class="account-stat-card" style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:20px; border-radius:var(--nv-radius-md); transition:border-color var(--nv-transition-fast); text-align:center;">
                                <div style="font-size:2rem; font-weight:800; color:var(--nv-gold); font-family:var(--nv-font-mono);">${metrics.favoritesCount}</div>
                                <div style="color:var(--nv-text-secondary); font-size:0.9rem; margin-top:4px;">Favorited Exhibits</div>
                                <span style="font-size:0.75rem; color:var(--nv-text-muted); display:block; margin-top:6px;">Browse saved &rarr;</span>
                            </div>
                        </a>
                        <a href="/collections/" style="text-decoration:none; color:inherit;">
                            <div class="account-stat-card" style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:20px; border-radius:var(--nv-radius-md); transition:border-color var(--nv-transition-fast); text-align:center;">
                                <div style="font-size:2rem; font-weight:800; color:var(--nv-cyan); font-family:var(--nv-font-mono);">${metrics.collectionsCount}</div>
                                <div style="color:var(--nv-text-secondary); font-size:0.9rem; margin-top:4px;">Curated Collections</div>
                                <span style="font-size:0.75rem; color:var(--nv-text-muted); display:block; margin-top:6px;">Manage lists &rarr;</span>
                            </div>
                        </a>
                        <a href="/ideas/" style="text-decoration:none; color:inherit;">
                            <div class="account-stat-card" style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:20px; border-radius:var(--nv-radius-md); transition:border-color var(--nv-transition-fast); text-align:center;">
                                <div style="font-size:2rem; font-weight:800; color:var(--nv-gold); font-family:var(--nv-font-mono);">${metrics.submissionsCount}</div>
                                <div style="color:var(--nv-text-secondary); font-size:0.9rem; margin-top:4px;">Submissions</div>
                                <span style="font-size:0.75rem; color:var(--nv-text-muted); display:block; margin-top:6px;">Track status &rarr;</span>
                            </div>
                        </a>
                        <a href="/support/" style="text-decoration:none; color:inherit;">
                            <div class="account-stat-card" style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:20px; border-radius:var(--nv-radius-md); transition:border-color var(--nv-transition-fast); text-align:center;">
                                <div style="font-size:2rem; font-weight:800; color:${metrics.openTicketsCount > 0 ? 'var(--nv-crimson)' : 'var(--nv-text-primary)'}; font-family:var(--nv-font-mono);">${metrics.openTicketsCount}</div>
                                <div style="color:var(--nv-text-secondary); font-size:0.9rem; margin-top:4px;">Open Tickets</div>
                                <span style="font-size:0.75rem; color:var(--nv-text-muted); display:block; margin-top:6px;">Support inbox &rarr;</span>
                            </div>
                        </a>
                        <a href="/messages/" style="text-decoration:none; color:inherit;">
                            <div class="account-stat-card" style="background:var(--nv-surface); border:1px solid var(--nv-border); padding:20px; border-radius:var(--nv-radius-md); transition:border-color var(--nv-transition-fast); text-align:center;">
                                <div style="font-size:2rem; font-weight:800; color:${metrics.unreadMessages > 0 ? 'var(--nv-crimson)' : 'var(--nv-text-primary)'}; font-family:var(--nv-font-mono);">${metrics.unreadMessages}</div>
                                <div style="color:var(--nv-text-secondary); font-size:0.9rem; margin-top:4px;">Unread Messages</div>
                                <span style="font-size:0.75rem; color:var(--nv-text-muted); display:block; margin-top:6px;">Open conversations &rarr;</span>
                            </div>
                        </a>
                    </div>
                `;
                break;

            case 'profile':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:6px; color:var(--nv-text-primary);">Edit Profile</h2>
                        <p style="color:var(--nv-text-secondary); font-size:0.9rem; margin-bottom:24px;">Update your display name and public bio across the NostalgicVerse museum network.</p>
                        
                        <form id="account-profile-form" style="display:flex; flex-direction:column; gap:20px; max-width:600px;">
                            <div>
                                <label class="auth-label">Display Name</label>
                                <input type="text" id="prof-display-name" class="auth-input" value="${escapeHtml(user.displayName)}" maxlength="50" required>
                            </div>
                            <div>
                                <label class="auth-label">Public Bio</label>
                                <textarea id="prof-bio" class="auth-input" rows="4" maxlength="500" style="resize:vertical;">${escapeHtml(user.bio || '')}</textarea>
                                <span style="font-size:0.78rem; color:var(--nv-text-muted); display:block; margin-top:4px;">Max 500 characters. Visible on your public profile exhibit.</span>
                            </div>
                            <div id="prof-feedback" style="display:none; font-size:0.9rem; padding:10px; border-radius:var(--nv-radius-sm);"></div>
                            <button type="submit" id="prof-save-btn" class="social-btn primary" style="width:auto; align-self:flex-start; padding:10px 24px;">Save Changes</button>
                        </form>
                    </div>
                `;

                document.getElementById('account-profile-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btn = document.getElementById('prof-save-btn');
                    const fb = document.getElementById('prof-feedback');
                    btn.disabled = true;
                    btn.textContent = 'Saving...';
                    fb.style.display = 'none';

                    const newDisplayName = document.getElementById('prof-display-name').value;
                    const newBio = document.getElementById('prof-bio').value;

                    try {
                        const res = await fetch('/api/account/profile', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ display_name: newDisplayName, bio: newBio })
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                            accountData.user.displayName = newDisplayName;
                            accountData.user.bio = newBio;
                            fb.textContent = 'Profile successfully updated!';
                            fb.style.background = 'rgba(0, 229, 255, 0.15)';
                            fb.style.color = 'var(--nv-cyan)';
                            fb.style.display = 'block';
                        } else {
                            throw new Error(data.error || 'Failed to update profile');
                        }
                    } catch (err) {
                        fb.textContent = err.message;
                        fb.style.background = 'rgba(255, 42, 109, 0.15)';
                        fb.style.color = 'var(--nv-crimson)';
                        fb.style.display = 'block';
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Save Changes';
                    }
                });
                break;

            case 'favorites':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:8px;">Saved Exhibits</h2>
                        <p style="color:var(--nv-text-secondary); margin-bottom:20px;">You have saved <strong>${metrics.favoritesCount}</strong> items to your personal archive favorites.</p>
                        <a href="/favorites/" class="social-btn primary" style="text-decoration:none; display:inline-block;">Open Full Favorites Manager &rarr;</a>
                    </div>
                `;
                break;

            case 'collections':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:8px;">Curated Collections</h2>
                        <p style="color:var(--nv-text-secondary); margin-bottom:20px;">You have created <strong>${metrics.collectionsCount}</strong> custom collections.</p>
                        <a href="/collections/" class="social-btn primary" style="text-decoration:none; display:inline-block;">Open Collections Hub &rarr;</a>
                    </div>
                `;
                break;

            case 'friends':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:8px;">Friend Network</h2>
                        <p style="color:var(--nv-text-secondary); margin-bottom:20px;">You currently have <strong>${metrics.friendsCount}</strong> connected friends in the museum community.</p>
                        <a href="/friends/" class="social-btn primary" style="text-decoration:none; display:inline-block;">Discover Users & Manage Requests &rarr;</a>
                    </div>
                `;
                break;

            case 'messages':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:8px;">Direct Realtime Chat</h2>
                        <p style="color:var(--nv-text-secondary); margin-bottom:20px;">You have <strong>${metrics.unreadMessages}</strong> unread conversations.</p>
                        <a href="/messages/" class="social-btn primary" style="text-decoration:none; display:inline-block;">Open Direct Messages &rarr;</a>
                    </div>
                `;
                break;

            case 'notifications':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:8px;">Notification Center</h2>
                        <p style="color:var(--nv-text-secondary); margin-bottom:20px;">You have <strong>${metrics.unreadNotifications}</strong> unread notifications.</p>
                        <a href="/notifications/" class="social-btn primary" style="text-decoration:none; display:inline-block;">Open Notifications &rarr;</a>
                    </div>
                `;
                break;

            case 'support':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:8px;">Support Center</h2>
                        <p style="color:var(--nv-text-secondary); margin-bottom:20px;">You have <strong>${metrics.openTicketsCount}</strong> active support requests.</p>
                        <a href="/support/" class="social-btn primary" style="text-decoration:none; display:inline-block;">Open Support Center &rarr;</a>
                    </div>
                `;
                break;

            case 'submissions':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:8px;">Community Submissions</h2>
                        <p style="color:var(--nv-text-secondary); margin-bottom:20px;">You have contributed <strong>${metrics.submissionsCount}</strong> submissions or suggestions to the archive.</p>
                        <a href="/ideas/" class="social-btn primary" style="text-decoration:none; display:inline-block;">Review Submissions & Post New Idea &rarr;</a>
                    </div>
                `;
                break;

            case 'security':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:6px;">Security & Password</h2>
                        <p style="color:var(--nv-text-secondary); font-size:0.9rem; margin-bottom:24px;">Change your account password securely.</p>

                        <form id="account-password-form" style="display:flex; flex-direction:column; gap:16px; max-width:440px;">
                            <div>
                                <label class="auth-label">Current Password</label>
                                <input type="password" id="sec-current-pw" class="auth-input" required>
                            </div>
                            <div>
                                <label class="auth-label">New Password</label>
                                <input type="password" id="sec-new-pw" class="auth-input" required minlength="8">
                            </div>
                            <div>
                                <label class="auth-label">Confirm New Password</label>
                                <input type="password" id="sec-confirm-pw" class="auth-input" required minlength="8">
                            </div>
                            <div id="sec-feedback" style="display:none; font-size:0.9rem; padding:10px; border-radius:var(--nv-radius-sm);"></div>
                            <button type="submit" id="sec-save-btn" class="social-btn primary" style="width:auto; align-self:flex-start; padding:10px 24px;">Update Password</button>
                        </form>
                    </div>
                `;

                document.getElementById('account-password-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btn = document.getElementById('sec-save-btn');
                    const fb = document.getElementById('sec-feedback');
                    fb.style.display = 'none';

                    const currentPassword = document.getElementById('sec-current-pw').value;
                    const newPassword = document.getElementById('sec-new-pw').value;
                    const confirmPassword = document.getElementById('sec-confirm-pw').value;

                    if (newPassword !== confirmPassword) {
                        fb.textContent = 'New passwords do not match';
                        fb.style.background = 'rgba(255, 42, 109, 0.15)';
                        fb.style.color = 'var(--nv-crimson)';
                        fb.style.display = 'block';
                        return;
                    }

                    btn.disabled = true;
                    btn.textContent = 'Updating...';

                    try {
                        const res = await fetch('/api/auth/change-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
                        });
                        const data = await res.json();
                        if (res.ok) {
                            fb.textContent = 'Password successfully updated!';
                            fb.style.background = 'rgba(0, 229, 255, 0.15)';
                            fb.style.color = 'var(--nv-cyan)';
                            fb.style.display = 'block';
                            document.getElementById('account-password-form').reset();
                        } else {
                            throw new Error(data.error || 'Failed to update password');
                        }
                    } catch (err) {
                        fb.textContent = err.message;
                        fb.style.background = 'rgba(255, 42, 109, 0.15)';
                        fb.style.color = 'var(--nv-crimson)';
                        fb.style.display = 'block';
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Update Password';
                    }
                });
                break;

            case 'settings':
                contentArea.innerHTML = `
                    <div style="background:var(--nv-surface); border:1px solid var(--nv-border); border-radius:var(--nv-radius-md); padding:28px;">
                        <h2 style="font-size:1.3rem; margin-bottom:8px;">Archive Preferences & Settings</h2>
                        <p style="color:var(--nv-text-secondary); margin-bottom:20px;">Configure your appearance, audio, and notification preferences.</p>
                        <a href="/settings/" class="social-btn primary" style="text-decoration:none; display:inline-block;">Open Settings Panel &rarr;</a>
                    </div>
                `;
                break;
        }
    }

    loadAccountData();
});

