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
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const FormData = require('form-data');

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
    firstName: { type: String, required: true },
    lastName: { type: String, default: '' }, // Nem kötelező (tulajdonosnak lehet csak egy neve)
    username: { type: String, unique: true, required: true, lowercase: true, trim: true },
    birthDate: { type: Date, default: null },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    cover: { type: String, default: '' },
    bio: { type: String, default: '' },
    // Részletes profil adatok
    workplace: { type: String, default: '' }, // Munkahely
    jobTitle: { type: String, default: '' }, // Munkakör
    school: { type: String, default: '' }, // Iskola
    college: { type: String, default: '' }, // Egyetem/Főiskola
    currentCity: { type: String, default: '' }, // Jelenlegi város
    hometown: { type: String, default: '' }, // Szülőváros
    relationship: { type: String, default: '' }, // Kapcsolati állapot
    // Barátok és jogok
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isOwner: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    lastUsernameChange: { type: Date, default: null },
    // Admin adatok
    registrationIP: { type: String, default: '' },
    lastLoginIP: { type: String, default: '' },
    lastLoginAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
    deviceInfo: { type: String, default: '' },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    bannedAt: { type: Date, default: null },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Virtuális mező a teljes névhez
userSchema.virtual('name').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Virtuálisok megjelenjenek a JSON-ban
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Poszt séma
const postSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    image: { type: String },
    feeling: { type: String }, // Érzés/tevékenység
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: {
        like: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        love: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        haha: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        wow: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        sad: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        angry: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date },
    comments: [{
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Üzenet séma (48 óra után automatikusan törlődik)
const messageSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 48 * 60 * 60 * 1000), index: { expires: 0 } }
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

// Csoport séma
const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, default: '' },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    messages: [{
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, default: () => new Date(Date.now() + 48 * 60 * 60 * 1000) }
    }],
    lastMessage: { type: Date, default: Date.now }
}, { timestamps: true });

// Csoport üzenetek tisztítása (48 óránál régebbiek törlése)
async function cleanOldGroupMessages() {
    try {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
        await Group.updateMany(
            {},
            { $pull: { messages: { createdAt: { $lt: cutoff } } } }
        );
        console.log('✅ Régi csoportüzenetek törölve');
    } catch (error) {
        console.error('Csoportüzenet törlés hiba:', error);
    }
}

// Óránként futtatjuk a tisztítást
setInterval(cleanOldGroupMessages, 60 * 60 * 1000);
// Induláskor is lefut
setTimeout(cleanOldGroupMessages, 5000);

const Group = mongoose.model('Group', groupSchema);

// Közösségi csoport séma (mint Facebook csoportok)
const communitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    cover: { type: String, default: '' },
    icon: { type: String, default: '' },
    privacy: { type: String, enum: ['public', 'private', 'hidden'], default: 'public' },
    // public = bárki csatlakozhat, private = kérelem kell, hidden = csak meghívóval
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pendingMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Csatlakozási kérelmek
    invitedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Meghívottak
    bannedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isOfficial: { type: Boolean, default: false }, // Tulajdonos hivatalos csoportja
    rules: [{ type: String }], // Csoport szabályok
    category: { type: String, default: 'Általános' },
    memberCount: { type: Number, default: 1 }
}, { timestamps: true });

