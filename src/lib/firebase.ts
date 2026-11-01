import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { initializeFirestore, doc, onSnapshot, setDoc, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress internal Firestore connection warnings in the preview environment
setLogLevel('silent');

const app = initializeApp(firebaseConfig);
// @ts-ignore
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const login = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Subscribe to config score
export const subscribeToScore = (callback: (score: number, target: number) => void) => {
  return onSnapshot(doc(db, 'config', 'main'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data.score || 0, data.target || 60000000);
    } else {
      callback(0, 60000000); // Default if not exists
    }
  }, (error) => {
    console.error("Firestore Error:", error);
  });
};

export const updateScore = async (score: number) => {
  await setDoc(doc(db, 'config', 'main'), { score, target: 60000000 }, { merge: true });
};
