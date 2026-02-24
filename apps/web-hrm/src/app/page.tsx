'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSnapshot } from '@/lib/authz';
import { getDefaultWorkspace, getWorkspaceLandingPath } from '@/lib/workspaces';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');

    if (!accessToken) {
      router.replace('/login');
      return;
    }

    const defaultWorkspace = getDefaultWorkspace(getAuthSnapshot());

    if (defaultWorkspace) {
      router.replace(getWorkspaceLandingPath(defaultWorkspace));
      return;
    }

    router.replace('/forbidden');
  }, [router]);

  return null;
}
