require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');

const QuizManager = require('./quizManager');
const GameRoom = require('./gameRoom');

// ========== FIREBASE INITIALIZATION ==========
// Initialize Firebase Admin SDK
let db, auth;

try {
  let serviceAccount = null;
  const serviceAccountInput = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountInput) {
    try {
      // First, try to parse as JSON (inline credentials)
      if (serviceAccountInput.trim().startsWith('{')) {
        serviceAccount = JSON.parse(serviceAccountInput);
        console.log('✓ Service account key loaded from .env (inline JSON)');
      } else {
        // Otherwise, treat as file path
        const filePath = path.join(__dirname, serviceAccountInput);
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          serviceAccount = JSON.parse(fileContent);
          console.log('✓ Service account key loaded from file');
        } else {
          console.warn('⚠ Service account file not found at:', filePath);
        }
      }
    } catch (parseError) {
      console.warn('⚠ Error parsing service account credentials:', parseError.message);
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  } else {
    // If no service account, use application default credentials
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    console.warn('⚠ Using application default credentials');
  }

  db = admin.firestore();
  auth = admin.auth();

  console.log('✓ Firebase initialized successfully');
  console.log(`  Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
} catch (error) {
  console.error('✗ Firebase initialization error:', error.message);
  process.exit(1);
}

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
app.use('/image', express.static('image'));
app.use('/music', express.static('music'));

// Initialize managers
const quizManager = new QuizManager();
const gameRooms = new Map(); // Store active game rooms

// ========== FIREBASE MIDDLEWARE ==========
// Middleware to verify Firebase token
const verifyFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ========== ROUTES ==========

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication page
app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

// Host Dashboard (Firebase authenticated)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Teacher Dashboard (legacy - with key protection)
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

// ========== FIREBASE AUTHENTICATION ENDPOINTS ==========

// Host Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and displayName are required' });
    }

    // Create Firebase user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName
    });

    // Store host data in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      userType: 'host',
      createdAt: new Date(),
      stats: { 
        totalQuizzesCreated: 0,
        totalGamesHosted: 0
      }
    });

    res.status(201).json({ 
      success: true, 
      uid: userRecord.uid,
      message: 'Host account created successfully'
    });
  } catch (error) {
    // Handle common Firebase errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ error: 'Password is too weak (minimum 6 characters)' });
    }
    res.status(400).json({ error: error.message });
  }
});

// Host Login (Token generation happens on client-side)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Verify user exists
    const user = await admin.auth().getUserByEmail(email);

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();

    let userData = userDoc.data();
    if (!userDoc.exists) {
      // Create user document if it doesn't exist
      userData = {
        email,
        displayName: user.displayName || 'Unknown Host',
        userType: 'host',
        createdAt: new Date(),
        stats: {
          totalQuizzesCreated: 0,
          totalGamesHosted: 0
        }
      };
      await db.collection('users').doc(user.uid).set(userData);
    }

    res.json({ success: true, userData });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(400).json({ error: error.message });
  }
});

// ========== FIREBASE QUIZ MANAGEMENT ENDPOINTS ==========

// Create Quiz (Host only, requires Firebase token)
app.post('/api/firebase/quizzes', verifyFirebaseToken, async (req, res) => {
  try {
    const { title, description, questions, settings } = req.body;
    const hostId = req.user.uid;

    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Title and questions array are required' });
    }

    const quizData = {
      title,
      description: description || '',
      questions,
      settings: settings || { timeLimit: 30, shuffle: false },
      hostId,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublished: false,
      stats: {
        timesPlayed: 0,
        totalPlayers: 0,
        averageScore: 0
      }
    };

    const docRef = await db.collection('quizzes').add(quizData);

    // Update host stats - create user document if it doesn't exist
    const userRef = db.collection('users').doc(hostId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create user document if it doesn't exist
      await userRef.set({
        email: req.user.email || '',
        displayName: req.user.name || 'Unknown Host',
        userType: 'host',
        createdAt: new Date(),
        stats: {
          totalQuizzesCreated: 1,
          totalGamesHosted: 0
        }
      });
    } else {
      // Update existing user stats
      await userRef.update({
        'stats.totalQuizzesCreated': admin.firestore.FieldValue.increment(1)
      });
    }

    res.status(201).json({ 
      success: true, 
      quizId: docRef.id,
      quiz: { id: docRef.id, ...quizData }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Host's Quizzes (requires Firebase token)
app.get('/api/firebase/quizzes', verifyFirebaseToken, async (req, res) => {
  try {
    const hostId = req.user.uid;

    const quizzesSnapshot = await db.collection('quizzes')
      .where('hostId', '==', hostId)
      .get();

    const quizzes = quizzesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

    res.json({ success: true, quizzes });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Single Quiz (requires Firebase token)
app.get('/api/firebase/quizzes/:quizId', verifyFirebaseToken, async (req, res) => {
  try {
    const quizDoc = await db.collection('quizzes').doc(req.params.quizId).get();

    if (!quizDoc.exists) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizDoc.data();

    // Verify ownership
    if (quiz.hostId !== req.user.uid) {
      return res.status(403).json({ error: 'You do not have permission to view this quiz' });
    }

    console.log(`🔥 Loaded quiz ${req.params.quizId}:`, {
      title: quiz.title,
      questionCount: quiz.questions?.length || 0,
      questions: quiz.questions?.map((q, i) => ({
        index: i,
        text: q.text?.substring(0, 50) + '...',
        correct: q.correct,
        optionsCount: q.options?.length || 0
      }))
    });

    res.json({ success: true, quiz: { id: quizDoc.id, ...quiz } });
  } catch (error) {
    console.error(`❌ Error loading quiz ${req.params.quizId}:`, error.message);
    res.status(400).json({ error: error.message });
  }
});

// Update Quiz (requires Firebase token)
app.put('/api/firebase/quizzes/:quizId', verifyFirebaseToken, async (req, res) => {
  try {
    const quizDoc = await db.collection('quizzes').doc(req.params.quizId).get();

    if (!quizDoc.exists) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizDoc.data();

    // Verify ownership
    if (quiz.hostId !== req.user.uid) {
      return res.status(403).json({ error: 'You do not have permission to update this quiz' });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    await db.collection('quizzes').doc(req.params.quizId).update(updateData);

    res.json({ 
      success: true, 
      message: 'Quiz updated successfully',
      quiz: { id: req.params.quizId, ...updateData }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete Quiz (requires Firebase token)
app.delete('/api/firebase/quizzes/:quizId', verifyFirebaseToken, async (req, res) => {
  try {
    const quizDoc = await db.collection('quizzes').doc(req.params.quizId).get();

    if (!quizDoc.exists) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizDoc.data();

    // Verify ownership
    if (quiz.hostId !== req.user.uid) {
      return res.status(403).json({ error: 'You do not have permission to delete this quiz' });
    }

    await db.collection('quizzes').doc(req.params.quizId).delete();

    // Update host stats
    await db.collection('users').doc(req.user.uid).update({
      'stats.totalQuizzesCreated': admin.firestore.FieldValue.increment(-1)
    });

    res.json({ success: true, message: 'Quiz deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Publish Quiz (requires Firebase token)
app.post('/api/firebase/quizzes/:quizId/publish', verifyFirebaseToken, async (req, res) => {
  try {
    const quizDoc = await db.collection('quizzes').doc(req.params.quizId).get();

    if (!quizDoc.exists) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizDoc.data();

    // Verify ownership
    if (quiz.hostId !== req.user.uid) {
      return res.status(403).json({ error: 'You do not have permission to publish this quiz' });
    }

    await db.collection('quizzes').doc(req.params.quizId).update({
      isPublished: true,
      publishedAt: new Date()
    });

    res.json({ success: true, message: 'Quiz published successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ========== FIREBASE PLAYER SCORE ENDPOINTS ==========

// Store Player Score
app.post('/api/firebase/scores', async (req, res) => {
  try {
    const { playerId, playerName, quizId, score, gameSessionId } = req.body;

    console.log(`🔥 Firebase save request - playerId: ${playerId}, playerName: ${playerName}, quizId: ${quizId}, score: ${score}, gameSessionId: ${gameSessionId}`);

    if (!playerId || !playerName || !quizId || score === undefined) {
      console.log(`❌ Missing required fields:`, { playerId, playerName, quizId, score });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create player document if not exists
    const playerRef = db.collection('players').doc(playerId);
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
      await playerRef.set({
        playerId,
        playerName,
        createdAt: new Date(),
        scores: []
      });
    }

    // Add score to player's scores
    await playerRef.update({
      scores: admin.firestore.FieldValue.arrayUnion({
        quizId,
        score,
        gameSessionId: gameSessionId || uuidv4(),
        timestamp: new Date()
      })
    });

    // Store game score record
    const gameScoreRef = db.collection('gameScores').doc();
    await gameScoreRef.set({
      playerId,
      playerName,
      quizId,
      score,
      gameSessionId: gameSessionId || uuidv4(),
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Score saved successfully' });
    console.log(`✅ Score saved to Firebase for player ${playerName}: ${score} points`);
  } catch (error) {
    console.error(`❌ Firebase save error:`, error.message);
    res.status(400).json({ error: error.message });
  }
});

// Get Player Scores
app.get('/api/firebase/scores/:playerId', async (req, res) => {
  try {
    const playerDoc = await db.collection('players').doc(req.params.playerId).get();

    if (!playerDoc.exists) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const playerData = playerDoc.data();

    res.json({ 
      success: true, 
      player: {
        id: playerDoc.id,
        ...playerData
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Quiz Leaderboard
app.get('/api/firebase/quizzes/:quizId/leaderboard', async (req, res) => {
  try {
    const scoresSnapshot = await db.collection('gameScores')
      .where('quizId', '==', req.params.quizId)
      .orderBy('score', 'desc')
      .limit(100)
      .get();

    const leaderboard = scoresSnapshot.docs.map(doc => doc.data());

    res.json({ 
      success: true, 
      leaderboard,
      totalEntries: leaderboard.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ========== SOCKET.IO EVENTS ==========

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ===== TEACHER EVENTS =====

  // Start a new game
  socket.on('start-game', async (data, callback) => {
    console.log('[start-game] received payload:', data);

    const { quizId, teacherName } = data;
    let quizPayload = data.quiz || data.quizPayload || null;
    let quiz = null;
    const requestedQuizId = quizId || quizPayload?.id || quizPayload?.quizId;

    if (typeof quizPayload === 'string') {
      try {
        quizPayload = JSON.parse(quizPayload);
      } catch (parseError) {
        console.error('[start-game] failed to parse quizPayload string:', parseError);
      }
    }

    if (quizPayload && typeof quizPayload === 'object' && Object.keys(quizPayload).length > 0) {
      quiz = { ...quizPayload };
      if (!quiz.id && requestedQuizId) {
        quiz.id = requestedQuizId;
      }
    }

    if (!quiz && requestedQuizId) {
      try {
        const quizDoc = await db.collection('quizzes').doc(requestedQuizId).get();
        if (quizDoc.exists) {
          quiz = { id: quizDoc.id, ...quizDoc.data() };
          console.log(`[start-game] loaded quiz from Firestore: ${requestedQuizId}`);
        } else {
          console.log(`[start-game] no Firestore quiz found for ${requestedQuizId}`);
        }
      } catch (firestoreError) {
        console.error(`[start-game] Firestore lookup failed for ${requestedQuizId}:`, firestoreError);
      }
    }

    if (!quiz && requestedQuizId) {
      try {
        quiz = quizManager.getQuiz(requestedQuizId);
      } catch (lookupError) {
        console.error(`[start-game] quizManager lookup failed for ${requestedQuizId}:`, lookupError);
      }
    }

    if (!quiz && quizPayload && requestedQuizId) {
      quiz = { ...quizPayload, id: requestedQuizId };
    }

    console.log('[start-game] resolved quiz:', {
      requestedQuizId,
      hasQuizPayload: !!quizPayload,
      quizIdFromPayload: quizPayload?.id || quizPayload?.quizId,
      quizFound: !!quiz,
      quizKeys: quiz ? Object.keys(quiz) : []
    });

    if (!quiz) {
      console.error('[start-game] quiz resolution failed:', {
        requestedQuizId,
        quizPayload,
        quizIdPresent: !!quizId,
        quizFromPayload: !!quizPayload
      });

      if (typeof callback === 'function') {
        callback({ success: false, error: 'Quiz not found' });
      } else {
        socket.emit('game-error', 'Quiz not found');
      }
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

    console.log(`🎮 Game room created with PIN: ${pin}`);
    console.log(`📚 Quiz details:`, {
      id: quiz.id,
      title: quiz.title,
      questionsCount: quiz.questions?.length || 0,
      questions: quiz.questions?.map((q, i) => ({
        index: i,
        text: q.text?.substring(0, 30) + '...',
        correct: q.correct,
        options: q.options
      })) || []
    });

    socket.join(`game-${pin}`);
    socket.emit('game-started', {
      pin,
      quiz,
      roomId: pin
    });

    if (typeof callback === 'function') {
      callback({ success: true, pin, roomId: pin });
    }

    console.log(`Game started with PIN: ${pin}`);
  });

  // Teacher starts the quiz
  socket.on('quiz-start', (data) => {
    const { pin } = data;
    const gameRoom = gameRooms.get(pin);

    if (!gameRoom) {
      socket.emit('game-error', 'Game room not found');
      return;
    }

    gameRoom.showQuestion(0);
    io.to(`game-${pin}`).emit('question-display', {
      question: gameRoom.getCurrentQuestion(),
      questionIndex: 0,
      totalQuestions: gameRoom.quiz.questions.length,
      timer: gameRoom.quiz.questions[0].timer
    });

    console.log(`🎮 Quiz started for PIN: ${pin} - First question: "${gameRoom.quiz.questions[0].text}" with correct answer: ${gameRoom.quiz.questions[0].correct}`);
  });

  // Question timer expired - show correct answer to everyone
  socket.on('question-timeout', (data) => {
    const { pin } = data;
    const gameRoom = gameRooms.get(pin);

    if (!gameRoom) {
      socket.emit('game-error', 'Game room not found');
      return;
    }

    const currentQuestion = gameRoom.quiz.questions[gameRoom.currentQuestionIndex];
    const correctAnswerIndex = currentQuestion.correct || currentQuestion.correctAnswer;

    // Send feedback to all players who answered
    gameRoom.players.forEach((playerData, playerId) => {
      const playerSocket = io.sockets.sockets.get(playerId);
      if (playerSocket) {
        const playerScore = gameRoom.scores.get(playerId) || 0;
        const hasAnswered = gameRoom.hasAnswered(playerId);

        // Send individual feedback
        playerSocket.emit('answer-feedback', {
          hasAnswered,
          points: hasAnswered ? (playerScore - (gameRoom.scores.get(playerId) || 0)) : 0, // This is approximate
          correctAnswer: correctAnswerIndex
        });
      }
    });

    // Broadcast correct answer and updated leaderboard to everyone
    io.to(`game-${pin}`).emit('question-timeout', {
      correctAnswer: correctAnswerIndex,
      correctOption: currentQuestion.options[correctAnswerIndex],
      leaderboard: gameRoom.getTopScores(10)
    });

    console.log(`⏰ Question timeout for PIN: ${pin} - Correct answer: ${String.fromCharCode(65 + correctAnswerIndex)}`);
    console.log(`🏆 Leaderboard being sent:`, gameRoom.getTopScores(10));
  });

  // Move to next question
  socket.on('next-question', (data) => {
    const { pin } = data;
    const gameRoom = gameRooms.get(pin);

    if (!gameRoom) {
      socket.emit('game-error', 'Game room not found');
      return;
    }

    const nextIndex = gameRoom.currentQuestionIndex + 1;

    if (nextIndex < gameRoom.quiz.questions.length) {
      gameRoom.showQuestion(nextIndex);

      // Show results for current question first
      const currentQuestionIndex = gameRoom.currentQuestionIndex;
      const currentQuestion = gameRoom.quiz.questions[currentQuestionIndex];
      const correctAnswerIndex = currentQuestion.correct || currentQuestion.correctAnswer;
      
      io.to(`game-${pin}`).emit('show-results', {
        correctAnswer: correctAnswerIndex,
        correctOption: currentQuestion.options[correctAnswerIndex],
        leaderboard: gameRoom.getTopScores(10)
      });

      // Small delay before showing next question
      setTimeout(() => {
        io.to(`game-${pin}`).emit('question-display', {
          question: gameRoom.getCurrentQuestion(),
          questionIndex: nextIndex,
          totalQuestions: gameRoom.quiz.questions.length,
          timer: gameRoom.quiz.questions[nextIndex].timer
        });
        const nextQuestion = gameRoom.quiz.questions[nextIndex];
        const nextCorrectAnswer = nextQuestion.correct || nextQuestion.correctAnswer;
        console.log(`➡️ Moved to question ${nextIndex + 1}: "${nextQuestion.text}" with correct answer: ${nextCorrectAnswer}`);
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
      socket.emit('game-error', 'Game room not found');
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
      socket.emit('game-error', 'Game room not found');
      return;
    }

    if (!gameRoom.isActive) {
      socket.emit('game-error', 'Game has not started yet');
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
    console.log(`📥 Server received submit-answer:`, data);

    const { pin, answer, timeTaken, availablePoints } = data;
    const gameRoom = gameRooms.get(pin);

    if (!gameRoom) {
      socket.emit('game-error', 'Game room not found');
      return;
    }

    const playerId = socket.playerId;
    const currentQuestion = gameRoom.quiz.questions[gameRoom.currentQuestionIndex];
    const correctAnswer = currentQuestion.correct || currentQuestion.correctAnswer;

    console.log(`🔍 Current question data:`, {
      questionIndex: gameRoom.currentQuestionIndex,
      questionText: currentQuestion.text,
      correctAnswer: correctAnswer,
      correctAnswerType: typeof correctAnswer,
      allOptions: currentQuestion.options,
      hasCorrect: 'correct' in currentQuestion,
      hasCorrectAnswer: 'correctAnswer' in currentQuestion
    });

    // Ensure both are numbers for comparison
    const submittedAnswer = parseInt(answer);
    const expectedAnswer = parseInt(correctAnswer);
    const isCorrect = submittedAnswer === expectedAnswer;
    const timerLimit = currentQuestion.timer;

    // Calculate score based on available points from client
    const score = isCorrect ? Math.floor(availablePoints || 0) : 0;
    console.log(`🔍 Answer validation - Player: ${playerId}, Question Index: ${gameRoom.currentQuestionIndex}`);    console.log(`🔍 Answer validation - Player: ${playerId}, Submitted: ${answer} (type: ${typeof answer}), Correct: ${correctAnswer} (type: ${typeof correctAnswer}), IsCorrect: ${isCorrect}, TimeTaken: ${timeTaken}, AvailablePoints: ${availablePoints}, Score: ${score}`);
    console.log(`📝 Question: "${currentQuestion.text}"`);
    console.log(`📝 Options:`, currentQuestion.options);

    // Only count first answer per player per question
    if (!gameRoom.hasAnswered(playerId)) {
      gameRoom.recordAnswer(playerId, submittedAnswer, score, isCorrect);

      console.log(`✅ Player ${playerId} answered. Score: ${score}`);
      console.log(`📊 Current leaderboard:`, gameRoom.getTopScores(5));

      // Store answer but don't send feedback yet - wait for timer to expire
      // Feedback will be sent when timer expires via 'question-timeout' event
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
