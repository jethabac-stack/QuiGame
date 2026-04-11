# Quiz Master - Architecture & System Design

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     QUIZ MASTER SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    CLIENT TIER                           │   │
│  │                                                          │   │
│  │  Teacher Browser    │    Player Browser(s)              │   │
│  │  ─────────────────  │    ────────────────────            │   │
│  │                     │                                     │   │
│  │  • Dashboard        │    • Join Page                     │   │
│  │  • Quiz Management  │    • Game Interface               │   │
│  │  • Host Game        │    • Answer Options               │   │
│  │  • Game Control     │    • Live Leaderboard             │   │
│  │                     │                                     │   │
│  │  [HTML/CSS/JS]      │    [HTML/CSS/JS + Socket.io]      │   │
│  └────────────┬────────┴────────────┬────────────────────────┘   │
│               │                     │                            │
│               └──────────┬──────────┘                            │
│                          │ WebSocket                            │
│                          │ Socket.io                            │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   APPLICATION TIER                       │   │
│  │           (Node.js + Express Server)                    │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ Socket.io Connection Handler                       │ │   │
│  │  │ • Manage connections & disconnections             │ │   │
│  │  │ • Route Socket events                              │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ Game Logic                                          │ │   │
│  │  │ • GameRoom class - manage active games             │ │   │
│  │  │ • Score calculation                                │ │   │
│  │  │ • Leaderboard generation                           │ │   │
│  │  │ • Player state tracking                            │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ Quiz Management                                    │ │   │
│  │  │ • QuizManager class - CRUD operations             │ │   │
│  │  │ • JSON validation & persistence                   │ │   │
│  │  │ • UUID generation                                 │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ REST API Routes                                    │ │   │
│  │  │ • GET /api/quizzes                                │ │   │
│  │  │ • POST /api/quizzes                               │ │   │
│  │  │ • PUT /api/quizzes/:id                            │ │   │
│  │  │ • DELETE /api/quizzes/:id                         │ │   │
│  │  │ • Static file serving                             │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │ File I/O                          │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    DATA TIER                             │   │
│  │                                                          │   │
│  │  File System Storage:                                   │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ quizzes/ directory                                 │ │   │
│  │  │ • [uuid].json - Quiz files                        │ │   │
│  │  │ • sample-001.json                                 │ │   │
│  │  │ • sample-002.json                                 │ │   │
│  │  │ • user-created quizzes...                         │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  In-Memory Storage:                                     │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ GameRooms Map                                      │ │   │
│  │  │ • PIN → GameRoom object                           │ │   │
│  │  │ • Player data per room                            │ │   │
│  │  │ • Scores & answers                                │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

### 1. Quiz Creation Flow
```
Teacher          Browser            Server          Filesystem
  │               │                  │                  │
  ├─ Fills form──>│                  │                  │
  │               ├─ POST /api/quiz─>│                  │
  │               │                  ├─ Validate       │
  │               │                  ├─ Generate UUID  │
  │               │                  ├─ Write JSON ───>│
  │               │<─ Response JSON ─┤                  │
  │               │                  │<─ Confirmed─────┤
  │<─ Success ───┤                  │                  │
  │               │                  │                  │
```

### 2. Game Flow (Real-Time)
```
Teacher          Socket.io          Server           Player(s)
  │                 │                 │                 │
  ├─ start-game ───>│                 │                 │
  │                 ├─ Create room   │                 │
  │                 ├─ Gen PIN       │                 │
  │<─ game-started ─┤                 │                 │
  │                 │                 │                 │
  │ [Shares PIN]    │                 │    [Joins]     │
  │                 │                 │<─ player-join ─┤
  │                 │                 ├─ Validate     │
  │                 │                 ├─ Add player   │
  │                 ├─ broadcast ────────────────────>│
  │<─ player-joined ┤                 │                 │
  │                 │                 │                 │
  ├─ quiz-start ───>│                 │                 │
  │                 ├─ Get Q1        │                 │
  │                 ├─ broadcast ────────────────────>│
  │<─ question ────┤                 │                 │
  │                 │                 │ [Question displayed]
  │                 │                 │                 │
  │                 │                 │  [Player decides]
  │                 │<─ submit-answer ┤                 │
  │                 ├─ Validate       │                 │
  │                 ├─ Calculate score│                 │
  │                 ├─ Update scores  │                 │
  │                 ├─ broadcast ────────────────────>│
  │<─ leaderboard ─┤                 │                 │
  │                 │                 │ [Score updates] │
  │                 │                 │                 │
  ├─ next-question>│                 │                 │
  │                 ├─ Get Q2        │                 │
  │                 ├─ broadcast ────────────────────>│
  │<─ question ────┤                 │                 │
  │                 │                 │                 │
  │ [Repeat for all questions]       │                 │
  │                 │                 │                 │
  ├─ end-game ────>│                 │                 │
  │                 ├─ Get final rank│                 │
  │                 ├─ broadcast ────────────────────>│
  │<─ quiz-ended ──┤                 │                 │
  │                 │                 │ [Final results] │
```

