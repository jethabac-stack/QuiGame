// Player Join Game JavaScript
const socket = io();
let currentPin = null;
let currentNickname = null;
let playerScore = 0;
let gamePhase = 'join'; // join, waiting, game, results
let hasAnsweredQuestion = false;
let questionStartTime = 0;
let countdownInterval = null;
let maxPointsAvailable = 1000;
let currentQuestionTimer = 0;
let pointsDecayInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Allow PIN input only for numbers
  document.getElementById('gamePin').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
});

// Join game
function joinGame() {
  const pin = document.getElementById('gamePin').value.trim();
  const nickname = document.getElementById('playerNickname').value.trim();

  clearJoinError();

  if (!pin || pin.length !== 6) {
    showJoinError('Please enter the full 6-digit game PIN shown by your teacher.');
    return;
  }

  if (!nickname) {
    showJoinError('Please enter your nickname so the teacher can identify you.');
    return;
  }

  currentPin = pin;
  currentNickname = nickname;
  hasAnsweredQuestion = false;

  socket.emit('player-join', { pin, nickname });
  showPhase('waiting');
  setupSocketListeners();
}

function showJoinError(message) {
  const errorElement = document.getElementById('joinError');
  if (!errorElement) return;
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
}

function clearJoinError() {
  const errorElement = document.getElementById('joinError');
  if (!errorElement) return;
  errorElement.textContent = '';
  errorElement.classList.add('hidden');
}

// Submit answer
function submitAnswer(selectedOption) {
  if (hasAnsweredQuestion) return;

  const timeTaken = (Date.now() - questionStartTime) / 1000;
  
  hasAnsweredQuestion = true;
  clearInterval(pointsDecayInterval); // Stop point decay
  
  socket.emit('submit-answer', { 
    pin: currentPin, 
    answer: selectedOption,
    timeTaken
  });

  // Disable answer buttons with visual feedback
  document.querySelectorAll('.answer-button').forEach(btn => {
    btn.classList.add('opacity-60', 'cursor-not-allowed');
    btn.style.pointerEvents = 'none';
  });
}

// Go home
function goHome() {
  window.location.href = '/';
}

// ===== SOCKET LISTENERS =====

function setupSocketListeners() {
  // Question display
  socket.on('question-display', (data) => {
    showPhase('game');
    hasAnsweredQuestion = false;
    questionStartTime = Date.now();
    currentQuestionTimer = data.timer;
    maxPointsAvailable = 1000;

    document.getElementById('questionNumber').textContent = 
      `Question ${data.questionIndex + 1} of ${data.totalQuestions}`;

    // Display question text
    document.getElementById('questionText').textContent = data.question.text;

    // Show answer buttons with hover effects
    const answerButtons = document.getElementById('answerButtons');
    answerButtons.innerHTML = data.question.options.map((option, index) => `
      <button class="answer-button bg-white hover:bg-indigo-50 border-2 border-gray-300 hover:border-indigo-600 p-4 rounded-lg font-semibold text-lg text-left transition duration-200 cursor-pointer shadow-sm hover:shadow-md text-black" onclick="submitAnswer(${index})">
        <span class="text-black font-bold text-xl">${String.fromCharCode(65 + index)}:</span> ${option}
      </button>
    `).join('');

    // Start countdown with real-time point decay
    startCountdownWithPointDecay(data.timer);
  });

  // Answer result with enhanced feedback
  socket.on('answer-result', (data) => {
    const feedback = document.getElementById('feedbackMessage');
    const scoreGain = document.getElementById('scoreGain');
    
    if (data.isCorrect) {
      feedback.className = 'bg-green-500 text-white p-6 rounded-lg text-center font-bold text-xl shadow-lg animate-bounce';
      feedback.innerHTML = `
        <div class=\"text-3xl mb-2\">✓ Correct!</div>
        <div class=\"text-2xl font-bold\">+${data.score} points</div>
      `;
    } else {
      feedback.className = 'bg-red-500 text-white p-6 rounded-lg text-center font-bold text-xl shadow-lg';
      feedback.innerHTML = `
        <div class=\"text-3xl mb-2\">✗ Incorrect</div>
        <div class=\"text-lg\">Answer was ${String.fromCharCode(65 + data.correctAnswer)}</div>
      `;
    }
    
    feedback.classList.remove('hidden');
    playerScore += data.score;
    updatePlayerScore();
    
    // Animate score gain
    if (scoreGain) {
      scoreGain.innerHTML = `<span class=\"text-3xl font-bold text-green-600 animate-bounce\">+${data.score}</span>`;
      scoreGain.classList.remove('hidden');
      setTimeout(() => scoreGain.classList.add('hidden'), 1500);
    }
  });

  // Leaderboard update
  socket.on('leaderboard-update', (data) => {
    console.log('🎯 Leaderboard Update Received:', data);
    console.log('📊 Leaderboard entries:', data.leaderboard);
    if (data.leaderboard && data.leaderboard.length > 0) {
      console.log('📍 First entry:', data.leaderboard[0]);
    }
    updateLeaderboard(data.leaderboard);
    updateAllPlayers(data.allPlayers);
  });

  // Show results
  socket.on('show-results', (data) => {
    // Results are shown and leaderboard updates
  });

  // Quiz ended
  socket.on('quiz-ended', (data) => {
    showPhase('results');
    
    document.getElementById('finalScore').textContent = playerScore;

    const finalBoard = document.getElementById('finalLeaderboard');
    finalBoard.innerHTML = data.leaderboard.map((entry, index) => `
      <div class="leaderboard-entry">
        <span class="leaderboard-rank">${index + 1}</span>
        <span class="leaderboard-name">${entry.nickname}</span>
        <span class="leaderboard-score">${entry.score}</span>
      </div>
    `).join('');
  });

  // Player joined (to see other players)
  socket.on('player-joined', (data) => {
    updateAllPlayers(data.players);
  });

  // Error
  socket.on('error', (message) => {
    alert(`Error: ${message}`);
    window.location.href = '/join';
  });

  // Disconnect
  socket.on('disconnect', () => {
    alert('Connection lost. Please rejoin the game.');
    window.location.href = '/join';
  });
}

