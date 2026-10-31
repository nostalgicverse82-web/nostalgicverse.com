const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const mainStart = content.indexOf('<main');
const mainEnd = content.indexOf('</main>') + 7;

const headerBlock = content.substring(0, mainStart);
const footerBlock = content.substring(mainEnd);

const buildPage = (dir, title, desc, innerHtml) => {
    fs.mkdirSync(dir, { recursive: true });
    let page = headerBlock + '<main id="main-content" tabindex="-1">\n' + innerHtml + '\n</main>' + footerBlock;
    page = page.replace('<title>NostalgicVerse — The Games That Made History</title>', '<title>' + title + ' — NostalgicVerse</title>');
    page = page.replace('<meta name="description" content="NostalgicVerse is a digital archive, museum, and preservation platform dedicated to the history, hardware, milestones, and culture of video games from the 1980s through the modern era.">', '<meta name="description" content="' + desc + '">');
    fs.writeFileSync(dir + '/index.html', page);
};

// Login
buildPage('login', 'Log In', 'Log in to your NostalgicVerse account.', `
    <div class="auth-layout-container">
        <div class="auth-header">
            <h1>Log In</h1>
            <p>Access your saved archives and collections.</p>
        </div>
        <form id="login-form">
            <div class="auth-form-group">
                <label for="username" class="auth-label">Username or Email</label>
                <input type="text" id="username" name="username" class="auth-input" required>
            </div>
            <div class="auth-form-group password-wrap">
                <label for="password" class="auth-label">Password</label>
                <input type="password" id="password" name="password" class="auth-input" required>
                <button type="button" class="password-toggle">Show</button>
            </div>
            <div class="auth-error-msg" id="login-error" aria-live="polite"></div>
            <button type="submit" class="auth-btn">Log In</button>
        </form>
        <div class="auth-footer">
            <p><a href="/forgot-password/">Forgot Password?</a></p>
            <p style="margin-top:12px;">Don't have an account? <a href="/signup/">Sign Up</a></p>
        </div>
    </div>
`);

// Signup
buildPage('signup', 'Sign Up', 'Create a new NostalgicVerse account.', `
    <div class="auth-layout-container">
        <div class="auth-header">
            <h1>Sign Up</h1>
            <p>Join the archive to curate your collections.</p>
        </div>
        <form id="signup-form">
            <div class="auth-form-group">
                <label for="email" class="auth-label">Email</label>
                <input type="email" id="email" name="email" class="auth-input" required>
            </div>
            <div class="auth-form-group">
                <label for="username" class="auth-label">Username</label>
                <input type="text" id="username" name="username" class="auth-input" required minlength="3" maxlength="30">
            </div>
            <div class="auth-form-group">
                <label for="displayName" class="auth-label">Display Name</label>
                <input type="text" id="displayName" name="displayName" class="auth-input" required maxlength="50">
            </div>
            <div class="auth-form-group password-wrap">
                <label for="password" class="auth-label">Password</label>
                <input type="password" id="password" name="password" class="auth-input" required minlength="8">
                <button type="button" class="password-toggle">Show</button>
            </div>
            <div class="auth-form-group password-wrap">
                <label for="confirmPassword" class="auth-label">Confirm Password</label>
                <input type="password" id="confirmPassword" name="confirmPassword" class="auth-input" required minlength="8">
                <button type="button" class="password-toggle">Show</button>
            </div>
            <div class="auth-error-msg" id="signup-error" aria-live="polite"></div>
            <button type="submit" class="auth-btn">Create Account</button>
        </form>
        <div class="auth-footer">
            <p>Already have an account? <a href="/login/">Log In</a></p>
        </div>
    </div>
`);

// Forgot Password
buildPage('forgot-password', 'Forgot Password', 'Reset your NostalgicVerse password.', `
    <div class="auth-layout-container">
        <div class="auth-header">
            <h1>Reset Password</h1>
            <p>Enter your username or email address.</p>
        </div>
        <form id="forgot-password-form">
            <div class="auth-form-group">
                <label for="reset-id" class="auth-label">Username or Email</label>
                <input type="text" id="reset-id" name="reset-id" class="auth-input" required>
            </div>
            <div class="auth-error-msg" id="forgot-error" aria-live="polite"></div>
            <button type="submit" class="auth-btn" disabled>Send Reset Instructions (Coming Soon)</button>
        </form>
        <div class="auth-footer">
            <p>Remembered your password? <a href="/login/">Log In</a></p>
        </div>
    </div>
`);

