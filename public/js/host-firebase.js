// Host Game JavaScript - Firebase Integration
import { getQuiz, getCurrentUser, onAuthChange } from './firebase-config.js';

const socket = io();

let currentPin = null;
let currentQuiz = null;
let gamePhase = 'setup'; // setup, lobby, game, results
let userToken = null;
let currentUser = null;
let countdownInterval = null;
let hostNotificationTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  onAuthChange(async (user) => {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quizId');

    if (!user) {
      if (quizId) {
        const redirectPath = `/teacher/host?key=quiz123&quizId=${encodeURIComponent(quizId)}`;
        window.location.href = `/auth?redirect=${encodeURIComponent(redirectPath)}`;
      } else {
        window.location.href = '/auth';
      }
      return;
    }

    currentUser = user;
    userToken = await user.getIdToken(true);
    loadQuizFromUrl();
  });

  setupSocketListeners();
  window.startGameWithFirebaseQuiz = startGameWithFirebaseQuiz;
  window.startGame = startGameWithFirebaseQuiz;
  window.beginQuiz = beginQuiz;
  window.nextQuestion = nextQuestion;
  window.endGame = endGame;
  window.goHome = goHome;

  const initialStartButton = document.getElementById('hostStartButton');
  if (initialStartButton) {
    initialStartButton.addEventListener('click', startGameWithFirebaseQuiz);
  }
});

// Load quiz from URL parameter
async function loadQuizFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const quizId = urlParams.get('quizId');

  if (!quizId) {
    renderHostError('No quiz selected. Please choose a quiz from the dashboard.', false);
    return;
  }

  if (!userToken && currentUser) {
    userToken = await currentUser.getIdToken(true);
  }

  if (!userToken) {
    renderHostError('You must be signed in to load this quiz. Redirecting to login...', true);
    return;
  }

  try {
    const quiz = await getQuiz(quizId, userToken);
    currentQuiz = {
      ...quiz,
      id: quiz.id || quizId
    };

    document.getElementById('setupPhase').innerHTML = `
      <div class="glass-card rounded-2xl p-6 mb-6">
        <h3 class="text-2xl font-bold text-black mb-4">${escapeHtml(currentQuiz.title)}</h3>
        <p class="text-gray-700 mb-2">${currentQuiz.description ? escapeHtml(currentQuiz.description) : 'No description'}</p>
        <p class="text-gray-600 font-semibold">📚 Questions: ${currentQuiz.questions?.length || 0}</p>
        <p class="text-gray-600 font-semibold">⏱️ Time per question: ${currentQuiz.settings?.timeLimit || 30}s</p>
      </div>
      
      <div class="mb-6">
        <label class="block text-lg font-semibold text-gray-900 mb-3">Your Name (Optional)</label>
        <input type="text" id="teacherName" placeholder="Enter your name" class="glass-input w-full px-4 py-3 rounded-xl">
      </div>
      
      <button id="hostStartButton" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl text-lg transition duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">Start Game 🚀</button>
    `;

    const startButton = document.getElementById('hostStartButton');
    if (startButton) {
      startButton.addEventListener('click', startGameWithFirebaseQuiz);
    }

    sessionStorage.setItem('currentQuiz', JSON.stringify(currentQuiz));
  } catch (error) {
    const messageText = error.message || 'Failed to load quiz.';
    const friendlyMessage = messageText.includes('permission') || messageText.includes('not found')
      ? 'This quiz could not be loaded. Please make sure you are signed in with the correct host account.'
      : messageText;
    renderHostError(friendlyMessage);
  }
}

