// ============================================
// SOCIALBOOK - NODE.JS + MONGODB SZERVER
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// ============ MONGODB KAPCSOLAT ============
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/socialbook')
    .then(() => console.log('✅ MongoDB kapcsolódva!'))
    .catch(err => console.error('❌ MongoDB hiba:', err));

// ============ MONGOOSE SÉMÁK ============

// Felhasználó séma
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    cover: { type: String, default: '' },
    bio: { type: String, default: '' },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isAdmin: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

// Poszt séma
const postSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    image: { type: String },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Üzenet séma
const messageSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    read: { type: Boolean, default: false }
}, { timestamps: true });

// Barátkérelem séma
const friendRequestSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
}, { timestamps: true });

// Értesítés séma
const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    type: { type: String, enum: ['like', 'comment', 'friend', 'message'] },
    read: { type: Boolean, default: false },
    link: { type: String }
}, { timestamps: true });

// Story séma
const storySchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: String, required: true },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Message = mongoose.model('Message', messageSchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Story = mongoose.model('Story', storySchema);

// ============ ADMIN LÉTREHOZÁSA ============
async function createAdmin() {
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        await User.create({
            name: process.env.ADMIN_NAME || 'Admin',
            email: process.env.ADMIN_EMAIL,
            password: hashedPassword,
            avatar: `https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff&size=200`,
            isAdmin: true
        });
        console.log('✅ Admin felhasználó létrehozva!');
    }
}
createAdmin();

// ============ JWT MIDDLEWARE ============
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) throw new Error();
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'titkos_kulcs');
        req.user = await User.findById(decoded.id);
        if (!req.user) throw new Error();
        next();
    } catch (error) {
        res.status(401).json({ error: 'Jelentkezz be!' });
    }
};

const adminAuth = async (req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Nincs jogosultságod!' });
    }
    next();
};

// ============ AUTH ROUTES ============

