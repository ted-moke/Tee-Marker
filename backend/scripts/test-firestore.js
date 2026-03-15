require('dotenv/config');
const admin = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

process.env.FIRESTORE_PREFER_REST = 'true';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountKey) {
  console.error('FATAL: FIREBASE_SERVICE_ACCOUNT_KEY env var is not set');
  process.exit(1);
}

let parsedKey;
try {
  if (serviceAccountKey.trim().startsWith('{')) {
    parsedKey = JSON.parse(serviceAccountKey.replace(/\\n/g, '\n'));
  } else {
    parsedKey = JSON.parse(fs.readFileSync(serviceAccountKey, 'utf8'));
  }
} catch (err) {
  console.error('FATAL: FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON or a readable file path:', err);
  process.exit(1);
}

try {
  initializeApp({ credential: admin.credential.cert(parsedKey) });
} catch (err) {
  console.error('FATAL: Firebase initializeApp failed:', err);
  process.exit(1);
}

const db = getFirestore();

db.collection('courses')
  .get()
  .then((snapshot) => {
    console.log('Success! Documents:', snapshot.size);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Firestore error:', err);
    process.exit(1);
  });