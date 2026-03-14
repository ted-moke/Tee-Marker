const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp(); // Will use GOOGLE_APPLICATION_CREDENTIALS

const db = getFirestore();

db.collection('courses').get()
  .then(snapshot => {
    console.log('Success! Documents:', snapshot.size);
    process.exit(0);
  })
  .catch(err => {
    console.error('Firestore error:', err);
    process.exit(1);
  });