'use client';

import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { canAccessPath, getAuthSnapshot } from '@/lib/authz';
import {
  canWorkspaceAccessPath,
  getAvailableWorkspaces,
  getDefaultWorkspace,
  getStoredWorkspace,
  getWorkspaceLandingPath,
  resolveWorkspaceFallbackPath,
  setStoredWorkspace,
} from '@/lib/workspaces';

type WorkspaceRedirectNotice = {
  targetPath: string;
  message: string;
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [workspaceRedirectNotice, setWorkspaceRedirectNotice] =
    useState<WorkspaceRedirectNotice | null>(null);

  useEffect(() => {
    let isActive = true;
    setBackendUnavailable(false);

    const persistProfile = async () => {
      const profileRes = await api.get('/users/me');
      localStorage.setItem('user', JSON.stringify(profileRes.data));
    };

    const isBackendOfflineError = (error: unknown) =>
      isAxiosError(error) && !error.response;

    const bootstrapAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          try {
            await persistProfile();
            if (isActive) {
              setAuthorized(true);
            }
            return;
          } catch (error: unknown) {
            if (isBackendOfflineError(error)) {
              if (isActive) {
                setBackendUnavailable(true);
              }
              return;
            }

            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
          }
        }

        try {
          const refreshRes = await api.post<{ accessToken: string; expiresIn: number }>(
            '/auth/refresh',
          );
          localStorage.setItem('accessToken', refreshRes.data.accessToken);
          await persistProfile();

          if (isActive) {
            setAuthorized(true);
          }
        } catch (error: unknown) {
          if (isBackendOfflineError(error)) {
            if (isActive) {
              setBackendUnavailable(true);
            }
            return;
          }

          if (isActive) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            router.replace('/login');
          }
        }
      } finally {
        if (isActive) {
          setReady(true);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      isActive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!ready || !authorized || !pathname || workspaceRedirectNotice) {
      return;
    }

    const snapshot = getAuthSnapshot();

    if (!canAccessPath(pathname, snapshot)) {
      router.replace('/forbidden');
      return;
    }

    const availableWorkspaces = getAvailableWorkspaces(snapshot);
    if (!availableWorkspaces.length) {
      return;
    }

    const storedWorkspace = getStoredWorkspace();
    const defaultWorkspace = getDefaultWorkspace(snapshot);
    const activeWorkspace =
      storedWorkspace && availableWorkspaces.includes(storedWorkspace)
        ? storedWorkspace
        : defaultWorkspace;

    if (!activeWorkspace) {
      router.replace('/forbidden');
      return;
    }

    if (storedWorkspace !== activeWorkspace) {
      setStoredWorkspace(activeWorkspace);
    }

    if (!canWorkspaceAccessPath(activeWorkspace, pathname)) {
      const fallbackPath =
        resolveWorkspaceFallbackPath(activeWorkspace, pathname) ??
        getWorkspaceLandingPath(activeWorkspace);
      if (fallbackPath !== pathname) {
        setWorkspaceRedirectNotice({
          targetPath: fallbackPath,
          message: 'Khong thuoc workspace hien tai. Dang chuyen huong...',
        });
        return;
      }

      router.replace('/forbidden');
      return;
    }
  }, [authorized, pathname, ready, router, workspaceRedirectNotice]);

  useEffect(() => {
    if (!workspaceRedirectNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      router.replace(workspaceRedirectNotice.targetPath);
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router, workspaceRedirectNotice]);

  useEffect(() => {
    if (!workspaceRedirectNotice) {
      return;
    }

    if (pathname === workspaceRedirectNotice.targetPath) {
      setWorkspaceRedirectNotice(null);
    }
  }, [pathname, workspaceRedirectNotice]);

  if (backendUnavailable) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
          <p className="text-base font-semibold">Khong ket noi duoc backend</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Vui long kiem tra API tai `http://localhost:3001` va thu lai.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            Thu lai
          </button>
        </div>
      </div>
    );
  }

  if (!ready || !authorized) {
    return null;
  }

  if (!canAccessPath(pathname, getAuthSnapshot())) {
    return null;
  }

  if (workspaceRedirectNotice) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
          <p className="text-base font-semibold">Khong thuoc workspace hien tai</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {workspaceRedirectNotice.message}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
