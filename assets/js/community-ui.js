document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('community-section');
    if (!container) return;

    const targetType = container.getAttribute('data-type');
    const targetId = container.getAttribute('data-id');
    
    if (!targetType || !targetId) return;

    let currentUser = null;
    try {
        const authRes = await fetch('/api/auth/me');
        if (authRes.ok) {
            const authData = await authRes.json();
            currentUser = authData.user;
        }
    } catch (e) {}

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .community-section { margin-top: 40px; border-top: 1px solid var(--nv-border); padding-top: 20px; }
        .community-tabs { display: flex; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid var(--nv-border); padding-bottom: 10px; }
        .community-tab { background: none; border: none; color: var(--nv-text-muted); font-size: 1.1rem; cursor: pointer; font-family: 'Space Mono', monospace; }
        .community-tab.active { color: var(--nv-primary); font-weight: bold; }
        .community-pane { display: none; }
        .community-pane.active { display: block; }
        
        .reactions-bar { display: flex; gap: 10px; margin-bottom: 20px; }
        .reaction-btn { display: flex; align-items: center; gap: 5px; background: var(--nv-bg-card); border: 1px solid var(--nv-border); color: var(--nv-text); padding: 5px 10px; border-radius: 4px; cursor: pointer; }
        .reaction-btn:hover { border-color: var(--nv-primary); }
        .reaction-btn.user-reacted { background: var(--nv-primary); color: #000; }
        
        .community-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px; background: var(--nv-bg-card); padding: 20px; border-radius: 8px; border: 1px solid var(--nv-border); }
        .community-form input, .community-form textarea, .community-form select { width: 100%; padding: 10px; background: #000; border: 1px solid var(--nv-border); color: var(--nv-text); font-family: inherit; }
        .community-form button { align-self: flex-start; padding: 10px 20px; background: var(--nv-primary); color: #000; border: none; font-weight: bold; cursor: pointer; }
        .community-form button:hover { opacity: 0.9; }
        
        .review-card, .comment-card { border: 1px solid var(--nv-border); padding: 15px; margin-bottom: 15px; border-radius: 8px; background: var(--nv-bg-card); }
        .review-header, .comment-header { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.9rem; color: var(--nv-text-muted); }
        .review-rating { color: var(--nv-primary); font-weight: bold; font-size: 1.2rem; }
        .review-title { font-weight: bold; margin-bottom: 10px; font-size: 1.1rem; }
        .review-proscons { margin-top: 10px; font-size: 0.9rem; display: flex; gap: 20px; }
        .pros { color: #4ade80; }
        .cons { color: #f87171; }
        
        .auth-prompt { text-align: center; padding: 20px; background: var(--nv-bg-card); border: 1px solid var(--nv-border); border-radius: 8px; margin-bottom: 20px; }
        .auth-prompt a { color: var(--nv-primary); font-weight: bold; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h2>Community</h2>
        <div class="reactions-bar" id="reactions-container">Loading reactions...</div>
        
        <div class="community-tabs">
            <button class="community-tab active" data-target="pane-reviews">Reviews</button>
            <button class="community-tab" data-target="pane-comments">Comments</button>
        </div>
        
        <div id="pane-reviews" class="community-pane active">
            ${!currentUser ? `<div class="auth-prompt">Please <a href="/login/">log in</a> to write a review.</div>` : `
            <form id="review-form" class="community-form">
                <h3>Write a Review</h3>
                <div style="display:flex; gap:10px;">
                    <select id="rev-rating" required style="width:100px;">
                        <option value="">Rating</option>
                        ${[10,9,8,7,6,5,4,3,2,1].map(n => `<option value="${n}">${n}/10</option>`).join('')}
                    </select>
                    <input type="text" id="rev-title" placeholder="Review Title" required style="flex:1;">
                </div>
                <textarea id="rev-body" placeholder="Your review..." rows="4" required></textarea>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="rev-pros" placeholder="Pros (comma separated)">
                    <input type="text" id="rev-cons" placeholder="Cons (comma separated)">
                </div>
                <button type="submit">Submit Review</button>
                <p id="rev-err" style="color:red;display:none;"></p>
            </form>
            `}
            <div id="reviews-list">Loading reviews...</div>
        </div>
        
        <div id="pane-comments" class="community-pane">
            ${!currentUser ? `<div class="auth-prompt">Please <a href="/login/">log in</a> to post a comment.</div>` : `
            <form id="comment-form" class="community-form">
                <h3>Post a Comment</h3>
                <textarea id="com-body" placeholder="Join the discussion..." rows="3" required></textarea>
                <button type="submit">Post</button>
                <p id="com-err" style="color:red;display:none;"></p>
            </form>
            `}
            <div id="comments-list">Loading comments...</div>
        </div>
    `;

    // Tabs logic
    document.querySelectorAll('.community-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.community-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.community-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    async function loadData() {
        try {
            const [reactRes, revRes, comRes] = await Promise.all([
                fetch(`/api/community/reactions/${targetType}/${targetId}`),
                fetch(`/api/community/reviews/${targetType}/${targetId}`),
                fetch(`/api/community/comments/${targetType}/${targetId}`)
            ]);
            
            const [reactData, revData, comData] = await Promise.all([
                reactRes.json(), revRes.json(), comRes.json()
            ]);

            renderReactions(reactData.summary || [], reactData.user_reaction);
            renderReviews(revData.reviews || []);
            renderComments(comData.comments || []);
        } catch (e) {
            console.error(e);
        }
    }

    function renderReactions(summary, userReaction) {
        const rContainer = document.getElementById('reactions-container');
        rContainer.innerHTML = '';
        const types = ['LIKE', 'HEART', 'STAR', 'FIRE'];
        const emojis = { 'LIKE': '👍', 'HEART': '❤️', 'STAR': '⭐', 'FIRE': '🔥' };
        
        types.forEach(t => {
            const count = summary.find(s => s.reaction_type === t)?.count || 0;
            const btn = document.createElement('button');
            btn.className = 'reaction-btn ' + (userReaction === t ? 'user-reacted' : '');
            btn.innerHTML = `${emojis[t]} <span>${count}</span>`;
            if (currentUser) {
                btn.addEventListener('click', async () => {
                    await fetch('/api/community/reactions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ target_type: targetType, target_id: targetId, reaction_type: t })
                    });
                    loadData();
                });
            } else {
                btn.title = "Log in to react";
            }
            rContainer.appendChild(btn);
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function renderReviews(reviews) {
        const list = document.getElementById('reviews-list');
        if (reviews.length === 0) {
            list.innerHTML = '<p style="color:var(--nv-text-muted);">No reviews yet. Be the first!</p>';
            return;
        }
        list.innerHTML = reviews.map(r => `
            <div class="review-card">
                <div class="review-header">
                    <span><strong><a href="/u/${escapeHtml(r.username)}" style="color:inherit;">${escapeHtml(r.display_name || r.username)}</a></strong></span>
                    <span>${new Date(r.created_at + 'Z').toLocaleDateString()}</span>
                </div>
                <div class="review-rating">${r.rating}/10</div>
                <div class="review-title">${escapeHtml(r.title)}</div>
                <p>${escapeHtml(r.body)}</p>
                ${(r.pros || r.cons) ? `
                <div class="review-proscons">
                    ${r.pros ? `<div class="pros"><strong>Pros:</strong> ${escapeHtml(r.pros)}</div>` : ''}
                    ${r.cons ? `<div class="cons"><strong>Cons:</strong> ${escapeHtml(r.cons)}</div>` : ''}
                </div>` : ''}
            </div>
        `).join('');
    }

    function renderComments(comments) {
        const list = document.getElementById('comments-list');
        if (comments.length === 0) {
            list.innerHTML = '<p style="color:var(--nv-text-muted);">No comments yet.</p>';
            return;
        }
        // Basic flat rendering for now
        list.innerHTML = comments.map(c => `
            <div class="comment-card">
                <div class="comment-header">
                    <span><strong><a href="/u/${escapeHtml(c.username)}" style="color:inherit;">${escapeHtml(c.display_name || c.username)}</a></strong></span>
                    <span>${new Date(c.created_at + 'Z').toLocaleDateString()}</span>
                </div>
                <p>${escapeHtml(c.body)}</p>
            </div>
        `).join('');
    }

    // Forms
    const revForm = document.getElementById('review-form');
    if (revForm) {
        revForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const err = document.getElementById('rev-err');
            err.style.display = 'none';
            try {
                const res = await fetch('/api/community/reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target_type: targetType,
                        target_id: targetId,
                        rating: parseInt(document.getElementById('rev-rating').value),
                        title: document.getElementById('rev-title').value,
                        body: document.getElementById('rev-body').value,
                        pros: document.getElementById('rev-pros').value,
                        cons: document.getElementById('rev-cons').value
                    })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                revForm.reset();
                loadData();
            } catch (ex) {
                err.textContent = ex.message;
                err.style.display = 'block';
            }
        });
    }

    const comForm = document.getElementById('comment-form');
    if (comForm) {
        comForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const err = document.getElementById('com-err');
            err.style.display = 'none';
            try {
                const res = await fetch('/api/community/comments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target_type: targetType,
                        target_id: targetId,
                        body: document.getElementById('com-body').value
                    })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                comForm.reset();
                loadData();
            } catch (ex) {
                err.textContent = ex.message;
                err.style.display = 'block';
            }
        });
    }

    loadData();
});

