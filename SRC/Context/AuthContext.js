import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  deleteMe,
  fetchMe,
  isBackendConfigured,
  loginUser,
  registerUser,
  updateMe,
} from '../services/authApi';
import { clearSession, getStoredToken, getStoredUser, saveSession } from '../services/authStorage';
import {
  resumeWatchingIfPending,
  stopWatching,
  subscribePaymentVerified,
} from '../services/pendingPaymentAutoVerify';
import { setPointsBalanceHandler } from '../services/pointsBridge';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pointsEnabled, setPointsEnabled] = useState(true);

  const backendRequired = isBackendConfigured();

  const hydrate = useCallback(async () => {
    if (!backendRequired) {
      setLoading(false);
      return;
    }
    try {
      const storedToken = await getStoredToken();
      const storedUser = await getStoredUser();
      if (!storedToken) {
        setLoading(false);
        return;
      }
      setToken(storedToken);
      setUser(storedUser);
      const me = await fetchMe();
      setUser(me.user);
      setPointsEnabled(me.pointsEnabled !== false);
    } catch {
      await clearSession();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [backendRequired]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setPointsBalanceHandler((balance) => {
      setUser((prev) => (prev ? { ...prev, pointsBalance: balance } : prev));
    });
    return () => setPointsBalanceHandler(null);
  }, []);

  useEffect(() => {
    if (!token) {
      stopWatching();
      return undefined;
    }

    resumeWatchingIfPending();

    const unsub = subscribePaymentVerified(async (result) => {
      setUser((prev) => (prev ? { ...prev, pointsBalance: result.balance } : prev));
      try {
        const me = await fetchMe();
        setUser(me.user);
        if (token) await saveSession(token, me.user);
      } catch {
        /* balance already updated from verify response */
      }
      Alert.alert(
        'Payment successful',
        `+${result.pointsAdded} points added. Your balance is now ${result.balance} points.`
      );
    });

    return () => unsub();
  }, [token]);

  const applySession = async (sessionToken, sessionUser) => {
    await saveSession(sessionToken, sessionUser);
    setToken(sessionToken);
    setUser(sessionUser);
  };

  const login = async (email, password) => {
    const data = await loginUser({ email, password });
    await applySession(data.token, data.user);
    setPointsEnabled(true);
    return data.user;
  };

  const register = async (email, password, fullName) => {
    const data = await registerUser({ email, password, fullName });
    await applySession(data.token, data.user);
    setPointsEnabled(true);
    return data.user;
  };

  const logout = async () => {
    await clearSession();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    const me = await fetchMe();
    setUser(me.user);
    setPointsEnabled(me.pointsEnabled !== false);
    await saveSession(token, me.user);
  };

  const updatePointsBalance = (balance) => {
    if (balance == null) return;
    setUser((prev) => (prev ? { ...prev, pointsBalance: balance } : prev));
  };

  const updateProfile = async (fields) => {
    const data = await updateMe(fields);
    setUser(data.user);
    if (token) await saveSession(token, data.user);
    return data.user;
  };

  const deleteAccount = async (password) => {
    await deleteMe({ password });
    await clearSession();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      backendRequired,
      isAuthenticated: !!token && !!user,
      pointsEnabled,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      deleteAccount,
      updatePointsBalance,
    }),
    [user, token, loading, backendRequired, pointsEnabled]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
