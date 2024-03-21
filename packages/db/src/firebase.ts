import admin from "firebase-admin"
import { Bucket } from "@google-cloud/storage"

import { getConfig } from "utils/dist/config"

const vitalKeys = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"] as const
const config = getConfig({ vitalKeys, nonVitalKeys: [] as const })

const { firebaseProjectId, firebaseClientEmail, firebasePrivateKey } = config

// set env variable FIRESTORE_EMULATOR_HOST to use firebase emulator

// Firebase config for web api (not needed for firebase-admin)
// const firebaseConfig = {
//   apiKey: FIREBASE_API_KEY,
//   authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
//   projectId: FIREBASE_PROJECT_ID,
//   storageBucket: `${FIREBASE_PROJECT_ID}.appspot.com`,
//   messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
//   appId: FIREBASE_APP_ID,
//   measurementId: FIREBASE_MEASUREMENT_ID,
// }

if (!admin.apps.length) {
  try {
    console.log("initializing firebase admin...")
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseProjectId,
        clientEmail: firebaseClientEmail,
        privateKey: firebasePrivateKey,
      }),
    })
  } catch (error) {
    console.error("Firebase admin initialization error", error)
  }
}

export const firestore = admin.firestore()
// this function will throw if it is called more than once (ex: when hot-reloading)
try {
  firestore.settings({ ignoreUndefinedProperties: true })
} catch {}

export const storageBucket = admin
  .storage()
  .bucket(`${firebaseProjectId}.appspot.com`) as any as Bucket
