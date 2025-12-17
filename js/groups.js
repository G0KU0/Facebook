// js/groups.js

let currentGroupChat = null;

// Betölti a bal oldali sávba a csoportokat (ha lenne külön hely neki)
// Vagy a messenger oldalon listázza őket
async function loadGroupsPage() {
    const container = document.getElementById('messengerChatList');
    const groups = await api('/groups');
    
    // Hozzáadjuk a csoportokat a chat lista tetejéhez vagy külön szekcióba
    const groupHtml = groups.map(g => `
        <div onclick="openGroupChat('${g._id}')" class="flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer border-l-4 border-purple-500">
            <div class="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">
                ${g.image ? `<img src="${g.image}" class="w-full h-full rounded-full">` : '<i class="fas fa-users"></i>'}
            </div>
            <span class="font-bold">${g.name}</span>
        </div>
    `).join('');
    
    // Gomb új csoport létrehozásához
    const createBtn = `<button onclick="openCreateGroupModal()" class="w-full mb-2 bg-gray-200 py-2 rounded font-bold text-sm">+ Új Csoport</button>`;
    
    container.innerHTML = createBtn + groupHtml + container.innerHTML;
}

function openCreateGroupModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white p-6 rounded-xl w-96">
            <h3 class="font-bold text-lg mb-4">Új csoport létrehozása</h3>
            <input id="newGroupName" placeholder="Csoport neve" class="w-full border p-2 mb-4 rounded">
            <p class="text-sm mb-2">Tagok kiválasztása (Ctrl+Click):</p>
            <select id="groupMembersSelect" multiple class="w-full border p-2 mb-4 h-32 rounded">
                </select>
            <div class="flex justify-end gap-2">
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-200 rounded">Mégse</button>
                <button onclick="createGroup()" class="px-4 py-2 bg-blue-600 text-white rounded">Létrehozás</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Listázzuk a usereket a selectbe
    api('/users').then(users => {
        const select = document.getElementById('groupMembersSelect');
        users.forEach(u => {
            if(u._id !== currentUser._id) {
                const opt = document.createElement('option');
                opt.value = u._id;
                opt.textContent = getUserName(u);
                select.appendChild(opt);
            }
        });
    });
}

async function createGroup() {
    const name = document.getElementById('newGroupName').value;
    const select = document.getElementById('groupMembersSelect');
    const members = Array.from(select.selectedOptions).map(opt => opt.value);
    members.push(currentUser._id); // Magunkat is hozzáadjuk

    if(!name || members.length < 2) {
        toast('Adj meg nevet és válassz tagokat!', 'error');
        return;
    }

    try {
        await api('/groups', { method: 'POST', body: JSON.stringify({ name, members }) });
        document.querySelector('.fixed.inset-0').remove(); // Modal bezárása
        toast('Csoport létrehozva!', 'success');
        loadMessenger(); // Lista frissítése
    } catch(e) { toast('Hiba történt', 'error'); }
}

async function openGroupChat(groupId) {
    // Ez hasonló a sima chat ablakhoz, csak csoportos
    // Egyszerűsítve: nem lebegő ablak, hanem modal vagy teljes képernyő
    // De használhatjuk a lebegő ablakot is
    
    const group = (await api('/groups')).find(g => g._id === groupId);
    if(!group) return;

    socket.emit('joinGroup', groupId);

    const div = document.createElement('div');
    div.className = 'chat-window bg-white shadow-lg slide-up border-2 border-purple-500'; // Lila keret jelzi a csoportot
    div.innerHTML = `
        <div class="h-10 bg-purple-600 text-white flex items-center justify-between px-3 cursor-pointer" onclick="this.parentElement.classList.toggle('minimized')">
            <span>${group.name} (Csoport)</span>
            <button onclick="this.closest('.chat-window').remove()">X</button>
        </div>
        <div class="chat-body flex-1 overflow-y-auto p-2" id="group-msgs-${groupId}"></div>
        <div class="chat-footer p-2 border-t flex">
            <input class="flex-1 border rounded px-2" placeholder="Csoportos üzenet..." onkeypress="if(event.key==='Enter') sendGroupMessage('${groupId}', this)">
        </div>
    `;
    document.getElementById('chatWindowsContainer').appendChild(div);
    
    // Üzenetek betöltése (Szerver oldalon kellene /groups/:id/messages végpont, de most szimuláljuk a group objektumból)
    const msgsContainer = document.getElementById(`group-msgs-${groupId}`);
    // Ha a szerver nem menti, akkor üres lesz
    if(group.messages) {
        msgsContainer.innerHTML = group.messages.map(m => `
             <div class="text-left mb-1">
                <p class="text-[10px] text-gray-500 ml-1">${m.from === currentUser._id ? 'Én' : 'Tag'}</p>
                <span class="inline-block px-2 py-1 rounded bg-purple-100 text-black">${m.text}</span>
            </div>
        `).join('');
    }
}

async function sendGroupMessage(groupId, input) {
    if(!input.value) return;
    // Socket esemény küldése, hogy mindenki megkapja
    socket.emit('newGroupMessage', { 
        groupId, 
        message: { from: currentUser._id, text: input.value, createdAt: new Date() } 
    });
    
    // API hívás a mentéshez (ha van endpoint, most a példa kedvéért csak UI frissítés socketen keresztül)
    // De a szerver.js-ben van rá endpoint, használjuk azt:
    // await api(`/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify({ text: input.value }) });
    
    input.value = '';
}

// Socket figyelő hozzáadása (ezt az app.js-be kellene, de itt definiáljuk a logikát)
// Az app.js socket.on('newGroupMessage') hívja majd meg a UI frissítést