// Firebase Configuration
// TODO: Replace these with your actual Firebase project credentials
// Get these from: Firebase Console > Project Settings > General > Your apps > SDK setup and configuration

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage'
const firebaseConfig = {
  apiKey: "AIzaSyBRT7Mx5exTgT370WF1QDw7GnLJ9TGKtxg",
  authDomain: "trustlens-632fa.firebaseapp.com",
  projectId: "trustlens-632fa",
  storageBucket: "trustlens-632fa.firebasestorage.app",
  messagingSenderId: "902327937543",
  appId: "1:902327937543:web:fb7c956fd6ec9d6dd8d8a2",
  measurementId: "G-NHD3CCKKBX"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Firebase Storage 
export const storage = getStorage(app)