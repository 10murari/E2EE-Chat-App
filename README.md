# 🔐 SecureChat — End-to-End Encrypted Chat App

A project that demonstrates secure real-time messaging using **ECDH key exchange** and **AES-256-GCM encryption**.

> Goal: Build a practical chat app where the server stores and relays encrypted data, but cannot read message plaintext.

---

## 📌 Project Overview

`SecureChat` is a full-stack web application with:
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** MongoDB
- **Real-time channel:** Socket.IO
- **Security stack:** JWT, bcrypt, ECDH, HKDF, AES-GCM, PBKDF2

Messages are encrypted in the browser before sending, and decrypted only on the recipient side.

---

## ✨ Key Features

- End-to-end encrypted 1:1 messaging
- Secure authentication (JWT + bcrypt)
- Public-key based key exchange (ECDH P-256)
- AES-256-GCM encrypted message payloads
- Private key protection in browser storage (PBKDF2 + AES-GCM)
- Real-time messaging with online status and typing indicators
- User search and conversation history
- Input validation and improved error handling for demo stability

---

## 🔒 Security Design (High-Level)

### What is protected
- Passwords are hashed (bcrypt, server-side)
- Private keys remain client-side only
- Message plaintext never needs to be stored server-side

### What the server stores
- User account data + public keys
- Encrypted message payload (`ciphertext`) + IV
- Metadata (sender, receiver, timestamp)

### What the server cannot do
- Cannot decrypt user messages without endpoint private keys

For detailed crypto flow, see: **`ARCHITECTURE.md`**

---

## 🧱 Project Structure

```text
E2EE-Chat-App/
├── README.md
├── ARCHITECTURE.md
├── client/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       │   ├── Auth/
│       │   ├── Chat/
│       │   └── Settings/
│       ├── context/
│       ├── crypto/
│       └── styles/
└── server/
    ├── package.json
    ├── server.js
    ├── middleware/
    ├── models/
    ├── routes/
    └── socket/
```

---

## ⚙️ Prerequisites

- Node.js (LTS recommended)
- MongoDB running locally (or remote URI)

---

## 🚀 Local Setup

### 1) Start MongoDB
```bat
mongod
```

### 2) Start backend
```bat
cd server
npm install
npm start
```

### 3) Start frontend
```bat
cd client
npm install
npm run dev
```

### 4) Open app
- `http://localhost:5173`

---

## 🧪 Quick Demo Flow (Classroom)

1. Open app in normal browser and incognito.
2. Register 2 users (example: `alice`, `bob`).
3. Login both users.
4. Search and start chat.
5. Send messages both ways.
6. Show that chat is real-time.
7. Open MongoDB and show stored `ciphertext` is unreadable plaintext-wise.

---

## 🧰 Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB, Mongoose |
| Auth | JWT, bcrypt |
| Crypto | Web Crypto API (ECDH, HKDF, AES-GCM, PBKDF2) |

---

## 🔬 Testing Notes

This project was tested for:
- Registration/login flow
- Real-time encrypted messaging
- Conversation history fetch
- Input validation behavior
- Basic multi-session behavior checks

If you test with same user in multiple tabs and observe sync issues, ensure socket session handling is configured for multiple active sockets per user.

---

## ⚠️ Scope & Limitations (Mini-Project)

This is a classroom-focused implementation, not a production-hardened system. Example non-goals:
- Full key rotation strategy
- Advanced rate limiting and abuse controls
- Enterprise-grade observability and incident logging

---

## 📈 Future Enhancements

- Group chat with E2EE
- Robust multi-device session sync
- Message delivery/read receipts
- Key rotation + recovery workflow
- HTTPS deployment + stronger security hardening

---

