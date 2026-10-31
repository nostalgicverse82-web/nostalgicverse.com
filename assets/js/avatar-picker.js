// Phase 04: Avatar Picker Logic
window.AvatarPicker = (function() {
    'use strict';

    let registry = [];
    let modalEl = null;
    let selectedId = null;
    let onSaveCallback = null;

    async function loadRegistry() {
        if (registry.length > 0) return registry;
        try {
            const res = await fetch('/api/account/avatars');
            if (res.ok) {
                registry = await res.json();
            }
        } catch (e) {
            console.error('Failed to load avatars', e);
        }
        return registry;
    }

    function createModalHTML() {
        const div = document.createElement('div');
        div.className = 'avatar-picker-modal';
        div.id = 'avatar-picker-modal';
        div.innerHTML = `
            <div class="avatar-picker-content">
                <div class="avatar-picker-header">
                    <h2>Choose your profile icon</h2>
                    <p>Select an avatar to represent you in the archive.</p>
                </div>
                <div class="avatar-picker-preview-area">
                    <img src="" alt="Avatar Preview" class="avatar-picker-preview" id="avatar-preview-img" style="display:none;">
                </div>
                <div class="avatar-picker-grid" id="avatar-grid"></div>
                <div class="avatar-picker-footer">
                    <button class="avatar-skip-btn" id="avatar-skip-btn">Skip</button>
                    <button class="avatar-save-btn" id="avatar-save-btn">Save Avatar</button>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        return div;
    }

    async function show(options = {}) {
        await loadRegistry();
        
        if (!modalEl) {
            modalEl = createModalHTML();
            bindEvents();
        }

        selectedId = options.currentAvatarId || null;
        onSaveCallback = options.onSave || null;

        renderGrid();
        updatePreview();

        modalEl.classList.add('visible');
    }

    function hide() {
        if (modalEl) {
            modalEl.classList.remove('visible');
        }
    }

    function renderGrid() {
        const grid = document.getElementById('avatar-grid');
        grid.innerHTML = '';

        registry.forEach(avatar => {
            const btn = document.createElement('button');
            btn.className = 'avatar-btn';
            btn.setAttribute('aria-label', avatar.name + ' profile icon');
            btn.setAttribute('aria-pressed', avatar.id === selectedId ? 'true' : 'false');
            btn.dataset.id = avatar.id;
            
            const img = document.createElement('img');
            img.src = avatar.path;
            img.alt = '';
            img.loading = 'lazy';
            
            // Image fallback to default icon logic if we wanted, but these are local so they should load.
            img.onerror = () => { img.src = '/assets/images/branding/logo/logo.png'; }; // Safe fallback
            
            btn.appendChild(img);
            
            btn.addEventListener('click', () => {
                selectedId = avatar.id;
                renderGrid();
                updatePreview();
            });

            grid.appendChild(btn);
        });
    }

    function updatePreview() {
        const previewImg = document.getElementById('avatar-preview-img');
        if (!selectedId) {
            previewImg.style.display = 'none';
            return;
        }
        
        const avatar = registry.find(a => a.id === selectedId);
        if (avatar) {
            previewImg.src = avatar.path;
            previewImg.style.display = 'block';
        }
    }

    function bindEvents() {
        document.getElementById('avatar-skip-btn').addEventListener('click', () => {
            hide();
            if (onSaveCallback) onSaveCallback(null);
        });

        document.getElementById('avatar-save-btn').addEventListener('click', async () => {
            if (!selectedId) {
                // If nothing selected, maybe fallback to img1? 
                // We said: "If a user has no avatar selected: use one safe default avatar. Choose a suitable default from the 50."
                selectedId = 'img1'; // Panda default
            }
            
            const btn = document.getElementById('avatar-save-btn');
            btn.disabled = true;
            btn.textContent = 'Saving...';

            try {
                const res = await fetch('/api/account/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar_id: selectedId })
                });

                if (res.ok) {
                    hide();
                    if (onSaveCallback) onSaveCallback(selectedId);
                } else {
                    alert('Failed to save avatar');
                }
            } catch (err) {
                alert('Network error while saving avatar');
            }
            
            btn.disabled = false;
            btn.textContent = 'Save Avatar';
        });
    }
    
    // Centralized resolver for other components
    function getAvatarPath(avatarId) {
        if (!avatarId) return '/assets/images/profile-icons/img1.png';
        const a = registry.find(x => x.id === avatarId);
        return a ? a.path : '/assets/images/profile-icons/img1.png';
    }

    return {
        show,
        hide,
        loadRegistry,
        getAvatarPath
    };
})();

