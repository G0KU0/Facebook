// js/admin.js

async function loadAdmin() {
    if (!currentUser.isAdmin) {
        toast('Nincs jogosultságod!', 'error');
        navigate('feed');
        return;
    }

    const content = document.querySelector('#mainApp .flex-1');
    document.querySelectorAll('[id$="Page"]').forEach(p => p.classList.add('hidden')); // Minden más elrejtése
    
    // Létrehozunk egy admin div-et ha nincs
    let adminDiv = document.getElementById('adminPage');
    if(!adminDiv) {
        adminDiv = document.createElement('div');
        adminDiv.id = 'adminPage';
        content.appendChild(adminDiv);
    }
    adminDiv.classList.remove('hidden');

    // Admin statisztikák
    const stats = await api('/admin/stats'); // Ez a végpont a server.js-ben van
    const users = await api('/admin/users');

    adminDiv.innerHTML = `
        <div class="bg-white dark:bg-dark-200 p-6 rounded-xl shadow mb-6">
            <h1 class="text-3xl font-bold mb-6 text-red-600">Adminisztrációs Pult</h1>
            <div class="grid grid-cols-3 gap-4 mb-8">
                <div class="bg-blue-100 p-4 rounded-xl text-center">
                    <p class="text-2xl font-bold">${stats.users || 0}</p>
                    <p class="text-sm">Felhasználó</p>
                </div>
                <div class="bg-green-100 p-4 rounded-xl text-center">
                    <p class="text-2xl font-bold">${stats.posts || 0}</p>
                    <p class="text-sm">Bejegyzés</p>
                </div>
                <div class="bg-purple-100 p-4 rounded-xl text-center">
                    <p class="text-2xl font-bold">${stats.messages || 0}</p>
                    <p class="text-sm">Üzenet</p>
                </div>
            </div>

            <h2 class="text-xl font-bold mb-4">Felhasználók kezelése</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b">
                            <th class="p-2">Név</th>
                            <th class="p-2">Email/User</th>
                            <th class="p-2">Státusz</th>
                            <th class="p-2">Művelet</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-2 flex items-center gap-2">
                                    <img src="${getAvatar(u)}" class="w-8 h-8 rounded-full">
                                    ${u.name || u.username}
                                    ${u.isAdmin ? '<span class="text-xs bg-red-500 text-white px-1 rounded">ADMIN</span>' : ''}
                                </td>
                                <td class="p-2 text-sm text-gray-500">@${u.username}</td>
                                <td class="p-2">${u.isBanned ? '<span class="text-red-500 font-bold">BANNED</span>' : '<span class="text-green-500">Aktív</span>'}</td>
                                <td class="p-2">
                                    ${!u.isOwner ? `
                                        <button onclick="deleteUser('${u._id}')" class="text-red-500 hover:text-red-700 mr-2" title="Törlés"><i class="fas fa-trash"></i></button>
                                        <button onclick="banUser('${u._id}')" class="text-orange-500 hover:text-orange-700" title="Tiltás"><i class="fas fa-ban"></i></button>
                                    ` : '<span class="text-gray-400">Védett</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function deleteUser(id) {
    if(confirm('Biztosan törlöd ezt a felhasználót végleg?')) {
        try {
            await api(`/admin/users/${id}`, { method: 'DELETE' });
            loadAdmin(); // Frissítés
            toast('Felhasználó törölve', 'success');
        } catch(e) { toast('Hiba történt', 'error'); }
    }
}

async function banUser(id) {
    const reason = prompt("Tiltás oka:");
    if(reason) {
        try {
            await api(`/admin/ban/${id}`, { method: 'POST', body: JSON.stringify({ reason }) });
            loadAdmin();
            toast('Felhasználó kitiltva', 'warning');
        } catch(e) { toast('Hiba történt', 'error'); }
    }
}