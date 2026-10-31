document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-search-input');
    const btn = document.getElementById('user-search-btn');
    const resultsArea = document.getElementById('user-search-results');
    
    async function searchUsers() {
        const q = input.value.trim();
        if (q.length < 3) {
            resultsArea.innerHTML = '<p style="padding:10px; color:var(--nv-text-muted);">Please enter at least 3 characters.</p>';
            return;
        }
        
        resultsArea.innerHTML = '<p style="padding:10px; color:var(--nv-text-muted);">Searching...</p>';
        
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Search failed');
            
            if (data.users.length === 0) {
                resultsArea.innerHTML = '<p style="padding:10px; color:var(--nv-text-muted);">No users found.</p>';
                return;
            }
            
            resultsArea.innerHTML = data.users.map(u => `
                <div class="social-list-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--nv-border);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="/assets/images/profile-icons/${u.avatar_id}.png" alt="Avatar" style="width:40px; height:40px; border-radius:50%;">
                        <div>
                            <strong>${u.display_name}</strong><br>
                            <span style="color:var(--nv-text-muted); font-size:0.9em;">@${u.username}</span>
                        </div>
                    </div>
                    <div>
                        <a href="/u/${u.username}" class="social-btn primary" style="padding: 6px 12px; font-size: 0.9rem;">View Profile</a>
                    </div>
                </div>
            `).join('');
            
        } catch (err) {
            resultsArea.innerHTML = `<p class="error" style="padding:10px;">${err.message}</p>`;
        }
    }
    
    btn.addEventListener('click', searchUsers);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });
});
