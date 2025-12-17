// js/stories.js

async function loadStories() {
    const stories = await api('/stories'); // Feltételezve, hogy van ilyen végpont (a server.js-ben létrehoztuk)
    
    // Ha nincs konténer a feed oldalon, beszúrjuk
    let storyContainer = document.getElementById('storiesWrapper');
    if (!storyContainer) {
        const feedPage = document.getElementById('feedPage');
        const wrapper = document.createElement('div');
        wrapper.id = 'storiesWrapper';
        wrapper.className = 'flex gap-2 overflow-x-auto pb-4 mb-4';
        // A poszt írás doboz elé szúrjuk be
        feedPage.insertBefore(wrapper, feedPage.firstChild);
        storyContainer = wrapper;
    }

    // "Új történet" gomb + a történetek
    storyContainer.innerHTML = `
        <div onclick="createStoryPrompt()" class="min-w-[100px] h-40 bg-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-300 relative overflow-hidden">
            <img src="${getAvatar(currentUser)}" class="absolute inset-0 w-full h-full object-cover opacity-50">
            <div class="absolute bottom-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold">+</div>
        </div>
        ${stories.map(s => `
            <div onclick="viewStory('${s.image}')" class="min-w-[100px] h-40 bg-gray-800 rounded-xl relative cursor-pointer overflow-hidden border-2 border-blue-500">
                <img src="${s.image}" class="w-full h-full object-cover">
                <div class="absolute top-2 left-2 w-8 h-8 rounded-full border-2 border-blue-500 overflow-hidden">
                    <img src="${getAvatar(s.author)}" class="w-full h-full">
                </div>
            </div>
        `).join('')}
    `;
}

function createStoryPrompt() {
    const url = prompt("Add meg a kép URL-jét a történethez:");
    if (url) {
        api('/stories', { method: 'POST', body: JSON.stringify({ image: url }) })
            .then(() => {
                toast('Történet hozzáadva!', 'success');
                loadStories();
            })
            .catch(() => toast('Hiba történt', 'error'));
    }
}

function viewStory(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/90 z-[100] flex items-center justify-center cursor-pointer';
    modal.innerHTML = `<img src="${imageUrl}" class="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl">`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
}

// Hívd meg a loadStories()-t a feed.js loadFeed() függvényében, vagy az app.js-ben!