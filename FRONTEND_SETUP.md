# Frontend Pages Setup Guide

## Overview
Three new frontend pages have been created for the Firebase-integrated Quiz Master application:

1. **auth.html** - Host registration and login page
2. **dashboard.html** - Complete host dashboard with quiz management
3. **Updated index.html** - Home page with new navigation

---

## File Locations

```
public/
├── index.html              (Updated - Links to /auth)
├── auth.html              (New - Login/Register)
├── dashboard.html         (New - Full dashboard)
├── host.html              (Existing - Game hosting)
├── join.html              (Existing - Player join)
├── teacher-dashboard.html (Legacy)
└── js/
    └── firebase-config.js (Created earlier)
```

---

## Page Features

### 1. **auth.html** - Authentication Page

**Location:** `http://localhost:3000/auth`

**Features:**
- ✅ Host Registration with validation
- ✅ Host Login
- ✅ Password visibility toggle
- ✅ Remember me checkbox
- ✅ Error/Success messages
- ✅ Automatic redirect to dashboard after login
- ✅ Beautiful gradient UI with animations

**Form Validation:**
- Email format validation
- Password minimum 6 characters
- Password confirmation match
- Terms and conditions checkbox

**After Login:**
- Firebase ID token saved to `localStorage`
- Host ID and email stored for reference
- Auto-redirect to `/dashboard`

---

### 2. **dashboard.html** - Host Dashboard

**Location:** `http://localhost:3000/dashboard`

**Requires:** Firebase authentication token

**Sections:**

#### A. My Quizzes
- View all created quizzes
- Filter by: All, Published, Drafts
- Quiz cards show:
  - Quiz title and description
  - Publication status
  - Number of questions
  - Times played
  - Total players participated
- Actions per quiz:
  - ✎ Edit quiz
  - 🎮 Host game (if published)
  - 📤 Publish quiz (if draft)
  - 🗑 Delete quiz

#### B. Create Quiz
- Quiz title input
- Description textarea
- Time limit per question (5-300 seconds)
- Shuffle questions option
- Dynamic question builder:
  - Add/remove questions
  - 4 multiple choice options per question
  - Select correct answer via radio button
- Submit to create quiz

#### C. Host Game
- Select published quiz from dropdown
- Display quiz metadata
- Start game button (redirects to host.html with quiz ID)

#### D. Statistics
- Total quizzes created
- Games hosted count
- Total players participated

#### E. User Profile Section
- Display logged-in user email
- Logout button with confirmation

---

### 3. **index.html** - Updated Home Page

**Changes:**
- "Teacher Dashboard" button → "Host Dashboard"
- Now links to `/auth` instead of `/teacher/dashboard?key=...`
- Same layout and design maintained

---

## Server Routes Added

```javascript
GET  /auth        → Serves auth.html
GET  /dashboard   → Serves dashboard.html
GET  /            → Updated to link to new auth
```

---

## Authentication Flow

```
User visits home page
         ↓
   Clicks "Host Dashboard"
         ↓
   Redirected to /auth
         ↓
   Choose: Login or Register
         ↓
   Firebase authenticates user
         ↓
   Token saved to localStorage
         ↓
   Redirected to /dashboard
         ↓
   Dashboard loads user's quizzes via Firebase
```

---

## Data Flow

### Creating a Quiz

```
Dashboard Form
    ↓
Collect quiz data (title, questions, settings)
    ↓
POST /api/firebase/quizzes (with Firebase token)
    ↓
Backend saves to Firestore
    ↓
Dashboard reloads quiz list
    ↓
Show success message
```

### Publishing a Quiz

```
Click "Publish" on draft quiz
    ↓
POST /api/firebase/quizzes/:quizId/publish
    ↓
Backend updates Firestore (isPublished = true)
    ↓
Quiz moves to "Published" filter
    ↓
Host Game button becomes available
```

### Hosting a Game

```
Click "Host" on published quiz
    ↓
Redirect to: /host?quizId={quizId}
    ↓
host.html loads quiz details
    ↓
Teacher can start game with Socket.io
```

