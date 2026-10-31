document.addEventListener('DOMContentLoaded', async () => {
    let currentUser = null;
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) currentUser = (await res.json()).user;
        else return window.location.href = '/login/';
    } catch(e) { return window.location.href = '/login/'; }

    const form = document.getElementById('change-password-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('cp-current').value;
            const newPassword = document.getElementById('cp-new').value;
            const confirmPassword = document.getElementById('cp-confirm').value;
            const msgBox = document.getElementById('cp-msg');

            if (newPassword !== confirmPassword) {
                msgBox.textContent = 'New passwords do not match.';
                msgBox.style.color = 'var(--nv-red)';
                return;
            }

            try {
                const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({currentPassword, newPassword, confirmPassword})
                });
                const data = await res.json();
                if (data.success) {
                    msgBox.textContent = 'Password updated successfully!';
                    msgBox.style.color = 'var(--nv-cyan)';
                    form.reset();
                } else {
                    msgBox.textContent = data.error || 'Failed to update password.';
                    msgBox.style.color = 'var(--nv-red)';
                }
            } catch (err) {
                msgBox.textContent = 'Network error.';
                msgBox.style.color = 'var(--nv-red)';
            }
        });
    }
});

