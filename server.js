// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// CSAK a css és js mappákat engedjük látni a böngészőnek
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/socialbook')
    .then(() => console.log('✅ MongoDB kapcsolódva!'))
    .catch(err => console.error('❌ MongoDB hiba:', err));

// --- SÉMÁK (Egyszerűsítve a stabilitásért) ---
const userSchema = new mongoose.Schema({
    firstName: String, lastName: String, username: { type: String, unique: true },
    password: { type: String, required: true }, birthDate: Date,
    avatar: String, cover: String, bio: String, workplace: String, 
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isAdmin: { type: Boolean, default: false }, isOnline: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false }, banReason: String
}, { timestamps: true });
userSchema.virtual('name').get(function() { return `${this.firstName} ${this.lastName || ''}`.trim(); });
userSchema.set('toJSON', { virtuals: true });

const postSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, content: String, image: String, feeling: String,
    reactions: { like: [], love: [], haha: [] },
    comments: [{ author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: String, createdAt: { type: Date, default: Date.now } }]
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String, read: { type: Boolean, default: false }
}, { timestamps: true });

const groupSchema = new mongoose.Schema({
    name: String, image: String, creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    messages: [{ from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: String, createdAt: { type: Date, default: Date.now } }]
});

const communitySchema = new mongoose.Schema({
    name: String, description: String, privacy: String, creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], pendingMembers: []
});
const communityPostSchema = new mongoose.Schema({ community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' }, author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, content: String, image: String }, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Message = mongoose.model('Message', messageSchema);
const Group = mongoose.model('Group', groupSchema);
const Community = mongoose.model('Community', communitySchema);
const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);

// --- AUTH ---
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'titkos');
        req.user = await User.findById(decoded.id);
        if(!req.user) throw new Error();
        next();
    } catch { res.status(401).json({ error: 'Jelentkezz be!' }); }
};

// --- ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = await User.create({ ...req.body, password: hashedPassword, avatar: `https://ui-avatars.com/api/?name=${req.body.firstName}&background=random` });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'titkos');
        res.json({ token, user });
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if(!user || !await bcrypt.compare(req.body.password, user.password)) return res.status(400).json({ error: 'Hibás adatok' });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'titkos');
        user.isOnline = true; await user.save();
        res.json({ token, user });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', auth, async (req, res) => res.json(req.user));
app.get('/api/users', auth, async (req, res) => res.json(await User.find({ _id: { $ne: req.user._id } })));
app.get('/api/users/:id', auth, async (req, res) => res.json(await User.findById(req.params.id).populate('friends')));

app.get('/api/posts', auth, async (req, res) => res.json(await Post.find().populate('author').populate('comments.author').sort({ createdAt: -1 })));
app.post('/api/posts', auth, async (req, res) => {
    const p = await Post.create({ ...req.body, author: req.user._id });
    await p.populate('author'); io.emit('newPost'); res.json(p);
});

app.get('/api/messages/conversations', auth, async (req, res) => {
     const users = await User.find({ _id: { $ne: req.user._id } }); 
     res.json(users.map(u => ({ user: u, unread: 0, lastMessage: null }))); 
});
app.get('/api/messages/:uid', auth, async (req, res) => {
    const msgs = await Message.find({ $or: [{ from: req.user._id, to: req.params.uid }, { from: req.params.uid, to: req.user._id }] }).sort({ createdAt: 1 });
    res.json(msgs);
});
app.post('/api/messages', auth, async (req, res) => {
    const m = await Message.create({ from: req.user._id, to: req.body.to, text: req.body.text });
    io.to(req.body.to).emit('newMessage', m); res.json(m);
});

// Csoportok és Közösségek (Alap funkcionalitás)
app.get('/api/groups', auth, async (req, res) => res.json(await Group.find({ members: req.user._id })));
app.post('/api/groups', auth, async (req, res) => { const g = await Group.create({ ...req.body, creator: req.user._id }); res.json(g); });
app.get('/api/communities', auth, async (req, res) => res.json(await Community.find()));

// Socket.IO
io.on('connection', (socket) => {
    socket.on('join', (uid) => { socket.join(uid); User.findByIdAndUpdate(uid, { isOnline: true }); });
    socket.on('typing', (d) => io.to(d.to).emit('typing', d.from));
    socket.on('stopTyping', (d) => io.to(d.to).emit('stopTyping', d.from));
    socket.on('newGroupMessage', (d) => io.to(d.groupId).emit('newGroupMessage', d));
});

// Minden egyéb kérést az index.html szolgál ki
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Szerver fut: http://localhost:${PORT}`));