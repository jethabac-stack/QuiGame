# 🎮 Quiz Master - Multiplayer Quiz Game

A real-time multiplayer quiz game built with Node.js, Express, and Socket.io. Teachers create quizzes and host games, while players compete to answer questions correctly and climb the leaderboard.

## Features

### 1. Teacher Quiz Management
- ✅ Create, edit, and delete quizzes via web dashboard
- ✅ Questions stored as JSON files (no database required)
- ✅ Each question can have 2-4 answer options
- ✅ Configurable timer per question (5-30 seconds)
- ✅ Quiz preview before saving

### 2. Quiz Builder Interface
- ✅ Web-based form for creating/editing quizzes
- ✅ Add/remove questions dynamically
- ✅ Specify correct answers with radio buttons
- ✅ Set custom timer for each question
- ✅ Input validation and error handling

### 3. Live Game Host Flow
- ✅ Teachers select quiz from dropdown
- ✅ Generate unique 6-digit game PIN
- ✅ Real-time player join notifications
- ✅ Game flow controls: Start → Next Question → Show Results → End
- ✅ Live leaderboard during game

### 4. Player Join & Answer
- ✅ Players enter PIN and nickname to join
- ✅ Answer questions on personal device
- ✅ Button-based answer selection (A/B/C/D)
- ✅ Real-time feedback (correct/incorrect, points earned)

### 5. Real-Time Scoring (Socket.io)
- ✅ Server-validated scoring (prevents cheating)
- ✅ Points formula: `Math.floor(1000 - (timeTaken / timerLimit) * 800)`
- ✅ Only first answer per player per question counts
- ✅ Instant leaderboard updates

### 6. Live Leaderboard
- ✅ Top 5 scores displayed after each question
- ✅ Final leaderboard with winner announcement
- ✅ Real-time score updates for all players

### 7. Basic Access Control
- ✅ Teacher routes protected with access key (`?key=quiz123`)
- ✅ No user registration system required
- ✅ Perfect for classroom/local use

### 8. Game State Persistence
- ✅ In-memory game rooms stored in JavaScript Map
- ✅ Automatic cleanup after 1 hour of inactivity
- ✅ Player disconnect handling

## Project Structure

```
quiz-game/
├── server.js                 # Main Express + Socket.io server
├── quizManager.js           # Quiz CRUD operations
├── gameRoom.js              # Game room logic & scoring
├── package.json             # Dependencies
├── quizzes/                 # JSON quiz files
│   ├── sample-001.json
│   └── sample-002.json
└── public/
    ├── index.html           # Home page
    ├── teacher-dashboard.html # Quiz management
    ├── host.html            # Teacher game hosting
    ├── join.html            # Player join page
    ├── unauthorized.html    # 403 error page
    ├── css/
    │   └── style.css        # Styling
    └── js/
        ├── teacher-dashboard.js # Quiz CRUD logic
        ├── host.js              # Teacher hosting logic
        └── player-join.js       # Player join logic
```

## Installation & Setup

### Prerequisites
- Node.js (v14+)
- npm

### Steps

1. **Navigate to project directory**
   ```bash
   cd "c:\Users\Jason Habac\OneDrive\Desktop\Node JS Games\quiz-game"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   Or with auto-reload (requires nodemon):
   ```bash
   npm run dev
   ```

4. **Open in browser**
   - Home page: `http://localhost:3000`
   - Teacher dashboard: `http://localhost:3000/teacher/dashboard?key=quiz123`
   - Join game: `http://localhost:3000/join`

## Usage Guide

### For Teachers

1. **Create a Quiz**
   - Go to `/teacher/dashboard?key=quiz123`
   - Click "Create New Quiz"
   - Add quiz title and questions
   - Set timer (5-30 sec) and correct answer for each question
   - Save quiz

2. **Host a Game**
   - Click "Host" on any quiz
   - Share 6-digit PIN with students
   - Click "Start Quiz" when ready
   - Control flow with "Next Question" button
   - View live leaderboard

3. **Edit/Delete Quizzes**
   - Click "Edit" to modify a quiz
   - Click "Delete" to remove (with confirmation)

### For Players

1. **Join Game**
   - Go to `/join`
   - Enter 6-digit PIN
   - Enter nickname
   - Click "Join"

2. **Answer Questions**
   - When question appears, click correct answer button
   - See instant feedback
   - Check live leaderboard
   - Points awarded based on speed

