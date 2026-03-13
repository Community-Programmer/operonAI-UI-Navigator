import { useCallback, useSyncExternalStore } from "react";

const TOKEN_KEY = "ui-nav-token";
const USER_KEY = "ui-nav-user";

// Simple external store so every consumer re-renders on auth change.
let listeners: Array<() => void> = [];
function subscribe(cb: () => void) {
  listeners = [...listeners, cb];
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
function emitChange() {
  listeners.forEach((l) => l());
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function getUserId() {
  return localStorage.getItem(USER_KEY);
}

export function useAuth() {
  const token = useSyncExternalStore(subscribe, getToken, () => null);
  const userId = useSyncExternalStore(subscribe, getUserId, () => null);

  const setAuth = useCallback((t: string, uid: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, uid);
    emitChange();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    emitChange();
  }, []);

  return { token, userId, isLoggedIn: !!token, setAuth, logout };
}
