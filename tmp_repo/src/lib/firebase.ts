import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  return await signOut(auth);
};

export const syncUserProfile = async (uid: string, data: any) => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(userRef, {
      ...data,
      targetScore: data.targetScore || 115,
      timeSaved: data.timeSaved || 0,
      cognitiveState: { focus: 50, frustration: 0, joy: 50 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
};

export const updateCognitiveState = async (uid: string, changes: Partial<{focus: number, frustration: number, joy: number}>) => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const currentState = snap.data().cognitiveState || { focus: 50, frustration: 0, joy: 50 };
    await updateDoc(userRef, {
      cognitiveState: { ...currentState, ...changes },
      updatedAt: serverTimestamp()
    });
  }
};

export const getUserProfile = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
};

export const saveErrorRecord = async (uid: string, errorData: any) => {
  const newErrorRef = doc(collection(db, `users/${uid}/errors`));
  await setDoc(newErrorRef, {
    painPoint: errorData.painPoint,
    rule: errorData.rule,
    questionText: errorData.questionText,
    options: errorData.options,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const getActiveErrors = async (uid: string) => {
  const errorsRef = collection(db, `users/${uid}/errors`);
  const q = query(errorsRef, where("status", "==", "active"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const resolveError = async (uid: string, errorId: string) => {
  const errorRef = doc(db, `users/${uid}/errors`, errorId);
  await updateDoc(errorRef, {
    status: 'resolved',
    updatedAt: serverTimestamp()
  });
};

