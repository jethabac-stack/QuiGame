#!/usr/bin/env node

/**
 * Firebase Firestore Collection Setup Script
 * This script initializes all required Firestore collections with proper structure
 * Run this ONCE to set up your database
 */

require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
const serviceAccountInput = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
let serviceAccount = null;

if (!serviceAccountInput) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not defined in .env');
}

if (serviceAccountInput.trim().startsWith('{')) {
  serviceAccount = JSON.parse(serviceAccountInput);
  console.log('✓ Loaded service account from .env inline JSON');
} else {
  const serviceAccountPath = path.join(__dirname, '..', serviceAccountInput);
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  console.log('✓ Loaded service account from file:', serviceAccountPath);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});

const db = admin.firestore();

// Collection setup data
const collections = {
  users: {
    docId: 'template',
    data: {
      email: 'test@example.com',
      displayName: 'Test Host',
      userType: 'host',
      createdAt: admin.firestore.Timestamp.now(),
      stats: {
        totalQuizzesCreated: 0,
        totalGamesHosted: 0
      }
    }
  },
  quizzes: {
    docId: 'template',
    data: {
      title: 'Sample Quiz',
      description: 'This is a sample quiz template',
      hostId: 'host123',
      questions: [
        {
          id: 0,
          text: 'What is the capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Madrid'],
          correctAnswer: 0,
          timer: 30
        }
      ],
      settings: { timeLimit: 30, shuffle: false },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isPublished: false,
      stats: {
        timesPlayed: 0,
        totalPlayers: 0,
        averageScore: 0
      }
    }
  },
  players: {
    docId: 'player123',
    data: {
      playerId: 'player123',
      playerName: 'Sample Player',
      createdAt: admin.firestore.Timestamp.now(),
      scores: [
        {
          quizId: 'quiz123',
          score: 85,
          gameSessionId: 'session123',
          timestamp: admin.firestore.Timestamp.now()
        }
      ]
    }
  },
  gameScores: {
    docId: 'score123',
    data: {
      playerId: 'player123',
      playerName: 'Sample Player',
      quizId: 'quiz123',
      score: 85,
      gameSessionId: 'session123',
      timestamp: admin.firestore.Timestamp.now()
    }
  }
};

async function setupCollections() {
  console.log('🚀 Starting Firestore setup...\n');

  try {
    for (const [collectionName, collectionData] of Object.entries(collections)) {
      console.log(`📝 Setting up collection: ${collectionName}`);

      const docRef = db.collection(collectionName).doc(collectionData.docId);
      await docRef.set(collectionData.data);

      console.log(`   ✓ Template document created: ${collectionData.docId}`);
    }

    console.log('\n✅ Firestore setup completed successfully!');
    console.log('\n📊 Collections created:');
    console.log('   • users - Host account data');
    console.log('   • quizzes - Quiz information and questions');
    console.log('   • players - Player profiles and score history');
    console.log('   • gameScores - Game session scores for leaderboards');

    console.log('\n⚠️  Important: Delete the template documents before going to production!');
    console.log('   Templates are for reference only.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up collections:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify serviceAccountKey.json exists in project root');
    console.error('2. Check .env file has correct FIREBASE_PROJECT_ID');
    console.error('3. Ensure Firebase Firestore is enabled in Console');
    process.exit(1);
  }
}

setupCollections();
