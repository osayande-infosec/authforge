# AuthForge Demo Script - Clipchamp Recording

## 🎬 Quick Recording Guide

### Setup
1. **Backend**: http://localhost:8787 ✅
2. **Frontend**: http://localhost:3005 ✅
3. Open **Clipchamp** (Windows 11 built-in)
4. Click **Create video** → **Screen recording**
5. Select browser window showing AuthForge

---

## 📹 RECORDING FLOW

Record continuously - add text titles in editor after!

### Scene 1: Landing Page (0:00 - 0:10)
**Action**: Show landing page, scroll hero section
**Clipchamp Title**: `AuthForge - Self-Hosted Auth0 Alternative`

### Scene 2: Register (0:10 - 0:30)
**Action**: Click "Get Started" → Fill form → Submit
**Clipchamp Title**: `Secure User Registration with Password Validation`

### Scene 3: Dashboard Overview (0:30 - 0:45)
**Action**: Show dashboard, hover over security score
**Clipchamp Title**: `Real-time Security Score Dashboard`

### Scene 4: Email Verification (0:45 - 0:55)
**Action**: Go to Security → Click "Verify Now"
**Clipchamp Title**: `Email Verification`

### Scene 5: Two-Factor Authentication (0:55 - 1:30)
**Action**: Click Enable 2FA → Show QR code → Enter code from app
**Clipchamp Title**: `TOTP Two-Factor Authentication Setup`

### Scene 6: Passkey Registration (1:30 - 2:00)
**Action**: Go to Passkeys page → Click "Add Passkey" → Use Windows Hello
**Clipchamp Title**: `WebAuthn Passkey Registration`

### Scene 7: Encrypted Vault (2:00 - 2:30)
**Action**: Go to Vault → Setup with password → Add a secret
**Clipchamp Title**: `AES-256-GCM Encrypted Password Vault`

### Scene 8: Session Management (2:30 - 2:50)
**Action**: Go to Sessions → Show active sessions
**Clipchamp Title**: `Session Management & Device Tracking`

### Scene 9: Passkey Login (2:50 - 3:15)
**Action**: Log out → Click "Sign in with Passkey" → Use Windows Hello
**Clipchamp Title**: `Passwordless Passkey Authentication`

### Scene 10: Final Dashboard (3:15 - 3:30)
**Action**: Show 100% security score
**Clipchamp Title**: `100% Security Score - All Features Active`

---

## ✅ PRE-RECORDING CHECKLIST

- [ ] Both servers running (8787, 3005)
- [ ] Browser in incognito/fresh mode
- [ ] Phone with authenticator app ready
- [ ] Windows Hello set up (for passkeys)
- [ ] Browser zoomed to 110-125%
- [ ] Notifications silenced

---

## 🎨 CLIPCHAMP EDITING TIPS

After recording:

1. **Import** your screen recording
2. **Add titles** at scene transitions:
   - Click **Text** in sidebar
   - Choose **Title** style
   - Position at bottom-left or top-left
   - Use these colors: Background `#1a1a2e`, Text `#ffffff`

3. **Trim** any mistakes or long pauses

4. **Export** as 1080p MP4

---

## 📊 TECH STACK (for description text)

```
Backend: Cloudflare Workers + Hono.js + D1 Database
Frontend: React + Vite + TailwindCSS  
Auth: WebAuthn/Passkeys + TOTP 2FA + JWT Sessions
Security: AES-256-GCM Vault + bcrypt Passwords
```

---

## 🚀 DEMO TALKING POINTS (if narrating)

1. **"AuthForge is a self-hosted authentication platform"**
2. **"Features include passkeys, 2FA, OAuth, and encrypted vault"**
3. **"Built with edge computing - Cloudflare Workers"**
4. **"Zero-knowledge encryption - we never see your vault data"**
5. **"100% security score when all features are enabled"**