function renderHostError(message, showLoginLink = false) {
  document.getElementById('setupPhase').innerHTML = `
    <div class="glass-card rounded-2xl p-8 bg-red-50 border border-red-300">
      <h2 class="text-2xl font-bold text-red-700 mb-4">Unable to load quiz</h2>
      <p class="text-red-700 mb-6">${escapeHtml(message)}</p>
      <div class="flex flex-col gap-3 sm:flex-row">
        <a href="/dashboard" class="inline-flex justify-center items-center rounded-xl bg-white border border-red-400 text-red-700 px-5 py-3 font-semibold transition hover:bg-red-100">Back to Dashboard</a>
        ${showLoginLink ? `<a href="/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}" class="inline-flex justify-center items-center rounded-xl bg-red-700 text-white px-5 py-3 font-semibold transition hover:bg-red-800">Login and Retry</a>` : ''}
      </div>
    </div>
  `;
}

// Start game with Firebase quiz
function startGameWithFirebaseQuiz() {
  const teacherName = document.getElementById('teacherName')?.value?.trim() || 'Host';

  const quizIdFromUrl = new URLSearchParams(window.location.search).get('quizId');
  const quizId = currentQuiz?.id || currentQuiz?.quizId || quizIdFromUrl;

  if (!quizId) {
    showHostNotification('Quiz ID is missing. Please reload the quiz from the dashboard.', 'error');
    console.error('Quiz ID missing in startGameWithFirebaseQuiz:', { currentQuiz, quizIdFromUrl });
    return;
  }

  const payload = {
    quizId,
    teacherName
  };

  console.log('[client] emitting start-game with:', {
    quizId: payload.quizId,
    teacherName: payload.teacherName,
    socketConnected: socket.connected,
    socketId: socket.id
  });

  socket.emit('start-game', payload, (response) => {
    if (response?.success) {
      console.log('[client] start-game ack success:', response);
      return;
    }

    const errorText = response?.error || 'Failed to start the game. Please try again.';
    showHostNotification(`Error: ${errorText}`, 'error');
    console.error('[client] start-game ack error:', response);
  });
}

// Begin quiz
function beginQuiz() {
  if (!currentPin) return;
  socket.emit('quiz-start', { pin: currentPin });
}

// Next question
function nextQuestion() {
  if (!currentPin) return;
  socket.emit('next-question', { pin: currentPin });
}

// End game
function endGame() {
  if (!currentPin) return;
  
  if (confirm('Are you sure you want to end the game?')) {
    socket.emit('end-game', { pin: currentPin });
    // Save game stats to Firebase
    saveGameStats();
  }
}

