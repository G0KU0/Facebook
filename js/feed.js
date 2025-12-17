// js/feed.js
async function loadFeed() {
    const posts = await api('/posts');
    const container = document.getElementById('postsContainer');
    container.innerHTML = posts.map(post => `
        <div class="bg-white dark:bg-dark-200 rounded-xl shadow p-4 mb-4">
            <div class="flex items-center gap-3 mb-2">
                <img src="${getAvatar(post.author)}" class="w-10 h-10 rounded-full">
                <div>
                    <p class="font-bold cursor-pointer" onclick="navigate('profile', '${post.author._id}')">${getUserName(post.author)}</p>
                    <p class="text-xs text-gray-500">${timeAgo(post.createdAt)}</p>
                </div>
            </div>
            <p>${post.content || ''}</p>
            ${post.image ? `<img src="${post.image}" class="mt-2 rounded w-full">` : ''}
        </div>
    `).join('');
}

async function createPost() {
    const content = document.getElementById('postContent').value;
    if(!content) return;
    await api('/posts', { method: 'POST', body: JSON.stringify({ content }) });
    document.getElementById('postContent').value = '';
    document.getElementById('postModal').classList.add('hidden');
}