// Update player score
function updatePlayerScore() {
  document.getElementById('playerScore').textContent = playerScore;
}

// Update leaderboard with animation
function updateLeaderboard(leaderboard) {
  const board = document.getElementById('liveLeaderboard');
  console.log('🎨 Rendering leaderboard:', leaderboard);
  
  if (!leaderboard || leaderboard.length === 0) {
    console.warn('⚠️ No leaderboard data to display');
    board.innerHTML = '<p class="text-black text-center font-semibold">Waiting for scores...</p>';
    return;
  }
  
  board.innerHTML = leaderboard.map((entry, index) => {
    console.log(`🏅 Player ${index + 1}:`, entry.nickname, 'Score:', entry.score);
    const isPlayer = entry.nickname === currentNickname;
    const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    const glassClass = isPlayer ? 'glassmorphism border-2 border-white/40 ring-2 ring-indigo-400/50 shadow-lg' : 'glassmorphism border border-white/20';
    return `
      <div class=\"${glassClass} p-4 rounded-xl flex justify-between items-center transition duration-300 ${isPlayer ? 'scale-105' : ''} hover:shadow-lg\">
        <span class=\"text-2xl font-bold w-8\">${medalEmoji}</span>
        <span class=\"text-lg font-semibold text-black flex-1 ml-2 drop-shadow-lg\">${entry.nickname}</span>
        <span class=\"text-xl font-bold text-black drop-shadow-lg\">${entry.score}</span>
      </div>
    `;
  }).join('');
}

// Update all players (for waiting phase)
function updateAllPlayers(players) {
  const playerList = document.getElementById('playersList');
  if (playerList) {
    playerList.innerHTML = players.map(player => 
      `<div class="player-badge">${player.nickname}</div>`
    ).join('');
  }
}

// Real-time point decay countdown
function startCountdownWithPointDecay(seconds) {
  let timeLeft = seconds;
  const countdown = document.getElementById('countdown');
  const pointsDisplay = document.getElementById('pointsAvailable');
  
  countdown.textContent = timeLeft;
  if (pointsDisplay) pointsDisplay.textContent = maxPointsAvailable;

  if (countdownInterval) clearInterval(countdownInterval);
  if (pointsDecayInterval) clearInterval(pointsDecayInterval);

  countdownInterval = setInterval(() => {
    timeLeft--;
    countdown.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);

  // Update available points in real-time as timer counts down
  pointsDecayInterval = setInterval(() => {
    const elapsedTime = (Date.now() - questionStartTime) / 1000;
    const pointsDecay = (elapsedTime / seconds) * 800;
    maxPointsAvailable = Math.max(0, Math.floor(1000 - pointsDecay));
    
    if (pointsDisplay && !hasAnsweredQuestion) {
      pointsDisplay.textContent = maxPointsAvailable;
      // Add color change for low points
      if (maxPointsAvailable < 300) {
        pointsDisplay.classList.remove('text-green-600');
        pointsDisplay.classList.add('text-red-600', 'animate-pulse');
      } else if (maxPointsAvailable < 600) {
        pointsDisplay.classList.remove('text-green-600', 'text-red-600');
        pointsDisplay.classList.add('text-yellow-600');
      } else {
        pointsDisplay.classList.remove('text-yellow-600', 'text-red-600');
        pointsDisplay.classList.add('text-green-600');
      }
    }
  }, 100);
}

// Standard countdown
function startCountdown(seconds) {
  startCountdownWithPointDecay(seconds);
}

// Show/hide phases
function showPhase(phase) {
  gamePhase = phase;
  
  document.getElementById('joinPhase').classList.add('hidden');
  document.getElementById('waitingPhase').classList.add('hidden');
  document.getElementById('gamePhase').classList.add('hidden');
  document.getElementById('resultsPhase').classList.add('hidden');

  if (phase === 'join') {
    document.getElementById('joinPhase').classList.remove('hidden');
  } else if (phase === 'waiting') {
    document.getElementById('waitingPhase').classList.remove('hidden');
  } else if (phase === 'game') {
    document.getElementById('gamePhase').classList.remove('hidden');
  } else if (phase === 'results') {
    document.getElementById('resultsPhase').classList.remove('hidden');
  }
}
