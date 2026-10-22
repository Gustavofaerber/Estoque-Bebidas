// ==========================================================================
// CONFIGURAÇÃO FIREBASE & FIRESTORE (COM PERSISTÊNCIA OFFLINE SEGURA)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
    getFirestore,
    collection,
    onSnapshot,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    enableIndexedDbPersistence,
    increment,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA0z0EPQjYIO4u3cJwQ2RsrEKfb9vmh9bc",
    authDomain: "estoque-bebidas-do-trem.firebaseapp.com",
    projectId: "estoque-bebidas-do-trem",
    storageBucket: "estoque-bebidas-do-trem.firebasestorage.app",
    messagingSenderId: "39050841748",
    appId: "1:39050841748:web:d3778526f2bc33acd8ee81"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Trata corretamente a Promise de persistência offline para evitar erros em múltiplas abas
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.info("Persistência offline: múltiplas abas abertas (ativa na aba principal).");
    } else if (err.code === 'unimplemented') {
        console.info("Persistência offline não suportada neste navegador.");
    }
});

export {
    collection,
    onSnapshot,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    increment,
    writeBatch
};
