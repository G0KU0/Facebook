# 🚀 SocialBook - Facebook-szerű Közösségi Oldal

Egy modern, full-stack közösségi oldal MongoDB adatbázissal, Node.js szerverrel és Socket.io valós idejű kommunikációval.

![SocialBook](https://img.shields.io/badge/SocialBook-v1.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-6+-brightgreen)

## ✨ Funkciók

### 👤 Felhasználók
- Regisztráció és bejelentkezés (JWT autentikáció)
- Profilkép és borítókép beállítása
- Bemutatkozás szerkesztése
- Online/Offline státusz jelzés
- **Felhasználó keresés** név alapján

### 📰 Hírfolyam
- Posztok létrehozása szöveggel és képekkel
- Lájkolás és kommentelés
- Valós idejű frissítések (Socket.io)

### 💬 Messenger
- **Külön Messenger oldal** teljes képernyős csevegéssel
- **Lebegő chat ablakok** (Facebook stílusú, max 3 db)
- Valós idejű üzenetküldés
- "Gépel..." indikátor
- Olvasatlan üzenetek jelzése
- Üzenetek automatikusan megnyílnak új ablakban

### 📞 Hívások
- **Hanghívás** indítása
- **Videóhívás** indítása
- Némítás, videó ki/be kapcsolás
- Bejövő hívás értesítés

### 📸 Történetek (Stories)
- 24 órás történetek létrehozása
- Képfeltöltés
- **Történet törlése** (saját vagy admin)

### 👥 Barátok
- Barátkérelmek küldése/fogadása
- Ismerős javaslatok
- Barátlista kezelése

### 🔔 Értesítések
- Lájk, komment, barátkérelem értesítések
- Valós idejű értesítések badge-ekkel

### 🛡️ Admin Panel
- Statisztikák (felhasználók, posztok, üzenetek)
- Felhasználók listázása és törlése

### 🌓 Sötét/Világos mód
- Könnyű témaváltás

---

## 📦 Telepítés

### 1. Előfeltételek

- [Node.js](https://nodejs.org/) (18+)
- [MongoDB](https://www.mongodb.com/try/download/community) (helyi) vagy [MongoDB Atlas](https://www.mongodb.com/atlas) (felhő)

### 2. Projekt letöltése

```bash
# Klónozd a projektet
git clone <repo-url>
cd socialbook

# Függőségek telepítése
npm install
```

### 3. Környezeti változók beállítása

Szerkeszd a `.env` fájlt:

```env
# MongoDB kapcsolat
MONGODB_URI=mongodb://localhost:27017/socialbook

# JWT titkos kulcs (változtasd meg éles környezetben!)
JWT_SECRET=szuper_titkos_kulcs_123

# Szerver port
PORT=3000

# Admin felhasználó beállítások
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@socialbook.hu
ADMIN_PASSWORD=admin123
```

### 4. MongoDB indítása

**Helyi MongoDB:**
```bash
# Windows
mongod

# macOS/Linux
sudo systemctl start mongod
```

**MongoDB Atlas (felhő):**
- Hozz létre egy ingyenes cluster-t a [MongoDB Atlas](https://www.mongodb.com/atlas) oldalon
- Másold be a connection string-et a `.env` fájlba

### 5. Szerver indítása

```bash
# Fejlesztői mód (automatikus újratöltés)
npm run dev

# Vagy éles mód
npm start
```

### 6. Megnyitás böngészőben

Nyisd meg: **http://localhost:3000**

---

## 🔐 Bejelentkezés

### Tulajdonos (Owner)
- **Email:** owner@socialbook.hu
- **Jelszó:** owner123

> ⚠️ **Fontos:** Éles környezetben változtasd meg a tulajdonos jelszót a `.env` fájlban!

### Adminok
Az adminokat a **tulajdonos** nevezi ki a weboldalon keresztül az Admin Panelen. Az admin jogosultságok a MongoDB-ben tárolódnak.

---

## 📁 Projekt struktúra

```
socialbook/
├── index.html      # Frontend (Single Page Application)
├── server.js       # Backend (Node.js + Express + Socket.io)
├── .env            # Környezeti változók
├── package.json    # Függőségek
└── README.md       # Dokumentáció
```

---

## 🛠️ Technológiák

### Frontend
- HTML5, CSS3, JavaScript
- Tailwind CSS (modern UI)
- Socket.io Client (valós idejű kommunikáció)
- Font Awesome (ikonok)

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT (autentikáció)
- Socket.io (valós idejű)
- bcryptjs (jelszó titkosítás)

---

## 📡 API Végpontok

### Auth
- `POST /api/auth/register` - Regisztráció
- `POST /api/auth/login` - Bejelentkezés
- `GET /api/auth/me` - Jelenlegi felhasználó

### Users
- `GET /api/users` - Összes felhasználó
- `GET /api/users/:id` - Egy felhasználó
- `PUT /api/users/profile` - Profil frissítése

### Posts
- `GET /api/posts` - Összes poszt
- `POST /api/posts` - Új poszt
- `DELETE /api/posts/:id` - Poszt törlése
- `POST /api/posts/:id/like` - Lájkolás
- `POST /api/posts/:id/comment` - Komment

### Messages
- `GET /api/messages/conversations` - Beszélgetések
- `GET /api/messages/:userId` - Üzenetek
- `POST /api/messages` - Üzenet küldése

### Friends
- `GET /api/friends/requests` - Barátkérelmek
- `POST /api/friends/request/:userId` - Kérelem küldése
- `POST /api/friends/accept/:requestId` - Elfogadás
- `POST /api/friends/decline/:requestId` - Elutasítás
- `GET /api/friends/suggestions` - Javaslatok

### Notifications
- `GET /api/notifications` - Értesítések
- `PUT /api/notifications/read` - Olvasottnak jelölés
- `GET /api/notifications/unread` - Olvasatlan számok

### Stories
- `GET /api/stories` - Történetek
- `POST /api/stories` - Új történet

### Admin
- `GET /api/admin/stats` - Statisztikák
- `GET /api/admin/users` - Felhasználók
- `DELETE /api/admin/users/:id` - Felhasználó törlése

---

## 🎨 Testreszabás

### Tulajdonos (Owner) módosítása
Szerkeszd a `.env` fájlt:
```env
OWNER_FIRSTNAME=Új Keresztnév
OWNER_LASTNAME=Új Vezetéknév
OWNER_USERNAME=uj_felhasznalonev
OWNER_EMAIL=uj.email@example.com
OWNER_PASSWORD=uj_jelszo_123
```

### Admin jogosultság adása
1. Jelentkezz be tulajdonosként
2. Menj az Admin Panelre (jobb felső menüből)
3. Kattints az "Admin adása" gombra bármely felhasználónál
4. Az admin jogot bármikor elveheted ugyanitt

### Port módosítása
```env
PORT=8080
```

### MongoDB Atlas használata
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/socialbook
```

### ImgBB képfeltöltés beállítása (ingyenes, korlátlan tárhely)

A képek nem a MongoDB-ben tárolódnak, hanem az ImgBB ingyenes szolgáltatásán. Ez megakadályozza, hogy a MongoDB tárhely megteljen.

1. **Regisztrálj** az [ImgBB](https://imgbb.com) oldalon
2. **Szerezd meg az API kulcsot** itt: https://api.imgbb.com/
3. **Másold be a `.env` fájlba:**
```env
IMGBB_API_KEY=your_actual_api_key_here
```

Ha nincs API kulcs beállítva, a rendszer automatikusan base64 formátumban menti a képeket (de ez több tárhelyet foglal).

---

## 🐛 Hibaelhárítás

### "MongoDB connection error"
- Ellenőrizd, hogy fut-e a MongoDB
- Ellenőrizd a connection string-et a `.env` fájlban

### "Cannot find module"
```bash
npm install
```

### Port foglalt
Változtasd meg a portot a `.env` fájlban:
```env
PORT=8080
```

---

## 📄 Licensz

MIT License - szabadon használható és módosítható.

---

## 🤝 Közreműködés

Pull request-eket szívesen fogadunk!

1. Fork-old a repót
2. Készíts egy új branch-et (`git checkout -b feature/UjFunkcio`)
3. Commit-old a változtatásokat (`git commit -m 'Új funkció hozzáadása'`)
4. Push-old a branch-et (`git push origin feature/UjFunkcio`)
5. Nyiss egy Pull Request-et

---

**Készítette: SocialBook Team** 🚀
