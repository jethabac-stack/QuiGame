// Firebase Configuration and Initialization (Client-side)
// Using Firebase SDK v9+ with modular approach

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDz2btltqYoJTUPlGpkAsJE7JiatPhMn2E",
  authDomain: "quiz-game-38d87.firebaseapp.com",
  projectId: "quiz-game-38d87",
  storageBucket: "quiz-game-38d87.firebasestorage.app",
  messagingSenderId: "93000647779",
  appId: "1:93000647779:web:6e25e8f03ab96fa5222456",
  measurementId: "G-GCMZN07HFF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// ========== AUTHENTICATION FUNCTIONS ==========

/**
 * Register a new host
 * @param {string} email - Host email
 * @param {string} password - Host password
 * @param {string} displayName - Host display name
 * @returns {Promise<Object>} - User object with uid
 */
export async function registerHost(email, password, displayName) {
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Call backend to store user data in Firestore
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return user;
  } catch (error) {
    console.error('Registration error:', error.message);
    throw error;
  }
}

/**
 * Login an existing host
 * @param {string} email - Host email
 * @param {string} password - Host password
 * @returns {Promise<Object>} - User object with uid and token
 */
export async function loginHost(email, password) {
  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Get ID token for backend requests
    const token = await user.getIdToken();

    // Call backend to verify user
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();

    return { 
      user,
      uid: user.uid,
      email: user.email,
      token: token,
      userData: data.userData
    };
  } catch (error) {
    console.error('Login error:', error.message);
    throw error;
  }
}

/**
 * Logout the current user
 * @returns {Promise<void>}
 */
export async function logoutHost() {
  try {
    await signOut(auth);
    localStorage.removeItem('firebaseToken');
  } catch (error) {
    console.error('Logout error:', error.message);
    throw error;
  }
}

/**
 * Get current user
 * @returns {Object|null} - Current user object or null
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Monitor authentication state changes
 * @param {Function} callback - Callback function(user)
 * @returns {Function} - Unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ========== QUIZ MANAGEMENT FUNCTIONS ==========

/**
 * Create a new quiz
 * @param {Object} quizData - Quiz data object
 * @param {string} token - Firebase ID token
 * @returns {Promise<Object>} - Created quiz with ID
 */
export async function createQuiz(quizData, token) {
  try {
    const response = await fetch('/api/firebase/quizzes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(quizData)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return await response.json();
  } catch (error) {
    console.error('Create quiz error:', error.message);
    throw error;
  }
}

/**
 * Get all quizzes created by the host
 * @param {string} token - Firebase ID token
 * @returns {Promise<Array>} - Array of quiz objects
 */
export async function getHostQuizzes(token) {
  try {
    const response = await fetch('/api/firebase/quizzes', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    return data.quizzes;
  } catch (error) {
    console.error('Get quizzes error:', error.message);
    throw error;
  }
}

/**
 * Get a specific quiz by ID
 * @param {string} quizId - Quiz ID
 * @param {string} token - Firebase ID token
 * @returns {Promise<Object>} - Quiz object
 */
export async function getQuiz(quizId, token) {
  try {
    const response = await fetch(`/api/firebase/quizzes/${quizId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      const message = data?.error || data?.message || text || 'Failed to load quiz';
      throw new Error(message);
    }

    return data?.quiz;
  } catch (error) {
    console.error('Get quiz error:', error.message);
    throw error;
  }
}

/**
 * Update a quiz
 * @param {string} quizId - Quiz ID
 * @param {Object} updateData - Data to update
 * @param {string} token - Firebase ID token
 * @returns {Promise<Object>} - Updated quiz
 */
export async function updateQuiz(quizId, updateData, token) {
  try {
    const response = await fetch(`/api/firebase/quizzes/${quizId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return await response.json();
  } catch (error) {
    console.error('Update quiz error:', error.message);
    throw error;
  }
}

/**
 * Delete a quiz
 * @param {string} quizId - Quiz ID
 * @param {string} token - Firebase ID token
 * @returns {Promise<Object>} - Success response
 */
export async function deleteQuiz(quizId, token) {
  try {
    const response = await fetch(`/api/firebase/quizzes/${quizId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return await response.json();
  } catch (error) {
    console.error('Delete quiz error:', error.message);
    throw error;
  }
}

/**
 * Publish a quiz
 * @param {string} quizId - Quiz ID
 * @param {string} token - Firebase ID token
 * @returns {Promise<Object>} - Success response
 */
export async function publishQuiz(quizId, token) {
  try {
    const response = await fetch(`/api/firebase/quizzes/${quizId}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return await response.json();
  } catch (error) {
    console.error('Publish quiz error:', error.message);
    throw error;
  }
}

// ========== PLAYER SCORE FUNCTIONS ==========

/**
 * Save a player's score
 * @param {Object} scoreData - Score data object
 * @returns {Promise<Object>} - Success response
 */
export async function savePlayerScore(scoreData) {
  try {
    const response = await fetch('/api/firebase/scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scoreData)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return await response.json();
  } catch (error) {
    console.error('Save score error:', error.message);
    throw error;
  }
}

/**
 * Get player's scores
 * @param {string} playerId - Player ID
 * @returns {Promise<Object>} - Player object with all scores
 */
export async function getPlayerScores(playerId) {
  try {
    const response = await fetch(`/api/firebase/scores/${playerId}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    return data.player;
  } catch (error) {
    console.error('Get player scores error:', error.message);
    throw error;
  }
}

/**
 * Get quiz leaderboard
 * @param {string} quizId - Quiz ID
 * @returns {Promise<Array>} - Array of top scores
 */
export async function getQuizLeaderboard(quizId) {
  try {
    const response = await fetch(`/api/firebase/quizzes/${quizId}/leaderboard`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    return data.leaderboard;
  } catch (error) {
    console.error('Get leaderboard error:', error.message);
    throw error;
  }
}

console.log('✓ Firebase configuration loaded successfully');
