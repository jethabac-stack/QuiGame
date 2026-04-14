# Quick Start Guide - Storyboarding Portal

## 🚀 5-Minute Setup

### 1. Install Dependencies (1 minute)
```bash
cd quiz-game
npm install
```

### 2. Start Server (30 seconds)
```bash
npm start
```

You should see:
```
Server running on http://localhost:3000
Teacher Dashboard: http://localhost:3000/teacher/dashboard?key=quiz123
Join Game: http://localhost:3000/join
```

### 3. Test the App (3.5 minutes)

#### Step 1: Create a Quiz (1 min)
- Open: http://localhost:3000/teacher/dashboard?key=quiz123
- Click "+ Create New Quiz"
- Fill in:
  - **Title**: "Test Quiz"
  - **Teacher Name**: "Your Name"
  - **Questions**: Leave the auto-generated question or add your own
- Click "Save Quiz"
- ✅ You should see your quiz in the list

#### Step 2: Host a Game (1 min)
- Click "Host" on your quiz
- Click "Start Game"
- ✅ You'll see a 6-digit PIN (e.g., "437829")
- Note this PIN

#### Step 3: Join as Player (1 min)
- Open another browser tab/window
- Go to: http://localhost:3000/join
- Enter:
  - **PIN**: The PIN from your host page
  - **Nickname**: "Test Player"
- Click "Join Game"
- ✅ You should see "Waiting for teacher..." message
- Back on teacher page, you should see player joined

#### Step 4: Play the Game (0.5 min)
- On teacher page, click "Start Quiz"
- Question appears on both pages
- On player page, click an answer
- ✅ See feedback and score
- On teacher page, click "Next Question"
- When done, click "End Game"
- ✅ See final leaderboard

## 📝 Quick Testing Checklist

- [ ] Server starts without errors
- [ ] Teacher dashboard loads
- [ ] Can create a quiz
- [ ] Can edit a quiz
- [ ] Can delete a quiz
- [ ] Can host a game (PIN generated)
- [ ] Can join game with PIN
- [ ] Players see questions
- [ ] Players can answer
- [ ] Scores update in real-time
- [ ] Leaderboard displays
- [ ] Game ends properly

## 🐛 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Run `npm install` |
| Port 3000 in use | Change PORT in server.js |
| Quizzes not loading | Restart server |
| Players don't join | Check PIN spelling, restart |
| Styles look broken | Hard refresh (Ctrl+Shift+R) |

## 📱 Multi-Device Testing

### Same Machine (Different Browser Tabs)
- Teacher: Tab 1 at `http://localhost:3000/teacher/host`
- Player 1: Tab 2 at `http://localhost:3000/join`
- Player 2: Tab 3 at `http://localhost:3000/join`

### Different Machines
- Host: `http://<your-ip>:3000` (find IP with `ipconfig`)
- Players: Enter host IP and PIN

## 🎮 Sample Quizzes

Two pre-made quizzes included:
1. **General Knowledge** (sample-001.json) - 5 questions
2. **Science Challenge** (sample-002.json) - 4 questions

These are ready to host immediately!

## 🔑 Security Notes

- Default teacher key: `quiz123`
- Change this in production: Edit `server.js` line ~35
- No password system (as requested) - for classroom use only
- All scoring done server-side (no client cheating)

## 📲 Next Steps

1. **Customize Quizzes**: Edit `quizzes/` JSON files or create new ones
2. **Change Look**: Edit `public/css/style.css`
3. **Modify Scoring**: Edit `gameRoom.js` scoring formula
4. **Add Features**: See README.md for enhancement ideas

## ✅ Ready to Go!

Your multiplayer quiz game is ready to use in the classroom. Share the PIN with students and start playing! 🎉

For detailed documentation, see **README.md**