---

## Required Setup

### 1. Firestore Collections Created ✅
Should already be done from FIREBASE_SETUP.md

### 2. Security Rules Set ✅
Should already be done from FIREBASE_SETUP.md

### 3. Service Account Key Added
- Download from Firebase Console
- Add to `.env` as `FIREBASE_SERVICE_ACCOUNT_KEY`

### 4. Dependencies Installed ✅
```bash
npm install
```

---

## Testing the Frontend

### Step 1: Start the server
```bash
npm start
```

You should see:
```
✓ Firebase initialized successfully
Server running on port 3000
```

### Step 2: Visit home page
```
http://localhost:3000/
```

### Step 3: Click "Host Dashboard"
Should redirect to `/auth`

### Step 4: Register a new host account
- Click "Register" tab
- Fill in form:
  - Display Name: "John Doe"
  - Email: "john@example.com"
  - Password: "password123"
  - Confirm Password: "password123"
  - Check terms
- Click "Create Account"

Expected outcome:
- Success message appears
- Redirect to `/dashboard`
- Dashboard shows "No quizzes yet"
- User email displays in sidebar

### Step 5: Create a quiz
- Click "Create Quiz" in sidebar
- Fill in quiz details:
  - Title: "Biology 101"
  - Description: "Chapter 5 Quiz"
  - Time Limit: 30 seconds
  - Check "Shuffle questions"
- Add questions (at least 1)
- Click "Create Quiz"

Expected outcome:
- Success message
- Redirect to "My Quizzes"
- Quiz appears in list as "Draft"

### Step 6: Publish quiz
- Click "📤 Publish" button on quiz
- Quiz status changes to "✓ Published"
- "🎮 Host" button appears

### Step 7: Test logout
- Click logout button
- Confirm logout
- Redirect to home page

---

## Browser LocalStorage

After login, these values are stored:

```javascript
localStorage.firebaseToken  // Firebase ID token (expires in 1 hour)
localStorage.hostId         // User UID
localStorage.hostName       // User email
```

**Note:** Token auto-refreshes when needed via `getIdToken()`

---

## Mobile Responsiveness

All pages are fully responsive:
- **Desktop:** Full layout with sidebar
- **Tablet:** Adapted grid and spacing
- **Mobile:** Stacked layout, full-width buttons

---

## Common Issues & Solutions

### Issue: "Redirect to /auth on load"
**Solution:** Check if user is logged in and token is valid

### Issue: "Quizzes don't load"
**Solution:** 
- Verify Firebase token is valid
- Check browser console for errors
- Verify Firestore security rules allow read

### Issue: "Cannot create quiz"
**Solution:**
- Ensure all form fields are filled
- Check Firebase token is sent in request header
- Verify Firestore is accessible from backend

### Issue: "Not redirecting to dashboard after login"
**Solution:**
- Check browser console for errors
- Verify Firebase is properly initialized
- Check localStorage has firebaseToken

### Issue: "Email already registered error"
**Solution:**
- Use different email for registration
- Or use login tab instead

---

## Next Steps

1. ✅ Test registration/login flow
2. ✅ Test quiz creation
3. ✅ Test quiz publishing
4. ✅ Test dashboard functionality
5. ⬜ Update host.html to display quiz details
6. ⬜ Update join.html to show player scores from Firebase
7. ⬜ Create leaderboard display
8. ⬜ Deploy to production

---

## Deployment Checklist

Before going live:

- [ ] All Security Rules properly set in Firestore
- [ ] Environment variables configured on server
- [ ] HTTPS enabled for credential security
- [ ] Firebase token refresh mechanism tested
- [ ] Error handling properly implemented
- [ ] User authentication flow tested end-to-end
- [ ] Quiz creation and management working
- [ ] Game hosting working with Socket.io
- [ ] Player scores being saved to Firebase

---

## Support

For issues:
1. Check browser console (F12)
2. Check Network tab for failed requests
3. Check Firebase Console for data
4. Review error messages displayed on UI