// Account Shell
buildPage('account', 'Account Settings', 'Manage your NostalgicVerse account.', `
    <div class="auth-layout-container" style="max-width:800px;">
        <div class="auth-header">
            <h1>Account Dashboard</h1>
            <p>Account features are currently under construction.</p>
        </div>
        
        <div id="account-info-container" style="text-align:center; margin-bottom: 24px;">
            <!-- Profile Info injected here -->
        </div>

        <div style="text-align:center; color:var(--nv-text-secondary);">
            <button id="change-avatar-btn" class="auth-btn" style="width:auto; margin-bottom:16px;">Change Profile Icon</button>
            <p>Future features will include:</p>
            <ul style="list-style:none; padding:0; margin-top:16px; display:inline-block; text-align:left;">
                <li>- Profile Editing</li>
                <li>- Favorites Management</li>
                <li>- Curated Collections</li>
                <li>- Support Requests</li>
                <li>- Notification Settings</li>
            </ul>
        </div>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    const user = data.user;
                    
                    const container = document.getElementById('account-info-container');
                    let avatarPath = '/assets/images/branding/logo/logo.png';
                    if (window.AvatarPicker) {
                        await window.AvatarPicker.loadRegistry();
                        avatarPath = window.AvatarPicker.getAvatarPath(user.avatar_id);
                    }
                    
                    container.innerHTML = '<img src="' + avatarPath + '" alt="Avatar" style="width:96px; height:96px; border-radius:50%; object-fit:cover; margin-bottom:12px; border:2px solid var(--nv-cyan);"><h2>' + (user.display_name || user.username) + '</h2><p style="color:var(--nv-text-muted);">@' + user.username + '</p>';

                    if (!user.avatar_id && window.AvatarPicker) {
                        window.AvatarPicker.show({ onSave: () => window.location.reload() });
                    }

                    document.getElementById('change-avatar-btn').addEventListener('click', () => {
                        if (window.AvatarPicker) {
                            window.AvatarPicker.show({ currentAvatarId: user.avatar_id, onSave: () => window.location.reload() });
                        }
                    });

                } else {
                    window.location.href = '/login/';
                }
            } catch (e) {
                console.error(e);
            }
        });
    </script>
`);

// User Search Shell
buildPage('users/search', 'User Search', 'Find NostalgicVerse members.', `
    <link rel="stylesheet" href="/assets/css/social-ui.css">
    <div class="auth-layout-container" style="max-width:800px; text-align:left;">
        <div class="auth-header">
            <h1 style="color:var(--nv-gold);">User Search</h1>
        </div>
        <div style="display:flex; gap:10px; margin-bottom: 20px;">
            <input type="text" id="user-search-input" placeholder="Search by username or display name..." style="flex:1; padding:12px; background:var(--nv-bg-alt); border:1px solid var(--nv-border); color:white; border-radius:4px;">
            <button id="user-search-btn" class="social-btn primary">Search</button>
        </div>
        <div id="user-search-results" class="social-list">
            <!-- Populated by JS -->
        </div>
    </div>
    <script src="/assets/js/user-search-ui.js"></script>
`);

// Public Profile Shell
buildPage('u', 'User Profile', 'View NostalgicVerse user profile.', `
    <link rel="stylesheet" href="/assets/css/social-ui.css">
    <div class="auth-layout-container" style="max-width:800px; text-align:left;">
        <div id="public-profile-area" style="text-align:center;">
            <p style="color:var(--nv-text-muted);">Loading profile...</p>
        </div>
    </div>
    <script src="/assets/js/public-profile-ui.js"></script>
`);

