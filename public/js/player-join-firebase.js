// Player Join Game JavaScript - Firebase Integration
import { savePlayerScore } from './firebase-config.js';

const socket = io();
let currentPin = null;
let currentNickname = null;
let playerScore = 0;
let currentQuizId = null;
let gamePhase = 'join'; // join, waiting, game, results
let hasAnsweredQuestion = false;
let questionStartTime = 0;
let countdownInterval = null;
let maxPointsAvailable = 1000;
let currentQuestionTimer = 0;
let pointsDecayInterval = null;
let playerId = null;
let gameSessionId = generateUUID();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Generate or get player ID
  playerId = localStorage.getItem('playerId') || generateUUID();
  if (!localStorage.getItem('playerId')) {
    localStorage.setItem('playerId', playerId);
  }

  // Allow PIN input only for numbers
  document.getElementById('gamePin').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
});

// Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
  playBackgroundMusic();
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

  console.log(`🎯 Client submitting answer: ${parseInt(selectedOption)} (orig: ${selectedOption}, type: ${typeof selectedOption}) for question ${currentQuestionTimer}s timer`);
  console.log(`💰 Available points at submission: ${maxPointsAvailable}`);

  socket.emit('submit-answer', {
    pin: currentPin,
    answer: parseInt(selectedOption),
    timeTaken,
    availablePoints: maxPointsAvailable
  });

  console.log(`📤 Sending to server - pin: ${currentPin}, answer: ${parseInt(selectedOption)} (type: ${typeof parseInt(selectedOption)}), timeTaken: ${timeTaken}, availablePoints: ${maxPointsAvailable}`);

  // Disable answer buttons with visual feedback (but don't show result yet)
  document.querySelectorAll('.answer-button').forEach(btn => {
    btn.classList.add('opacity-60', 'cursor-not-allowed');
    btn.style.pointerEvents = 'none';
    if (btn.onclick.toString().includes(selectedOption.toString())) {
      btn.classList.add('bg-indigo-200', 'border-indigo-600'); // Highlight selected answer
    }
  });
}

// Save player score to Firebase
async function saveScore() {
  console.log(`💾 Attempting to save score - playerId: ${playerId}, nickname: ${currentNickname}, quizId: ${currentQuizId}, score: ${playerScore}, gameSessionId: ${gameSessionId}`);

  if (!playerId || !currentNickname || !currentQuizId) {
    console.warn('Missing data for score save:', { playerId, currentNickname, currentQuizId });
    return;
  }

  try {
    console.log('📤 Calling savePlayerScore with data:', {
      playerId,
      playerName: currentNickname,
      quizId: currentQuizId,
      score: playerScore,
      gameSessionId
    });
    await savePlayerScore({
      playerId,
      playerName: currentNickname,
      quizId: currentQuizId,
      score: playerScore,
      gameSessionId
    });
    console.log('✅ Score saved to Firebase successfully');
  } catch (error) {
    console.error('❌ Error saving score:', error);
  }
}

// Go home
function goHome() {
  stopBackgroundMusic();
  window.location.href = '/';
}

function playBackgroundMusic() {
  const backgroundMusic = document.getElementById('backgroundMusic');
  if (!backgroundMusic) return;

  backgroundMusic.volume = 0.3;
  const playPromise = backgroundMusic.play();
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.log('Background music autoplay blocked:', error);
    });
  }
}

function stopBackgroundMusic() {
  const backgroundMusic = document.getElementById('backgroundMusic');
  if (!backgroundMusic) return;

  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
}

// ===== SOCKET LISTENERS =====