// Regisztráció
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ error: 'Ez az email már foglalt!' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200`
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'titkos_kulcs', { expiresIn: '7d' });
        res.json({ token, user: { ...user.toObject(), password: undefined } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bejelentkezés
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Hibás email vagy jelszó!' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Hibás email vagy jelszó!' });

        user.isOnline = true;
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'titkos_kulcs', { expiresIn: '7d' });
        res.json({ token, user: { ...user.toObject(), password: undefined } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Jelenlegi felhasználó
app.get('/api/auth/me', auth, async (req, res) => {
    res.json({ ...req.user.toObject(), password: undefined });
});

// ============ USER ROUTES ============

// Összes felhasználó
app.get('/api/users', auth, async (req, res) => {
    const users = await User.find({ _id: { $ne: req.user._id } }).select('-password');
    res.json(users);
});

// Egy felhasználó
app.get('/api/users/:id', auth, async (req, res) => {
    const user = await User.findById(req.params.id).select('-password').populate('friends', 'name avatar');
    res.json(user);
});

// Profil frissítése
app.put('/api/users/profile', auth, async (req, res) => {
    const { avatar, cover, bio, name } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { avatar, cover, bio, name }, { new: true }).select('-password');
    res.json(user);
});

// ============ POST ROUTES ============

// Posztok lekérése
app.get('/api/posts', auth, async (req, res) => {
    const posts = await Post.find()
        .populate('author', 'name avatar')
        .populate('comments.author', 'name avatar')
        .sort({ createdAt: -1 });
    res.json(posts);
});

// Felhasználó posztjai
app.get('/api/posts/user/:id', auth, async (req, res) => {
    const posts = await Post.find({ author: req.params.id })
        .populate('author', 'name avatar')
        .populate('comments.author', 'name avatar')
        .sort({ createdAt: -1 });
    res.json(posts);
});

// Poszt létrehozása
app.post('/api/posts', auth, async (req, res) => {
    const { content, image } = req.body;
    const post = await Post.create({ author: req.user._id, content, image });
    await post.populate('author', 'name avatar');
    io.emit('newPost', post);
    res.json(post);
});

// Poszt törlése
app.delete('/api/posts/:id', auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Poszt nem található!' });
    if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Nincs jogosultságod!' });
    }
    await post.deleteOne();
    io.emit('deletePost', req.params.id);
    res.json({ message: 'Poszt törölve!' });
});

// Lájkolás
app.post('/api/posts/:id/like', auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    const idx = post.likes.indexOf(req.user._id);
    
    if (idx > -1) {
        post.likes.splice(idx, 1);
    } else {
        post.likes.push(req.user._id);
        if (post.author.toString() !== req.user._id.toString()) {
            await Notification.create({
                user: post.author,
                text: `${req.user.name} kedveli a bejegyzésedet`,
                type: 'like'
            });
            io.to(post.author.toString()).emit('notification');
        }
    }
    
    await post.save();
    await post.populate('author', 'name avatar');
    io.emit('updatePost', post);
    res.json(post);
});

// Komment hozzáadása
app.post('/api/posts/:id/comment', auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    post.comments.push({ author: req.user._id, text: req.body.text });
    await post.save();
    await post.populate('author', 'name avatar');
    await post.populate('comments.author', 'name avatar');
    
    if (post.author._id.toString() !== req.user._id.toString()) {
        await Notification.create({
            user: post.author._id,
            text: `${req.user.name} hozzászólt a bejegyzésedhez`,
            type: 'comment'
        });
        io.to(post.author._id.toString()).emit('notification');
    }
    
    io.emit('updatePost', post);
    res.json(post);
});

// ============ MESSAGE ROUTES ============

// Beszélgetések
app.get('/api/messages/conversations', auth, async (req, res) => {
    const messages = await Message.find({
        $or: [{ from: req.user._id }, { to: req.user._id }]
    }).populate('from to', 'name avatar isOnline');

    const conversations = {};
    messages.forEach(msg => {
        const otherUser = msg.from._id.toString() === req.user._id.toString() ? msg.to : msg.from;
        const odterId = otherUser._id.toString();
        if (!conversations[odterId] || conversations[odterId].createdAt < msg.createdAt) {
            conversations[odterId] = {
                user: otherUser,
                lastMessage: msg,
                unread: msg.to._id.toString() === req.user._id.toString() && !msg.read ? 1 : 0
            };
        } else if (msg.to._id.toString() === req.user._id.toString() && !msg.read) {
            conversations[odterId].unread++;
        }
    });

    res.json(Object.values(conversations).sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt));
});

// Üzenetek egy felhasználóval
app.get('/api/messages/:userId', auth, async (req, res) => {
    const messages = await Message.find({
        $or: [
            { from: req.user._id, to: req.params.userId },
            { from: req.params.userId, to: req.user._id }
        ]
    }).sort({ createdAt: 1 });

    // Olvasottnak jelölés
    await Message.updateMany(
        { from: req.params.userId, to: req.user._id, read: false },
        { read: true }
    );

    res.json(messages);
});

// Üzenet küldése
app.post('/api/messages', auth, async (req, res) => {
    const { to, text } = req.body;
    const message = await Message.create({ from: req.user._id, to, text });
    await message.populate('from to', 'name avatar');
    
    io.to(to).emit('newMessage', message);
    io.to(req.user._id.toString()).emit('newMessage', message);
    
    res.json(message);
});

// ============ FRIEND ROUTES ============

// Barátkérelmek
app.get('/api/friends/requests', auth, async (req, res) => {
    const requests = await FriendRequest.find({ to: req.user._id, status: 'pending' })
        .populate('from', 'name avatar');
    res.json(requests);
});

// Barátkérelem küldése
app.post('/api/friends/request/:userId', auth, async (req, res) => {
    const exists = await FriendRequest.findOne({
        $or: [
            { from: req.user._id, to: req.params.userId },
            { from: req.params.userId, to: req.user._id }
        ],
        status: 'pending'
    });
    if (exists) return res.status(400).json({ error: 'Már van függő kérelem!' });

    const request = await FriendRequest.create({ from: req.user._id, to: req.params.userId });
    
    await Notification.create({
        user: req.params.userId,
        text: `${req.user.name} barátkérelmet küldött`,
        type: 'friend'
    });
    io.to(req.params.userId).emit('notification');
    io.to(req.params.userId).emit('friendRequest');
    
    res.json(request);
});

// Barátkérelem elfogadása
app.post('/api/friends/accept/:requestId', auth, async (req, res) => {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request || request.to.toString() !== req.user._id.toString()) {
        return res.status(404).json({ error: 'Kérelem nem található!' });
    }

    request.status = 'accepted';
    await request.save();

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { friends: request.from } });
    await User.findByIdAndUpdate(request.from, { $addToSet: { friends: req.user._id } });

    await Notification.create({
        user: request.from,
        text: `${req.user.name} elfogadta a barátkérelmedet`,
        type: 'friend'
    });
    io.to(request.from.toString()).emit('notification');

    res.json({ message: 'Elfogadva!' });
});

// Barátkérelem elutasítása
app.post('/api/friends/decline/:requestId', auth, async (req, res) => {
    await FriendRequest.findByIdAndDelete(req.params.requestId);
    res.json({ message: 'Elutasítva!' });
});

// Javaslatok
app.get('/api/friends/suggestions', auth, async (req, res) => {
    const requests = await FriendRequest.find({
        $or: [{ from: req.user._id }, { to: req.user._id }]
    });
    const excludeIds = [
        req.user._id,
        ...req.user.friends,
        ...requests.map(r => r.from),
        ...requests.map(r => r.to)
    ];

    const suggestions = await User.find({ _id: { $nin: excludeIds } })
        .select('name avatar')
        .limit(10);
    res.json(suggestions);
});

// ============ NOTIFICATION ROUTES ============

app.get('/api/notifications', auth, async (req, res) => {
    const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20);
    res.json(notifications);
});

app.put('/api/notifications/read', auth, async (req, res) => {
    await Notification.updateMany({ user: req.user._id }, { read: true });
    res.json({ message: 'OK' });
});

app.get('/api/notifications/unread', auth, async (req, res) => {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    const msgCount = await Message.countDocuments({ to: req.user._id, read: false });
    res.json({ notifications: count, messages: msgCount });
});

// ============ STORY ROUTES ============

app.get('/api/stories', auth, async (req, res) => {
    const stories = await Story.find({ expiresAt: { $gt: new Date() } })
        .populate('author', 'name avatar')
        .sort({ createdAt: -1 });
    res.json(stories);
});

app.post('/api/stories', auth, async (req, res) => {
    const story = await Story.create({ author: req.user._id, image: req.body.image });
    await story.populate('author', 'name avatar');
    io.emit('newStory', story);
    res.json(story);
});

// ============ ADMIN ROUTES ============

app.get('/api/admin/stats', auth, adminAuth, async (req, res) => {
    const users = await User.countDocuments();
    const posts = await Post.countDocuments();
    const messages = await Message.countDocuments();
    res.json({ users, posts, messages });
});

app.get('/api/admin/users', auth, adminAuth, async (req, res) => {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
});

app.delete('/api/admin/users/:id', auth, adminAuth, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user.isAdmin) return res.status(403).json({ error: 'Admin nem törölhető!' });
    
    await Post.deleteMany({ author: req.params.id });
    await Message.deleteMany({ $or: [{ from: req.params.id }, { to: req.params.id }] });
    await user.deleteOne();
    
    res.json({ message: 'Felhasználó törölve!' });
});

// ============ SOCKET.IO ============

const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('🔌 Felhasználó csatlakozott:', socket.id);

    socket.on('join', async (userId) => {
        socket.join(userId);
        onlineUsers.set(userId, socket.id);
        await User.findByIdAndUpdate(userId, { isOnline: true });
        io.emit('userOnline', userId);
    });

    socket.on('typing', ({ to, from }) => {
        io.to(to).emit('typing', from);
    });

    socket.on('stopTyping', ({ to, from }) => {
        io.to(to).emit('stopTyping', from);
    });

    socket.on('disconnect', async () => {
        for (const [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
                io.emit('userOffline', userId);
                break;
            }
        }
    });
});

// ============ SZERVER INDÍTÁSA ============

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Szerver fut: http://localhost:${PORT}`);
});
