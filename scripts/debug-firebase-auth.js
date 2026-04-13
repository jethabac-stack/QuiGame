require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const input = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
let serviceAccount;
if (!input) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is missing');
}

if (input.trim().startsWith('{')) {
  serviceAccount = JSON.parse(input);
  console.log('Loaded service account inline JSON');
} else {
  serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '..', input), 'utf8'));
  console.log('Loaded service account from file');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});

console.log('Firebase projectId:', admin.app().options.projectId);

const db = admin.firestore();

admin.auth().listUsers(1)
  .then((result) => {
    console.log('Auth request succeeded; user count:', result.users.length);
  })
  .catch((error) => {
    console.error('Auth request failed:');
    console.error(error);
  })
  .finally(() => {
    db.listCollections()
      .then((collections) => {
        console.log('Firestore request succeeded; collections count:', collections.length);
      })
      .catch((error) => {
        console.error('Firestore request failed:');
        console.error(error);
      })
      .finally(() => {
        process.exit(0);
      });
  });
