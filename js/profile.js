// js/profile.js

let currentProfileId = null;
let originalUsername = '';

async function loadProfile(userIdOrUsername) {
    try {
        // Ha username vagy ID alapján keresünk
        let user;
        if (userIdOrUsername.match(/^[0-9a-fA-F]{24}$/)) {
            user = await api(`/users/${userIdOrUsername}`);
        } else {
            user = await api(`/users/username/${userIdOrUsername}`);
        }
        
        currentProfileId = user._id;
        
        // HTML elemek feltöltése
        const page = document.getElementById('profilePage');
        page.innerHTML = `
            <div class="bg-white dark:bg-dark-200 rounded-xl shadow overflow-hidden">
                <div class="h-48 bg-gradient-to-r from-blue-400 to-purple-500 relative">
                    ${user.cover ? `<img src="${user.cover}" class="w-full h-full object-cover">` : ''}
                </div>
                <div class="px-4 pb-4">
                    <div class="relative flex justify-between items-end -mt-12 mb-4">
                        <img src="${getAvatar(user)}" class="w-32 h-32 rounded-full border-4 border-white dark:border-dark-200 bg-white">
                        ${user._id === currentUser._id 
                            ? `<button onclick="showSettings()" class="bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded font-bold">Profil szerkesztése</button>` 
                            : `<button onclick="openChatWindow('${user._id}')" class="bg-blue-600 text-white px-4 py-2 rounded font-bold">Üzenet</button>`
                        }
                    </div>
                    <h1 class="text-3xl font-bold">${getUserName(user)}</h1>
                    <p class="text-gray-500">@${user.username || 'user'}</p>
                    <p class="mt-2">${user.bio || 'Nincs bemutatkozás'}</p>
                    
                    <div class="mt-4 flex gap-4 text-gray-600 dark:text-gray-300 text-sm border-t pt-4">
                        ${user.workplace ? `<span><i class="fas fa-briefcase"></i> ${user.workplace}</span>` : ''}
                        ${user.currentCity ? <span><i class="fas fa-map-marker-alt"></i> ${user.currentCity}</span> : ''}
                        <span><i class="fas fa-user-friends"></i> ${user.friends?.length || 0} barát</span>
                    </div>
                </div>
            </div>
            
            <div class="mt-4" id="profilePosts">
                <p class="text-center text-gray-500">Posztok betöltése...</p>
            </div>
        `;

        // Posztok betöltése ehhez a felhasználóhoz
        const posts = await api(`/posts/user/${user._id}`);
        const postsContainer = document.getElementById('profilePosts');
        if (posts.length === 0) {
            postsContainer.innerHTML = '<div class="text-center py-8 text-gray-500">Nincsenek még bejegyzések.</div>';
        } else {
            postsContainer.innerHTML = posts.map(post => `
                <div class="bg-white dark:bg-dark-200 rounded-xl shadow p-4 mb-4">
                    <div class="flex items-center gap-3 mb-2">
                        <img src="${getAvatar(post.author)}" class="w-10 h-10 rounded-full">
                        <div>
                            <p class="font-bold">${getUserName(post.author)}</p>
                            <p class="text-xs text-gray-500">${timeAgo(post.createdAt)}</p>
                        </div>
                    </div>
                    <p class="mb-2">${post.content || ''}</p>
                    ${post.image ? `<img src="${post.image}" class="rounded w-full max-h-96 object-cover">` : ''}
                </div>
            `).join('');
        }

    } catch (e) {
        console.error(e);
        toast('Hiba a profil betöltésekor', 'error');
    }
}

// Beállítások modal megjelenítése
function showSettings() {
    const modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[60]';
    modal.innerHTML = `
        <div class="bg-white dark:bg-dark-200 p-6 rounded-xl w-full max-w-md shadow-2xl h-[80vh] overflow-y-auto">
            <h2 class="text-2xl font-bold mb-4">Profil szerkesztése</h2>
            
            <label class="block mb-2 text-sm font-bold">Avatar URL (Kép link)</label>
            <input id="setAvatar" type="text" value="${currentUser.avatar || ''}" class="w-full border p-2 mb-4 rounded">
            
            <label class="block mb-2 text-sm font-bold">Borítókép URL</label>
            <input id="setCover" type="text" value="${currentUser.cover || ''}" class="w-full border p-2 mb-4 rounded">
            
            <label class="block mb-2 text-sm font-bold">Bio (Bemutatkozás)</label>
            <textarea id="setBio" class="w-full border p-2 mb-4 rounded">${currentUser.bio || ''}</textarea>
            
            <label class="block mb-2 text-sm font-bold">Munkahely</label>
            <input id="setWork" type="text" value="${currentUser.workplace || ''}" class="w-full border p-2 mb-4 rounded">
            
            <label class="block mb-2 text-sm font-bold">Lakóhely</label>
            <input id="setCity" type="text" value="${currentUser.currentCity || ''}" class="w-full border p-2 mb-4 rounded">

            <div class="flex justify-end gap-2 mt-4">
                <button onclick="document.getElementById('settingsModal').remove()" class="px-4 py-2 bg-gray-200 rounded">Mégse</button>
                <button onclick="saveSettings()" class="px-4 py-2 bg-blue-600 text-white rounded font-bold">Mentés</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveSettings() {
    const data = {
        avatar: document.getElementById('setAvatar').value,
        cover: document.getElementById('setCover').value,
        bio: document.getElementById('setBio').value,
        workplace: document.getElementById('setWork').value,
        currentCity: document.getElementById('setCity').value
    };

    try {
        const updatedUser = await api('/users/profile', { method: 'PUT', body: JSON.stringify(data) });
        currentUser = updatedUser;
        document.getElementById('settingsModal').remove();
        toast('Profil frissítve!', 'success');
        loadProfile(currentUser._id); // Profil újratöltése
        document.getElementById('navAvatar').src = getAvatar(currentUser); // Fejléc kép frissítése
    } catch (e) {
        toast('Hiba a mentés során', 'error');
    }
}