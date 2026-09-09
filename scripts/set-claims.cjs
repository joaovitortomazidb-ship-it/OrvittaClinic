// scripts/set-claims.js
// This script runs locally and uses the Firebase Admin SDK to ensure every Firebase user
// has a custom claim "role": "authenticated". Existing custom claims are preserved.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Initialize the Admin SDK using Application Default Credentials.
initializeApp({
  credential: applicationDefault()
});

const auth = getAuth();

async function assignAuthenticatedRole() {
  let nextPageToken = undefined;
  let updatedCount = 0;
  try {
    do {
      const listResult = await auth.listUsers(1000, nextPageToken);
      const promises = listResult.users.map(async (userRecord) => {
        const existingClaims = userRecord.customClaims || {};
        // If the role claim is already present, do nothing.
        if (existingClaims.role === 'authenticated') return;
        const newClaims = { ...existingClaims, role: 'authenticated' };
        await auth.setCustomUserClaims(userRecord.uid, newClaims);
        updatedCount++;
      });
      await Promise.all(promises);
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);
    console.log(`✅ Updated ${updatedCount} user(s) with role "authenticated"`);
  } catch (error) {
    console.error('Error while assigning claims:', error);
    process.exit(1);
  }
}

assignAuthenticatedRole();
