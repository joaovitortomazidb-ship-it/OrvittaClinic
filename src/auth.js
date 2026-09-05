import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { auth, firebaseConfig } from "./firebase";

export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const register = async (email, password, profile = {}) => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (profile.name) {
    await updateProfile(credential.user, {
      displayName: profile.name
    });
  }

  return credential;
};

export const createEmployeeAccount = async (email, password, name) => {
  const appName = `employee-${Date.now()}`;
  const employeeApp = initializeApp(firebaseConfig, appName);
  const employeeAuth = getAuth(employeeApp);
  try {
    const credential = await createUserWithEmailAndPassword(employeeAuth, email, password);
    if (name) await updateProfile(credential.user, { displayName: name });
    return {
      uid: credential.user.uid,
      email: credential.user.email || email,
      name: name || email.split("@")[0]
    };
  } finally {
    await signOut(employeeAuth).catch(() => {});
  }
};

export const resetPassword = (email) =>
  sendPasswordResetEmail(auth, email);

export const logout = () =>
  auth ? signOut(auth) : Promise.resolve();

export const observeAuth = (callback) => {
  if (auth) return onAuthStateChanged(auth, callback);

  callback({
    uid: "local-demo",
    email: "demo@odontoflow.local"
  });

  return () => {};
};