### 3. Scoring Algorithm
```
┌─ Answer Submitted ─┐
│                    │
├─ Check if correct? ─┐
│                     │
│ ┌─ NO: Score = 0   │
│ │                   │
│ └─ YES: ┌──────────┐
│         │          │
│    Calculate time factor:
│    timeFactor = timeTaken / timerLimit (0.0 - 1.0)
│    
│    Calculate points:
│    timeDecay = timeFactor * 800 (0 - 800)
│    score = 1000 - timeDecay
│    
│    Result:
│    • Answered in 1 sec with 10 sec timer: 920 pts
│    • Answered in 5 sec with 10 sec timer: 600 pts
│    • Answered in 9 sec with 10 sec timer: 280 pts
└──────────────────────────────────
```

---

## Socket.io Event Map

### Event Categories
```
Teacher               Server                Player
──────               ────────               ──────

start-game           ▶ Creates room
                     ▶ Generates PIN       
                     ▶ Initializes game    
                                           
quiz-start           ▶ Shows question Q1   ▶ Displays Q1
                     ▶ Broadcasts timer     ▶ Timer running
                     
                                           submit-answer ──▶
                                           ▶ Validates
                                           ▶ Calculates pts
                     ◀──────────────────────────────────
                     answer-result
                     leaderboard-update    ◀──────────────
                                           
next-question        ▶ Shows results       ▶ Displays results
                     ▶ Shows question Q2   ▶ Displays Q2
                     
[Repeat for each question]
                     
end-game             ▶ Calculates finals
                     ▶ Sends leaderboard   ◀──────────────
                     quiz-ended            ▶ Shows results
```

---

## Database Schema (JSON Format)

### Quiz Structure
```json
{
  "id": "uuid-v4",
  "title": "String",
  "teacher": "String",
  "createdAt": "ISO-8601 timestamp",
  "updatedAt": "ISO-8601 timestamp",
  "questions": [
    {
      "text": "Question string",
      "options": ["A", "B", "C", "D"],
      "correct": 0-3,
      "timer": 5-30
    }
  ]
}
```

### GameRoom (In-Memory)
```javascript
{
  pin: "437829",
  quiz: {...},
  teacherName: "String",
  isActive: boolean,
  currentQuestionIndex: 0-N,
  players: Map<playerId, playerData>,
  scores: Map<playerId, number>,
  answers: Map<playerId, Set<questionIndex>>,
  questionAnswers: Map<questionIndex, Set<playerId>>
}
```

### Player Data (In-Memory)
```javascript
{
  id: "socket-id",
  nickname: "String",
  joinedAt: "ISO-8601 timestamp"
}
```

---

## Request/Response Flow

### 1. Create Quiz
```
Request:
POST /api/quizzes
Content-Type: application/json

{
  "title": "Quiz Title",
  "teacher": "Teacher Name",
  "questions": [...]
}

Response (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Quiz Title",
  "teacher": "Teacher Name",
  "createdAt": "2024-01-15T10:00:00Z",
  "questions": [...]
}
```

### 2. Join Game
```
Socket Emit:
socket.emit('player-join', {
  "pin": "437829",
  "nickname": "Player Name"
})

Server Broadcasts:
socket.on('player-joined', {
  "players": [...],
  "playerCount": 5
})
```

