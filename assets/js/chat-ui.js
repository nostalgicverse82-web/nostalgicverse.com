/**
 * NostalgicVerse Chat UI Engine
 * Features:
 * - Strict message deduplication & optimistic client reconciliation
 * - Canonical message ID & client_message_id handling
 * - Composer persistence across all updates and events
 * - Multi-tab and reconnect safety via NVRealtime singleton
 * - Smart scrolling and keyboard shortcuts (Enter to send, Shift+Enter for newline)
 */
document.addEventListener('DOMContentLoaded', async () => {
    let currentUser = null;
    let activeConversationId = null;
    let conversations = [];
    let unreadScrollIndicator = null;
    let typingTimer = null;
    let oldestMessageId = null;
    let hasMoreEarlierMessages = false;
    let isLoadingEarlierMessages = false;
    let loadEarlierBtn = null;

    const els = {
        sidebar: document.getElementById('chat-sidebar'),
        list: document.getElementById('chat-list'),
        main: document.getElementById('chat-main'),
        emptyState: document.getElementById('chat-empty-state'),
        activeState: document.getElementById('chat-active'),
        messages: document.getElementById('chat-messages'),
        form: document.getElementById('chat-form'),
        input: document.getElementById('chat-input'),
        backBtn: document.getElementById('chat-back-btn'),
        newBtn: document.getElementById('new-chat-btn'),
        modal: document.getElementById('new-chat-modal'),
        activeName: document.getElementById('chat-active-name'),
        activeAvatar: document.getElementById('chat-active-avatar'),
        activeStatus: document.getElementById('chat-active-status'),
        callActions: document.getElementById('chat-header-actions'),
        voiceCallBtn: document.getElementById('chat-call-voice-btn'),
        videoCallBtn: document.getElementById('chat-call-video-btn')
    };

    if (!els.list) return; // Not on messages page

    // 1. Check Auth & Initialize
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            if (window.AvatarPicker) await window.AvatarPicker.loadRegistry();
            await loadConversations();
            initRealtime();
            handleUrlParams();
        } else {
            window.location.href = '/login/';
        }
    } catch (e) {
        window.location.href = '/login/';
    }

    // 2. Fetch Conversations
    async function loadConversations() {
        try {
            const res = await fetch('/api/chat/conversations');
            const data = await res.json();
            conversations = data.conversations || [];
            renderConversations();
        } catch (e) {
            console.error('[Chat UI] loadConversations error:', e);
            els.list.innerHTML = '<p style="text-align:center;color:red;padding:20px;">Error loading chats.</p>';
        }
    }

    function renderConversations() {
        els.list.innerHTML = '';
        if (conversations.length === 0) {
            els.list.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--nv-text-muted);">
                    <p style="margin-bottom:10px; font-weight:600; color:var(--nv-text-primary);">No conversations yet</p>
                    <p style="margin-bottom:20px; font-size:0.88rem;">Connect with friends and community members to start chatting.</p>
                    <a href="/friends/" class="social-btn primary" style="display:inline-block; text-decoration:none;">Discover People</a>
                </div>
            `;
            
            if (!activeConversationId) {
                els.emptyState.style.display = 'flex';
                els.activeState.style.display = 'none';
                els.emptyState.innerHTML = `
                    <div style="text-align:center; padding:40px;">
                        <img src="/assets/images/branding/logo/logo.png" alt="Logo" style="width:64px;opacity:0.4;margin-bottom:16px;">
                        <h2 style="color:var(--nv-text-primary); margin-bottom:8px;">No conversations yet</h2>
                        <p style="color:var(--nv-text-muted); margin-bottom:24px; max-width:400px;">Select a conversation or find members in the directory to start a new chat.</p>
                        <div style="display:flex; gap:12px; justify-content:center;">
                            <a href="/friends/" class="social-btn primary" style="display:inline-block; text-decoration:none;">Discover People</a>
                            <button class="social-btn" onclick="document.getElementById('new-chat-btn').click()">+ New Message</button>
                        </div>
                    </div>
                `;
            }
            return;
        }

        conversations.forEach(c => {
            const div = document.createElement('div');
            div.className = 'chat-list-item' + (c.id === activeConversationId ? ' active' : '');
            div.setAttribute('data-conv-id', c.id);
            
            let avatarPath = '/assets/images/branding/logo/logo.png';
            if (window.AvatarPicker) avatarPath = window.AvatarPicker.getAvatarPath(c.other_avatar_id);
            
            const name = escapeHtml(c.other_display_name || c.other_username);
            const preview = c.last_message ? escapeHtml(c.last_message) : 'No messages yet';
            const unreadBadge = c.unread_count > 0 
                ? `<span class="badge" style="background:var(--nv-cyan);color:#000;font-size:0.75rem;padding:2px 6px;border-radius:10px;font-weight:bold;margin-left:auto;">${c.unread_count}</span>` 
                : '';
            
            div.innerHTML = `
                <img src="${avatarPath}" alt="" class="chat-list-avatar">
                <div class="chat-list-info" style="display:flex; flex-direction:column; justify-content:center;">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <h3 class="chat-list-name">${name}</h3>
                        ${unreadBadge}
                    </div>
                    <p class="chat-list-preview">${preview}</p>
                </div>
            `;
            div.addEventListener('click', () => openConversation(c));
            els.list.appendChild(div);
        });
    }

    // 3. Open Conversation
    async function openConversation(conv) {
        if (activeConversationId && activeConversationId !== conv.id && window.NVRealtime) {
            window.NVRealtime.leaveConversation(activeConversationId);
        }

        activeConversationId = conv.id;
        conv.unread_count = 0; // Local mark read
        
        let avatarPath = '/assets/images/branding/logo/logo.png';
        if (window.AvatarPicker) avatarPath = window.AvatarPicker.getAvatarPath(conv.other_avatar_id);
        
        els.activeName.textContent = conv.other_display_name || conv.other_username;
        els.activeAvatar.src = avatarPath;
        els.activeStatus.textContent = '';
        
        els.emptyState.style.display = 'none';
        els.activeState.style.display = 'flex';
        if (els.callActions) {
            els.callActions.style.display = 'flex';
            if (els.voiceCallBtn) {
                els.voiceCallBtn.onclick = () => {
                    if (window.NVCallManager) {
                        window.NVCallManager.startCall(conv.id, conv.other_user_id, 'VOICE', {
                            displayName: conv.other_display_name,
                            username: conv.other_username,
                            avatarId: conv.other_avatar_id
                        });
                    }
                };
            }
            if (els.videoCallBtn) {
                els.videoCallBtn.onclick = () => {
                    if (window.NVCallManager) {
                        window.NVCallManager.startCall(conv.id, conv.other_user_id, 'VIDEO', {
                            displayName: conv.other_display_name,
                            username: conv.other_username,
                            avatarId: conv.other_avatar_id
                        });
                    }
                };
            }
        }
        els.messages.innerHTML = '<p style="text-align:center;color:var(--nv-text-muted);margin-top:20px;">Loading messages...</p>';
        
        if (window.innerWidth <= 768) {
            els.list.style.display = 'none';
            els.main.classList.add('open');
        }
        
        renderConversations(); // Update active highlight
        removeScrollDownIndicator();
        
        try {
            // Join realtime room
            if (window.NVRealtime) {
                window.NVRealtime.joinConversation(conv.id);
            }

            // Mark read on server
            fetch(`/api/chat/conversations/${conv.id}/read`, { method: 'POST' }).catch(() => {});

            // Fetch messages
            const res = await fetch(`/api/chat/conversations/${conv.id}/messages?limit=50`);
            const data = await res.json();
            
            els.messages.innerHTML = '';
            const messages = data.messages || [];
            
            if (messages.length === 0) {
                oldestMessageId = null;
                hasMoreEarlierMessages = false;
                els.messages.innerHTML = `
                    <div style="text-align:center; padding:40px 20px; color:var(--nv-text-muted); margin:auto;">
                        <p style="color:var(--nv-gold); margin-bottom:8px; font-weight:bold;">Beginning of conversation</p>
                        <p style="font-size:0.9rem;">Send a message to say hello!</p>
                    </div>
                `;
            } else {
                if (messages.length >= 50) {
                    oldestMessageId = messages[0].id;
                    hasMoreEarlierMessages = true;
                    ensureLoadEarlierButton();
                } else {
                    oldestMessageId = null;
                    hasMoreEarlierMessages = false;
                }
                messages.forEach(m => renderOrUpdateMessage(m, false));
                scrollToBottom(false);
            }
            
            // Focus composer input
            if (els.input) els.input.focus();
        } catch (e) {
            console.error('[Chat UI] openConversation error:', e);
            els.messages.innerHTML = '<p style="text-align:center;color:red;margin-top:20px;">Error loading messages.</p>';
        }
    }

    function ensureLoadEarlierButton() {
        if (!hasMoreEarlierMessages || !oldestMessageId) {
            if (loadEarlierBtn) {
                loadEarlierBtn.remove();
                loadEarlierBtn = null;
            }
            return;
        }
        if (!loadEarlierBtn || !els.messages.contains(loadEarlierBtn)) {
            loadEarlierBtn = document.createElement('div');
            loadEarlierBtn.className = 'chat-load-earlier-wrapper';
            loadEarlierBtn.style.textAlign = 'center';
            loadEarlierBtn.style.padding = '12px 0';
            loadEarlierBtn.innerHTML = `
                <button class="social-btn" style="font-size:0.8rem;padding:6px 14px;background:var(--nv-bg-alt);border:1px solid var(--nv-border);cursor:pointer;">
                    Load earlier messages
                </button>
            `;
            loadEarlierBtn.querySelector('button').addEventListener('click', loadEarlierMessages);
            els.messages.insertBefore(loadEarlierBtn, els.messages.firstChild);
        }
    }

    async function loadEarlierMessages() {
        if (isLoadingEarlierMessages || !oldestMessageId || !activeConversationId) return;
        isLoadingEarlierMessages = true;
        
        const btn = loadEarlierBtn ? loadEarlierBtn.querySelector('button') : null;
        if (btn) btn.textContent = 'Loading earlier messages...';

        const previousScrollHeight = els.messages.scrollHeight;
        const previousScrollTop = els.messages.scrollTop;

        try {
            const res = await fetch(`/api/chat/conversations/${activeConversationId}/messages?before=${oldestMessageId}&limit=50`);
            const data = await res.json();
            const earlier = data.messages || [];

            if (earlier.length < 50) {
                hasMoreEarlierMessages = false;
                if (loadEarlierBtn) {
                    loadEarlierBtn.remove();
                    loadEarlierBtn = null;
                }
            } else {
                hasMoreEarlierMessages = true;
                if (btn) btn.textContent = 'Load earlier messages';
            }

            if (earlier.length > 0) {
                oldestMessageId = earlier[0].id;
                const fragment = document.createDocumentFragment();
                earlier.forEach(m => {
                    const node = createMessageNode(m);
                    fragment.appendChild(node);
                });

                if (loadEarlierBtn && loadEarlierBtn.nextSibling) {
                    els.messages.insertBefore(fragment, loadEarlierBtn.nextSibling);
                } else if (loadEarlierBtn) {
                    els.messages.appendChild(fragment);
                } else {
                    els.messages.insertBefore(fragment, els.messages.firstChild);
                }

                // Maintain scroll position after prepending
                const heightDiff = els.messages.scrollHeight - previousScrollHeight;
                els.messages.scrollTop = previousScrollTop + heightDiff;
            }
        } catch (err) {
            console.error('[Chat UI] loadEarlierMessages error:', err);
            if (btn) btn.textContent = 'Error loading earlier. Retry?';
        } finally {
            isLoadingEarlierMessages = false;
        }
    }

    function createMessageNode(m) {
        const isMe = m.sender_id === currentUser.id;
        const timeStr = new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = 'chat-message ' + (isMe ? 'sent' : 'received');
        if (m.isSending) div.classList.add('sending');
        if (m.isFailed) div.classList.add('failed');

        if (m.id) div.setAttribute('data-id', m.id);
        if (m.client_message_id) div.setAttribute('data-client-id', m.client_message_id);

        const statusNote = m.isSending ? ' <span style="font-size:0.65rem;opacity:0.6;">(sending...)</span>' : '';

        if (m.message_type === 'CALL_REQUEST') {
            let callData = {};
            try {
                callData = typeof m.body === 'string' ? JSON.parse(m.body) : m.body;
            } catch (e) {
                callData = { label: m.body };
            }
            const isVideo = callData.callType === 'VIDEO';
            const icon = isVideo ? '📹' : '📞';
            const label = escapeHtml(callData.label || 'Call event');
            div.innerHTML = `
                <div class="chat-call-card">
                    <div class="chat-call-icon ${isVideo ? 'video' : ''}">${icon}</div>
                    <div class="chat-call-info">
                        <div class="chat-call-title">${label}</div>
                        <div class="chat-call-sub">${isVideo ? 'Video Call' : 'Voice Call'}</div>
                    </div>
                </div>
                <span class="chat-time">${timeStr}</span>
            `;
            return div;
        }

        div.innerHTML = `
            ${escapeHtml(m.body)}
            <span class="chat-time">${timeStr}${statusNote}</span>
        `;
        return div;
    }

    // 4. Message Upsert & Deduplication Core
    function renderOrUpdateMessage(m, shouldScroll = true) {
        if (!m || !m.body) return;

        // Clean empty state if present
        const emptyPlaceholder = els.messages.querySelector('div[style*="margin:auto"]');
        if (emptyPlaceholder) emptyPlaceholder.remove();

        // 1. Check if message already exists by canonical id
        let existingNode = null;
        if (m.id) {
            existingNode = els.messages.querySelector(`[data-id="${m.id}"]`);
        }
        
        // 2. Check if message exists by client_message_id
        if (!existingNode && m.client_message_id) {
            existingNode = els.messages.querySelector(`[data-client-id="${m.client_message_id}"]`);
        }

        const isMe = m.sender_id === currentUser.id;
        const timeStr = new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (existingNode) {
            // Reconcile and update existing node in place
            if (m.id) existingNode.setAttribute('data-id', m.id);
            if (m.client_message_id) existingNode.setAttribute('data-client-id', m.client_message_id);
            existingNode.classList.remove('sending', 'failed');
            const timeEl = existingNode.querySelector('.chat-time');
            if (timeEl) timeEl.textContent = timeStr;
            return existingNode;
        }

        // Create new message bubble
        const div = createMessageNode(m);
        els.messages.appendChild(div);

        if (shouldScroll) {
            const isNearBottom = (els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight) < 140;
            if (isNearBottom || isMe) {
                scrollToBottom(true);
            } else {
                showScrollDownIndicator();
            }
        }

        return div;
    }

    function scrollToBottom(smooth = true) {
        removeScrollDownIndicator();
        els.messages.scrollTo({
            top: els.messages.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }

    function showScrollDownIndicator() {
        if (unreadScrollIndicator) return;
        unreadScrollIndicator = document.createElement('button');
        unreadScrollIndicator.className = 'chat-scroll-down-btn';
        unreadScrollIndicator.innerHTML = `&darr; New messages`;
        unreadScrollIndicator.addEventListener('click', () => scrollToBottom(true));
        els.activeState.appendChild(unreadScrollIndicator);
    }

    function removeScrollDownIndicator() {
        if (unreadScrollIndicator) {
            unreadScrollIndicator.remove();
            unreadScrollIndicator = null;
        }
    }

    // Scroll listener on messages container to dismiss indicator when reaching bottom
    els.messages.addEventListener('scroll', () => {
        const isNearBottom = (els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight) < 50;
        if (isNearBottom) {
            removeScrollDownIndicator();
        }
    });

    // 5. Send Message (Idempotent Flow)
    async function sendMessage() {
        const body = (els.input.value || '').trim();
        if (!body || !activeConversationId) return;

        // Unique client_message_id to prevent duplicate inserts
        const client_message_id = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Optimistic render
        const optimisticMsg = {
            id: null,
            client_message_id,
            conversation_id: activeConversationId,
            sender_id: currentUser.id,
            body,
            created_at: new Date().toISOString(),
            isSending: true
        };
        const msgNode = renderOrUpdateMessage(optimisticMsg, true);

        // Clear input and keep composer focused
        els.input.value = '';
        els.input.focus();
        updateConversationPreview(activeConversationId, body);

        try {
            const res = await fetch(`/api/chat/conversations/${activeConversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body, client_message_id })
            });
            const data = await res.json();
            
            if (res.ok && data.success && data.message) {
                // Reconcile optimistic bubble with canonical server message
                renderOrUpdateMessage(data.message, false);
                updateConversationPreview(activeConversationId, data.message.body);
            } else {
                throw new Error(data.error || 'Failed to send');
            }
        } catch (err) {
            console.error('[Chat UI] Send error:', err);
            if (msgNode) {
                msgNode.classList.remove('sending');
                msgNode.classList.add('failed');
                const timeEl = msgNode.querySelector('.chat-time');
                if (timeEl) {
                    timeEl.innerHTML = `<span style="color:var(--nv-crimson);">Failed to send</span> <button style="color:var(--nv-cyan);text-decoration:underline;cursor:pointer;background:none;border:none;padding:0;font-size:inherit;">Retry</button>`;
                    const retryBtn = timeEl.querySelector('button');
                    if (retryBtn) {
                        retryBtn.addEventListener('click', () => {
                            els.input.value = body;
                            msgNode.remove();
                            sendMessage();
                        });
                    }
                }
            }
        }
    }

    els.form.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    // Keyboard support: Enter = send, Shift+Enter = newline
    els.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function updateConversationPreview(convId, body) {
        const c = conversations.find(x => x.id === convId);
        if (c) {
            c.last_message = body;
            c.updated_at = new Date().toISOString();
            conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            renderConversations();
        }
    }

    // 6. Realtime Event Listener Integration (NVRealtime)
    function initRealtime() {
        if (!window.NVRealtime) return;
        window.NVRealtime.connect();

        // Listen for new messages (handles both standardized and legacy names)
        const handleNewMessage = (data) => {
            const msg = data.message;
            if (!msg) return;

            updateConversationPreview(msg.conversation_id, msg.body);

            if (msg.conversation_id === activeConversationId) {
                renderOrUpdateMessage(msg, true);
                // Mark read since conversation is open
                fetch(`/api/chat/conversations/${activeConversationId}/read`, { method: 'POST' }).catch(() => {});
            } else {
                // Increment unread count for conversation in sidebar
                const conv = conversations.find(c => c.id === msg.conversation_id);
                if (conv) {
                    conv.unread_count = (conv.unread_count || 0) + 1;
                    renderConversations();
                } else {
                    loadConversations();
                }
            }
        };

        window.NVRealtime.on('message.created', handleNewMessage);
        window.NVRealtime.on('NEW_MESSAGE', handleNewMessage);

        // Call status changes in active room
        const handleCallStatusChange = () => {
            if (activeConversationId) {
                fetch(`/api/chat/conversations/${activeConversationId}/messages?limit=30`)
                    .then(r => r.json())
                    .then(data => {
                        (data.messages || []).forEach(m => renderOrUpdateMessage(m, false));
                    })
                    .catch(() => {});
            }
        };
        window.NVRealtime.on('call.status_change', handleCallStatusChange);
        window.NVRealtime.on('call.requested', handleCallStatusChange);

        // Typing indicators
        const handleTyping = (data) => {
            if (data.conversationId === activeConversationId && data.userId !== currentUser.id) {
                els.activeStatus.textContent = 'Typing...';
                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => {
                    els.activeStatus.textContent = '';
                }, 3000);
            }
        };

        window.NVRealtime.on('typing.started', handleTyping);
        window.NVRealtime.on('TYPING', handleTyping);

        // On connection re-established, re-fetch messages to reconcile missed frames
        window.NVRealtime.on('connection.open', () => {
            if (activeConversationId) {
                window.NVRealtime.joinConversation(activeConversationId);
                fetch(`/api/chat/conversations/${activeConversationId}/messages?limit=30`)
                    .then(r => r.json())
                    .then(data => {
                        (data.messages || []).forEach(m => renderOrUpdateMessage(m, false));
                    })
                    .catch(() => {});
            }
        });
    }

    // Send typing broadcast on input (debounced)
    let typingDebounce = null;
    els.input.addEventListener('input', () => {
        if (!activeConversationId || !window.NVRealtime) return;
        if (!typingDebounce) {
            window.NVRealtime.sendTyping(activeConversationId);
            typingDebounce = setTimeout(() => {
                typingDebounce = null;
            }, 2500);
        }
    });

    // 7. New Chat Modal & User Search
    if (els.newBtn) {
        els.newBtn.addEventListener('click', () => {
            if (els.modal) els.modal.style.display = 'flex';
            const newSearchInput = document.getElementById('new-chat-search-input');
            if (newSearchInput) {
                newSearchInput.value = '';
                newSearchInput.focus();
                performNewChatSearch('');
            }
        });
    }

    const newSearchInput = document.getElementById('new-chat-search-input');
    const newSearchResults = document.getElementById('new-chat-search-results');
    let searchTimeout = null;
    
    if (newSearchInput) {
        newSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performNewChatSearch(newSearchInput.value.trim());
            }, 250);
        });
    }

    async function performNewChatSearch(q) {
        if (!newSearchResults) return;
        newSearchResults.innerHTML = '<p style="color:var(--nv-text-muted);padding:10px;">Loading members...</p>';
        try {
            const url = q ? `/api/users/search?q=${encodeURIComponent(q)}` : `/api/users/discover?limit=10`;
            const res = await fetch(url);
            const data = await res.json();
            const users = data.users || [];
            
            if (users.length === 0) {
                newSearchResults.innerHTML = '<p style="color:var(--nv-text-muted);padding:10px;">No community members found.</p>';
                return;
            }
            
            newSearchResults.innerHTML = users.map(u => {
                let avatarPath = '/assets/images/branding/logo/logo.png';
                if (window.AvatarPicker) avatarPath = window.AvatarPicker.getAvatarPath(u.avatarId || u.avatar_id);
                
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--nv-bg-alt); padding:10px 14px; border:1px solid var(--nv-border); border-radius:6px; margin-bottom:8px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${avatarPath}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;">
                            <div>
                                <strong style="display:block; color:var(--nv-text-primary); font-size:0.95rem;">${escapeHtml(u.displayName || u.display_name || u.username)}</strong>
                                <span style="font-size:0.8rem; color:var(--nv-text-muted);">@${escapeHtml(u.username)}</span>
                            </div>
                        </div>
                        <div>
                            <button class="social-btn primary start-chat-btn" data-id="${escapeHtml(u.id)}" data-username="${escapeHtml(u.username)}">Message</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            newSearchResults.querySelectorAll('.start-chat-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const target_id = e.currentTarget.dataset.id;
                    const target_username = e.currentTarget.dataset.username;
                    try {
                        const res = await fetch('/api/chat/conversations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ target_id, target_username })
                        });
                        const data = await res.json();
                        if (data.success && data.conversation_id) {
                            if (els.modal) els.modal.style.display = 'none';
                            await loadConversations();
                            const conv = conversations.find(c => c.id === data.conversation_id);
                            if (conv) openConversation(conv);
                        } else {
                            alert(data.error || 'Failed to start conversation');
                        }
                    } catch (err) {
                        alert('Network error starting conversation');
                    }
                });
            });
        } catch (err) {
            newSearchResults.innerHTML = `<p style="color:red;padding:10px;">${err.message}</p>`;
        }
    }

    // Mobile Back Button
    if (els.backBtn) {
        els.backBtn.addEventListener('click', () => {
            els.main.classList.remove('open');
            els.list.style.display = 'block';
            if (activeConversationId && window.NVRealtime) {
                window.NVRealtime.leaveConversation(activeConversationId);
            }
            activeConversationId = null;
            renderConversations();
        });
    }

    // Modal Close
    const modalClose = document.getElementById('new-chat-modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            if (els.modal) els.modal.style.display = 'none';
        });
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

    // 8. Handle Direct User Chat Entry via URL (?u=USER_ID)
    async function handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const targetUserId = urlParams.get('u');
        if (!targetUserId) return;

        try {
            const res = await fetch('/api/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetUserId })
            });
            const data = await res.json();
            if (data.success && data.conversation_id) {
                await loadConversations();
                const conv = conversations.find(c => c.id === data.conversation_id);
                if (conv) openConversation(conv);
            }
        } catch (err) {
            console.error('[Chat UI] Direct chat URL error:', err);
        }
    }

    // 9. Mobile Visual Viewport Handling (Keyboard and Orientation)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            if (els.main && els.main.classList.contains('open') && els.messages) {
                const isNearBottom = (els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight) < 160;
                if (isNearBottom) {
                    scrollToBottom(false);
                }
            }
        });
    }
});
