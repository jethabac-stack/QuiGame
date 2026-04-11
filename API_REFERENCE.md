# API & Socket.io Events Documentation

## HTTP REST API

### Quiz Management Endpoints

All quiz endpoints serve JSON data and are RESTful compliant.

---

### 1. Get All Quizzes
**GET** `/api/quizzes`

Returns array of all quizzes.

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "General Knowledge",
    "teacher": "Ms. Smith",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "questions": [...]
  }
]
```

**cURL Example:**
```bash
curl http://localhost:3000/api/quizzes
```

---

### 2. Get Single Quiz
**GET** `/api/quizzes/:id`

Returns specific quiz by ID.

**Parameters:**
- `id` (string, required) - Quiz UUID

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "General Knowledge",
  "teacher": "Ms. Smith",
  "createdAt": "2024-01-15T10:00:00Z",
  "questions": [
    {
      "text": "What is the capital of France?",
      "options": ["London", "Berlin", "Paris", "Madrid"],
      "correct": 2,
      "timer": 10
    }
  ]
}
```

**cURL Example:**
```bash
curl http://localhost:3000/api/quizzes/550e8400-e29b-41d4-a716-446655440000
```

---

### 3. Create Quiz
**POST** `/api/quizzes`

Creates a new quiz.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Biology 101",
  "teacher": "Dr. Johnson",
  "questions": [
    {
      "text": "What is photosynthesis?",
      "options": ["Process 1", "Process 2", "Process 3", "Process 4"],
      "correct": 1,
      "timer": 15
    },
    {
      "text": "What is the powerhouse of the cell?",
      "options": ["Nucleus", "Mitochondria", "Ribosome", "Lysosome"],
      "correct": 1,
      "timer": 12
    }
  ]
}
```

**Validation Rules:**
- `title` (required) - Must not be empty
- `teacher` (optional) - Defaults to "Unknown Teacher"
- `questions` (required) - Array with at least 1 question
- Each question must have:
  - `text` (required) - Question content
  - `options` (required) - Array of 2-4 options
  - `correct` (required) - Index of correct answer (0-3)
  - `timer` (required) - 5-30 seconds

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Biology 101",
  "teacher": "Dr. Johnson",
  "createdAt": "2024-01-15T11:00:00Z",
  "questions": [...]
}
```

**Error (400 Bad Request):**
```json
{
  "error": "Quiz must have at least one question"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Biology 101",
    "teacher": "Dr. Johnson",
    "questions": [...]
  }'
```

---

### 4. Update Quiz
**PUT** `/api/quizzes/:id`

Updates an existing quiz.

**Parameters:**
- `id` (string, required) - Quiz UUID

**Request Body:**
```json
{
  "title": "Biology 101 - Updated",
  "questions": [...]
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Biology 101 - Updated",
  "updatedAt": "2024-01-15T11:30:00Z",
  "questions": [...]
}
```

**cURL Example:**
```bash
curl -X PUT http://localhost:3000/api/quizzes/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Biology 101 - Updated",
    "questions": [...]
  }'
```

---

### 5. Delete Quiz
**DELETE** `/api/quizzes/:id`

Deletes a quiz permanently.

**Parameters:**
- `id` (string, required) - Quiz UUID

**Response (200 OK):**
```json
{
  "success": true
}
```

**Error (404 Not Found):**
```json
{
  "error": "Quiz not found"
}
```

**cURL Example:**
```bash
curl -X DELETE http://localhost:3000/api/quizzes/550e8400-e29b-41d4-a716-446655440000
```

---

## Socket.io Events

Real-time communication between client and server.

### Connection & Disconnection

**Event: `connect`**
- Fired automatically when client connects via Socket.io
- Server logs: `User connected: [socket.id]`

**Event: `disconnect`**
- Fired when client disconnects
- Server cleans up player data
- Notifies other players: `player-left`

---

## Teacher Events

### 1. Start Game
**Event: `start-game`**

Teacher initiates a new game with a quiz.

**Emit from:** Teacher browser
**Received by:** Server

**Payload:**
```javascript
{
  "quizId": "550e8400-e29b-41d4-a716-446655440000",
  "teacherName": "Ms. Smith"
}
```

**Server Response (emit `game-started`):**
```javascript
{
  "pin": "437829",
  "quiz": {...},
  "roomId": "437829"
}
```

**Server logs:** `Game started with PIN: 437829`

**Next Step:** Players use this PIN to join

---

### 2. Start Quiz (Begin Questions)
**Event: `quiz-start`**

Teacher starts displaying questions to players.

**Emit from:** Teacher browser (after game created)
**Received by:** Server

**Payload:**
```javascript
{
  "pin": "437829"
}
```

**Server broadcasts `question-display` to all in room:**
```javascript
{
  "question": {
    "text": "What is the capital of France?",
    "options": ["London", "Berlin", "Paris", "Madrid"],
    "timer": 10
  },
  "questionIndex": 0,
  "totalQuestions": 5,
  "timer": 10
}
```

---

