'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useWorkspace } from '@/components/providers/workspace-provider';
import {
  WORKSPACE_DEFINITIONS,
  getWorkspaceLandingPath,
  type WorkspaceKey,
} from '@/lib/workspaces';

type StoredUser = {
  email?: string;
  employee?: {
    fullName?: string;
  };
} | null;

const parseStoredUser = (raw: string | null): StoredUser => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
};

const isWorkspaceKey = (value: string): value is WorkspaceKey => {
  return Object.prototype.hasOwnProperty.call(WORKSPACE_DEFINITIONS, value);
};

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser>(null);
  const { availableWorkspaces, activeWorkspace, setActiveWorkspace } =
    useWorkspace();

  useEffect(() => {
    const syncUser = () => {
      setUser(parseStoredUser(localStorage.getItem('user')));
    };

    syncUser();
    window.addEventListener('storage', syncUser);
    window.addEventListener('focus', syncUser);

    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('focus', syncUser);
    };
  }, []);

  const displayName = useMemo(() => {
    return (
      user?.employee?.fullName?.trim() || user?.email?.trim() || 'Nguoi dung'
    );
  }, [user]);

  const displayEmail = useMemo(() => {
    return user?.email?.trim() || '-';
  }, [user]);

  const avatarFallback = useMemo(() => {
    return displayName.charAt(0).toUpperCase() || 'U';
  }, [displayName]);

  const handleWorkspaceChange = (value: string) => {
    if (!isWorkspaceKey(value)) {
      return;
    }

    if (value === activeWorkspace) {
      return;
    }

    const changed = setActiveWorkspace(value);
    if (!changed) {
      return;
    }

    const landingPath = getWorkspaceLandingPath(value);
    if (pathname !== landingPath) {
      router.replace(landingPath);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore API error and continue client-side logout.
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('activeWorkspace');
    setUser(null);
    router.replace('/login');
  };

  return (
    <header className="flex h-14 items-center justify-end gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {displayEmail}
              </p>
            </div>
          </DropdownMenuLabel>

          {availableWorkspaces.length > 1 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Chon workspace
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={activeWorkspace ?? ''}
                onValueChange={handleWorkspaceChange}
              >
                {availableWorkspaces.map((workspace) => {
                  const definition = WORKSPACE_DEFINITIONS[workspace];

                  return (
                    <DropdownMenuRadioItem key={workspace} value={workspace}>
                      <div className="flex flex-col">
                        <span>{definition.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {definition.description}
                        </span>
                      </div>
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>Dang xuat</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
