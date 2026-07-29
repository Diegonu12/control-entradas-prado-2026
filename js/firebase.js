import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyC2Kt1EiycdXjpa8HSpZwTJTOatUpvGkSPc",
  authDomain: "control-entradas-prado-2026.firebaseapp.com",
  projectId: "control-entradas-prado-2026",
  storageBucket: "control-entradas-prado-2026.firebasestorage.app",
  messagingSenderId: "197596982165",
  appId: "1:197596982165:web:ada01d3f1486027f75a49c",
  measurementId: "G-Y6D31EQQ1N"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
