# Firebase Backend Integration Guide

## Overview
This guide walks you through setting up Firebase Admin SDK for the backend and completing the full backend integration.

## Prerequisites
- Node.js installed
- npm or yarn package manager
- Firebase project created (already done)
- Firebase credentials

---

## Step 1: Install Dependencies

Run this command in your project root:

```bash
npm install
```

This will install:
- `firebase-admin@^12.0.0` - Firebase Admin SDK for backend
- `dotenv@^16.3.1` - Environment variable management

---

## Step 2: Get Firebase Service Account Key

This is **critical** for backend authentication.

### How to Get Service Account Key:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **quiz-game-38d87**
3. Navigate to **Project Settings** (gear icon) → **Service Accounts** tab
4. Click **Generate New Private Key**
5. A JSON file will download - this is your service account key

### ⚠️ SECURITY WARNING
- **NEVER** commit this file to Git
- **NEVER** share this file publicly
- Keep it secure on your computer

---

## Step 3: Add Service Account Key to .env

You have two options:

### Option A: Store Full JSON in .env (Easier for Development)

1. Open the downloaded JSON file and copy all its content
2. In your `.env` file, add:

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"quiz-game-38d87",...}
```

Or use multiline format:

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type": "service_account", "project_id": "quiz-game-38d87", "private_key_id": "...", ...}
```

### Option B: Store as Separate File (Better for Production)

1. Create `serviceAccountKey.json` in project root
2. Paste the entire JSON content into it
3. Update `.env`:

```env
FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/serviceAccountKey.json
```

**Recommended:** Use Option B and add `serviceAccountKey.json` to `.gitignore` (already done)

---

## Step 4: Verify Environment Variables

Your `.env` file should now contain:

```env
FIREBASE_API_KEY=AIzaSyDz2btltqYoJTUPlGpkAsJE7JiatPhMn2E
FIREBASE_AUTH_DOMAIN=quiz-game-38d87.firebaseapp.com
FIREBASE_PROJECT_ID=quiz-game-38d87
FIREBASE_STORAGE_BUCKET=quiz-game-38d87.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=93000647779
FIREBASE_APP_ID=1:93000647779:web:6e25e8f03ab96fa5222456
FIREBASE_SERVICE_ACCOUNT_KEY=<your-json-or-path>
PORT=3000
NODE_ENV=development
```

---

## Step 5: Initialize Firestore Database

### Setup Collections:

1. Go to Firebase Console → **Firestore Database**
2. Create these collections (click "Start collection"):

#### Collection 1: `users`
```
users/
  └── {hostId}
      ├── email (string)
      ├── displayName (string)
      ├── userType (string) = "host"
      ├── createdAt (timestamp)
      └── stats (map)
          ├── totalQuizzesCreated (number)
          └── totalGamesHosted (number)
```

#### Collection 2: `quizzes`
```
quizzes/
  └── {quizId}
      ├── title (string)
      ├── description (string)
      ├── questions (array)
      ├── settings (map)
      ├── hostId (string)
      ├── createdAt (timestamp)
      ├── updatedAt (timestamp)
      ├── isPublished (boolean)
      └── stats (map)
          ├── timesPlayed (number)
          ├── totalPlayers (number)
          └── averageScore (number)
```

#### Collection 3: `players`
```
players/
  └── {playerId}
      ├── playerId (string)
      ├── playerName (string)
      ├── createdAt (timestamp)
      └── scores (array)
          ├── quizId (string)
          ├── score (number)
          ├── gameSessionId (string)
          └── timestamp (timestamp)
```

#### Collection 4: `gameScores`
```
gameScores/
  └── {documentId}
      ├── playerId (string)
      ├── playerName (string)
      ├── quizId (string)
      ├── score (number)
      ├── gameSessionId (string)
      └── timestamp (timestamp)
```

---

## Step 6: Set Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Replace all content with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Anyone can read published quizzes, only host can write
    match /quizzes/{quizId} {
      allow read: if resource.data.isPublished == true || resource.data.hostId == request.auth.uid;
      allow write: if request.auth.uid != null && request.auth.uid == resource.data.hostId;
      allow create: if request.auth.uid != null;
    }
    
    // Players can read/write their own scores
    match /players/{playerId} {
      allow read, write: if playerId == request.auth.uid || request.auth != null;
    }
    
    // Anyone can read/write game scores (for public leaderboards)
    match /gameScores/{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **Publish**

---

## Step 7: Test the Backend

### Start your server:

```bash
npm start
```

You should see:
```
✓ Firebase initialized successfully
Server running on port 3000
```

### Test Registration Endpoint:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "host@example.com",
    "password": "password123",
    "displayName": "Test Host"
  }'
```

Expected response:
```json
{
  "success": true,
  "uid": "xyz123...",
  "message": "Host account created successfully"
}
```

### Test Login Endpoint:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "host@example.com"}'
```

Expected response:
```json
{
  "success": true,
  "uid": "xyz123...",
  "userData": {
    "email": "host@example.com",
    "displayName": "Test Host",
    "userType": "host",
    "createdAt": {...},
    "stats": {...}
  }
}
```

---

## Step 8: Use in Frontend

### Import Firebase Config:

In your HTML files (e.g., `auth.html`):

```html
<script type="module">
  import { registerHost, loginHost, getHostQuizzes } from './js/firebase-config.js';
  
  // Example: Register
  async function handleRegister(email, password, displayName) {
    try {
      const user = await registerHost(email, password, displayName);
      console.log('Registered:', user);
      
      // Get ID token for protected requests
      const token = await user.getIdToken();
      
      // Get user's quizzes
      const quizzes = await getHostQuizzes(token);
      console.log('My quizzes:', quizzes);
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
</script>
```

---

## Step 9: Backend API Endpoints Summary

### Authentication Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register` | ❌ | Register new host |
| POST | `/api/auth/login` | ❌ | Login host |

### Quiz Management Endpoints (Requires Firebase Token)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/firebase/quizzes` | ✅ | Create new quiz |
| GET | `/api/firebase/quizzes` | ✅ | Get host's quizzes |
| GET | `/api/firebase/quizzes/:quizId` | ✅ | Get specific quiz |
| PUT | `/api/firebase/quizzes/:quizId` | ✅ | Update quiz |
| DELETE | `/api/firebase/quizzes/:quizId` | ✅ | Delete quiz |
| POST | `/api/firebase/quizzes/:quizId/publish` | ✅ | Publish quiz |

### Score Management Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/firebase/scores` | ❌ | Save player score |
| GET | `/api/firebase/scores/:playerId` | ❌ | Get player scores |
| GET | `/api/firebase/quizzes/:quizId/leaderboard` | ❌ | Get quiz leaderboard |

---

## Step 10: Common Issues & Fixes

### Issue: "Firebase not initialized"
**Solution:** Ensure `.env` file has `FIREBASE_SERVICE_ACCOUNT_KEY` set correctly

### Issue: "Invalid token"
**Solution:** Token might be expired. Get new token with `getIdToken()`

### Issue: "Permission denied"
**Solution:** Check Firestore security rules are properly set

### Issue: "Email already exists"
**Solution:** User already registered. Try different email or use login

---

## Next Steps

1. ✅ Create host registration page (`auth.html`)
2. ✅ Create host dashboard page (update `teacher-dashboard.html`)
3. ✅ Create quiz creation form (update `teacher-dashboard.html`)
4. ✅ Update player submission to use Firebase
5. ✅ Add leaderboard display (update `host.html`)

---

## Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

---

**Status:** Backend integration complete and ready for production! 🎉