3. **View Final Results**
   - After quiz ends, see final leaderboard
   - Your final score displayed

## Quiz Schema

Each quiz is stored as JSON with this structure:

```json
{
  "id": "uuid",
  "title": "Quiz Title",
  "teacher": "Teacher Name",
  "createdAt": "ISO timestamp",
  "questions": [
    {
      "text": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 1,
      "timer": 10
    }
  ]
}
```

## Scoring System

- **Base Points**: 1000 per question
- **Formula**: `Math.floor(1000 - (timeTaken / timerLimit) * 800)`
- **Speed Bonus**: Answering faster gives more points
- **Wrong Answer**: 0 points
- **Only First Answer Counts**: Subsequent answers ignored

Example:
- 10 second timer, answer in 2 seconds, correct: `1000 - (2/10) * 800 = 840 points`
- 10 second timer, answer in 8 seconds, correct: `1000 - (8/10) * 800 = 360 points`

## Socket.io Events

### Teacher Events
- `start-game` - Initiate new game with quiz
- `quiz-start` - Begin showing questions
- `next-question` - Show next question
- `end-game` - End game early

### Player Events
- `player-join` - Join existing game
- `submit-answer` - Submit answer to current question

### Broadcast Events
- `game-started` - Game room created
- `player-joined` - Player joined game
- `question-display` - Show question to all
- `answer-result` - Send feedback to answering player
- `leaderboard-update` - Broadcast updated scores
- `quiz-ended` - Game finished

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quizzes` | Get all quizzes |
| GET | `/api/quizzes/:id` | Get single quiz |
| POST | `/api/quizzes` | Create new quiz |
| PUT | `/api/quizzes/:id` | Update quiz |
| DELETE | `/api/quizzes/:id` | Delete quiz |

## Teacher Access Key

Default access key: `quiz123`

To change it, modify the key check in `server.js`:
```javascript
if (key !== 'quiz123') { // Change this
```

## Customization

### Change Timer Limits
Edit `quizManager.js` in the `createQuiz` method:
```javascript
if (question.timer < 5 || question.timer > 30) { // Adjust min/max
```

### Modify Scoring Formula
Edit `gameRoom.js` in the `recordAnswer` method:
```javascript
const score = isCorrect ? Math.floor(1000 - (timeTaken / timerLimit) * 800) : 0;
```

### Change Game Room Expiration
Edit `server.js` in the `end-game` event:
```javascript
setTimeout(() => {
  gameRooms.delete(pin);
}, 3600000); // 1 hour in milliseconds
```

## Example Workflows

### Complete Teacher Workflow
1. Access `/teacher/dashboard?key=quiz123`
2. Create new quiz: "Biology 101"
   - Add 5 questions about photosynthesis
   - Set 15 second timer per question
3. Click "Host" to start a game
4. Share PIN (e.g., "437829") with class
5. Controls flow: Start → Next → Results → Next → End
6. Awards go to fastest correct answerers

### Complete Player Workflow
1. Access `/join`
2. Enter PIN "437829" and nickname "John"
3. See "Waiting for teacher..." message
4. Teacher starts quiz
5. Questions appear one by one
6. For each: Click answer, see feedback & score
7. Check live leaderboard updates
8. After 5 questions: See final results

## Troubleshooting

### Port Already in Use
Change port in `server.js`:
```javascript
const PORT = process.env.PORT || 3001; // Change to 3001
```

### Quizzes Not Loading
- Check `quizzes/` folder exists
- Ensure JSON files are valid
- Restart server

### Players Not Joining
- Verify PIN is correct (6 digits)
- Check server console for errors
- Confirm firewall allows Socket.io

### Styling Not Applied
- Hard refresh browser (Ctrl + Shift + R)
- Check browser console for CSS errors
- Verify `/public/css/style.css` exists

## Future Enhancements

- 🚀 Question shuffle/randomization
- 🚀 Different question types (multiple select, true/false)
- 🚀 Question images/media
- 🚀 Player achievements/badges
- 🚀 Game session history/analytics
- 🚀 Hint system
- 🚀 Category-based quizzes
- 🚀 Export results to CSV
- 🚀 Mobile responsive UI refinement
- 🚀 Dark mode

## License

MIT License - Feel free to use and modify

## Support

For issues or questions, review the code comments and Socket.io documentation.

---

**Happy Teaching & Gaming! 🎮📚**