### 3. Next Question
**Event: `next-question`**

Teacher moves to next question.

**Emit from:** Teacher browser
**Received by:** Server

**Payload:**
```javascript
{
  "pin": "437829"
}
```

**Server behavior:**
1. Shows results for previous question
2. Broadcasts `show-results` event
3. After 3 second delay, broadcasts next `question-display`

**Broadcast `show-results`:**
```javascript
{
  "correctAnswer": 2,
  "leaderboard": [
    { "nickname": "John", "score": 840, "playerId": "socket-123" },
    { "nickname": "Jane", "score": 720, "playerId": "socket-456" }
  ]
}
```

---

### 4. End Game
**Event: `end-game`**

Teacher ends the game prematurely or after all questions.

**Emit from:** Teacher browser
**Received by:** Server

**Payload:**
```javascript
{
  "pin": "437829"
}
```

**Server broadcasts `quiz-ended` to all players:**
```javascript
{
  "leaderboard": [
    { "nickname": "John", "score": 2100, "playerId": "socket-123" },
    { "nickname": "Jane", "score": 1800, "playerId": "socket-456" },
    { "nickname": "Mike", "score": 1200, "playerId": "socket-789" }
  ],
  "winner": {
    "nickname": "John",
    "score": 2100,
    "playerId": "socket-123"
  }
}
```

---

## Player Events

### 1. Join Game
**Event: `player-join`**

Player joins an active game with PIN and nickname.

**Emit from:** Player browser
**Received by:** Server

**Payload:**
```javascript
{
  "pin": "437829",
  "nickname": "John"
}
```

**Player socket joins room:** `game-437829`

**Server broadcasts `player-joined` to all in room:**
```javascript
{
  "players": [
    { "id": "socket-123", "nickname": "John", "joinedAt": "2024-01-15T11:00:00Z" },
    { "id": "socket-456", "nickname": "Jane", "joinedAt": "2024-01-15T11:00:05Z" }
  ],
  "playerCount": 2
}
```

**Server logs:** `John joined game 437829`

---

### 2. Submit Answer
**Event: `submit-answer`**

Player submits answer to current question.

**Emit from:** Player browser
**Received by:** Server

**Payload:**
```javascript
{
  "pin": "437829",
  "answer": 2,
  "timeTaken": 3.5
}
```

**Parameters:**
- `pin` (string) - Game room PIN
- `answer` (number) - Index of selected option (0-3)
- `timeTaken` (number) - Seconds elapsed since question displayed

**Server validates:**
1. Game room exists
2. Player hasn't already answered this question
3. Answer is valid (0-3)

**Server calculates score:**
```javascript
const score = isCorrect ? Math.floor(1000 - (timeTaken / timerLimit) * 800) : 0;
```

**Server emits `answer-result` to answering player:**
```javascript
{
  "isCorrect": true,
  "score": 840,
  "correctAnswer": 2
}
```

**Server broadcasts `leaderboard-update` to all:**
```javascript
{
  "leaderboard": [
    { "nickname": "John", "score": 840, "playerId": "socket-123" },
    { "nickname": "Jane", "score": 720, "playerId": "socket-456" }
  ],
  "allPlayers": [
    { "nickname": "John", "score": 840, "playerId": "socket-123" },
    { "nickname": "Jane", "score": 720, "playerId": "socket-456" },
    { "nickname": "Mike", "score": 0, "playerId": "socket-789" }
  ]
}
```

---

## Server-Broadcast Events

### Show Results
**Event: `show-results`**

Sent after players answer to show correct answer.

**Emitted to:** All players in room
**Timing:** After question time expires or teacher clicks "Next"

**Payload:**
```javascript
{
  "correctAnswer": 2,
  "leaderboard": [...]
}
```

---

### Leaderboard Update
**Event: `leaderboard-update`**

Real-time score updates.

**Emitted to:** All players in room
**Timing:** After player submits answer

**Payload:**
```javascript
{
  "leaderboard": [...],        // Top 5 scores
  "allPlayers": [...]           // All players sorted by score
}
```

---

### Quiz Ended
**Event: `quiz-ended`**

Sent when game is finished.

**Emitted to:** All players in room
**Timing:** After teacher clicks "End Game" or all questions complete

**Payload:**
```javascript
{
  "leaderboard": [...],    // Final scores, all players
  "winner": {              // Top scorer
    "nickname": "John",
    "score": 2100,
    "playerId": "socket-123"
  }
}
```

---

### Question Display
**Event: `question-display`**

Sends current question to all connected players.

**Emitted to:** All players in room
**Timing:** When teacher starts quiz or clicks "Next Question"

**Payload:**
```javascript
{
  "question": {
    "text": "What is the capital of France?",
    "options": ["London", "Berlin", "Paris", "Madrid"],
    "timer": 10
  },
  "questionIndex": 0,              // 0-based index
  "totalQuestions": 5,
  "timer": 10                      // Same as question.timer
}
```

---

### Player Joined/Left
**Event: `player-joined` or `player-left`**

Notifies all when player joins or leaves.