// Közösségi csoport poszt séma
const communityPostSchema = new mongoose.Schema({
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    image: { type: String },
    feeling: { type: String },
    isPinned: { type: Boolean, default: false },
    isAnnouncement: { type: Boolean, default: false },
    reactions: {
        like: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        love: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        haha: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        wow: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        sad: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        angry: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    comments: [{
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const Community = mongoose.model('Community', communitySchema);
const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);

// ============ RANDOM USERNAME GENERÁLÁS ============
function generateRandomUsername(baseName = 'user') {
    const cleanName = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const random = Math.random().toString(36).substring(2, 8);
    return `${cleanName}_${random}`;
}

// ============ RÉGI FELHASZNÁLÓK MIGRÁLÁSA ============
async function migrateOldUsers() {
    try {
        // Felhasználók akiknek nincs username-jük
        const usersWithoutUsername = await User.find({ 
            $or: [
                { username: { $exists: false } },
                { username: null },
                { username: '' }
            ]
        });
        
        for (const user of usersWithoutUsername) {
            let newUsername;
            let isUnique = false;
            
            // Generálunk egyedi username-et
            while (!isUnique) {
                const baseName = user.firstName || user.email.split('@')[0];
                newUsername = generateRandomUsername(baseName);
                const exists = await User.findOne({ username: newUsername });
                if (!exists) isUnique = true;
            }
            
            // Ha nincs firstName/lastName, generáljunk az emailből
            if (!user.firstName || !user.lastName) {
                const emailName = user.email.split('@')[0];
                user.firstName = user.firstName || emailName.charAt(0).toUpperCase() + emailName.slice(1);
                user.lastName = user.lastName || '';
            }
            
            user.username = newUsername;
            await user.save();
            console.log(`✅ Migrálva: ${user.email} -> @${newUsername}`);
        }
        
        if (usersWithoutUsername.length > 0) {
            console.log(`✅ ${usersWithoutUsername.length} felhasználó migrálva!`);
        }
    } catch (error) {
        console.error('Migráció hiba:', error);
    }
}

// ============ OWNER LÉTREHOZÁSA ============
async function createOwner() {
    // Owner létrehozása (csak ő van az .env-ben, az adminokat ő nevezi ki)
    const ownerUsername = process.env.OWNER_USERNAME || 'owner';
    const ownerExists = await User.findOne({ username: ownerUsername.toLowerCase() });
    if (!ownerExists && process.env.OWNER_USERNAME) {
        const hashedPassword = await bcrypt.hash(process.env.OWNER_PASSWORD, 10);
        const ownerName = process.env.OWNER_FIRSTNAME || 'Owner';
        await User.create({
            firstName: ownerName,
            lastName: process.env.OWNER_LASTNAME || '', // Tulajdonosnak lehet üres
            username: ownerUsername.toLowerCase(),
            birthDate: new Date('2000-01-01'), // Alapértelmezett dátum
            password: hashedPassword,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName)}&background=f59e0b&color=fff&size=200`,
            isOwner: true,
            isAdmin: true
        });
        console.log('✅ Tulajdonos felhasználó létrehozva!');
    } else if (ownerExists) {
        // Owner adatok frissítése
        ownerExists.isOwner = true;
        ownerExists.isAdmin = true;
        ownerExists.firstName = process.env.OWNER_FIRSTNAME || ownerExists.firstName || 'Owner';
        // Tulajdonosnak a vezetéknév opcionális - ha nincs megadva az env-ben, marad ami volt
        if (process.env.OWNER_LASTNAME !== undefined) {
            ownerExists.lastName = process.env.OWNER_LASTNAME;
        }
        await ownerExists.save();
        console.log('✅ Tulajdonos adatok frissítve!');
    }
    
    // Régi felhasználók migrálása
    await migrateOldUsers();
}
createOwner();

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

// IP cím lekérése
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           'Ismeretlen';
}

// Regisztráció
app.post('/api/auth/register', async (req, res) => {
    try {
        const { firstName, lastName, username, birthDate, password } = req.body;
        
        // Név ellenőrzés - kötelező mezők
        if (!firstName || !firstName.trim()) {
            return res.status(400).json({ error: 'A keresztnév megadása kötelező!' });
        }
        // Vezetéknév kötelező normál felhasználóknak
        if (!lastName || !lastName.trim()) {
            return res.status(400).json({ error: 'A vezetéknév megadása kötelező!' });
        }
        
        // Születési dátum ellenőrzés
        if (!birthDate) {
            return res.status(400).json({ error: 'A születési dátum megadása kötelező!' });
        }
        
        // Életkor ellenőrzés (minimum 13 év)
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        if (age < 13) {
            return res.status(400).json({ error: 'Minimum 13 éves kort kell betöltened a regisztrációhoz!' });
        }
        
        // Username ellenőrzés
        const usernameExists = await User.findOne({ username: username.toLowerCase() });
        if (usernameExists) return res.status(400).json({ error: 'Ez a felhasználónév már foglalt!' });
        
        // Username formátum ellenőrzés
        if (!/^[a-zA-Z0-9._]+$/.test(username)) {
            return res.status(400).json({ error: 'A felhasználónév csak betűket, számokat, pontot és aláhúzást tartalmazhat!' });
        }
        
        if (username.length < 3 || username.length > 30) {
            return res.status(400).json({ error: 'A felhasználónév 3-30 karakter hosszú legyen!' });
        }

        const clientIP = getClientIP(req);
        const deviceInfo = req.headers['user-agent'] || 'Ismeretlen eszköz';

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            username: username.toLowerCase(),
            birthDate: birth,
            password: hashedPassword,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName + ' ' + lastName)}&background=random&size=200`,
            registrationIP: clientIP,
            lastLoginIP: clientIP,
            lastLoginAt: new Date(),
            loginCount: 1,
            deviceInfo: deviceInfo
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'titkos_kulcs', { expiresIn: '7d' });
        res.json({ token, user: { ...user.toObject(), password: undefined } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Username elérhetőség ellenőrzése
app.get('/api/auth/check-username/:username', async (req, res) => {
    try {
        const exists = await User.findOne({ username: req.params.username.toLowerCase() });
        res.json({ available: !exists });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bejelentkezés
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return res.status(400).json({ error: 'Hibás felhasználónév vagy jelszó!' });

        // Ellenőrizzük, hogy ki van-e tiltva
        if (user.isBanned) {
            return res.status(403).json({ error: `A fiókod ki van tiltva! Ok: ${user.banReason || 'Nincs megadva'}` });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Hibás felhasználónév vagy jelszó!' });

        const clientIP = getClientIP(req);
        const deviceInfo = req.headers['user-agent'] || 'Ismeretlen eszköz';

        user.isOnline = true;
        user.lastLoginIP = clientIP;
        user.lastLoginAt = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        user.deviceInfo = deviceInfo;
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

// Összes felhasználó (kereséshez is)
app.get('/api/users', auth, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user._id } })
            .select('-password')
            .sort({ name: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Egy felhasználó ID alapján
app.get('/api/users/:id', auth, async (req, res) => {
    try {
        // Ellenőrizzük, hogy valid MongoDB ID-e
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: 'Érvénytelen ID formátum!' });
        }
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('friends', 'firstName lastName username avatar isOnline');
        if (!user) return res.status(404).json({ error: 'Felhasználó nem található!' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Egy felhasználó USERNAME alapján
app.get('/api/users/username/:username', auth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username.toLowerCase() })
            .select('-password')
            .populate('friends', 'firstName lastName username avatar isOnline');
        if (!user) return res.status(404).json({ error: 'Felhasználó nem található!' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Profil frissítése
app.put('/api/users/profile', auth, async (req, res) => {
    try {
        const { avatar, cover, bio, firstName, lastName, workplace, jobTitle, school, college, currentCity, hometown, relationship, birthDate } = req.body;
        
        // Vezetéknév kötelező, kivéve ha tulajdonos
        if (!req.user.isOwner && (!lastName || !lastName.trim())) {
            return res.status(400).json({ error: 'A vezetéknév megadása kötelező!' });
        }
        
        // Frissítendő adatok
        const updateData = { 
            avatar, cover, bio, firstName, lastName: lastName || '', 
            workplace, jobTitle, school, college, currentCity, hometown, relationship 
        };
        
        // Születési dátum csak akkor állítható be, ha még nincs megadva
        if (birthDate && !req.user.birthDate) {
            const birth = new Date(birthDate);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            if (age < 13) {
                return res.status(400).json({ error: 'Minimum 13 éves kort kell betöltened!' });
            }
            updateData.birthDate = birth;
        }
        
        const user = await User.findByIdAndUpdate(
            req.user._id, 
            updateData, 
            { new: true }
        ).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Username módosítása (havonta egyszer)
app.put('/api/users/username', auth, async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findById(req.user._id);
        
        // Ellenőrizzük, hogy eltelt-e 30 nap
        if (user.lastUsernameChange) {
            const daysSinceChange = (Date.now() - new Date(user.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceChange < 30) {
                const daysLeft = Math.ceil(30 - daysSinceChange);
                return res.status(400).json({ 
                    error: `Még ${daysLeft} napot kell várnod a következő felhasználónév váltásig!` 
                });
            }
        }
        
        // Username formátum ellenőrzés
        if (!/^[a-zA-Z0-9._]+$/.test(username)) {
            return res.status(400).json({ error: 'A felhasználónév csak betűket, számokat, pontot és aláhúzást tartalmazhat!' });
        }
        
        if (username.length < 3 || username.length > 30) {
            return res.status(400).json({ error: 'A felhasználónév 3-30 karakter hosszú legyen!' });
        }
        
        // Egyediség ellenőrzése
        const exists = await User.findOne({ username: username.toLowerCase(), _id: { $ne: req.user._id } });
        if (exists) {
            return res.status(400).json({ error: 'Ez a felhasználónév már foglalt!' });
        }
        
        user.username = username.toLowerCase();
        user.lastUsernameChange = new Date();
        await user.save();
        
        res.json({ ...user.toObject(), password: undefined });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ POST ROUTES ============

// Posztok lekérése
app.get('/api/posts', auth, async (req, res) => {
    const posts = await Post.find()
        .populate('author', 'firstName lastName username avatar')
        .populate('comments.author', 'firstName lastName username avatar')
        .sort({ createdAt: -1 });
    res.json(posts);
});

// Felhasználó posztjai
app.get('/api/posts/user/:id', auth, async (req, res) => {
    const posts = await Post.find({ author: req.params.id })
        .populate('author', 'firstName lastName username avatar')
        .populate('comments.author', 'firstName lastName username avatar')
        .sort({ createdAt: -1 });
    res.json(posts);
});

// Poszt létrehozása
app.post('/api/posts', auth, async (req, res) => {
    const { content, image, feeling } = req.body;
    const post = await Post.create({ author: req.user._id, content, image, feeling });
    await post.populate('author', 'firstName lastName username avatar');
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

// Lájkolás (régi, kompatibilitás miatt)
app.post('/api/posts/:id/like', auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    const idx = post.likes.indexOf(req.user._id);
    
    const userName = `${req.user.firstName} ${req.user.lastName}`.trim();
    
    if (idx > -1) {
        post.likes.splice(idx, 1);
    } else {
        post.likes.push(req.user._id);
        if (post.author.toString() !== req.user._id.toString()) {
            await Notification.create({
                user: post.author,
                text: `${userName} kedveli a bejegyzésedet`,
                type: 'like'
            });
            io.to(post.author.toString()).emit('notification');
        }
    }
    
    await post.save();
    await post.populate('author', 'firstName lastName username avatar');
    io.emit('updatePost', post);
    res.json(post);
});

// Reakció poszthoz (like, love, haha, wow, sad, angry)
app.post('/api/posts/:id/react', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const { reaction } = req.body;
        const userId = req.user._id;
        const userName = `${req.user.firstName} ${req.user.lastName}`.trim();
        
        // Inicializáljuk a reactions objektumot ha nincs
        if (!post.reactions) {
            post.reactions = { like: [], love: [], haha: [], wow: [], sad: [], angry: [] };
        }
        
        // Töröljük a korábbi reakciót
        ['like', 'love', 'haha', 'wow', 'sad', 'angry'].forEach(type => {
            if (!post.reactions[type]) post.reactions[type] = [];
            const idx = post.reactions[type].indexOf(userId);
            if (idx > -1) post.reactions[type].splice(idx, 1);
        });
        
        // Ellenőrizzük, hogy ugyanazt a reakciót adta-e (toggle)
        const alreadyReacted = post.reactions[reaction]?.includes(userId);
        
        if (!alreadyReacted) {
            post.reactions[reaction].push(userId);
            
            // Értesítés küldése
            if (post.author.toString() !== userId.toString()) {
                const reactionTexts = {
                    like: 'kedveli',
                    love: 'imádja',
                    haha: 'viccesnek találja',
                    wow: 'csodálja',
                    sad: 'szomorúnak találja',
                    angry: 'mérgesnek találja'
                };
                await Notification.create({
                    user: post.author,
                    text: `${userName} ${reactionTexts[reaction]} a bejegyzésedet`,
                    type: 'like'
                });
                io.to(post.author.toString()).emit('notification');
            }
        }
        
        await post.save();
        await post.populate('author', 'firstName lastName username avatar');
        io.emit('updatePost', post);
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Poszt mentése
app.post('/api/posts/:id/save', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post.savedBy) post.savedBy = [];
        
        const idx = post.savedBy.indexOf(req.user._id);
        if (idx > -1) {
            post.savedBy.splice(idx, 1);
        } else {
            post.savedBy.push(req.user._id);
        }
        
        await post.save();
        res.json({ saved: post.savedBy.includes(req.user._id) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mentett posztok lekérése
app.get('/api/posts/saved', auth, async (req, res) => {
    try {
        const posts = await Post.find({ savedBy: req.user._id })
            .populate('author', 'firstName lastName username avatar')
            .populate('comments.author', 'firstName lastName username avatar')
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Emlékek (X éve ezen a napon)
app.get('/api/posts/memories', auth, async (req, res) => {
    try {
        const today = new Date();
        const memories = await Post.find({
            author: req.user._id,
            $expr: {
                $and: [
                    { $eq: [{ $dayOfMonth: '$createdAt' }, today.getDate()] },
                    { $eq: [{ $month: '$createdAt' }, today.getMonth() + 1] },
                    { $lt: [{ $year: '$createdAt' }, today.getFullYear()] }
                ]
            }
        })
        .populate('author', 'firstName lastName username avatar')
        .sort({ createdAt: -1 })
        .limit(5);
        
        res.json(memories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Poszt szerkesztése
app.put('/api/posts/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Poszt nem található!' });
        if (post.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        post.content = req.body.content;
        post.editedAt = new Date();
        await post.save();
        
        await post.populate('author', 'firstName lastName username avatar');
        io.emit('updatePost', post);
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Komment hozzáadása
app.post('/api/posts/:id/comment', auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    post.comments.push({ author: req.user._id, text: req.body.text });
    await post.save();
    await post.populate('author', 'firstName lastName username avatar');
    await post.populate('comments.author', 'firstName lastName username avatar');
    
    const userName = `${req.user.firstName} ${req.user.lastName}`.trim();
    
    if (post.author._id.toString() !== req.user._id.toString()) {
        await Notification.create({
            user: post.author._id,
            text: `${userName} hozzászólt a bejegyzésedhez`,
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
    }).populate('from to', 'firstName lastName name avatar isOnline');

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
    
    const userName = `${req.user.firstName} ${req.user.lastName}`.trim();
    
    await Notification.create({
        user: req.params.userId,
        text: `${userName} barátkérelmet küldött`,
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

    const userName = `${req.user.firstName} ${req.user.lastName}`.trim();

    await Notification.create({
        user: request.from,
        text: `${userName} elfogadta a barátkérelmedet`,
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

// Barátkérelem visszavonása
app.delete('/api/friends/request/:userId', auth, async (req, res) => {
    try {
        await FriendRequest.findOneAndDelete({
            from: req.user._id,
            to: req.params.userId,
            status: 'pending'
        });
        res.json({ message: 'Barátkérelem visszavonva!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Barátkérelem státusz lekérése egy felhasználóval
app.get('/api/friends/status/:userId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const targetId = req.params.userId;
        
        // Már barátok?
        const isFriend = user.friends.some(f => f.toString() === targetId);
        if (isFriend) {
            return res.json({ status: 'friends' });
        }
        
        // Én küldtem kérelmet?
        const sentRequest = await FriendRequest.findOne({
            from: req.user._id,
            to: targetId,
            status: 'pending'
        });
        if (sentRequest) {
            return res.json({ status: 'request_sent', requestId: sentRequest._id });
        }
        
        // Nekem küldtek kérelmet?
        const receivedRequest = await FriendRequest.findOne({
            from: targetId,
            to: req.user._id,
            status: 'pending'
        });
        if (receivedRequest) {
            return res.json({ status: 'request_received', requestId: receivedRequest._id });
        }
        
        // Nincs kapcsolat
        res.json({ status: 'none' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Barátság törlése
app.delete('/api/friends/:userId', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { $pull: { friends: req.params.userId } });
        await User.findByIdAndUpdate(req.params.userId, { $pull: { friends: req.user._id } });
        res.json({ message: 'Barát törölve!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Javaslatok
app.get('/api/friends/suggestions', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const requests = await FriendRequest.find({
            $or: [{ from: req.user._id }, { to: req.user._id }],
            status: 'pending'
        });
        
        const excludeIds = [
            req.user._id,
            ...(user.friends || []),
            ...requests.map(r => r.from.toString()),
            ...requests.map(r => r.to.toString())
        ];

        const suggestions = await User.find({ _id: { $nin: excludeIds } })
            .select('name avatar isOnline')
            .limit(12);
        res.json(suggestions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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

// ============ IMAGE UPLOAD (ImgBB) ============

app.post('/api/upload', auth, async (req, res) => {
    try {
        const { image } = req.body; // base64 kép
        
        if (!image) {
            return res.status(400).json({ error: 'Nincs kép!' });
        }
        
        const apiKey = process.env.IMGBB_API_KEY;
        
        if (!apiKey || apiKey === 'your_imgbb_api_key_here') {
            // Ha nincs API kulcs, használjuk a base64-et (fallback)
            console.log('⚠️ ImgBB API kulcs nincs beállítva, base64 használata');
            return res.json({ url: image });
        }
        
        // Base64 prefix eltávolítása ha van
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        
        // ImgBB API hívás
        const formData = new URLSearchParams();
        formData.append('key', apiKey);
        formData.append('image', base64Data);
        
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Kép feltöltve:', data.data.url);
            res.json({ url: data.data.url });
        } else {
            console.error('❌ ImgBB hiba:', data);
            // Fallback base64-re
            res.json({ url: image });
        }
    } catch (error) {
        console.error('❌ Képfeltöltés hiba:', error);
        // Fallback base64-re hiba esetén
        res.json({ url: req.body.image });
    }
});

// ============ STORY ROUTES ============

app.get('/api/stories', auth, async (req, res) => {
    const stories = await Story.find({ expiresAt: { $gt: new Date() } })
        .populate('author', 'firstName lastName username avatar')
        .sort({ createdAt: -1 });
    res.json(stories);
});

app.post('/api/stories', auth, async (req, res) => {
    const story = await Story.create({ author: req.user._id, image: req.body.image });
    await story.populate('author', 'firstName lastName username avatar');
    io.emit('newStory', story);
    res.json(story);
});

// Story törlése
app.delete('/api/stories/:id', auth, async (req, res) => {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Történet nem található!' });
    if (story.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Nincs jogosultságod!' });
    }
    await story.deleteOne();
    io.emit('storyDeleted', req.params.id);
    res.json({ message: 'Történet törölve!' });
});

// ============ GROUP ROUTES ============

// Csoportok lekérése
app.get('/api/groups', auth, async (req, res) => {
    try {
        const groups = await Group.find({ members: req.user._id })
            .populate('members', 'firstName lastName username avatar isOnline')
            .populate('creator', 'firstName lastName username avatar')
            .populate('admins', 'firstName lastName username avatar')
            .sort({ lastMessage: -1 });
        
        // Unread count hozzáadása
        const groupsWithUnread = groups.map(g => ({
            ...g.toObject(),
            unreadCount: 0 // Később implementálható
        }));
        
        res.json(groupsWithUnread);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Egy csoport lekérése
app.get('/api/groups/:id', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('members', 'firstName lastName username avatar isOnline isAdmin isOwner')
            .populate('creator', 'firstName lastName username avatar')
            .populate('admins', 'firstName lastName username avatar');
        
        if (!group) return res.status(404).json({ error: 'Csoport nem található!' });
        if (!group.members.some(m => m._id.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Nem vagy tagja ennek a csoportnak!' });
        }
        
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Csoport létrehozása
app.post('/api/groups', auth, async (req, res) => {
    try {
        const { name, image, members } = req.body;
        
        if (!name || !members || members.length < 2) {
            return res.status(400).json({ error: 'Adj meg nevet és legalább 2 tagot!' });
        }
        
        const group = await Group.create({
            name,
            image,
            creator: req.user._id,
            admins: [req.user._id],
            members: [...new Set(members)] // Duplikációk eltávolítása
        });
        
        await group.populate('members', 'firstName lastName username avatar');
        
        // Értesítés küldése a tagoknak
        for (const memberId of members) {
            if (memberId !== req.user._id.toString()) {
                io.to(memberId).emit('addedToGroup', group);
            }
        }
        
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Csoport üzenetek lekérése
app.get('/api/groups/:id/messages', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('messages.from', 'firstName lastName username avatar isAdmin isOwner');
        
        if (!group) return res.status(404).json({ error: 'Csoport nem található!' });
        
        res.json(group.messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Üzenet küldése csoportba
app.post('/api/groups/:id/messages', auth, async (req, res) => {
    try {
        const { text } = req.body;
        const group = await Group.findById(req.params.id);
        
        if (!group) return res.status(404).json({ error: 'Csoport nem található!' });
        if (!group.members.some(m => m.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Nem vagy tagja ennek a csoportnak!' });
        }
        
        group.messages.push({ from: req.user._id, text });
        group.lastMessage = new Date();
        await group.save();
        
        const message = group.messages[group.messages.length - 1];
        await Group.populate(group, { path: 'messages.from', select: 'firstName lastName username avatar isAdmin isOwner' });
        
        // Értesítés a csoport tagjainak
        group.members.forEach(memberId => {
            io.to(memberId.toString()).emit('newGroupMessage', { 
                groupId: group._id, 
                message: group.messages[group.messages.length - 1] 
            });
        });
        
        res.json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tag eltávolítása
app.delete('/api/groups/:id/members/:memberId', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        
        if (!group) return res.status(404).json({ error: 'Csoport nem található!' });
        if (!group.admins.some(a => a.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        if (group.creator.toString() === req.params.memberId) {
            return res.status(403).json({ error: 'A létrehozó nem távolítható el!' });
        }
        
        group.members = group.members.filter(m => m.toString() !== req.params.memberId);
        group.admins = group.admins.filter(a => a.toString() !== req.params.memberId);
        await group.save();
        
        io.to(req.params.memberId).emit('removedFromGroup', group._id);
        
        res.json({ message: 'Tag eltávolítva!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Kilépés csoportból
app.post('/api/groups/:id/leave', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        
        if (!group) return res.status(404).json({ error: 'Csoport nem található!' });
        
        if (group.creator.toString() === req.user._id.toString()) {
            // Ha a létrehozó lép ki, a csoport törlődik
            await group.deleteOne();
            group.members.forEach(memberId => {
                io.to(memberId.toString()).emit('groupDeleted', group._id);
            });
            return res.json({ message: 'Csoport törölve!' });
        }
        
        group.members = group.members.filter(m => m.toString() !== req.user._id.toString());
        group.admins = group.admins.filter(a => a.toString() !== req.user._id.toString());
        await group.save();
        
        res.json({ message: 'Kiléptél a csoportból!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tag hozzáadása
app.post('/api/groups/:id/members', auth, async (req, res) => {
    try {
        const { userIds } = req.body;
        const group = await Group.findById(req.params.id);
        
        if (!group) return res.status(404).json({ error: 'Csoport nem található!' });
        if (!group.admins.some(a => a.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        for (const userId of userIds) {
            if (!group.members.some(m => m.toString() === userId)) {
                group.members.push(userId);
                io.to(userId).emit('addedToGroup', group);
            }
        }
        
        await group.save();
        res.json({ message: 'Tagok hozzáadva!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ COMMUNITY (KÖZÖSSÉGI CSOPORT) ROUTES ============

// Összes közösség lekérése
app.get('/api/communities', auth, async (req, res) => {
    try {
        const communities = await Community.find({
            $or: [
                { privacy: 'public' },
                { privacy: 'private' },
                { members: req.user._id },
                { creator: req.user._id }
            ]
        })
        .populate('creator', 'firstName lastName username avatar isOwner isAdmin')
        .populate('members', 'firstName lastName username avatar isOnline')
        .sort({ memberCount: -1, createdAt: -1 });
        
        res.json(communities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Saját közösségeim
app.get('/api/communities/my', auth, async (req, res) => {
    try {
        const communities = await Community.find({ members: req.user._id })
            .populate('creator', 'firstName lastName username avatar isOwner isAdmin')
            .populate('members', 'firstName lastName username avatar')
            .sort({ createdAt: -1 });
        res.json(communities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Felfedezés - ajánlott közösségek
app.get('/api/communities/discover', auth, async (req, res) => {
    try {
        const communities = await Community.find({
            members: { $ne: req.user._id },
            privacy: { $in: ['public', 'private'] },
            bannedMembers: { $ne: req.user._id }
        })
        .populate('creator', 'firstName lastName username avatar isOwner isAdmin')
        .populate('members', 'firstName lastName username avatar')
        .sort({ memberCount: -1 })
        .limit(20);
        res.json(communities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Egy közösség lekérése
app.get('/api/communities/:id', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id)
            .populate('creator', 'firstName lastName username avatar isOwner isAdmin')
            .populate('admins', 'firstName lastName username avatar isOwner isAdmin')
            .populate('moderators', 'firstName lastName username avatar')
            .populate('members', 'firstName lastName username avatar isOnline')
            .populate('pendingMembers', 'firstName lastName username avatar');
        
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        // Ha rejtett és nem tag, ne mutassa
        if (community.privacy === 'hidden' && !community.members.some(m => m._id.toString() === req.user._id.toString())) {
            return res.status(404).json({ error: 'Közösség nem található!' });
        }
        
        res.json(community);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Közösség létrehozása
app.post('/api/communities', auth, async (req, res) => {
    try {
        const { name, description, cover, icon, privacy, category, rules } = req.body;
        
        if (!name || name.length < 3) {
            return res.status(400).json({ error: 'A csoport neve legalább 3 karakter legyen!' });
        }
        
        const community = await Community.create({
            name,
            description,
            cover,
            icon,
            privacy: privacy || 'public',
            category: category || 'Általános',
            rules: rules || [],
            creator: req.user._id,
            admins: [req.user._id],
            members: [req.user._id],
            isOfficial: req.user.isOwner, // Ha tulajdonos hozza létre, hivatalos
            memberCount: 1
        });
        
        await community.populate('creator', 'firstName lastName username avatar isOwner isAdmin');
        res.json(community);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Közösség szerkesztése
app.put('/api/communities/:id', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        // Csak admin szerkeszthet
        if (!community.admins.some(a => a.toString() === req.user._id.toString()) && !req.user.isOwner) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        const { name, description, cover, icon, privacy, category, rules } = req.body;
        
        community.name = name || community.name;
        community.description = description !== undefined ? description : community.description;
        community.cover = cover !== undefined ? cover : community.cover;
        community.icon = icon !== undefined ? icon : community.icon;
        community.privacy = privacy || community.privacy;
        community.category = category || community.category;
        community.rules = rules || community.rules;
        
        await community.save();
        await community.populate('creator', 'firstName lastName username avatar isOwner isAdmin');
        
        res.json(community);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Közösség törlése
app.delete('/api/communities/:id', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        // Csak creator vagy owner törölhet
        if (community.creator.toString() !== req.user._id.toString() && !req.user.isOwner) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        // Posztok törlése
        await CommunityPost.deleteMany({ community: req.params.id });
        await community.deleteOne();
        
        res.json({ message: 'Közösség törölve!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Csatlakozás közösséghez
app.post('/api/communities/:id/join', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        // Már tag?
        if (community.members.includes(req.user._id)) {
            return res.status(400).json({ error: 'Már tag vagy!' });
        }
        
        // Tiltva van?
        if (community.bannedMembers.includes(req.user._id)) {
            return res.status(403).json({ error: 'Ki vagy tiltva ebből a közösségből!' });
        }
        
        if (community.privacy === 'public') {
            // Nyilvános - azonnal csatlakozhat
            community.members.push(req.user._id);
            community.memberCount = community.members.length;
            await community.save();
            res.json({ message: 'Csatlakoztál a közösséghez!', status: 'joined' });
        } else if (community.privacy === 'private') {
            // Privát - kérelem
            if (community.pendingMembers.includes(req.user._id)) {
                return res.status(400).json({ error: 'Már kérelmet küldtél!' });
            }
            community.pendingMembers.push(req.user._id);
            await community.save();
            
            // Értesítés az adminoknak
            for (const adminId of community.admins) {
                await Notification.create({
                    user: adminId,
                    text: `${req.user.firstName} ${req.user.lastName} csatlakozni szeretne: ${community.name}`,
                    type: 'friend'
                });
                io.to(adminId.toString()).emit('notification');
            }
            
            res.json({ message: 'Csatlakozási kérelem elküldve!', status: 'pending' });
        } else {
            // Rejtett - csak meghívóval
            if (community.invitedMembers.includes(req.user._id)) {
                community.members.push(req.user._id);
                community.invitedMembers = community.invitedMembers.filter(m => m.toString() !== req.user._id.toString());
                community.memberCount = community.members.length;
                await community.save();
                res.json({ message: 'Csatlakoztál a közösséghez!', status: 'joined' });
            } else {
                return res.status(403).json({ error: 'Csak meghívóval csatlakozhatsz!' });
            }
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Kilépés közösségből
app.post('/api/communities/:id/leave', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        if (community.creator.toString() === req.user._id.toString()) {
            return res.status(400).json({ error: 'A létrehozó nem léphet ki! Töröld a közösséget.' });
        }
        
        community.members = community.members.filter(m => m.toString() !== req.user._id.toString());
        community.admins = community.admins.filter(a => a.toString() !== req.user._id.toString());
        community.moderators = community.moderators.filter(m => m.toString() !== req.user._id.toString());
        community.memberCount = community.members.length;
        await community.save();
        
        res.json({ message: 'Kiléptél a közösségből!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Csatlakozási kérelem elfogadása
app.post('/api/communities/:id/approve/:userId', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        // Csak admin fogadhat el
        if (!community.admins.some(a => a.toString() === req.user._id.toString()) && 
            !community.moderators.some(m => m.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        const userId = req.params.userId;
        
        if (!community.pendingMembers.some(p => p.toString() === userId)) {
            return res.status(400).json({ error: 'Nincs ilyen kérelem!' });
        }
        
        community.pendingMembers = community.pendingMembers.filter(p => p.toString() !== userId);
        community.members.push(userId);
        community.memberCount = community.members.length;
        await community.save();
        
        // Értesítés
        await Notification.create({
            user: userId,
            text: `Elfogadták a csatlakozási kérelmedet: ${community.name}`,
            type: 'friend'
        });
        io.to(userId).emit('notification');
        
        res.json({ message: 'Tag elfogadva!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Csatlakozási kérelem elutasítása
app.post('/api/communities/:id/reject/:userId', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        if (!community.admins.some(a => a.toString() === req.user._id.toString()) && 
            !community.moderators.some(m => m.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        community.pendingMembers = community.pendingMembers.filter(p => p.toString() !== req.params.userId);
        await community.save();
        
        res.json({ message: 'Kérelem elutasítva!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tag meghívása
app.post('/api/communities/:id/invite/:userId', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        if (!community.members.some(m => m.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Csak tagok hívhatnak meg!' });
        }
        
        const userId = req.params.userId;
        
        if (community.members.some(m => m.toString() === userId)) {
            return res.status(400).json({ error: 'Már tag!' });
        }
        
        if (community.invitedMembers.some(i => i.toString() === userId)) {
            return res.status(400).json({ error: 'Már meg van hívva!' });
        }
        
        community.invitedMembers.push(userId);
        await community.save();
        
        // Értesítés
        await Notification.create({
            user: userId,
            text: `${req.user.firstName} ${req.user.lastName} meghívott a ${community.name} közösségbe`,
            type: 'friend'
        });
        io.to(userId).emit('notification');
        
        res.json({ message: 'Meghívó elküldve!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tag eltávolítása / kitiltás
app.post('/api/communities/:id/remove/:userId', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        if (!community.admins.some(a => a.toString() === req.user._id.toString()) && !req.user.isOwner) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        const userId = req.params.userId;
        const { ban } = req.body;
        
        if (community.creator.toString() === userId) {
            return res.status(400).json({ error: 'A létrehozót nem lehet eltávolítani!' });
        }
        
        community.members = community.members.filter(m => m.toString() !== userId);
        community.admins = community.admins.filter(a => a.toString() !== userId);
        community.moderators = community.moderators.filter(m => m.toString() !== userId);
        community.memberCount = community.members.length;
        
        if (ban) {
            community.bannedMembers.push(userId);
        }
        
        await community.save();
        
        res.json({ message: ban ? 'Tag kitiltva!' : 'Tag eltávolítva!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin/moderátor kinevezése
app.post('/api/communities/:id/promote/:userId', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        if (!community.admins.some(a => a.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        const { role } = req.body; // 'admin' vagy 'moderator'
        const userId = req.params.userId;
        
        if (!community.members.some(m => m.toString() === userId)) {
            return res.status(400).json({ error: 'Nem tag!' });
        }
        
        if (role === 'admin') {
            if (!community.admins.some(a => a.toString() === userId)) {
                community.admins.push(userId);
            }
        } else if (role === 'moderator') {
            if (!community.moderators.some(m => m.toString() === userId)) {
                community.moderators.push(userId);
            }
        }
        
        await community.save();
        res.json({ message: `${role === 'admin' ? 'Admin' : 'Moderátor'} kinevezve!` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Közösség posztok lekérése
app.get('/api/communities/:id/posts', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        // Ha privát és nem tag, ne mutassa
        if ((community.privacy === 'private' || community.privacy === 'hidden') && 
            !community.members.some(m => m.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Csak tagok láthatják a posztokat!' });
        }
        
        const posts = await CommunityPost.find({ community: req.params.id })
            .populate('author', 'firstName lastName username avatar isOwner isAdmin')
            .populate('comments.author', 'firstName lastName username avatar isOwner isAdmin')
            .sort({ isPinned: -1, createdAt: -1 });
        
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Poszt létrehozása közösségben
app.post('/api/communities/:id/posts', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Közösség nem található!' });
        
        if (!community.members.some(m => m.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Csak tagok posztolhatnak!' });
        }
        
        const { content, image, feeling, isAnnouncement } = req.body;
        
        const post = await CommunityPost.create({
            community: req.params.id,
            author: req.user._id,
            content,
            image,
            feeling,
            isAnnouncement: isAnnouncement && community.admins.some(a => a.toString() === req.user._id.toString())
        });
        
        await post.populate('author', 'firstName lastName username avatar isOwner isAdmin');
        
        // Socket értesítés
        io.to(`community-${req.params.id}`).emit('newCommunityPost', post);
        
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Közösségi poszt törlése
app.delete('/api/communities/:communityId/posts/:postId', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.communityId);
        const post = await CommunityPost.findById(req.params.postId);
        
        if (!post) return res.status(404).json({ error: 'Poszt nem található!' });
        
        const isAuthor = post.author.toString() === req.user._id.toString();
        const isAdmin = community.admins.some(a => a.toString() === req.user._id.toString());
        const isModerator = community.moderators.some(m => m.toString() === req.user._id.toString());
        
        if (!isAuthor && !isAdmin && !isModerator && !req.user.isOwner) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        await post.deleteOne();
        res.json({ message: 'Poszt törölve!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Közösségi poszt reakció
app.post('/api/communities/:communityId/posts/:postId/react', auth, async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Poszt nem található!' });
        
        const { reaction } = req.body;
        const userId = req.user._id;
        
        if (!post.reactions) {
            post.reactions = { like: [], love: [], haha: [], wow: [], sad: [], angry: [] };
        }
        
        ['like', 'love', 'haha', 'wow', 'sad', 'angry'].forEach(type => {
            if (!post.reactions[type]) post.reactions[type] = [];
            const idx = post.reactions[type].indexOf(userId);
            if (idx > -1) post.reactions[type].splice(idx, 1);
        });
        
        const alreadyReacted = post.reactions[reaction]?.includes(userId);
        if (!alreadyReacted) {
            post.reactions[reaction].push(userId);
        }
        
        await post.save();
        await post.populate('author', 'firstName lastName username avatar isOwner isAdmin');
        
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Közösségi poszt komment
app.post('/api/communities/:communityId/posts/:postId/comment', auth, async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Poszt nem található!' });
        
        post.comments.push({ author: req.user._id, text: req.body.text });
        await post.save();
        
        await post.populate('author', 'firstName lastName username avatar isOwner isAdmin');
        await post.populate('comments.author', 'firstName lastName username avatar isOwner isAdmin');
        
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Poszt kitűzése
app.post('/api/communities/:communityId/posts/:postId/pin', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.communityId);
        if (!community.admins.some(a => a.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Nincs jogosultságod!' });
        }
        
        const post = await CommunityPost.findById(req.params.postId);
        post.isPinned = !post.isPinned;
        await post.save();
        
        res.json({ message: post.isPinned ? 'Poszt kitűzve!' : 'Kitűzés eltávolítva!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
    if (!user) return res.status(404).json({ error: 'Felhasználó nem található!' });
    if (user.isOwner) return res.status(403).json({ error: 'A tulajdonos nem törölhető!' });
    
    // Csak a tulajdonos törölhet admint
    if (user.isAdmin && !req.user.isOwner) {
        return res.status(403).json({ error: 'Csak a tulajdonos törölhet admint!' });
    }
    
    await Post.deleteMany({ author: req.params.id });
    await Message.deleteMany({ $or: [{ from: req.params.id }, { to: req.params.id }] });
    await FriendRequest.deleteMany({ $or: [{ from: req.params.id }, { to: req.params.id }] });
    await Notification.deleteMany({ user: req.params.id });
    await Story.deleteMany({ author: req.params.id });
    await user.deleteOne();
    
    res.json({ message: 'Felhasználó törölve!' });
});

// Admin jogosultság adása/elvétele (csak Owner)
app.post('/api/admin/toggle-admin/:id', auth, async (req, res) => {
    try {
        if (!req.user.isOwner) {
            return res.status(403).json({ error: 'Csak a tulajdonos adhat admin jogot!' });
        }
        
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Felhasználó nem található!' });
        if (user.isOwner) return res.status(403).json({ error: 'A tulajdonos jogai nem módosíthatók!' });
        
        user.isAdmin = !user.isAdmin;
        await user.save();
        
        res.json({ 
            message: user.isAdmin ? 'Admin jog megadva!' : 'Admin jog elvéve!',
            user: { ...user.toObject(), password: undefined }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Felhasználó tiltása (csak Admin/Owner)
app.post('/api/admin/ban/:id', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Felhasználó nem található!' });
        if (user.isOwner) return res.status(403).json({ error: 'A tulajdonos nem tiltható ki!' });
        if (user.isAdmin && !req.user.isOwner) {
            return res.status(403).json({ error: 'Csak a tulajdonos tilthat ki admint!' });
        }
        
        const { reason } = req.body;
        
        user.isBanned = true;
        user.banReason = reason || 'Nincs megadva';
        user.bannedAt = new Date();
        user.bannedBy = req.user._id;
        user.isOnline = false;
        await user.save();
        
        res.json({ message: 'Felhasználó kitiltva!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Felhasználó tiltás feloldása (csak Admin/Owner)
app.post('/api/admin/unban/:id', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Felhasználó nem található!' });
        
        user.isBanned = false;
        user.banReason = '';
        user.bannedAt = null;
        user.bannedBy = null;
        await user.save();
        
        res.json({ message: 'Tiltás feloldva!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Részletes felhasználó adatok lekérése (csak Admin)
app.get('/api/admin/users/:id/details', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('bannedBy', 'firstName lastName username');
        if (!user) return res.status(404).json({ error: 'Felhasználó nem található!' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ SOCKET.IO ============

const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('🔌 Felhasználó csatlakozott:', socket.id);

    socket.on('join', async (userId) => {
        socket.join(userId);
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;
        await User.findByIdAndUpdate(userId, { isOnline: true });
        io.emit('userOnline', userId);
    });

    socket.on('typing', ({ to, from }) => {
        io.to(to).emit('typing', from);
    });

    socket.on('stopTyping', ({ to, from }) => {
        io.to(to).emit('stopTyping', from);
    });

    // Hívás kezelése
    socket.on('startCall', async ({ to, from, type }) => {
        try {
            const caller = await User.findById(from).select('name avatar');
            io.to(to).emit('incomingCall', {
                from,
                name: caller.name,
                avatar: caller.avatar,
                type
            });
        } catch (error) {
            console.error('Call error:', error);
        }
    });

    socket.on('acceptCall', ({ to, from }) => {
        io.to(to).emit('callAccepted', { from });
    });

    socket.on('endCall', ({ to }) => {
        io.to(to).emit('callEnded');
    });

    // Csoport események
    socket.on('groupTyping', ({ groupId, userId, userName }) => {
        socket.to(groupId).emit('groupTyping', { groupId, userId, userName });
    });

    socket.on('stopGroupTyping', ({ groupId, userId }) => {
        socket.to(groupId).emit('stopGroupTyping', { groupId, userId });
    });

    socket.on('joinGroup', (groupId) => {
        socket.join(groupId);
    });

    socket.on('leaveGroup', (groupId) => {
        socket.leave(groupId);
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

// ============ CATCH-ALL ROUTE (SPA) ============
// Minden ismeretlen útvonalat az index.html-re irányít
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============ SZERVER INDÍTÁSA ============

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Szerver fut: http://localhost:${PORT}`);
});
