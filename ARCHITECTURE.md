# E2EE Chat App - Architecture & Security Explanation

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          E2EE CHAT APPLICATION                          │
└─────────────────────────────────────────────────────────────────────────┘

CLIENT (Browser)                    SERVER (Node.js)              CLIENT (Browser)
─────────────────                   ────────────────              ─────────────────

   🔐 ALICE                          🔒 RELAY                          🔐 BOB
   
   • Private Key                     • Public Keys                     • Private Key
     (Never leaves)                    (Stored)                          (Never leaves)
   
   • Public Key                      • Encrypted Messages              • Public Key
     (Sent to server)                  (Can't read)                      (Sent to server)

                    ┌──────────────────────────────────┐
                    │  ENCRYPTION PROCESS (ALICE)      │
                    └──────────────────────────────────┘

1. ECDH Key Agreement
   Alice's Private Key + Bob's Public Key
         ↓
   Shared Secret (256-bit)
         ↓
   HKDF (SHA-256)
         ↓
   AES-256-GCM Key
   
2. Message Encryption
   Plaintext: "Hello Bob!"
         ↓
   Random IV (12 bytes)
         ↓
   AES-256-GCM
         ↓
   Ciphertext (Base64) + IV (Base64)
   
3. Send to Server
   Server stores: { sender, receiver, ciphertext, iv, timestamp }
   Server CANNOT decrypt!

                    ┌──────────────────────────────────┐
                    │  DECRYPTION PROCESS (BOB)        │
                    └──────────────────────────────────┘

1. Receive Ciphertext from Server
   Bob has: receiver's (Alice's) public key
   
2. ECDH Key Agreement (SAME CALCULATION)
   Bob's Private Key + Alice's Public Key
         ↓
   Same Shared Secret!
         ↓
   Same AES-256-GCM Key
   
3. Message Decryption
   Ciphertext + IV
         ↓
   AES-256-GCM
         ↓
   Plaintext: "Hello Bob!"
```

---

## 🔐 Cryptographic Algorithms

### Key Exchange: ECDH (Elliptic Curve Diffie-Hellman)

**What it does:**
- Two parties exchange public keys
- Both independently compute the SAME secret
- Server never sees the secret

**Mathematical Magic:**
```
Alice computes: deriveBits(Alice_Private, Bob_Public) = SECRET
Bob computes:   deriveBits(Bob_Private, Alice_Public)  = SECRET

THESE ARE THE SAME! ✨
```

**Curve:** P-256 (NIST recommended, 128-bit security)

---

### Key Derivation: HKDF (SHA-256)

**What it does:**
- Takes ECDH output (256 bits)
- Stretches it properly
- Adds domain separation for security
- Output: AES-256 encryption key

**Advantages:**
- Better than just using ECDH output directly
- Defends against future weaknesses
- Standard in protocols like TLS

---

### Message Encryption: AES-256-GCM

**What it does:**
- Encrypts message (Confidentiality)
- Authenticates message (Integrity)
- No separate MAC needed

**Key Features:**
```
AES = Advanced Encryption Standard (256-bit key)
GCM = Galois/Counter Mode
  • Provides AEAD (Authenticated Encryption with Associated Data)
  • Detects tampering automatically
  • IV must be unique per message (we use random 12-byte IV)
```

**Example:**
```
Plaintext:  "Hello Bob!"
Key:        256-bit AES key (from ECDH+HKDF)
IV:         Random 12-byte value
    ↓
Ciphertext: "xK7#mQ9Lp2+$nZ..."  (gibberish)
Tag:        (128-bit authentication tag, appended automatically)
    ↓
Server sees only ciphertext (useless without key!)
```

---

### Password Hashing: bcrypt

**What it does:**
- Hashes passwords before storage
- Adds salt and many iterations (12 rounds)
- Even if database is leaked, passwords are safe

**Comparison:**
```
Your password:  "MyPass123"
    ↓
bcrypt (12 rounds, salt)
    ↓
Hash:           "$2b$12$xY9kZ3nL8mQp.rS2uV..."
    ↓
Database stores: $2b$12$xY9kZ3nL8mQp.rS2uV...
(Attacker sees only hash, not password)
```

---

### Key Protection: PBKDF2 (AES-GCM)

**What it does:**
- Protects private key in localStorage
- Uses password as passphrase
- 100,000 iterations of PBKDF2

**Flow:**
```
User Password: "MyPass123"
    ↓
PBKDF2 (100,000 iterations, SHA-256, random salt)
    ↓
AES-256 Key for encrypting private key
    ↓
Encrypt Private Key JWK
    ↓
