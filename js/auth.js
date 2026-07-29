import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import { auth } from "./firebase.js";

/**
 * Detecta cuando un usuario inicia o cierra sesión.
 */
export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Inicia sesión con correo y contraseña.
 */
export function login(email, password) {
  return signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
}

/**
 * Crea una cuenta nueva para un vendedor.
 */
export function register(email, password) {
  return createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
}

/**
 * Cierra la sesión actual.
 */
export function logout() {
  return signOut(auth);
}

/**
 * Devuelve el usuario conectado actualmente.
 */
export function currentUser() {
  return auth.currentUser;
}