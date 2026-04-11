const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const QuizManager = require('./quizManager');
const GameRoom = require('./gameRoom');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize managers
const quizManager = new QuizManager();
const gameRooms = new Map(); // Store active game rooms

// ========== ROUTES ==========

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Teacher Dashboard
app.get('/teacher/dashboard', (req, res) => {
  const key = req.query.key;
  if (key !== 'quiz123') {
    return res.status(403).sendFile(path.join(__dirname, 'public', 'unauthorized.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'teacher-dashboard.html'));
});

// Teacher Host Lobby
app.get('/teacher/host', (req, res) => {
  const key = req.query.key;
  if (key !== 'quiz123') {
    return res.status(403).sendFile(path.join(__dirname, 'public', 'unauthorized.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

// Player Join Page
app.get('/join', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'join.html'));
});

// API Routes for Quiz Management
app.get('/api/quizzes', (req, res) => {
  const quizzes = quizManager.getAllQuizzes();
  res.json(quizzes);
});

app.get('/api/quizzes/:id', (req, res) => {
  const quiz = quizManager.getQuiz(req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  res.json(quiz);
});

app.post('/api/quizzes', (req, res) => {
  try {
    const quiz = quizManager.createQuiz(req.body);
    res.status(201).json(quiz);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/quizzes/:id', (req, res) => {
  try {
    const quiz = quizManager.updateQuiz(req.params.id, req.body);
    res.json(quiz);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/quizzes/:id', (req, res) => {
  try {
    quizManager.deleteQuiz(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ========== SOCKET.IO EVENTS ==========

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ===== TEACHER EVENTS =====

  // Start a new game
  socket.on('start-game', (data) => {
    const { quizId, teacherName } = data;
    const quiz = quizManager.getQuiz(quizId);
    
    if (!quiz) {
      socket.emit('error', 'Quiz not found');
      return;
    }

    // Generate 6-digit PIN
    let pin;
    let gameRoom;
    do {
      pin = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
      gameRoom = gameRooms.get(pin);
    } while (gameRoom && gameRoom.isActive);

    // Create new game room
    const newGameRoom = new GameRoom(pin, quiz, teacherName);
    gameRooms.set(pin, newGameRoom);

    socket.join(`game-${pin}`);
    socket.emit('game-started', {
      pin,
      quiz,
      roomId: pin
    });

    console.log(`Game started with PIN: ${pin}`);
  });

  // Teacher starts the quiz
  socket.on('quiz-start', (data) => {
    const { pin } = data;
    const gameRoom = gameRooms.get(pin);

    if (!gameRoom) {
      socket.emit('error', 'Game room not found');
      return;
    }

    gameRoom.showQuestion(0);
    io.to(`game-${pin}`).emit('question-display', {
      question: gameRoom.getCurrentQuestion(),
      questionIndex: 0,
      totalQuestions: gameRoom.quiz.questions.length,
      timer: gameRoom.quiz.questions[0].timer
    });

    console.log(`Quiz started for PIN: ${pin}`);
  });

  // Move to next question
  socket.on('next-question', (data) => {
    const { pin } = data;
    const gameRoom = gameRooms.get(pin);

    if (!gameRoom) {
      socket.emit('error', 'Game room not found');
      return;
    }

    const nextIndex = gameRoom.currentQuestionIndex + 1;

    if (nextIndex < gameRoom.quiz.questions.length) {
      gameRoom.showQuestion(nextIndex);

      // Show results for current question first
      io.to(`game-${pin}`).emit('show-results', {
        correctAnswer: gameRoom.quiz.questions[gameRoom.currentQuestionIndex - 1].correct,
        leaderboard: gameRoom.getTopScores(5)
      });

      // Small delay before showing next question
      setTimeout(() => {
        io.to(`game-${pin}`).emit('question-display', {
          question: gameRoom.getCurrentQuestion(),
          questionIndex: nextIndex,
          totalQuestions: gameRoom.quiz.questions.length,
          timer: gameRoom.quiz.questions[nextIndex].timer
        });
      }, 3000);
    } else {
      // Quiz ended
      gameRoom.endGame();
      io.to(`game-${pin}`).emit('quiz-ended', {
        leaderboard: gameRoom.getFinalLeaderboard(),
        winner: gameRoom.getWinner()
      });

      // Clean up room after 1 hour
      setTimeout(() => {
        gameRooms.delete(pin);
      }, 3600000);
    }
  });

  // End game early
  socket.on('end-game', (data) => {
    const { pin } = data;
    const gameRoom = gameRooms.get(pin);

    if (!gameRoom) {
      socket.emit('error', 'Game room not found');
      return;
    }

    gameRoom.endGame();
    io.to(`game-${pin}`).emit('quiz-ended', {
      leaderboard: gameRoom.getFinalLeaderboard(),
      winner: gameRoom.getWinner()
    });

    gameRooms.delete(pin);
  });

  // ===== PLAYER EVENTS =====

  // Player joins game
  socket.on('player-join', (data) => {
    const { pin, nickname } = data;
    const gameRoom = gameRooms.get(pin);

    if (!gameRoom) {
      socket.emit('error', 'Game room not found');
      return;
    }

    if (!gameRoom.isActive) {
      socket.emit('error', 'Game has not started yet');
      return;
    }

    // Add player to room
    gameRoom.addPlayer(socket.id, nickname);
    socket.join(`game-${pin}`);
    socket.gamePin = pin;
    socket.playerId = socket.id;

    // Notify teacher of new player
    io.to(`game-${pin}`).emit('player-joined', {
      players: gameRoom.getPlayers(),
      playerCount: gameRoom.players.size
    });

    // Send current game state to player
    if (gameRoom.currentQuestionIndex >= 0) {
      socket.emit('question-display', {
        question: gameRoom.getCurrentQuestion(),
        questionIndex: gameRoom.currentQuestionIndex,
        totalQuestions: gameRoom.quiz.questions.length,
        timer: gameRoom.getCurrentQuestion().timer
      });
    }

    console.log(`${nickname} joined game ${pin}`);
  });

  // Player submits answer
  socket.on('submit-answer', (data) => {
    const { pin, answer, timeTaken } = data;
    const gameRoom = gameRooms.get(pin);

    if (!gameRoom) {
      socket.emit('error', 'Game room not found');
      return;
    }

    const playerId = socket.playerId;
    const currentQuestion = gameRoom.quiz.questions[gameRoom.currentQuestionIndex];
    const correctAnswer = currentQuestion.correct;
    const isCorrect = answer === correctAnswer;
    const timerLimit = currentQuestion.timer;

    // Calculate score
    const score = isCorrect ? Math.floor(1000 - (timeTaken / timerLimit) * 800) : 0;

    // Only count first answer per player per question
    if (!gameRoom.hasAnswered(playerId)) {
      gameRoom.recordAnswer(playerId, answer, score, isCorrect);
      
      console.log(`✅ Player ${playerId} answered. Score: ${score}`);
      console.log(`📊 Current leaderboard:`, gameRoom.getTopScores(5));

      // Notify player of result
      socket.emit('answer-result', {
        isCorrect,
        score,
        correctAnswer
      });

      // Broadcast updated leaderboard to all players
      io.to(`game-${pin}`).emit('leaderboard-update', {
        leaderboard: gameRoom.getTopScores(5),
        allPlayers: gameRoom.getAllScores()
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    if (socket.gamePin && socket.playerId) {
      const gameRoom = gameRooms.get(socket.gamePin);
      if (gameRoom) {
        gameRoom.removePlayer(socket.playerId);
        io.to(`game-${socket.gamePin}`).emit('player-left', {
          players: gameRoom.getPlayers(),
          playerCount: gameRoom.players.size
        });
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

// ========== SERVER START ==========

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Teacher Dashboard: http://localhost:${PORT}/teacher/dashboard?key=quiz123`);
  console.log(`Join Game: http://localhost:${PORT}/join`);
});
