'use client';

import { useAuth } from '@/hooks/useAuth';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';

export default function Home() {
  const { isLoggedIn } = useAuth();

  return isLoggedIn ? <AuthenticatedPage /> : <UnauthenticatedPage />;
}
