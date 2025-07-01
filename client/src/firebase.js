import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBX66q8mwaoDoTJ7yGU55X22fQZM0vKfgE",
  authDomain: "ai-app-taskforce.firebaseapp.com",
  projectId: "ai-app-taskforce",
  storageBucket: "ai-app-taskforce.firebasestorage.app",
  messagingSenderId: "107659590739",
  appId: "1:107659590739:web:411219977842fa81621aa6",
  measurementId: "G-LRPSQG5XHL"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