// Messages Shell
buildPage('messages', 'Messages', 'NostalgicVerse Direct Messaging.', `
    <link rel="stylesheet" href="/assets/css/chat-ui.css">
    <div class="chat-container">
        <div class="chat-sidebar" id="chat-sidebar">
            <div class="chat-sidebar-header">
                <h2>Messages</h2>
                <button id="new-chat-btn" class="chat-icon-btn" aria-label="New Chat">+</button>
            </div>
            <div class="chat-list" id="chat-list">
                <!-- Chat list injected here -->
                <p style="text-align:center;color:var(--nv-text-muted);margin-top:20px;">Loading...</p>
            </div>
        </div>
        
        <div class="chat-main" id="chat-main">
            <div class="chat-empty-state" id="chat-empty-state">
                <img src="/assets/images/branding/logo/logo.png" alt="Logo" style="width:64px;opacity:0.5;margin-bottom:16px;">
                <h2>Your Messages</h2>
                <p style="color:var(--nv-text-muted);">Select a conversation or start a new one.</p>
            </div>
            
            <div class="chat-active" id="chat-active" style="display:none;">
                <div class="chat-header">
                    <button id="chat-back-btn" class="chat-icon-btn chat-mobile-only" aria-label="Back">&larr;</button>
                    <img id="chat-active-avatar" src="" alt="Avatar" class="chat-avatar">
                    <div class="chat-header-info">
                        <h3 id="chat-active-name"></h3>
                        <span id="chat-active-status" class="chat-status-text"></span>
                    </div>
                </div>
                
                <div class="chat-messages" id="chat-messages">
                    <!-- Messages injected here -->
                </div>
                
                <div class="chat-composer">
                    <form id="chat-form">
                        <input type="text" id="chat-input" placeholder="Type a message..." required autocomplete="off">
                        <button type="submit" class="chat-send-btn" id="chat-send-btn">Send</button>
                    </form>
                </div>
            </div>
        </div>
    </div>
    
    <div id="new-chat-modal" class="avatar-picker-modal" style="display:none; z-index:9999;">
        <div class="avatar-picker-content">
            <div class="avatar-picker-header">
                <h2>New Conversation</h2>
                <button type="button" class="avatar-picker-close" onclick="document.getElementById('new-chat-modal').style.display='none'">&times;</button>
            </div>
            <form id="new-chat-form" style="display:flex;flex-direction:column;gap:12px;">
                <label style="color:var(--nv-text-secondary);font-size:0.9rem;">Enter exact username to chat with:</label>
                <input type="text" id="new-chat-username" required style="padding:10px;background:var(--nv-bg-alt);border:1px solid var(--nv-border);color:#fff;border-radius:4px;">
                <div id="new-chat-error" style="color:var(--nv-red);font-size:0.8rem;display:none;"></div>
                <button type="submit" class="auth-btn">Start Chat</button>
            </form>
        </div>
    </div>

    <script src="/assets/js/chat-ui.js"></script>
`);

// Friends Shell
buildPage('friends', 'Friends', 'Manage your friends and requests.', `
    <link rel="stylesheet" href="/assets/css/social-ui.css">
    <div class="auth-layout-container" style="max-width:800px; text-align:left;">
        <div class="auth-header">
            <h1>Friends</h1>
        </div>
        <div class="social-tabs">
            <button class="social-tab active" data-tab="friends-list">My Friends</button>
            <button class="social-tab" data-tab="friends-requests">Requests</button>
            <button class="social-tab" data-tab="friends-search">Find Users</button>
        </div>
        <div id="friends-content-area" style="margin-top:20px;">
            <!-- Content Injected via JS -->
            <p style="text-align:center; color:var(--nv-text-muted);">Loading...</p>
        </div>
    </div>
    <script src="/assets/js/friends-ui.js"></script>
`);

// Notifications Shell
buildPage('notifications', 'Notifications', 'Your notifications.', `
    <link rel="stylesheet" href="/assets/css/social-ui.css">
    <div class="auth-layout-container" style="max-width:800px; text-align:left;">
        <div class="auth-header" style="display:flex; justify-content:space-between; align-items:center;">
            <h1>Notifications</h1>
            <button id="mark-all-read-btn" class="auth-btn" style="width:auto; padding:8px 16px;">Mark All Read</button>
        </div>
        <div id="notifications-list" style="margin-top:20px; display:flex; flex-direction:column; gap:12px;">
            <p style="text-align:center; color:var(--nv-text-muted);">Loading...</p>
        </div>
    </div>
    <script src="/assets/js/notifications-ui.js"></script>
`);

