// js/friends.js

async function loadFriends() {
    const page = document.getElementById('profilePage'); // Újrahasznosítjuk a konténert vagy csinálhatunk újat
    // De mivel a layoutunkban a "Profil" divbe töltjük a tartalmat ha navigálunk:
    const content = document.querySelector('#mainApp .flex-1'); // A középső sáv
    
    // Töröljük a feed/profil tartalmát ideiglenesen és kirakjuk a barátokat
    document.getElementById('feedPage').classList.add('hidden');
    document.getElementById('messengerPage').classList.add('hidden');
    document.getElementById('profilePage').classList.remove('hidden');
    
    document.getElementById('profilePage').innerHTML = `
        <div class="bg-white dark:bg-dark-200 p-4 rounded-xl shadow mb-4">
            <h2 class="text-2xl font-bold mb-4">Ismerősök</h2>
            <div class="flex gap-4 border-b mb-4">
                <button onclick="showFriendsList('all')" class="pb-2 border-b-2 border-blue-600 text-blue-600 font-bold">Összes</button>
                <button onclick="showFriendsList('suggestions')" class="pb-2 text-gray-500">Javaslatok</button>
            </div>
            <div id="friendsListContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                Loading...
            </div>
        </div>
    `;
    showFriendsList('all');
}

async function showFriendsList(type) {
    const container = document.getElementById('friendsListContainer');
    container.innerHTML = '<p class="p-4">Betöltés...</p>';

    if (type === 'all') {
        // Mivel az API /users végpontot adtunk meg egyszerűsítve, itt most lekérjük az összes usert
        // Egy igazi appban lenne /friends végpont
        const users = await api('/users'); 
        const friends = users.filter(u => currentUser.friends?.includes(u._id) || false); // Ez csak szimuláció, ha nincs friends tömb a userben

        if (users.length === 0) {
            container.innerHTML = '<p class="text-gray-500">Nincsenek még felhasználók.</p>';
            return;
        }

        container.innerHTML = users.map(u => `
            <div class="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                <img src="${getAvatar(u)}" class="w-12 h-12 rounded-full cursor-pointer" onclick="navigate('profile', '${u._id}')">
                <div class="flex-1">
                    <p class="font-bold cursor-pointer" onclick="navigate('profile', '${u._id}')">${getUserName(u)}</p>
                    <p class="text-xs text-gray-500">@${u.username}</p>
                </div>
                <button onclick="openChatWindow('${u._id}')" class="text-blue-500 bg-blue-100 p-2 rounded-full"><i class="fas fa-comment"></i></button>
            </div>
        `).join('');
    } 
    else if (type === 'suggestions') {
        const users = await api('/users');
        // Kiszűrjük magunkat
        const suggestions = users.filter(u => u._id !== currentUser._id);
        
        container.innerHTML = suggestions.map(u => `
            <div class="flex items-center gap-3 p-3 border rounded-lg">
                <img src="${getAvatar(u)}" class="w-12 h-12 rounded-full">
                <div class="flex-1">
                    <p class="font-bold">${getUserName(u)}</p>
                </div>
                <button onclick="toast('Jelölés elküldve!', 'success')" class="text-blue-600 font-bold text-sm bg-blue-100 px-3 py-1 rounded">Jelölés</button>
            </div>
        `).join('');
    }
}