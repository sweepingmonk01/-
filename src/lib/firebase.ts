import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
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
  if (uid === 'demo-student') return;
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('API failed to sync profile');
};

export const updateCognitiveState = async (uid: string, changes: Partial<{focus: number, frustration: number, joy: number}>) => {
  if (uid === 'demo-student') return;
  const profile = await getUserProfile(uid);
  if (profile) {
    const currentState = profile.cognitiveState || { focus: 50, frustration: 0, joy: 50 };
    await syncUserProfile(uid, { cognitiveState: { ...currentState, ...changes } });
  }
};

export const getUserProfile = async (uid: string) => {
  if (uid === 'demo-student') return null;
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/profile`);
  if (!res.ok) return null;
  const data = await res.json();
  return Object.keys(data).length > 0 ? data : null;
};

export const saveErrorRecord = async (uid: string, errorData: any) => {
  if (uid === 'demo-student') return;
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorData)
  });
  if (!res.ok) throw new Error('API failed to save error record');
};

export const getActiveErrors = async (uid: string) => {
  if (uid === 'demo-student') return [];
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/errors`);
  if (!res.ok) return [];
  const payload = await res.json();
  return payload.items || [];
};

export const resolveError = async (uid: string, errorId: string) => {
  if (uid === 'demo-student') return;
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/errors/${encodeURIComponent(errorId)}/resolve`, {
    method: 'PATCH'
  });
  if (!res.ok) throw new Error('API failed to resolve error record');
};

