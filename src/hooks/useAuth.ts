'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'gxwtf_english_auth';

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem(STORAGE_KEY) === 'true';
    setIsLoggedIn(stored);
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(STORAGE_KEY, isLoggedIn.toString());
    }
  }, [isLoggedIn, isClient]);

  const login = () => {
    setIsLoggedIn(true);
  };

  const logout = () => {
    setIsLoggedIn(false);
  };

  return {
    isLoggedIn,
    isClient,
    login,
    logout,
  };
};