**Emitted to:** All in room
**Timing:** When player joins or disconnects

**Payload:**
```javascript
{
  "players": [...],        // Current list of all players
  "playerCount": 2         // Total player count
}
```

---

## Error Handling

### Server Error Event
**Event: `error`**

Server sends error messages to client.

**Emitted to:** Individual socket (the client that caused error)

**Possible errors:**
```javascript
"Quiz not found"
"Game room not found"
"Game has not started yet"
```

**Client handling:**
```javascript
socket.on('error', (message) => {
  alert(`Error: ${message}`);
});
```

---

## Complete Game Flow Timeline

```
Teacher                              Server                    Players
   │                                   │                          │
   ├─── start-game ───────────────────>│                          │
   │                                   │ Creates room 437829      │
   │<────── game-started ──────────────┤                          │
   │  (PIN: 437829)                    │                          │
   │                                   │                          │
   │ [Share PIN with class]            │                          │
   │                                   │                          │
   │                                   │<── player-join(437829) ──┤
   │                                   │    John joins            │
   │                                   ├─ broadcast player-joined │
   │────── [sees John joined] ─────────┤                          │
   │                                   ├─ broadcast player-joined │
   │                                   │                    [John sees John joined]
   │                                   │                          │
   │ [More players join...]            │<── player-join(437829) ──┤
   │ [Teacher clicks Start]            │    Jane joins            │
   │     │                             │                          │
   │     ├─── quiz-start ──────────────>│                          │
   │     │                             ├─ broadcast question-display
   │<─────── [sees Q1] ────────────────┤                          │
   │                                   ├─ broadcast question-display
   │                                   │                    [John sees Q1]
   │                                   │                    [Jane sees Q1]
   │                                   │                          │
   │ [Timer running on players' screens]                         │
   │ [John answers after 3 sec]        │<── submit-answer ────────┤
   │                                   │    answer: 2             │
   │                                   ├─ emit answer-result──────>
   │                                   │  (John: +840 points)     │
   │                                   ├─ broadcast leaderboard───┤
   │<─────── [sees leaderboard] ───────┤                          │
   │                                   │ [John sees score]        │
   │                                   │ [Jane sees John lead]    │
   │                                   │                          │
   │ [Jane answers in 5 sec]           │<── submit-answer ────────┤
   │                                   │    answer: 1 (wrong)     │
   │                                   ├─ emit answer-result──────>
   │                                   │  (Jane: +0 points)       │
   │                                   ├─ broadcast leaderboard───┤
   │                                   │                          │
   │ [Teacher clicks Next]             │                          │
   │     │                             │                          │
   │     ├─── next-question ──────────>│                          │
   │     │                             ├─ broadcast show-results──┤
   │<─────── [sees results] ───────────┤                          │
   │                                   │ [Players see: answer was 2]
   │                                   │        [After 3 sec delay]
   │                                   ├─ broadcast question-display
   │<─────── [sees Q2] ────────────────┤                          │
   │                                   │ [John sees Q2]           │
   │                                   │ [Jane sees Q2]           │
   │                                   │                          │
   │ [More questions, same flow...]   │                          │
   │                                   │                          │
   │ [After Q5, teacher clicks End]   │                          │
   │     │                             │                          │
   │     ├─── end-game ────────────────>│                          │
   │     │                             ├─ broadcast quiz-ended ───┤
   │<─────── [Final Leaderboard] ──────┤                          │
   │            John: 2100             │ [John sees: Winner!]     │
   │            Jane: 840              │ [Jane sees: 2nd place]   │
   │                                   │                          │
   └                                   └                          ┘
```

---

## Rate Limiting & Performance

**Recommendations:**
- Max 100 players per game
- Socket messages optimized for <100ms latency
- Leaderboard updates throttled every 100ms
- Game rooms cleaned up after 1 hour

---

## CORS Configuration

Socket.io configured with:
```javascript
cors: {
  origin: "*",
  methods: ["GET", "POST"]
}
```

Safe for local/classroom use. For production, restrict origin to your domain.

---

## Testing

### cURL - Get All Quizzes
```bash
curl http://localhost:3000/api/quizzes
```

### cURL - Create Quiz
```bash
curl -X POST http://localhost:3000/api/quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Math Quiz",
    "teacher":"Mr. T",
    "questions":[{
      "text":"2+2=?",
      "options":["3","4","5","6"],
      "correct":1,
      "timer":10
    }]
  }'
```

### WebSocket - Using Socket.io Client
```javascript
const socket = io('http://localhost:3000');

// Student joins
socket.emit('player-join', { pin: '437829', nickname: 'John' });

// Student answers
socket.emit('submit-answer', { 
  pin: '437829', 
  answer: 2, 
  timeTaken: 3.5 
});

// Listen for updates
socket.on('question-display', (data) => console.log(data));
socket.on('leaderboard-update', (data) => console.log(data));
socket.on('quiz-ended', (data) => console.log(data));
```

---

That's the complete API! All endpoints and Socket.io events are documented with examples.
