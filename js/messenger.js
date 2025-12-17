// js/messenger.js
async function loadMessenger() {
    const chats = await api('/messages/conversations');
    document.getElementById('messengerChatList').innerHTML = chats.map(c => `
        <div onclick="openChatWindow('${c.user._id}')" class="flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer">
            <img src="${getAvatar(c.user)}" class="w-10 h-10 rounded-full">
            <span>${getUserName(c.user)}</span>
        </div>
    `).join('');
}

async function openChatWindow(userId) {
    if(openChats.has(userId)) return;
    const user = await api(`/users/${userId}`);
    
    const div = document.createElement('div');
    div.className = 'chat-window bg-white shadow-lg slide-up';
    div.innerHTML = `
        <div class="h-10 bg-blue-500 text-white flex items-center justify-between px-3 cursor-pointer" onclick="this.parentElement.classList.toggle('minimized')">
            <span>${getUserName(user)}</span>
            <button onclick="this.closest('.chat-window').remove()">X</button>
        </div>
        <div class="chat-body flex-1 overflow-y-auto p-2" id="msgs-${userId}"></div>
        <div class="chat-footer p-2 border-t flex">
            <input class="flex-1 border rounded px-2" placeholder="Üzenet..." onkeypress="if(event.key==='Enter') sendChatMsg('${userId}', this)">
        </div>
    `;
    document.getElementById('chatWindowsContainer').appendChild(div);
    openChats.set(userId, div);
    loadChatMessages(userId);
}

async function loadChatMessages(userId) {
    const msgs = await api(`/messages/${userId}`);
    const div = document.getElementById(`msgs-${userId}`);
    if(div) {
        div.innerHTML = msgs.map(m => `
            <div class="${m.from === currentUser._id ? 'text-right' : 'text-left'}">
                <span class="inline-block px-2 py-1 rounded ${m.from === currentUser._id ? 'bg-blue-500 text-white' : 'bg-gray-200'} my-1">${m.text}</span>
            </div>
        `).join('');
        div.scrollTop = div.scrollHeight;
    }
}

async function sendChatMsg(userId, input) {
    if(!input.value) return;
    await api('/messages', { method: 'POST', body: JSON.stringify({ to: userId, text: input.value }) });
    input.value = '';
    loadChatMessages(userId);
}