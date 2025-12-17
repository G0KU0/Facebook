// js/utils.js
let socket;
let currentUser = null;
let token = localStorage.getItem('token');
let openChats = new Map();
const API = window.location.origin + '/api';

function toast(message, type = 'info') {
    const div = document.createElement('div');
    div.className = `fixed bottom-5 left-5 px-4 py-2 rounded shadow z-50 text-white ${type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

async function api(endpoint, options = {}) {
    try {
        const res = await fetch(API + endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
                ...options.headers
            }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Hiba');
        return data;
    } catch (err) {
        toast(err.message, 'error');
        throw err;
    }
}

function getAvatar(user) { return user?.avatar || 'https://ui-avatars.com/api/?background=random'; }
function getUserName(user) { return user?.name || user?.username || 'Ismeretlen'; }
function timeAgo(date) { return new Date(date).toLocaleTimeString(); }