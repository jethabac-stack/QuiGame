// Host Game JavaScript
const socket = io();
let currentPin = null;
let currentQuiz = null;
let gamePhase = 'setup'; // setup, lobby, game, results
let allQuizzes = [];
let countdownInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadQuizzes();
  setupSocketListeners();
  
  // Get quizId from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const quizId = urlParams.get('quizId');
  
  // Pre-select quiz if passed in URL
  if (quizId) {
    setTimeout(() => {
      document.getElementById('quizSelect').value = quizId;
    }, 500);
  }
});

// Load available quizzes
async function loadQuizzes() {
  try {
    const response = await fetch('/api/quizzes');
    allQuizzes = await response.json();
    
    const select = document.getElementById('quizSelect');
    select.innerHTML = '<option value="">-- Select a quiz --</option>' + allQuizzes.map(quiz => 
      `<option value="${quiz.id}">${quiz.title} (${quiz.questions.length} questions)</option>`
    ).join('');
  } catch (error) {
    console.error('Error loading quizzes:', error);
  }
}

// Start game
function startGame() {
  const quizId = document.getElementById('quizSelect').value;
  const teacherName = document.getElementById('teacherName').value || 'Teacher';

  if (!quizId) {
    alert('Please select a quiz');
    return;
  }

  currentQuiz = allQuizzes.find(q => q.id === quizId);
  if (!currentQuiz) return;

  socket.emit('start-game', { quizId, teacherName });
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
  }
}

// Go home
function goHome() {
  window.location.href = '/teacher/dashboard?key=quiz123';
}

// ===== SOCKET LISTENERS =====

function setupSocketListeners() {
  // Game started
  socket.on('game-started', (data) => {
    currentPin = data.pin;
    showPhase('lobby');
    
    document.getElementById('pinDisplay').textContent = data.pin;
    document.getElementById('quizTitle').textContent = data.quiz.title;
    document.getElementById('quizTeacher').textContent = `Teacher: ${data.quiz.teacher || 'Unknown'}`;
    document.getElementById('questionCount').textContent = `Questions: ${data.quiz.questions.length}`;
  });

  // Player joined
  socket.on('player-joined', (data) => {
    document.getElementById('playerCount').textContent = data.playerCount;
    
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = data.players.map(player => 
      `<div class="player-badge">${player.nickname}</div>`
    ).join('');
  });

  // Player left
  socket.on('player-left', (data) => {
    document.getElementById('playerCount').textContent = data.playerCount;
    
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = data.players.map(player => 
      `<div class="player-badge">${player.nickname}</div>`
    ).join('');
  });

  // Question display
  socket.on('question-display', (data) => {
    showPhase('game');
    
    document.getElementById('questionNumber').textContent = 
      `Question ${data.questionIndex + 1} of ${data.totalQuestions}`;
    document.getElementById('questionText').textContent = data.question.text;
    
    const optionsDisplay = document.getElementById('optionsDisplay');
    optionsDisplay.innerHTML = data.question.options.map((option, index) => 
      `<div class="answer-button">${String.fromCharCode(65 + index)}: ${option}</div>`
    ).join('');

    startCountdown(data.timer);
  });

  // Show results
  socket.on('show-results', (data) => {
    const correctOption = String.fromCharCode(65 + data.correctAnswer);
    alert(`Correct Answer: ${correctOption}\n\nCheck leaderboard for scores!`);
    updateLeaderboard(data.leaderboard);
  });

  // Quiz ended
  socket.on('quiz-ended', (data) => {
    showPhase('results');
    
    if (data.winner) {
      document.getElementById('winnerName').textContent = data.winner.nickname;
      document.getElementById('winnerScore').textContent = `${data.winner.score} points`;
    }

    const finalBoard = document.getElementById('finalLeaderboard');
    finalBoard.innerHTML = data.leaderboard.map((entry, index) => `
      <div class="leaderboard-entry">
        <span class="leaderboard-rank">${index + 1}</span>
        <span class="leaderboard-name">${entry.nickname}</span>
        <span class="leaderboard-score">${entry.score}</span>
      </div>
    `).join('');
  });

  // Leaderboard update - Real-time score updates
  socket.on('leaderboard-update', (data) => {
    console.log('Leaderboard update received:', data);
    updateLeaderboard(data.leaderboard);
  });

  // Error
  socket.on('error', (message) => {
    alert(`Error: ${message}`);
  });
}

// Update leaderboard display
function updateLeaderboard(leaderboard) {
  const board = document.getElementById('leaderboard');
  board.innerHTML = leaderboard.map((entry, index) => {
    const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
    const progressPercent = (entry.score / (leaderboard[0]?.score || 1000)) * 100;
    return `
      <div class="bg-white bg-opacity-90 rounded-lg p-3 mb-2 shadow-md border-l-4 ${index === 0 ? 'border-yellow-400' : 'border-indigo-300'} transition duration-300 hover:shadow-lg hover:bg-opacity-100">
        <div class="flex justify-between items-center mb-2">
          <div class="flex items-center gap-2 flex-1">
            <span class="text-xl">${medalEmoji}</span>
            <span class="text-sm font-bold text-black truncate">${entry.nickname}</span>
          </div>
          <span class="text-lg font-bold text-black">${entry.score}</span>
        </div>
        <div class="w-full bg-gray-300 rounded-full h-1.5">
          <div class="bg-gradient-to-r from-yellow-400 to-indigo-600 h-1.5 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Countdown timer
function startCountdown(seconds) {
  let timeLeft = seconds;
  const timerElement = document.getElementById('questionTimer');
  timerElement.textContent = timeLeft;

  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    timeLeft--;
    timerElement.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);
}

// Show/hide phases
function showPhase(phase) {
  gamePhase = phase;
  
  document.getElementById('setupPhase').classList.add('hidden');
  document.getElementById('lobbyPhase').classList.add('hidden');
  document.getElementById('gamePhase').classList.add('hidden');
  document.getElementById('resultsPhase').classList.add('hidden');

  if (phase === 'setup') {
    document.getElementById('setupPhase').classList.remove('hidden');
  } else if (phase === 'lobby') {
    document.getElementById('lobbyPhase').classList.remove('hidden');
  } else if (phase === 'game') {
    document.getElementById('gamePhase').classList.remove('hidden');
  } else if (phase === 'results') {
    document.getElementById('resultsPhase').classList.remove('hidden');
  }
}
