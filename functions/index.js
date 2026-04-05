/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');

admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

exports.createAdminUser = onCall(async (request) => {
  // Check if the user is authenticated (Optional but recommended: check if user is a Super Admin)
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { email, password, name, companyName, address, mobileNumber } = request.data;

  if (!email || !password || !name || !companyName || !address || !mobileNumber) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }

  try {
    // 1. Create the user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
    });

    // 2. Save user details and role in Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email: email,
      name: name,
      role: 'Admin',
      companyName: companyName,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 3. Save company details with address and mobile number
    await admin.firestore().collection('companies').add({
      name: companyName,
      email: email, // Save the admin email as the primary contact email for the list
      address: address,
      mobileNumber: mobileNumber,
      adminUid: userRecord.uid,
      status: 'active', // Add a default status for the listing UI
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      message: `Successfully created admin user: ${email}`,
      uid: userRecord.uid
    };
  } catch (error) {
    logger.error("Error creating new admin user:", error);
    throw new HttpsError('internal', error.message || 'An error occurred while creating the admin user.');
  }
});
