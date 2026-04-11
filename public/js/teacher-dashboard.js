// Teacher Dashboard JavaScript
let quizzes = [];
let editingQuizId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadQuizzes();
  document.getElementById('quizForm').addEventListener('submit', handleFormSubmit);
});

// Load all quizzes from server
async function loadQuizzes() {
  try {
    const response = await fetch('/api/quizzes');
    quizzes = await response.json();
    displayQuizzes();
  } catch (error) {
    console.error('Error loading quizzes:', error);
    showError('Failed to load quizzes');
  }
}

// Display quizzes in UI
function displayQuizzes() {
  const quizList = document.getElementById('quizList');
  
  if (quizzes.length === 0) {
    quizList.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 text-lg">📭 No quizzes yet. Create your first quiz!</p></div>';
    return;
  }

  quizList.innerHTML = quizzes.map(quiz => `
    <div class="quiz-card bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-600 hover:shadow-2xl">
      <div class="flex justify-between items-start mb-4">
        <div class="flex-1">
          <h3 class="text-2xl font-bold text-gray-800 mb-2">${quiz.title}</h3>
          <div class="space-y-1 text-gray-600">
            <p class="flex items-center gap-2"><span class="text-xl">📚</span> <strong>${quiz.questions.length}</strong> questions</p>
            <p class="flex items-center gap-2"><span class="text-xl">👨‍🏫</span> ${quiz.teacher || 'Unknown Teacher'}</p>
            <p class="text-sm text-gray-400 mt-2">ID: ${quiz.id.substring(0, 8)}...</p>
          </div>
        </div>
      </div>

      <div class="flex gap-2 flex-wrap pt-4 border-t-2 border-gray-100">
        <button class="btn-crud flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg" onclick="editQuiz('${quiz.id}')">
          ✏️ Edit
        </button>
        <button class="btn-crud flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg" onclick="hostQuiz('${quiz.id}')">
          🎮 Host
        </button>
        <button class="btn-crud flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg" onclick="deleteQuiz('${quiz.id}')">
          🗑️ Delete
        </button>
      </div>
    </div>
  `).join('');
}

// Open new quiz form
function openNewQuizForm() {
  editingQuizId = null;
  document.getElementById('formTitle').textContent = 'Create New Quiz';
  document.getElementById('quizForm').reset();
  document.getElementById('questionsContainer').innerHTML = '';
  addQuestion();
  document.getElementById('quizFormModal').classList.remove('hidden');
}

// Close quiz form
function closeQuizForm() {
  document.getElementById('quizFormModal').classList.add('hidden');
  editingQuizId = null;
}

// Add question to form
function addQuestion() {
  const container = document.getElementById('questionsContainer');
  const questionIndex = container.children.length;
  
  const questionCard = document.createElement('div');
  questionCard.className = 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-6 mb-4 space-y-4 shadow-sm';
  questionCard.innerHTML = `
    <div class="flex justify-between items-center pb-4 border-b-2 border-indigo-300">
      <span class="text-lg font-bold text-indigo-600 flex items-center gap-2">
        <span class="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">${questionIndex + 1}</span>
        Question ${questionIndex + 1}
      </span>
      <button type="button" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 shadow-md" onclick="removeQuestion(this)">
        🗑️ Remove
      </button>
    </div>

    <div class="space-y-2">
      <label class="block text-gray-700 font-semibold">Question Text *</label>
      <textarea class="question-text w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition resize-none" rows="2" required placeholder="Enter your question here..."></textarea>
    </div>

    <div>
      <label class="block text-gray-700 font-semibold mb-3">Answer Options * (Select correct answer)</label>
      <div class="options-container space-y-2" data-question-index="${questionIndex}">
        ${[0, 1, 2, 3].map(i => `
          <div class="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition">
            <input type="radio" name="correct-${questionIndex}" value="${i}" ${i === 0 ? 'checked' : ''} class="w-5 h-5 cursor-pointer">
            <label class="flex-1 flex items-center gap-2">
              <span class="bg-indigo-600 text-white font-bold rounded px-2 py-1 text-sm w-8 h-8 flex items-center justify-center">${String.fromCharCode(65 + i)}</span>
              <input type="text" class="option-text flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-200" placeholder="Option ${String.fromCharCode(65 + i)}" required>
            </label>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="space-y-2">
      <label class="block text-gray-700 font-semibold">Time Limit (seconds) *</label>
      <input type="number" class="question-timer w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition" min="5" max="60" value="10" required>
    </div>
  `;

  container.appendChild(questionCard);
}

// Remove question from form
function removeQuestion(button) {
  button.closest('.question-card').remove();
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('quizTitle').value;
  const teacher = document.getElementById('teacherName').value || 'Unknown Teacher';
  
  const questions = Array.from(document.querySelectorAll('.question-card')).map(card => {
    const text = card.querySelector('.question-text').value;
    const options = Array.from(card.querySelectorAll('.option-text')).map(input => input.value);
    const correct = parseInt(card.querySelector('input[type="radio"]:checked').value);
    const timer = parseInt(card.querySelector('.question-timer').value);

    return { text, options, correct, timer };
  });

  const quizData = { title, teacher, questions };

  try {
    let response;
    if (editingQuizId) {
      response = await fetch(`/api/quizzes/${editingQuizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizData)
      });
    } else {
      response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizData)
      });
    }

    if (!response.ok) {
      throw new Error('Failed to save quiz');
    }

    closeQuizForm();
    loadQuizzes();
    showSuccess(editingQuizId ? 'Quiz updated!' : 'Quiz created!');
  } catch (error) {
    console.error('Error saving quiz:', error);
    showError('Failed to save quiz');
  }
}

// Edit quiz
async function editQuiz(quizId) {
  const quiz = quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  editingQuizId = quizId;
  document.getElementById('formTitle').textContent = 'Edit Quiz';
  document.getElementById('quizTitle').value = quiz.title;
  document.getElementById('teacherName').value = quiz.teacher;

  const container = document.getElementById('questionsContainer');
  container.innerHTML = '';

  quiz.questions.forEach((question, index) => {
    addQuestion();
    const card = container.children[index];
    card.querySelector('.question-text').value = question.text;
    question.options.forEach((option, optionIndex) => {
      card.querySelectorAll('.option-text')[optionIndex].value = option;
    });
    card.querySelector(`input[type="radio"][value="${question.correct}"]`).checked = true;
    card.querySelector('.question-timer').value = question.timer;
  });

  document.getElementById('quizFormModal').classList.remove('hidden');
}

// Delete quiz
async function deleteQuiz(quizId) {
  if (!confirm('Are you sure you want to delete this quiz?')) return;

  try {
    const response = await fetch(`/api/quizzes/${quizId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete quiz');
    
    loadQuizzes();
    showSuccess('Quiz deleted!');
  } catch (error) {
    console.error('Error deleting quiz:', error);
    showError('Failed to delete quiz');
  }
}

// Host quiz
function hostQuiz(quizId) {
  // Redirect to host page with quiz ID
  window.location.href = `/teacher/host?key=quiz123&quizId=${quizId}`;
}

// Notification functions
function showSuccess(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slideInDown z-50';
  notification.innerHTML = `<span class="flex items-center gap-2"><span>✓</span> ${message}</span>`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideInDown 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

function showError(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slideInDown z-50';
  notification.innerHTML = `<span class="flex items-center gap-2"><span>✗</span> ${message}</span>`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideInDown 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
