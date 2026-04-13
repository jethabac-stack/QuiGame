class GameRoom {
  constructor(pin, quiz, teacherName) {
    this.pin = pin;
    this.quiz = quiz;
    this.teacherName = teacherName;
    this.isActive = true;
    this.currentQuestionIndex = -1;
    this.players = new Map(); // Map<playerId, playerData>
    this.scores = new Map(); // Map<playerId, score>
    this.answers = new Map(); // Map<playerId, answersPerQuestion>
    this.questionAnswers = new Map(); // Track who answered each question
  }

  // Add player to room
  addPlayer(playerId, nickname) {
    this.players.set(playerId, {
      id: playerId,
      nickname,
      joinedAt: new Date()
    });
    this.scores.set(playerId, 0);
    this.answers.set(playerId, new Set());
  }

  // Remove player from room
  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  // Get all players
  getPlayers() {
    return Array.from(this.players.values());
  }

  // Show a specific question
  showQuestion(questionIndex) {
    this.currentQuestionIndex = questionIndex;
    if (!this.questionAnswers.has(questionIndex)) {
      this.questionAnswers.set(questionIndex, new Set());
    }
  }

  // Get current question
  getCurrentQuestion() {
    if (this.currentQuestionIndex < 0 || this.currentQuestionIndex >= this.quiz.questions.length) {
      return null;
    }
    const question = this.quiz.questions[this.currentQuestionIndex];
    return {
      text: question.text,
      options: question.options,
      timer: question.timer
    };
  }

  // Check if player has answered current question
  hasAnswered(playerId) {
    const answeredQuestions = this.answers.get(playerId) || new Set();
    return answeredQuestions.has(this.currentQuestionIndex);
  }

  // Record player answer
  recordAnswer(playerId, answer, score, isCorrect) {
    // Mark as answered
    const answeredQuestions = this.answers.get(playerId);
    if (answeredQuestions) {
      answeredQuestions.add(this.currentQuestionIndex);
    }

    // Update score
    const currentScore = this.scores.get(playerId) || 0;
    this.scores.set(playerId, currentScore + score);
    
    console.log(`🎯 recordAnswer - PlayerId: ${playerId}, Score: ${score}, Total: ${currentScore + score}`);

    // Track who answered this question
    const questionAnswerers = this.questionAnswers.get(this.currentQuestionIndex) || new Set();
    questionAnswerers.add(playerId);
    this.questionAnswers.set(this.currentQuestionIndex, questionAnswerers);
  }

  // Get top scores
  getTopScores(limit = 5) {
    const topScores = Array.from(this.scores.entries())
      .map(([playerId, score]) => ({
        name: this.players.get(playerId)?.nickname || 'Unknown',
        score,
        playerId
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    console.log(`📊 getTopScores - Returning:`, topScores);
    return topScores;
  }

  // Get all scores
  getAllScores() {
    return Array.from(this.scores.entries())
      .map(([playerId, score]) => ({
        name: this.players.get(playerId)?.nickname || 'Unknown',
        score,
        playerId
      }))
      .sort((a, b) => b.score - a.score);
  }

  // Get final leaderboard
  getFinalLeaderboard() {
    return this.getAllScores();
  }

  // Get winner
  getWinner() {
    const topScores = this.getTopScores(1);
    return topScores.length > 0 ? topScores[0] : null;
  }

  // End game
  endGame() {
    this.isActive = false;
  }
}

module.exports = GameRoom;
