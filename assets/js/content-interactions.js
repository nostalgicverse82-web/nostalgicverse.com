/**
 * NostalgicVerse Universal Content Interaction System
 * Handles Reactions (Like/Dislike), Comments & Replies, Reviews, Saves/Favorites, and Sharing.
 * Backed by authoritative database state with optimistic UI reconciliation.
 */
(function() {
    'use strict';

    // Content type capability matrix (Requirement 185)
    const CAPABILITIES = {
        'GAME':     { likes: true, dislikes: true, comments: true, reviews: true,  favorites: true, saves: false, share: true },
        'CONSOLE':  { likes: true, dislikes: true, comments: true, reviews: true,  favorites: true, saves: false, share: true },
        'STORY':    { likes: true, dislikes: false, comments: true, reviews: false, favorites: false, saves: true,  share: true },
        'GUIDE':    { likes: true, dislikes: false, comments: true, reviews: false, favorites: false, saves: true,  share: true },
        'NEWS':     { likes: true, dislikes: false, comments: true, reviews: false, favorites: false, saves: true,  share: true },
        'TIMELINE': { likes: true, dislikes: false, comments: true, reviews: false, favorites: false, saves: false, share: true },
        'GENRE':    { likes: true, dislikes: false, comments: true, reviews: false, favorites: false, saves: false, share: true },
        'RELEASE':  { likes: true, dislikes: false, comments: true, reviews: false, favorites: false, saves: false, share: true },
        'IDEA':     { likes: true, dislikes: true,  comments: true, reviews: false, favorites: false, saves: false, share: true }
    };

    function normalizeType(type) {
        if (!type) return 'GAME';
        const clean = type.toLowerCase().trim();
        if (clean.startsWith('game')) return 'GAME';
        if (clean.startsWith('console')) return 'CONSOLE';
        if (clean.startsWith('stori') || clean.startsWith('story')) return 'STORY';
        if (clean.startsWith('guide')) return 'GUIDE';
        if (clean.startsWith('new') || clean.startsWith('article')) return 'NEWS';
        if (clean.startsWith('timeline')) return 'TIMELINE';
        if (clean.startsWith('genre')) return 'GENRE';
        if (clean.startsWith('release')) return 'RELEASE';
        if (clean.startsWith('idea')) return 'IDEA';
        return clean.toUpperCase();
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

    function showToast(message) {
        const existing = document.querySelector('.nv-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'nv-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    function fallbackCopy(text) {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Link copied to clipboard');
        } catch (err) {
            showToast('Could not copy link');
        }
    }

    async function initContentInteractions(options) {
        const { contentType, contentId, mountElement } = options;
        const container = typeof mountElement === 'string' ? document.querySelector(mountElement) : mountElement;
        if (!container) return;

        const normalizedType = normalizeType(contentType);
        const caps = CAPABILITIES[normalizedType] || CAPABILITIES['GAME'];

        let currentUser = null;
        try {
            const authRes = await fetch('/api/auth/me');
            if (authRes.ok) {
                currentUser = (await authRes.json()).user;
            }
        } catch(e) {}

        let reactionState = { likes: 0, dislikes: 0, userReaction: null };
        let isSaved = false;
        let isFavorite = false;
        let isReactionInFlight = false;
        let isSaveInFlight = false;
        let isFavInFlight = false;
        let activeTab = caps.reviews ? 'reviews' : 'comments';
        let commentsData = [];
        let reviewsData = { reviews: [], stats: { count: 0, averageRating: 0 } };

        container.className = 'nv-interaction-wrapper';
        container.innerHTML = `
            <div class="nv-interaction-bar" id="nv-bar">
                <!-- Buttons injected by renderBar -->
            </div>
            <div class="nv-interaction-panels" id="nv-panels">
                <div class="nv-panel-tabs" id="nv-tabs"></div>
                <div class="nv-panel-content" id="nv-pane-reviews"></div>
                <div class="nv-panel-content" id="nv-pane-comments"></div>
            </div>
        `;

        const barEl = container.querySelector('#nv-bar');
        const tabsEl = container.querySelector('#nv-tabs');
        const reviewsPane = container.querySelector('#nv-pane-reviews');
        const commentsPane = container.querySelector('#nv-pane-comments');

        // ==========================================
        // DATA LOADERS
        // ==========================================
        async function loadReactions() {
            if (!caps.likes) return;
            try {
                const res = await fetch(`/api/community/reactions/${normalizedType}/${encodeURIComponent(contentId)}`);
                const data = await res.json();
                reactionState = {
                    likes: data.counts?.likes || 0,
                    dislikes: data.counts?.dislikes || 0,
                    userReaction: data.userReaction || null
                };
                renderBar();
            } catch(e) {}
        }

        async function loadSavedState() {
            if (!currentUser) return;
            if (caps.saves) {
                try {
                    const res = await fetch(`/api/community/saves/${normalizedType}/${encodeURIComponent(contentId)}`);
                    const data = await res.json();
                    isSaved = !!data.isSaved;
                } catch(e) {}
            }
            if (caps.favorites) {
                try {
                    const res = await fetch('/api/users/favorites');
                    const data = await res.json();
                    const list = data.favorites || [];
                    isFavorite = list.some(f => f.item_type === normalizedType && f.item_id === contentId);
                } catch(e) {}
            }
            renderBar();
        }

        async function loadComments() {
            if (!caps.comments) return;
            try {
                const res = await fetch(`/api/community/comments/${normalizedType}/${encodeURIComponent(contentId)}`);
                const data = await res.json();
                commentsData = data.comments || [];
                renderComments();
                renderBar();
            } catch(e) {}
        }

        async function loadReviews() {
            if (!caps.reviews) return;
            try {
                const res = await fetch(`/api/community/reviews/${normalizedType}/${encodeURIComponent(contentId)}`);
                const data = await res.json();
                reviewsData = data;
                renderReviews();
                renderBar();
            } catch(e) {}
        }

        // ==========================================
        // RENDER BAR
        // ==========================================
        function renderBar() {
            let html = '';

            // Like Button
            if (caps.likes) {
                const isLiked = reactionState.userReaction === 'LIKE';
                html += `
                    <button class="nv-bar-btn like-btn ${isLiked ? 'active' : ''}" id="nv-like-btn" title="Like">
                        <svg viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                        <span>Like</span>
                        <span class="nv-bar-count">${reactionState.likes}</span>
                    </button>
                `;
            }

            // Dislike Button
            if (caps.dislikes) {
                const isDisliked = reactionState.userReaction === 'DISLIKE';
                html += `
                    <button class="nv-bar-btn dislike-btn ${isDisliked ? 'active' : ''}" id="nv-dislike-btn" title="Dislike">
                        <svg viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
                        <span>Dislike</span>
                        <span class="nv-bar-count">${reactionState.dislikes}</span>
                    </button>
                `;
            }

            // Reviews Trigger
            if (caps.reviews) {
                const avgText = reviewsData.stats.count > 0 ? ` (${reviewsData.stats.averageRating}★ / ${reviewsData.stats.count})` : '';
                html += `
                    <button class="nv-bar-btn ${activeTab === 'reviews' ? 'active' : ''}" id="nv-trigger-reviews">
                        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <span>Reviews${avgText}</span>
                    </button>
                `;
            }

            // Comments Trigger
            if (caps.comments) {
                const countText = commentsData.length > 0 ? ` (${commentsData.length})` : '';
                html += `
                    <button class="nv-bar-btn ${activeTab === 'comments' ? 'active' : ''}" id="nv-trigger-comments">
                        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        <span>Discussion${countText}</span>
                    </button>
                `;
            }

            // Save / Favorite Button
            if (caps.saves) {
                html += `
                    <button class="nv-bar-btn save-btn ${isSaved ? 'active' : ''}" id="nv-save-btn">
                        <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                        <span>${isSaved ? 'Saved' : 'Save'}</span>
                    </button>
                `;
            } else if (caps.favorites) {
                html += `
                    <button class="nv-bar-btn save-btn ${isFavorite ? 'active' : ''}" id="nv-fav-btn">
                        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        <span>${isFavorite ? 'Favorited' : 'Favorite'}</span>
                    </button>
                `;
            }

            // Share Button
            if (caps.share) {
                html += `
                    <button class="nv-bar-btn" id="nv-share-btn" title="Share exhibit">
                        <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                        <span>Share</span>
                    </button>
                `;
            }

            barEl.innerHTML = html;
            attachBarEvents();
        }

        function attachBarEvents() {
            // Like
            const likeBtn = barEl.querySelector('#nv-like-btn');
            if (likeBtn) {
                likeBtn.addEventListener('click', async () => {
                    if (!currentUser) return window.location.href = '/login/';
                    if (isReactionInFlight) return;
                    const newType = reactionState.userReaction === 'LIKE' ? null : 'LIKE';
                    await toggleReaction(newType);
                });
            }

            // Dislike
            const dislikeBtn = barEl.querySelector('#nv-dislike-btn');
            if (dislikeBtn) {
                dislikeBtn.addEventListener('click', async () => {
                    if (!currentUser) return window.location.href = '/login/';
                    if (isReactionInFlight) return;
                    const newType = reactionState.userReaction === 'DISLIKE' ? null : 'DISLIKE';
                    await toggleReaction(newType);
                });
            }

            // Switch to Reviews tab
            const revTrigger = barEl.querySelector('#nv-trigger-reviews');
            if (revTrigger) {
                revTrigger.addEventListener('click', () => switchTab('reviews'));
            }

            // Switch to Comments tab
            const comTrigger = barEl.querySelector('#nv-trigger-comments');
            if (comTrigger) {
                comTrigger.addEventListener('click', () => switchTab('comments'));
            }

            // Save Toggle
            const saveBtn = barEl.querySelector('#nv-save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    if (!currentUser) return window.location.href = '/login/';
                    if (isSaveInFlight) return;
                    isSaveInFlight = true;
                    try {
                        const res = await fetch('/api/community/saves', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ target_type: normalizedType, target_id: contentId })
                        });
                        const data = await res.json();
                        if (data.success) {
                            isSaved = !!data.isSaved;
                            renderBar();
                            showToast(isSaved ? 'Saved to bookmarks' : 'Removed from bookmarks');
                        }
                    } catch(e) {
                        showToast('Unable to update bookmark');
                    } finally {
                        isSaveInFlight = false;
                    }
                });
            }

            // Favorite Toggle
            const favBtn = barEl.querySelector('#nv-fav-btn');
            if (favBtn) {
                favBtn.addEventListener('click', async () => {
                    if (!currentUser) return window.location.href = '/login/';
                    if (isFavInFlight) return;
                    isFavInFlight = true;
                    try {
                        if (isFavorite) {
                            await fetch(`/api/users/favorites/${normalizedType}/${encodeURIComponent(contentId)}`, { method: 'DELETE' });
                            isFavorite = false;
                            showToast('Removed from favorites');
                        } else {
                            await fetch('/api/users/favorites', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ itemType: normalizedType, itemId: contentId })
                            });
                            isFavorite = true;
                            showToast('Added to favorites');
                        }
                        renderBar();
                    } catch(e) {
                        showToast('Unable to update favorite');
                    } finally {
                        isFavInFlight = false;
                    }
                });
            }

            // Share
            const shareBtn = barEl.querySelector('#nv-share-btn');
            if (shareBtn) {
                shareBtn.addEventListener('click', async () => {
                    const shareData = {
                        title: document.title || 'NostalgicVerse Exhibit',
                        url: window.location.href
                    };
                    if (navigator.share) {
                        try {
                            await navigator.share(shareData);
                            return;
                        } catch(e) {
                            // User cancelled or share failed, fallback
                        }
                    }
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        try {
                            await navigator.clipboard.writeText(window.location.href);
                            showToast('Link copied to clipboard');
                            return;
                        } catch(e) {
                            // Clipboard API rejected, use DOM fallback
                        }
                    }
                    fallbackCopy(window.location.href);
                });
            }
        }

        async function toggleReaction(type) {
            if (isReactionInFlight) return;
            isReactionInFlight = true;
            try {
                const res = await fetch('/api/community/reactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target_type: normalizedType,
                        target_id: contentId,
                        reaction_type: type
                    })
                });
                const data = await res.json();
                if (data.success) {
                    reactionState = {
                        likes: data.counts.likes,
                        dislikes: data.counts.dislikes,
                        userReaction: data.userReaction
                    };
                    renderBar();
                }
            } catch(e) {
                showToast('Unable to register reaction');
            } finally {
                isReactionInFlight = false;
            }
        }

        // ==========================================
        // TABS LOGIC
        // ==========================================
        function switchTab(tab) {
            activeTab = tab;
            renderBar();
            
            if (tab === 'reviews') {
                reviewsPane.classList.add('active');
                commentsPane.classList.remove('active');
            } else {
                commentsPane.classList.add('active');
                reviewsPane.classList.remove('active');
            }
        }

        // ==========================================
        // COMMENTS VIEW
        // ==========================================
        function renderComments() {
            commentsPane.innerHTML = `
                ${!currentUser ? `
                    <div style="background:var(--nv-surface);border:1px solid var(--nv-border);padding:18px;border-radius:8px;text-align:center;margin-bottom:24px;">
                        <span style="color:var(--nv-text-secondary);">Join the historical discussion. <a href="/login/" style="color:var(--nv-cyan);text-decoration:underline;font-weight:bold;">Log in</a> to post a comment.</span>
                    </div>
                ` : `
                    <form id="nv-comment-form" class="nv-comment-form">
                        <textarea id="nv-comment-input" class="nv-textarea" placeholder="Share a historical memory, critique, or perspective on this exhibit..." required></textarea>
                        <div class="nv-form-footer">
                            <button type="submit" class="btn btn-primary" style="min-height:40px;padding:8px 20px;font-size:0.85rem;">Post Comment</button>
                        </div>
                    </form>
                `}
                <div class="nv-comments-list" id="nv-comments-container">
                    ${commentsData.length === 0 ? `
                        <div style="text-align:center;padding:48px 20px;color:var(--nv-text-muted);">
                            <p style="font-size:1.1rem;color:var(--nv-text-primary);margin-bottom:6px;">Be the first to share a memory, thought, or perspective.</p>
                            <p style="font-size:0.88rem;">Preserve gaming history together.</p>
                        </div>
                    ` : commentsData.map(c => renderCommentCard(c)).join('')}
                </div>
            `;

            // Form Submit
            const form = commentsPane.querySelector('#nv-comment-form');
            if (form) {
                const input = form.querySelector('#nv-comment-input');
                const submitBtn = form.querySelector('button[type="submit"]');
                const draftKey = `nv_draft_comment_${normalizedType}_${contentId}`;
                
                // Restore draft if present
                const savedDraft = sessionStorage.getItem(draftKey);
                if (savedDraft && !input.value) {
                    input.value = savedDraft;
                }
                
                input.addEventListener('input', () => {
                    sessionStorage.setItem(draftKey, input.value);
                });

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (form.dataset.submitting === 'true') return;
                    const body = input.value.trim();
                    if (!body) return;

                    form.dataset.submitting = 'true';
                    if (submitBtn) submitBtn.disabled = true;

                    try {
                        const res = await fetch('/api/community/comments', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                target_type: normalizedType,
                                target_id: contentId,
                                body
                            })
                        });
                        const data = await res.json();
                        if (data.success) {
                            sessionStorage.removeItem(draftKey);
                            input.value = '';
                            await loadComments();
                            showToast('Comment published');
                        } else {
                            showToast(data.error || 'Failed to post comment. Your draft was saved.');
                        }
                    } catch(e) {
                        showToast('Network error posting comment. Your draft was saved.');
                    } finally {
                        form.dataset.submitting = 'false';
                        if (submitBtn) submitBtn.disabled = false;
                    }
                });
            }

            attachCommentActions();
        }

        function renderCommentCard(c) {
            let avatar = '/assets/images/branding/logo/logo.png';
            if (window.AvatarPicker && c.author.avatarId) {
                avatar = window.AvatarPicker.getAvatarPath(c.author.avatarId);
            }
            const timeStr = new Date(c.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

            return `
                <div class="nv-comment-card ${c.parentId ? 'is-reply' : ''}" id="comment-${c.id}" data-id="${c.id}">
                    <div class="nv-comment-header">
                        <div class="nv-author-info">
                            <img src="${avatar}" class="nv-author-avatar">
                            <div>
                                <span class="nv-author-name">${escapeHtml(c.author.displayName || c.author.username)}</span>
                                <span class="nv-author-username">@${escapeHtml(c.author.username)}</span>
                            </div>
                        </div>
                        <span class="nv-comment-time">${timeStr}</span>
                    </div>
                    <div class="nv-comment-body" id="body-${c.id}">${escapeHtml(c.body)}</div>
                    ${(!c.isDeleted && currentUser) ? `
                        <div class="nv-comment-actions">
                            <button class="nv-action-btn reply-btn" data-id="${c.id}" data-author="${escapeHtml(c.author.username)}">Reply</button>
                            ${c.isOwn ? `
                                <button class="nv-action-btn edit-btn" data-id="${c.id}">Edit</button>
                                <button class="nv-action-btn danger delete-btn" data-id="${c.id}">Delete</button>
                            ` : `
                                <button class="nv-action-btn report-btn" data-id="${c.id}">Report</button>
                            `}
                        </div>
                    ` : ''}
                    <div id="reply-container-${c.id}" style="margin-top:12px;"></div>
                </div>
            `;
        }

        function attachCommentActions() {
            // Reply
            commentsPane.querySelectorAll('.reply-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const commentId = e.currentTarget.dataset.id;
                    const author = e.currentTarget.dataset.author;
                    const container = commentsPane.querySelector(`#reply-container-${commentId}`);
                    if (!container) return;

                    if (container.innerHTML.trim()) {
                        container.innerHTML = '';
                        return;
                    }

                    container.innerHTML = `
                        <div style="background:var(--nv-bg-alt);border:1px solid var(--nv-border);padding:14px;border-radius:6px;margin-top:8px;">
                            <textarea class="nv-textarea" id="reply-input-${commentId}" placeholder="Replying to @${author}..." style="min-height:60px;"></textarea>
                            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
                                <button class="social-btn" onclick="document.getElementById('reply-container-${commentId}').innerHTML=''">Cancel</button>
                                <button class="social-btn primary" id="send-reply-${commentId}">Submit Reply</button>
                            </div>
                        </div>
                    `;

                    container.querySelector(`#send-reply-${commentId}`).addEventListener('click', async () => {
                        const input = container.querySelector(`#reply-input-${commentId}`);
                        const body = input.value.trim();
                        if (!body) return;

                        try {
                            const res = await fetch('/api/community/comments', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    target_type: normalizedType,
                                    target_id: contentId,
                                    parent_id: commentId,
                                    body
                                })
                            });
                            const data = await res.json();
                            if (data.success) {
                                container.innerHTML = '';
                                await loadComments();
                                showToast('Reply posted');
                            }
                        } catch(e) {}
                    });
                });
            });

            // Edit
            commentsPane.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const commentId = e.currentTarget.dataset.id;
                    const bodyEl = commentsPane.querySelector(`#body-${commentId}`);
                    if (!bodyEl) return;

                    const currentText = bodyEl.textContent;
                    bodyEl.innerHTML = `
                        <div style="margin-top:6px;">
                            <textarea class="nv-textarea" id="edit-input-${commentId}" style="min-height:70px;">${escapeHtml(currentText)}</textarea>
                            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
                                <button class="social-btn" id="cancel-edit-${commentId}">Cancel</button>
                                <button class="social-btn primary" id="save-edit-${commentId}">Save</button>
                            </div>
                        </div>
                    `;

                    bodyEl.querySelector(`#cancel-edit-${commentId}`).addEventListener('click', () => {
                        bodyEl.textContent = currentText;
                    });

                    bodyEl.querySelector(`#save-edit-${commentId}`).addEventListener('click', async () => {
                        const newBody = bodyEl.querySelector(`#edit-input-${commentId}`).value.trim();
                        if (!newBody) return;

                        try {
                            const res = await fetch(`/api/community/comments/${commentId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ body: newBody })
                            });
                            const data = await res.json();
                            if (data.success) {
                                bodyEl.textContent = newBody;
                                showToast('Comment updated');
                            }
                        } catch(e) {}
                    });
                });
            });

            // Delete
            commentsPane.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const commentId = e.currentTarget.dataset.id;
                    if (!confirm('Are you sure you want to delete this comment?')) return;

                    try {
                        const res = await fetch(`/api/community/comments/${commentId}`, { method: 'DELETE' });
                        const data = await res.json();
                        if (data.success) {
                            await loadComments();
                            showToast('Comment deleted');
                        }
                    } catch(e) {}
                });
            });

            // Report
            commentsPane.querySelectorAll('.report-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const commentId = e.currentTarget.dataset.id;
                    const reason = prompt('Please specify reason for reporting this comment (e.g. spam, harassment):');
                    if (!reason || !reason.trim()) return;

                    try {
                        await fetch('/api/community/reports', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                target_type: 'COMMENT',
                                target_id: commentId,
                                reason: reason.trim()
                            })
                        });
                        showToast('Report submitted for moderation review');
                    } catch(e) {}
                });
            });
        }

        // ==========================================
        // REVIEWS VIEW
        // ==========================================
        function renderReviews() {
            if (!caps.reviews) return;
            const stats = reviewsData.stats;
            const list = reviewsData.reviews;

            reviewsPane.innerHTML = `
                <div class="nv-reviews-summary">
                    <div class="nv-score-box">
                        <span class="nv-score-num">${stats.averageRating > 0 ? stats.averageRating : '—'}</span>
                        <span class="nv-score-label">Rating</span>
                    </div>
                    <div>
                        <h3 style="margin:0 0 4px;font-size:1.15rem;color:var(--nv-text-primary);">Community Historical Assessment</h3>
                        <p style="margin:0;color:var(--nv-text-muted);font-size:0.9rem;">Based on ${stats.count} retrospective ${stats.count === 1 ? 'review' : 'reviews'}.</p>
                    </div>
                </div>

                ${!currentUser ? `
                    <div style="background:var(--nv-surface);border:1px solid var(--nv-border);padding:18px;border-radius:8px;text-align:center;margin-bottom:24px;">
                        <span style="color:var(--nv-text-secondary);"><a href="/login/" style="color:var(--nv-cyan);text-decoration:underline;font-weight:bold;">Log in</a> to write a review.</span>
                    </div>
                ` : `
                    <form id="nv-review-form" class="nv-comment-form">
                        <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
                            <select id="nv-rev-rating" required style="padding:10px;background:var(--nv-bg-alt);border:1px solid var(--nv-border);color:var(--nv-gold);border-radius:4px;font-weight:bold;">
                                <option value="">Select Rating</option>
                                <option value="10">10 / 10 — Masterpiece</option>
                                <option value="9">9 / 10 — Essential</option>
                                <option value="8">8 / 10 — Great</option>
                                <option value="7">7 / 10 — Good</option>
                                <option value="6">6 / 10 — Decent</option>
                                <option value="5">5 / 10 — Mediocre</option>
                                <option value="4">4 / 10 — Flawed</option>
                                <option value="3">3 / 10 — Poor</option>
                                <option value="2">2 / 10 — Bad</option>
                                <option value="1">1 / 10 — Historic Failure</option>
                            </select>
                            <input type="text" id="nv-rev-title" class="auth-input" placeholder="Headline / Retrospective Summary" required style="flex:1;">
                        </div>
                        <textarea id="nv-rev-body" class="nv-textarea" placeholder="Detailed retrospective review..." required></textarea>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
                            <input type="text" id="nv-rev-pros" class="auth-input" placeholder="Pros (e.g. Graphics, Soundtrack)">
                            <input type="text" id="nv-rev-cons" class="auth-input" placeholder="Cons (e.g. Difficulty spikes)">
                        </div>
                        <div class="nv-form-footer">
                            <button type="submit" class="btn btn-primary" style="min-height:40px;padding:8px 20px;font-size:0.85rem;">Submit Review</button>
                        </div>
                    </form>
                `}

                <div class="nv-reviews-list">
                    ${list.length === 0 ? `
                        <div style="text-align:center;padding:48px 20px;color:var(--nv-text-muted);">
                            <p style="font-size:1.1rem;color:var(--nv-text-primary);margin-bottom:6px;">No reviews yet.</p>
                            <p style="font-size:0.88rem;">Be the first player to record a historical review for this title.</p>
                        </div>
                    ` : list.map(r => {
                        let avatar = '/assets/images/branding/logo/logo.png';
                        if (window.AvatarPicker && r.author.avatarId) {
                            avatar = window.AvatarPicker.getAvatarPath(r.author.avatarId);
                        }
                        const timeStr = new Date(r.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

                        return `
                            <div class="nv-review-card">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                                    <div class="nv-author-info">
                                        <img src="${avatar}" class="nv-author-avatar">
                                        <div>
                                            <span class="nv-author-name">${escapeHtml(r.author.displayName || r.author.username)}</span>
                                            <span class="nv-author-username">@${escapeHtml(r.author.username)}</span>
                                        </div>
                                    </div>
                                    <span class="nv-comment-time">${timeStr}</span>
                                </div>
                                <div class="nv-review-rating-badge">${r.rating} / 10 ★</div>
                                <div class="nv-review-title">${escapeHtml(r.title)}</div>
                                <p class="nv-comment-body">${escapeHtml(r.body)}</p>
                                ${(r.pros || r.cons) ? `
                                    <div class="nv-pros-cons">
                                        ${r.pros ? `<div class="nv-pro-box"><strong>Pros:</strong> ${escapeHtml(r.pros)}</div>` : ''}
                                        ${r.cons ? `<div class="nv-con-box"><strong>Cons:</strong> ${escapeHtml(r.cons)}</div>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            // Review Form Submit
            const revForm = reviewsPane.querySelector('#nv-review-form');
            if (revForm) {
                const draftKey = `nv_draft_review_${normalizedType}_${contentId}`;
                const titleInput = revForm.querySelector('#nv-rev-title');
                const bodyInput = revForm.querySelector('#nv-rev-body');
                const ratingInput = revForm.querySelector('#nv-rev-rating');
                const submitBtn = revForm.querySelector('button[type="submit"]');

                try {
                    const saved = JSON.parse(sessionStorage.getItem(draftKey) || '{}');
                    if (saved.title && titleInput && !titleInput.value) titleInput.value = saved.title;
                    if (saved.body && bodyInput && !bodyInput.value) bodyInput.value = saved.body;
                    if (saved.rating && ratingInput && !ratingInput.value) ratingInput.value = saved.rating;
                } catch (_) {}

                const saveReviewDraft = () => {
                    try {
                        sessionStorage.setItem(draftKey, JSON.stringify({
                            title: titleInput ? titleInput.value : '',
                            body: bodyInput ? bodyInput.value : '',
                            rating: ratingInput ? ratingInput.value : ''
                        }));
                    } catch (_) {}
                };
                if (titleInput) titleInput.addEventListener('input', saveReviewDraft);
                if (bodyInput) bodyInput.addEventListener('input', saveReviewDraft);
                if (ratingInput) ratingInput.addEventListener('change', saveReviewDraft);

                revForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (revForm.dataset.submitting === 'true') return;

                    const rating = parseInt(ratingInput.value, 10);
                    const title = titleInput.value.trim();
                    const body = bodyInput.value.trim();
                    const pros = revForm.querySelector('#nv-rev-pros').value.trim();
                    const cons = revForm.querySelector('#nv-rev-cons').value.trim();

                    revForm.dataset.submitting = 'true';
                    if (submitBtn) submitBtn.disabled = true;

                    try {
                        const res = await fetch('/api/community/reviews', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                target_type: normalizedType,
                                target_id: contentId,
                                rating,
                                title,
                                body,
                                pros,
                                cons
                            })
                        });
                        const data = await res.json();
                        if (data.success) {
                            sessionStorage.removeItem(draftKey);
                            revForm.reset();
                            await loadReviews();
                            showToast('Review submitted');
                        } else {
                            showToast(data.error || 'Failed to submit review. Draft saved.');
                        }
                    } catch(e) {
                        showToast('Network error submitting review. Draft saved.');
                    } finally {
                        revForm.dataset.submitting = 'false';
                        if (submitBtn) submitBtn.disabled = false;
                    }
                });
            }
        }

        // Initialize display
        renderBar();
        switchTab(activeTab);

        // Fetch initial live data in parallel
        await Promise.all([
            loadReactions(),
            loadSavedState(),
            loadComments(),
            loadReviews()
        ]);
    }

    // Expose globally
    window.initContentInteractions = initContentInteractions;

    // Automatic hook if element exists on page
    document.addEventListener('DOMContentLoaded', () => {
        const autoMount = document.querySelector('#community-interactions, [data-nv-community]');
        if (autoMount) {
            const contentType = autoMount.dataset.type || autoMount.getAttribute('data-type');
            const contentId = autoMount.dataset.id || autoMount.getAttribute('data-id');
            if (contentType && contentId) {
                initContentInteractions({
                    contentType,
                    contentId,
                    mountElement: autoMount
                });
            }
        }
    });
})();

