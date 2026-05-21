"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "./client";

type AuthState = {
  user: FirebaseUser | null;
  idToken: string | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  signInEmail: (email: string, password: string) => Promise<FirebaseUser>;
  signUpEmail: (email: string, password: string) => Promise<FirebaseUser>;
  signInWithGoogle: () => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
  forceRefreshToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    idToken: null,
    loading: true,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        setState({ user, idToken, loading: false });
      } else {
        setState({ user: null, idToken: null, loading: false });
      }
    });
    return () => unsub();
  }, []);

  const signInEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const signUpEmail = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  /**
   * Custom Claims 갱신 후 토큰 강제 재발급.
   * init-user 호출 직후 role/hospitalId/vendorId를 즉시 반영하기 위해 사용.
   */
  const forceRefreshToken = async (): Promise<string> => {
    if (!auth.currentUser) throw new Error("Not signed in");
    const token = await auth.currentUser.getIdToken(true);
    setState((s) => ({ ...s, idToken: token }));
    return token;
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInEmail,
        signUpEmail,
        signInWithGoogle,
        signOut,
        forceRefreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