### 3. Submit Answer
```
Socket Emit:
socket.emit('submit-answer', {
  "pin": "437829",
  "answer": 2,
  "timeTaken": 3.5
})

Server Response to Player:
socket.on('answer-result', {
  "isCorrect": true,
  "score": 840,
  "correctAnswer": 2
})

Server Broadcasts to All:
socket.on('leaderboard-update', {
  "leaderboard": [...],
  "allPlayers": [...]
})
```

---

## Error Handling Flow

```
User Action         Validation              Action
─────────────      ─────────────           ──────
                   ┌─ Valid?               ✓ Process
                   │                       
Create Quiz   ────>├─ Invalid    ───────>  ✗ Return error
                   │  • Missing field
                   │  • Bad type
                   │  • Out of range
                   
Submit Answer ────>├─ Already answered    ✗ Ignore
                   │  • Game not active   
                   │  • Room not found    
                   │  • Invalid option   
                   │
                   └─ All valid   ───────>  ✓ Calculate score

Join Game    ────>└─ Invalid PIN   ───────>  ✗ Error message
```

---

## Performance Optimization

### In-Memory Caching
```
// GameRooms stored efficiently
const gameRooms = new Map([
  ['437829', GameRoom{...}],
  ['518294', GameRoom{...}],
  ...
])
// O(1) lookup time
```

### Lazy Loading
- Quizzes only read from disk when needed
- No full scan of filesystem
- Direct UUID-based file access

### Socket Batch Updates
- Leaderboard updates after answer submission
- No per-player updates, broadcast to room
- Efficient connection handling

### Auto-Cleanup
- Game rooms expire after 1 hour
- Prevents memory leaks
- Automatic removal

---

## Security Architecture

### Server-Side Validation
```
Client Input   ──X──> Direct Use
                 │
           Server Validation
                 │
            ✓ Valid Input
                 │
          Process  & Store
```

### No Client-Side Logic
- All scoring on server
- Answer validation server-only
- Leaderboard calculated server-side

### Access Control
```
Teacher Routes:
  /teacher/dashboard?key=quiz123
  /teacher/host?key=quiz123
  
Player Routes:
  /join (public)
  / (public)

Protected by:
  • URL parameter checking
  • 403 redirect on failure
```

---

## Scalability Considerations

### Current Limits (Single Server)
- Recommended: < 100 concurrent games
- Per game: < 1000 players
- Quiz file size: < 1MB each
- Memory: ~1-2MB per active game

### Potential Scaling Strategies
1. **Horizontal Scaling** - Multiple Node servers behind load balancer
2. **WebSocket Scaling** - Use Redis for Socket.io adapter
3. **Database** - Replace JSON with MongoDB for large scale
4. **CDN** - Cache static assets globally
5. **Microservices** - Separate quiz & game services

---

## Module Dependencies

```
server.js
├─ express (HTTP framework)
├─ socket.io (Real-time)
├─ uuid (ID generation)
├─ quizManager.js
│  ├─ fs (File system)
│  └─ path (File paths)
├─ gameRoom.js
│  └─ (No external deps)
└─ public/ (Static files)
   ├─ index.html
   ├─ teacher-dashboard.html
   ├─ host.html
   ├─ join.html
   ├─ css/style.css
   └─ js/
      ├─ teacher-dashboard.js
      ├─ host.js
      └─ player-join.js
```

---

## Deployment Options

### Local (Development)
```bash
npm start
# http://localhost:3000
```

### LAN (Classroom)
```bash
# On server: npm start
# For clients: http://<server-ip>:3000
```

### Cloud (AWS EC2, Heroku, etc.)
```bash
# Set PORT environment variable
PORT=3000 npm start
# Access via domain or IP
```

### Docker (Containerized)
```dockerfile
FROM node:16
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Summary

The Quiz Master uses a **three-tier architecture**:

1. **Client Tier** - HTML/CSS/JS browsers
2. **Application Tier** - Node.js/Express/Socket.io
3. **Data Tier** - JSON files + In-memory objects

**Key Design Principles:**
- ✓ No database required
- ✓ Real-time communication
- ✓ Server-side validation
- ✓ Modular code structure
- ✓ Scalable architecture
- ✓ Secure by design
- ✓ Easy to deploy

This architecture is production-ready for classroom use and can scale to support larger deployments with minimal modifications.