function setupSocketListeners() {
  // Store quiz ID when game starts
  socket.on('game-started', (data) => {
    currentQuizId = data.quiz.id;
  });

  // Question display
  socket.on('question-display', (data) => {
    console.log(`📋 Question display - Index: ${data.questionIndex}, Text: "${data.question.text}", Options:`, data.question.options);

    showPhase('game');
    hasAnsweredQuestion = false;
    questionStartTime = Date.now();
    currentQuestionTimer = data.timer;
    maxPointsAvailable = 1000;

    document.getElementById('questionNumber').textContent = 
      `Question ${data.questionIndex + 1} of ${data.totalQuestions}`;

    console.log(`📋 Displaying Question ${data.questionIndex + 1}: "${data.question.text}"`);
    document.getElementById('questionText').textContent = escapeHtml(data.question.text || 'Loading...');

    // Show answer buttons with hover effects
    const answerButtons = document.getElementById('answerButtons');
    answerButtons.innerHTML = data.question.options.map((option, index) => `
      <button class="answer-button bg-white hover:bg-indigo-50 border-2 border-gray-300 hover:border-indigo-600 p-4 rounded-lg font-semibold text-lg text-left transition duration-200 cursor-pointer shadow-sm hover:shadow-md text-black" onclick="submitAnswer(${index})">
        <span class="text-black font-bold text-xl">${String.fromCharCode(65 + index)}:</span> ${escapeHtml(option)}
      </button>
    `).join('');

    // Start countdown with real-time point decay
    startCountdownWithPointDecay(data.timer);
  });

  // Update leaderboard
  socket.on('update-leaderboard', (data) => {
    const leaderboardDiv = document.getElementById('liveLeaderboard');
    leaderboardDiv.innerHTML = data.leaderboard.slice(0, 10).map((player, index) => `
      <div class="glassmorphism rounded-2xl p-4 flex justify-between items-center ${player.name === currentNickname ? 'border-2 border-indigo-500 bg-indigo-50' : ''}">
        <div class="flex items-center gap-3">
          <span class="text-2xl font-bold text-black">#${index + 1}</span>
          <span class="font-semibold text-black">${escapeHtml(player.name)}</span>
        </div>
        <span class="text-2xl font-bold text-indigo-600">${player.score}</span>
      </div>
    `).join('');

    // Update player rank
    const playerRank = data.leaderboard.findIndex(p => p.name === currentNickname) + 1;
    document.getElementById('playerRank').textContent = playerRank > 0 ? `#${playerRank}` : '-';
  });

  // Question timeout - show correct answer and feedback
  socket.on('question-timeout', (data) => {
    console.log(`⏰ Client received question-timeout:`, data);

    const resultsDiv = document.getElementById('resultsMessage');
    if (resultsDiv) {
      const answerLetter = String.fromCharCode(65 + data.correctAnswer);
      resultsDiv.className = 'glassmorphism border-l-4 border-blue-500 text-blue-700 p-4 rounded-lg font-semibold text-lg';
      resultsDiv.innerHTML = `
        <div>Correct Answer: <strong>${answerLetter}</strong></div>
        <div class="text-sm mt-2 text-blue-600">${escapeHtml(data.correctOption || '')}</div>
      `;
      resultsDiv.classList.remove('hidden');
    }

    // Update local player score from leaderboard
    const playerData = data.leaderboard.find(p => p.name === currentNickname);
    if (playerData) {
      playerScore = playerData.score;
      document.getElementById('playerScore').textContent = playerScore;
      console.log(`💰 Updated player score to: ${playerScore}`);
    } else {
      console.warn(`⚠️ Player ${currentNickname} not found in leaderboard:`, data.leaderboard);
    }

    // Update leaderboard
    const leaderboardDiv = document.getElementById('liveLeaderboard');
    leaderboardDiv.innerHTML = data.leaderboard.slice(0, 10).map((player, index) => `
      <div class="glassmorphism rounded-2xl p-4 flex justify-between items-center ${player.name === currentNickname ? 'border-2 border-indigo-500 bg-indigo-50' : ''}">
        <div class="flex items-center gap-3">
          <span class="text-2xl font-bold text-black">#${index + 1}</span>
          <span class="font-semibold text-black">${escapeHtml(player.name)}</span>
        </div>
        <span class="text-2xl font-bold text-indigo-600">${player.score}</span>
      </div>
    `).join('');

    // Update player rank
    const playerRank = data.leaderboard.findIndex(p => p.name === currentNickname) + 1;
    document.getElementById('playerRank').textContent = playerRank > 0 ? `#${playerRank}` : '-';
  });

  // Quiz ended
  socket.on('quiz-ended', (data) => {
    console.log('🎉 Quiz ended event received:', data);
    console.log('📊 Current game state:', { playerId, currentNickname, currentQuizId, playerScore, gameSessionId });
    clearInterval(countdownInterval);
    clearInterval(pointsDecayInterval);
    
    document.getElementById('finalScore').textContent = playerScore;
    
    const finalLeaderboardDiv = document.getElementById('finalLeaderboard');
    finalLeaderboardDiv.innerHTML = data.leaderboard.map((player, index) => `
      <div class="glassmorphism rounded-2xl p-4 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <span class="text-2xl font-bold text-black">#${index + 1}</span>
          <span class="font-semibold text-black">${escapeHtml(player.name)}</span>
        </div>
        <span class="text-2xl font-bold text-indigo-600">${player.score}</span>
      </div>
    `).join('');

    showPhase('results');
    stopBackgroundMusic();
    
    // Save score to Firebase
    saveScore();
  });

  // Error handler
  socket.on('error', (data) => {
    alert('Error: ' + data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });
}

// Start countdown with point decay
function startCountdownWithPointDecay(seconds) {
  let remaining = seconds;
  const countdownDiv = document.getElementById('countdown');
  countdownDiv.textContent = remaining;

  clearInterval(countdownInterval);
  clearInterval(pointsDecayInterval);

  // Points decay over time (reduced speed)
  pointsDecayInterval = setInterval(() => {
    maxPointsAvailable = Math.max(50, maxPointsAvailable - (1000 / seconds) / 2);
    document.getElementById('pointsAvailable').textContent = Math.round(maxPointsAvailable);
    
    const percentage = (maxPointsAvailable / 1000) * 100;
    document.getElementById('pointsBar').style.width = percentage + '%';
  }, 100);

  // Countdown timer
  countdownInterval = setInterval(() => {
    remaining--;
    countdownDiv.textContent = remaining;

    if (remaining <= 0) {
      clearInterval(countdownInterval);
      clearInterval(pointsDecayInterval);
      // Re-enable submit with 0 points if not answered
      if (!hasAnsweredQuestion) {
        submitAnswer(-1); // Submit incorrect answer
      }
    }
  }, 1000);
}

// Show phase
function showPhase(phase) {
  gamePhase = phase;
  document.getElementById('joinPhase').classList.toggle('hidden', phase !== 'join');
  document.getElementById('waitingPhase').classList.toggle('hidden', phase !== 'waiting');
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
window.joinGame = joinGame;
window.submitAnswer = submitAnswer;
window.goHome = goHome;
