// js/app.js
async function initApp() {
    document.getElementById('authPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    socket = io();
    socket.emit('join', currentUser._id);
    socket.on('newMessage', (msg) => { 
        if(openChats.has(msg.from._id)) loadChatMessages(msg.from._id); 
        else toast('Új üzenet!'); 
    });
    socket.on('newPost', () => loadFeed());

    document.getElementById('navAvatar').src = getAvatar(currentUser);
    document.getElementById('feedAvatar').src = getAvatar(currentUser);
    navigate('feed');
}

function navigate(page) {
    document.querySelectorAll('[id$="Page"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(page + 'Page')?.classList.remove('hidden');
    if(page === 'feed') loadFeed();
    if(page === 'messenger') loadMessenger();
}

// Alkalmazás indítása
if(token) {
    api('/auth/me').then(u => {
        if(u._id) { currentUser = u; initApp(); }
        else { document.getElementById('authPage').classList.remove('hidden'); }
    }).catch(() => document.getElementById('authPage').classList.remove('hidden'));
} else {
    document.getElementById('authPage').classList.remove('hidden');
}