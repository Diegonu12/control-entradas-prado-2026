import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { auth } from "./firebase.js";
export function observeAuth(callback){return onAuthStateChanged(auth,callback);}
export function login(email,password){return signInWithEmailAndPassword(auth,email,password);}
export function logout(){return signOut(auth);}
export function currentUser(){return auth.currentUser;}