// Support Shell
buildPage('support', 'Support', 'Contact NostalgicVerse support.', `
    <link rel="stylesheet" href="/assets/css/social-ui.css">
    <div class="auth-layout-container" style="max-width:800px; text-align:left;">
        <div class="auth-header">
            <h1>Support</h1>
        </div>
        <div class="social-tabs">
            <button class="social-tab active" data-tab="support-new">New Ticket</button>
            <button class="social-tab" data-tab="support-my">My Tickets</button>
        </div>
        <div id="support-content-area" style="margin-top:20px;">
            <p style="text-align:center; color:var(--nv-text-muted);">Loading...</p>
        </div>
    </div>
    <script src="/assets/js/support-ui.js"></script>
`);

// Ideas Shell
buildPage('ideas', 'Submissions & Ideas', 'Submit ideas and content to NostalgicVerse.', `
    <link rel="stylesheet" href="/assets/css/social-ui.css">
    <div class="auth-layout-container" style="max-width:800px; text-align:left;">
        <div class="auth-header">
            <h1>Ideas & Submissions</h1>
        </div>
        <div class="social-tabs">
            <button class="social-tab active" data-tab="ideas-public">Community Ideas</button>
            <button class="social-tab" data-tab="ideas-my">My Submissions</button>
            <button class="social-tab" data-tab="ideas-new">Submit Idea</button>
        </div>
        <div id="ideas-content-area" style="margin-top:20px;">
            <p style="text-align:center; color:var(--nv-text-muted);">Loading...</p>
        </div>
    </div>
    <script src="/assets/js/ideas-ui.js"></script>
`);

// Settings Shell
buildPage('settings', 'Settings', 'Manage account settings.', `
    <link rel="stylesheet" href="/assets/css/social-ui.css">
    <div class="auth-layout-container" style="max-width:800px; text-align:left;">
        <div class="auth-header">
            <h1>Settings</h1>
        </div>
        <div style="margin-top:20px; background:var(--nv-bg-alt); padding:20px; border-radius:8px; border:1px solid var(--nv-border);">
            <h3>Security</h3>
            <p style="color:var(--nv-text-muted); margin-bottom:12px;">Change your password</p>
            <form id="change-password-form" style="display:flex; flex-direction:column; gap:12px; max-width:400px;">
                <input type="password" id="cp-current" placeholder="Current Password" class="auth-input" required>
                <input type="password" id="cp-new" placeholder="New Password" class="auth-input" required minlength="8">
                <input type="password" id="cp-confirm" placeholder="Confirm New Password" class="auth-input" required minlength="8">
                <div id="cp-msg" style="font-size:0.9rem;"></div>
                <button type="submit" class="auth-btn">Update Password</button>
            </form>
        </div>
    </div>
    <script src="/assets/js/settings-ui.js"></script>
`);

// Owner Shell
buildPage('owner', 'Owner Control Center', 'NostalgicVerse Administration.', `
    <link rel="stylesheet" href="/assets/css/social-ui.css">
    <div class="auth-layout-container" style="max-width:1000px; text-align:left;">
        <div class="auth-header">
            <h1 style="color:var(--nv-gold);">Control Center</h1>
        </div>
        <div class="social-tabs">
            <button class="social-tab active" data-tab="owner-dashboard">Dashboard</button>
            <button class="social-tab" data-tab="owner-submissions">Submissions</button>
            <button class="social-tab" data-tab="owner-support">Support</button>
            <button class="social-tab" data-tab="owner-content">Generators</button>
            <button class="social-tab" data-tab="owner-reports">Reports</button>
            <button class="social-tab" data-tab="owner-comments">Comments</button>
        </div>
        <div id="owner-content-area" style="margin-top:20px;">
            <p style="text-align:center; color:var(--nv-text-muted);">Loading...</p>
        </div>
    </div>
    <script src="/assets/js/owner-ui.js"></script>
`);

// Collections Shell
buildPage('collections', 'Collections', 'Manage your collections.', `
    <link rel="stylesheet" href="/assets/css/social-ui.css">
    <div class="auth-layout-container" style="max-width:800px; text-align:left;">
        <div class="auth-header">
            <h1>My Collections</h1>
        </div>
        <div id="collections-list" style="margin-top:20px; display:flex; flex-direction:column; gap:12px;">
            <p style="text-align:center; color:var(--nv-text-muted);">Collections interface coming soon...</p>
        </div>
    </div>
`);

console.log('Successfully generated auth shell pages.');

