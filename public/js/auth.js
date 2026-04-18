document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect to dashboard
    if (localStorage.getItem('sf_token')) {
        window.location.href = '/';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const errorMsg = document.getElementById('errorMsg');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            await handleAuth('/api/auth/login', { username, password }, loginForm);
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('fullname').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            await handleAuth('/api/auth/signup', { name, username, password }, signupForm);
        });
    }

    async function handleAuth(url, payload, formEl) {
        const btn = formEl.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<div class="loader" style="width:20px;height:20px;border-width:3px;border-bottom-color:white;"></div>`;
        btn.disabled = true;
        errorMsg.classList.add('hidden');

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('sf_token', data.token);
                localStorage.setItem('sf_user', data.user.name);
                
                btn.innerHTML = `<span class="text-xs tracking-widest uppercase">Access Granted ✔</span>`;
                btn.classList.replace('bg-emerald-600', 'bg-blue-600');
                
                setTimeout(() => window.location.href = '/', 800);
            } else {
                errorMsg.innerText = data.error || 'Authentication failed.';
                errorMsg.classList.remove('hidden');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            errorMsg.innerText = 'Server unavailable. Please try again later.';
            errorMsg.classList.remove('hidden');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
});
