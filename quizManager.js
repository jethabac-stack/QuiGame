const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class QuizManager {
  constructor() {
    this.quizzesDir = path.join(__dirname, 'quizzes');
    
    // Ensure quizzes directory exists
    if (!fs.existsSync(this.quizzesDir)) {
      fs.mkdirSync(this.quizzesDir, { recursive: true });
    }
  }

  // Get all quizzes
  getAllQuizzes() {
    try {
      const files = fs.readdirSync(this.quizzesDir);
      const quizzes = [];

      files.forEach(file => {
        if (file.endsWith('.json')) {
          try {
            const content = fs.readFileSync(path.join(this.quizzesDir, file), 'utf-8');
            quizzes.push(JSON.parse(content));
          } catch (error) {
            console.error(`Error reading quiz file ${file}:`, error);
          }
        }
      });

      return quizzes;
    } catch (error) {
      console.error('Error reading quizzes directory:', error);
      return [];
    }
  }

  // Get single quiz by ID
  getQuiz(quizId) {
    try {
      const filePath = path.join(this.quizzesDir, `${quizId}.json`);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading quiz ${quizId}:`, error);
      return null;
    }
  }

  // Create new quiz
  createQuiz(quizData) {
    try {
      // Validate quiz data
      if (!quizData.title) {
        throw new Error('Quiz must have a title');
      }
      if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) {
        throw new Error('Quiz must have at least one question');
      }

      // Validate questions
      quizData.questions.forEach((question, index) => {
        if (!question.text) {
          throw new Error(`Question ${index + 1} must have text`);
        }
        if (!Array.isArray(question.options) || question.options.length < 2) {
          throw new Error(`Question ${index + 1} must have at least 2 options`);
        }
        if (question.correct === undefined || question.correct === null) {
          throw new Error(`Question ${index + 1} must specify correct answer`);
        }
        if (question.timer === undefined || question.timer < 5 || question.timer > 30) {
          throw new Error(`Question ${index + 1} timer must be between 5-30 seconds`);
        }
      });

      // Create quiz object
      const quiz = {
        id: uuidv4(),
        title: quizData.title,
        teacher: quizData.teacher || 'Unknown',
        createdAt: new Date().toISOString(),
        questions: quizData.questions
      };

      // Save to file
      const filePath = path.join(this.quizzesDir, `${quiz.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(quiz, null, 2), 'utf-8');

      return quiz;
    } catch (error) {
      throw error;
    }
  }

  // Update quiz
  updateQuiz(quizId, quizData) {
    try {
      const quiz = this.getQuiz(quizId);
      
      if (!quiz) {
        throw new Error('Quiz not found');
      }

      // Validate updated data
      if (quizData.title) {
        quiz.title = quizData.title;
      }
      if (quizData.teacher) {
        quiz.teacher = quizData.teacher;
      }
      if (quizData.questions) {
        quizData.questions.forEach((question, index) => {
          if (!question.text) {
            throw new Error(`Question ${index + 1} must have text`);
          }
          if (!Array.isArray(question.options) || question.options.length < 2) {
            throw new Error(`Question ${index + 1} must have at least 2 options`);
          }
          if (question.correct === undefined || question.correct === null) {
            throw new Error(`Question ${index + 1} must specify correct answer`);
          }
          if (question.timer === undefined || question.timer < 5 || question.timer > 30) {
            throw new Error(`Question ${index + 1} timer must be between 5-30 seconds`);
          }
        });
        quiz.questions = quizData.questions;
      }

      quiz.updatedAt = new Date().toISOString();

      // Save to file
      const filePath = path.join(this.quizzesDir, `${quizId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(quiz, null, 2), 'utf-8');

      return quiz;
    } catch (error) {
      throw error;
    }
  }

  // Delete quiz
  deleteQuiz(quizId) {
    try {
      const filePath = path.join(this.quizzesDir, `${quizId}.json`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('Quiz not found');
      }

      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = QuizManager;
