'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthSnapshot } from '@/lib/authz';
import { getAuthSnapshot } from '@/lib/authz';
import {
  getAvailableWorkspaces,
  getDefaultWorkspace,
  getStoredWorkspace,
  setStoredWorkspace,
  type WorkspaceKey,
} from '@/lib/workspaces';

type WorkspaceContextValue = {
  authSnapshot: AuthSnapshot;
  availableWorkspaces: WorkspaceKey[];
  activeWorkspace: WorkspaceKey | null;
  setActiveWorkspace: (workspace: WorkspaceKey) => boolean;
};

const EMPTY_SNAPSHOT: AuthSnapshot = {
  roles: new Set<string>(),
  permissions: new Set<string>(),
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(EMPTY_SNAPSHOT);
  const [activeWorkspace, setActiveWorkspaceState] =
    useState<WorkspaceKey | null>(null);

  useEffect(() => {
    const syncSnapshot = () => {
      setSnapshot(getAuthSnapshot());
    };

    syncSnapshot();
    window.addEventListener('storage', syncSnapshot);
    window.addEventListener('focus', syncSnapshot);

    return () => {
      window.removeEventListener('storage', syncSnapshot);
      window.removeEventListener('focus', syncSnapshot);
    };
  }, []);

  const availableWorkspaces = useMemo(
    () => getAvailableWorkspaces(snapshot),
    [snapshot],
  );

  useEffect(() => {
    if (!availableWorkspaces.length) {
      setActiveWorkspaceState(null);
      return;
    }

    const storedWorkspace = getStoredWorkspace();
    const defaultWorkspace = getDefaultWorkspace(snapshot);
    const nextWorkspace =
      storedWorkspace && availableWorkspaces.includes(storedWorkspace)
        ? storedWorkspace
        : defaultWorkspace;

    if (!nextWorkspace) {
      setActiveWorkspaceState(null);
      return;
    }

    setActiveWorkspaceState(nextWorkspace);

    if (storedWorkspace !== nextWorkspace) {
      setStoredWorkspace(nextWorkspace);
    }
  }, [availableWorkspaces, snapshot]);

  useEffect(() => {
    const syncWorkspace = () => {
      if (!availableWorkspaces.length) {
        setActiveWorkspaceState(null);
        return;
      }

      const storedWorkspace = getStoredWorkspace();
      if (storedWorkspace && availableWorkspaces.includes(storedWorkspace)) {
        setActiveWorkspaceState(storedWorkspace);
      }
    };

    window.addEventListener('storage', syncWorkspace);
    window.addEventListener('workspace-changed', syncWorkspace);

    return () => {
      window.removeEventListener('storage', syncWorkspace);
      window.removeEventListener('workspace-changed', syncWorkspace);
    };
  }, [availableWorkspaces]);

  const setActiveWorkspace = useCallback(
    (workspace: WorkspaceKey): boolean => {
      if (!availableWorkspaces.includes(workspace)) {
        return false;
      }

      setActiveWorkspaceState(workspace);
      setStoredWorkspace(workspace);
      return true;
    },
    [availableWorkspaces],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      authSnapshot: snapshot,
      availableWorkspaces,
      activeWorkspace,
      setActiveWorkspace,
    }),
    [activeWorkspace, availableWorkspaces, setActiveWorkspace, snapshot],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export const useWorkspace = (): WorkspaceContextValue => {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }

  return context;
};
