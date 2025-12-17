// js/auth.js
function showLogin() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
}
function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

async function login() {
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;
    try {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        initApp();
    } catch (e) {}
}

async function register() {
    const data = {
        firstName: document.getElementById('regFirstName').value,
        lastName: document.getElementById('regLastName').value,
        username: document.getElementById('regUsername').value,
        birthDate: document.getElementById('regBirthDate').value,
        password: document.getElementById('regPassword').value
    };
    try {
        const res = await api('/auth/register', { method: 'POST', body: JSON.stringify(data) });
        token = res.token; currentUser = res.user; localStorage.setItem('token', token);
        initApp();
    } catch (e) {}
}

function logout() {
    localStorage.removeItem('token');
    location.reload();
}