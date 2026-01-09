import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAXI0DNhc_d-X0b8vJSCe_nDg5iLcsdRXo",
    authDomain: "unionconnect-8f64e.firebaseapp.com",
    projectId: "unionconnect-8f64e",
    storageBucket: "unionconnect-8f64e.firebasestorage.app",
    messagingSenderId: "751188109510",
    appId: "1:751188109510:web:9cac105a08fd58a6c10fc7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
