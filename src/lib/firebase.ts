import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { buildMobiusHeaders } from "./mobius-auth";
import { normalizeCognitiveState, type CompatibleCognitiveState } from "../../shared/cognitive-state";

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
  const payload = data && typeof data === 'object' && 'cognitiveState' in data
    ? { ...data, cognitiveState: normalizeCognitiveState(data.cognitiveState) }
    : data;
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/profile`, {
    method: 'POST',
    headers: await buildMobiusHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('API failed to sync profile');
};

export const updateCognitiveState = async (uid: string, nextState: CompatibleCognitiveState) => {
  if (uid === 'demo-student') return;
  await syncUserProfile(uid, { cognitiveState: normalizeCognitiveState(nextState) });
};

export const getUserProfile = async (uid: string) => {
  if (uid === 'demo-student') return null;
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/profile`, {
    headers: await buildMobiusHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Object.keys(data).length) return null;

  return data.cognitiveState
    ? { ...data, cognitiveState: normalizeCognitiveState(data.cognitiveState) }
    : data;
};

export const saveErrorRecord = async (uid: string, errorData: any) => {
  if (uid === 'demo-student') return;
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/errors`, {
    method: 'POST',
    headers: await buildMobiusHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(errorData)
  });
  if (!res.ok) throw new Error('API failed to save error record');
};

export const getActiveErrors = async (uid: string) => {
  if (uid === 'demo-student') return [];
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/errors`, {
    headers: await buildMobiusHeaders(),
  });
  if (!res.ok) return [];
  const payload = await res.json();
  return payload.items || [];
};

export const resolveError = async (uid: string, errorId: string) => {
  if (uid === 'demo-student') return;
  const res = await fetch(`/api/mobius/students/${encodeURIComponent(uid)}/errors/${encodeURIComponent(errorId)}/resolve`, {
    method: 'PATCH',
    headers: await buildMobiusHeaders(),
  });
  if (!res.ok) throw new Error('API failed to resolve error record');
};