localStorage stores:
{
  encryptedKey: "...",  (base64)
  iv: "...",            (base64)
  salt: "..."           (base64)
}
```

**Why 100,000 iterations?**
- Makes brute-force attacks slow
- Takes ~1 second per password guess
- Attacker would need months to crack common passwords

---

## 🛡️ Security Properties

### Confidentiality ✅
- Messages encrypted with AES-256 (Military-grade)
- Only Alice and Bob have the AES key
- Server cannot decrypt

### Integrity ✅
- GCM provides authentication tag
- If ciphertext is tampered, decryption fails
- Bob knows message came from Alice (only they share the key)

### Authenticity ✅
- JWT tokens verify user identity to server
- bcrypt password hashing prevents impersonation
- Public key fingerprints allow manual verification

### Forward Secrecy ❌ (Not implemented)
- Would need per-message keys
- Out of scope for classroom demo

---

## 🔄 Complete Message Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1: REGISTRATION                                                 │
└──────────────────────────────────────────────────────────────────────┘

Alice:
1. Client generates ECDH P-256 key pair
2. Private key → encrypt with password (PBKDF2 + AES-GCM)
3. Encrypted private key → save to localStorage
4. Public key → export as JWK JSON
5. Send to server: {username, password_hash, publicKey}

Server:
1. Hash password with bcrypt (12 rounds)
2. Store: {username, passwordHash, publicKey}
3. Return JWT token (valid 24 hours)

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2: LOGIN                                                         │
└──────────────────────────────────────────────────────────────────────┘

Alice:
1. Send username + password to server
2. Server verifies password hash with bcrypt
3. Receive JWT token

Alice:
1. Load encrypted private key from localStorage
2. Decrypt with password (PBKDF2 + AES-GCM)
3. Use private key for message encryption

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3: SEND MESSAGE                                                 │
└──────────────────────────────────────────────────────────────────────┘

Alice:
1. Search server for Bob → get his public key
2. ECDH(Alice_Private, Bob_Public) → shared secret
3. HKDF(shared secret) → AES-256 key
4. AES-256-GCM(plaintext) → ciphertext + IV
5. Send to server: {receiverId, ciphertext, iv}

Server:
1. Verify JWT token (is Alice logged in?)
2. Save message: {sender, receiver, ciphertext, iv, timestamp}
3. Forward to Bob if online (via WebSocket)
4. If offline, save for later retrieval

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 4: RECEIVE MESSAGE                                              │
└──────────────────────────────────────────────────────────────────────┘

Bob:
1. Receive message from server: {ciphertext, iv}
2. Bob already has Alice's public key (from earlier search)
3. ECDH(Bob_Private, Alice_Public) → SAME shared secret!
4. HKDF(shared secret) → SAME AES-256 key!
5. AES-256-GCM decrypt(ciphertext, iv) → plaintext
6. Display: "Hello Bob!" ✅

Database:
- Never stores plaintext
- Only stores ciphertext (gibberish)
- Nobody except Alice and Bob can decrypt it
```

---

## 🎓 Key Concepts 

### Why This Is E2EE

✅ **Only endpoints have keys**
- Alice has: Alice's private key
- Bob has: Bob's private key
- Server has: Alice's public key, Bob's public key (public!)

✅ **Server is "zero knowledge"**
- Can't decrypt messages (no shared secret)
- Can't impersonate users (would need private key)
- Can't do MITM attacks (fingerprint verification prevents it)

✅ **Even if server is hacked**
- Attacker gets public keys (useless)
- Attacker gets encrypted messages (unreadable)
- Attacker can't decrypt past conversations

### What Could Break E2EE

❌ **Private key compromised**
- Attacker could decrypt all future messages
- But only for conversations with that key

❌ **MITM attack on key exchange**
- Attacker substitutes public key
- Fingerprint verification detects this!

❌ **Weak passphrase**
- Browser-stored key is only as strong as password
- That's why we enforce: 8+ chars, 1 number

---

## 📊 Comparison: With vs Without E2EE

### Without E2EE (Traditional Chat)
```
Alice → [plaintext message] → Server → [plaintext] → Bob
                               ↑
                        Server admin can read
                        Hacker can steal
                        Government can access
```

### With E2EE (This App)
```
Alice → [encrypted] → Server → [gibberish] → Bob
         (only Alice/Bob have key)  ↑        (decrypts)
                              Server sees nothing!
                              Hacker sees gibberish
                              Government can't read
```

---

## 🔍 What the Server Actually Stores

### User Document
```javascript
{
  _id: ObjectId,
  username: "alice",
  passwordHash: "$2b$12$xY9kZ3nL8mQp...",  // bcrypt hash
  publicKey: "{\"crv\":\"P-256\",\"kty\":\"EC\",\"x\":\"...\",\"y\":\"...\"}",
  createdAt: ISODate("2024-04-03")
}
```

### Message Document
```javascript
{
  _id: ObjectId,
  sender: ObjectId,
  receiver: ObjectId,
  ciphertext: "xK7#mQ9Lp2+$nZ7#9kL...",  // unreadable!
  iv: "aB3xY7zL9mK2...",               // unreadable!
  timestamp: ISODate("2024-04-03")
}
```

**Key observation:** Server stores `ciphertext` and `iv`, NOT plaintext!

---


## 🚀 Demo Talking Points

**"This app implements true end-to-end encryption:"**

1. "When Alice sends a message, the app encrypts it with AES-256-GCM"
2. "The server receives only ciphertext - it's completely unreadable"
3. "Bob receives the encrypted message and decrypts it with his private key"
4. "Notice that Alice and Bob both computed the same secret independently using ECDH"
5. "The server never has access to their shared secret"
6. "Even if the server is hacked, the messages remain encrypted"

**"Here's proof the server can't read messages:"**
- Open MongoDB Compass
- Show Messages collection
- Point at ciphertext field: "This is gibberish - the server can't read it"
- Point at Settings: "Here's Bob's actual public key - he's using ECDH P-256"

**"Security is verified through key fingerprints:"**
- Open both users' Settings
- Show fingerprints: "These are SHA-256 hashes of the public keys"
- "If fingerprints match, you're definitely talking to the right person"

---