// Save game statistics to Firebase
async function saveGameStats() {
  if (!currentUser || !userToken) return;
  
  try {
    // Update quiz stats
    const response = await fetch(`/api/firebase/quizzes/${currentQuiz.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        'stats.timesPlayed': currentQuiz.stats?.timesPlayed + 1 || 1
      })
    });

    if (response.ok) {
      console.log('Game stats saved');
    }
  } catch (error) {
    console.error('Error saving game stats:', error);
  }
}

// Go back to dashboard
function goHome() {
  window.location.href = '/dashboard';
}

// ===== SOCKET LISTENERS =====

function setupSocketListeners() {
  // Game started
  socket.on('game-started', (data) => {
    currentPin = data.pin;
    showPhase('lobby');
    
    const quiz = data.quiz || currentQuiz;
    document.getElementById('pinDisplay').textContent = data.pin;
    document.getElementById('quizTitle').textContent = escapeHtml(quiz.title || 'Quiz');
    document.getElementById('quizTeacher').textContent = `Host: ${data.teacherName || 'Host'}`;
    document.getElementById('questionCount').textContent = `📚 Questions: ${(quiz.questions || []).length}`;
  });

  // Player joined
  socket.on('player-joined', (data) => {
    document.getElementById('playerCount').textContent = data.playerCount;
    
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    if (data.players) {
      data.players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'glassmorphism rounded-2xl p-4 text-center';
        playerCard.innerHTML = `
          <p class="text-black font-semibold">${escapeHtml(player.nickname || player.name || 'Player')}</p>
          <p class="text-xl font-bold text-indigo-600">${player.score || 0}</p>
        `;
        playersList.appendChild(playerCard);
      });
    }
  });

  // Question display
  socket.on('question-display', (data) => {
    showPhase('game');
    updateQuestion(data);
    startTimer(data.timer);
  });

  // Show results
  socket.on('show-results', (data) => {
    clearInterval(countdownInterval);
    
    // Display correct answer
    const resultsDiv = document.getElementById('correctAnswerDisplay');
    if (resultsDiv) {
      const answerLetter = String.fromCharCode(65 + data.correctAnswer);
      resultsDiv.className = 'glassmorphism rounded-2xl p-4 bg-green-50 border-2 border-green-400';
      resultsDiv.innerHTML = `
        <p class="text-2xl font-bold text-green-700">Correct Answer: <span class="text-3xl">${answerLetter}</span></p>
        <p class="text-lg text-green-600 mt-2">${escapeHtml(data.correctOption || '')}</p>
      `;
      resultsDiv.classList.remove('hidden');
    }
    
    updateLeaderboard(data.leaderboard);
  });

  // Question timeout - show correct answer to everyone
  socket.on('question-timeout', (data) => {
    // Display correct answer on host side
    const resultsDiv = document.getElementById('correctAnswerDisplay');
    if (resultsDiv) {
      const answerLetter = String.fromCharCode(65 + data.correctAnswer);
      resultsDiv.className = 'glassmorphism rounded-2xl p-4 bg-green-50 border-2 border-green-400';
      resultsDiv.innerHTML = `
        <p class="text-2xl font-bold text-green-700">Correct Answer: <span class="text-3xl">${answerLetter}</span></p>
        <p class="text-lg text-green-600 mt-2">${escapeHtml(data.correctOption || '')}</p>
      `;
      resultsDiv.classList.remove('hidden');
    }

    updateLeaderboard(data.leaderboard);
  });

  // Quiz ended
  socket.on('quiz-ended', (data) => {
    showPhase('results');
    clearInterval(countdownInterval);
    
    document.getElementById('winnerName').textContent = data.winner?.name || data.winner?.nickname || 'No Winner';
    document.getElementById('winnerScore').textContent = `Score: ${data.winner?.score || 0}`;
    
    const leaderboardDiv = document.getElementById('finalLeaderboard');
    leaderboardDiv.innerHTML = (data.leaderboard || []).map((player, index) => `
      <div class="glassmorphism rounded-2xl p-4 flex justify-between items-center">
        <div>
          <p class="font-semibold text-black">#${index + 1} ${escapeHtml(player.name || player.nickname || 'Player')}</p>
        </div>
        <p class="text-xl font-bold text-indigo-600">${player.score} pts</p>
      </div>
    `).join('');
  });

  // Game error handler
  socket.on('game-error', (data) => {
    const message = typeof data === 'string' ? data : data?.message || JSON.stringify(data);
    console.error('[socket] game-error event received:', data);
    showHostNotification(`Error: ${message}`, 'error');
  });

  // Socket.IO transport error handler
  socket.on('error', (error) => {
    const errorMessage = typeof error === 'string'
      ? error
      : error?.message || JSON.stringify(error);

    console.error('[socket] transport error received:', error);

    if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('quiz not found')) {
      showHostNotification(`Error: ${errorMessage}`, 'error');
      return;
    }

    showHostNotification('A socket transport error occurred. Check the console.', 'error');
  });

  // Connection handlers
  socket.on('connect', () => {
    console.log('[socket] connected with ID:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('[socket] disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('[socket] connect_error:', error);
    showHostNotification(`Socket connection failed: ${error?.message || 'Unknown error'}`, 'error');
  });

  socket.on('reconnect_error', (error) => {
    console.error('[socket] reconnect_error:', error);
    showHostNotification(`Socket reconnect failed: ${error?.message || 'Unknown error'}`, 'error');
  });

  socket.on('reconnect_failed', () => {
    console.error('[socket] reconnect_failed');
    showHostNotification('Socket reconnect failed. Refresh the page to retry.', 'error');
  });
}

function showHostNotification(message, type = 'error') {
  let notification = document.getElementById('hostNotification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'hostNotification';
    notification.className = 'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-red-300 bg-red-50 px-4 py-4 text-sm text-red-700 shadow-lg';
    document.body.appendChild(notification);
  }

  notification.textContent = message;
  notification.classList.remove('hidden', 'border-red-300', 'bg-red-50', 'text-red-700', 'border-yellow-300', 'bg-yellow-50', 'text-yellow-700', 'border-green-300', 'bg-green-50', 'text-green-700');

  if (type === 'success') {
    notification.classList.add('border-green-300', 'bg-green-50', 'text-green-700');
  } else if (type === 'warning') {
    notification.classList.add('border-yellow-300', 'bg-yellow-50', 'text-yellow-700');
  } else {
    notification.classList.add('border-red-300', 'bg-red-50', 'text-red-700');
  }

  notification.classList.remove('opacity-0');
  notification.classList.add('opacity-100');

  if (hostNotificationTimeout) {
    clearTimeout(hostNotificationTimeout);
  }

  hostNotificationTimeout = setTimeout(() => {
    if (notification) {
      notification.classList.add('hidden');
    }
  }, 7000);
}

function clearHostNotification() {
  const notification = document.getElementById('hostNotification');
  if (!notification) return;
  notification.textContent = '';
  notification.classList.add('hidden');
}

// Update question display
function updateQuestion(data) {
  const questionNum = (data.questionIndex || 0) + 1;
  const totalQuestions = data.totalQuestions || 0;
  
  document.getElementById('questionNumber').textContent = `Question ${questionNum}/${totalQuestions}`;
  document.getElementById('questionText').textContent = escapeHtml(data.question?.text || 'Loading...');
  
  const options = data.question?.options || [];
  const optionsDisplay = document.getElementById('optionsDisplay');
  optionsDisplay.innerHTML = options.map((option, index) => `
    <div class="glassmorphism rounded-2xl p-4 text-center text-black font-semibold hover:bg-indigo-200 transition cursor-pointer">
      ${escapeHtml(option)}
    </div>
  `).join('');
}

// Update leaderboard
function updateLeaderboard(leaderboard) {
  const leaderboardDiv = document.getElementById('leaderboard');
  leaderboardDiv.innerHTML = leaderboard.slice(0, 10).map((player, index) => `
    <div class="glassmorphism rounded-2xl p-3 flex justify-between items-center">
      <span class="text-white font-semibold">#${index + 1} ${escapeHtml(player.name || player.nickname || 'Player')}</span>
      <span class="text-xl font-bold text-yellow-300">${player.score}</span>
    </div>
  `).join('');
}

// Start timer
function startTimer(seconds) {
  let remaining = seconds;
  const timerDisplay = document.getElementById('questionTimer');
  
  clearInterval(countdownInterval);
  timerDisplay.textContent = remaining;
  
  countdownInterval = setInterval(() => {
    remaining--;
    timerDisplay.textContent = remaining;
    
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      // Emit question timeout to show correct answer to everyone
      if (currentPin) {
        socket.emit('question-timeout', { pin: currentPin });
      }
    }
  }, 1000);
}

// Show phase
function showPhase(phase) {
  gamePhase = phase;
  document.getElementById('setupPhase').classList.toggle('hidden', phase !== 'setup');
  document.getElementById('lobbyPhase').classList.toggle('hidden', phase !== 'lobby');
  document.getElementById('gamePhase').classList.toggle('hidden', phase !== 'game');
  document.getElementById('resultsPhase').classList.toggle('hidden', phase !== 'results');
}

// Helper function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Export functions for HTML onclick handlers
window.startGameWithFirebaseQuiz = startGameWithFirebaseQuiz;
window.beginQuiz = beginQuiz;
window.nextQuestion = nextQuestion;
window.endGame = endGame;
window.goHome = goHome;
