'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CircleUser,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderTree,
  LayoutDashboard,
  Newspaper,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasAnyPermission, hasAnyRole } from '@/lib/authz';
import { useWorkspace } from '@/components/providers/workspace-provider';
import {
  getSidebarMenuItemsForWorkspace,
  isSidebarItemActive,
} from '@/lib/module-workspace/policy';
import {
  type SidebarIconKey,
} from '@/lib/module-workspace/registry';
import {
  WORKSPACE_DEFINITIONS,
} from '@/lib/workspaces';

const ICON_MAP: Record<SidebarIconKey, ComponentType<{ className?: string }>> = {
  'layout-dashboard': LayoutDashboard,
  'building-2': Building2,
  users: Users,
  'calendar-clock': CalendarClock,
  'briefcase-business': BriefcaseBusiness,
  'circle-user': CircleUser,
  'clipboard-check': ClipboardCheck,
  newspaper: Newspaper,
  'file-text': FileText,
  'folder-tree': FolderTree,
  'file-spreadsheet': FileSpreadsheet,
};

export function Sidebar() {
  const pathname = usePathname();
  const { activeWorkspace, authSnapshot } = useWorkspace();

  const workspaceLabel = activeWorkspace
    ? WORKSPACE_DEFINITIONS[activeWorkspace].label
    : 'Khong xac dinh';

  const menuItems = useMemo(() => {
    const workspaceItems = getSidebarMenuItemsForWorkspace(activeWorkspace);

    return workspaceItems.filter((item) => {
      const passPermissions = item.requiredAnyPermissions
        ? hasAnyPermission(authSnapshot.permissions, item.requiredAnyPermissions)
        : true;
      const passRoles = item.requiredAnyRoles
        ? hasAnyRole(authSnapshot.roles, item.requiredAnyRoles)
        : true;

      return passPermissions && passRoles;
    });
  }, [activeWorkspace, authSnapshot.permissions, authSnapshot.roles]);

  return (
    <aside className="z-20 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl">
      <div className="flex h-16 items-center border-b border-sidebar-border bg-sidebar-accent/10 px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/images/logo-sgu.png"
            alt="Logo Đại học Sài Gòn"
            width={36}
            height={36}
            className="rounded-full shadow-md"
          />
          <div>
            <h1 className="text-lg font-bold leading-none tracking-tight">SGU HRM</h1>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/70">
              Dai hoc Sai Gon
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-6">
        <div className="mb-3 px-3">
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            Workspace
          </span>
          <span className="text-sm font-medium text-sidebar-foreground/90">
            {workspaceLabel}
          </span>
        </div>

        {menuItems.map((item) => {
          const isActive = isSidebarItemActive(pathname, item);
          const Icon = ICON_MAP[item.iconKey];

          return (
            <Link
              key={`${activeWorkspace ?? 'unknown'}:${item.id}`}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white',
              )}
            >
              {isActive ? (
                <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/30" />
              ) : null}
              <Icon
                className={cn(
                  'h-5 w-5',
                  isActive
                    ? 'text-white'
                    : 'text-sidebar-foreground/70 group-hover:text-white',
                )}
              />
              {item.label}
            </Link>
          );
        })}

        {!menuItems.length ? (
          <div className="rounded-md border border-sidebar-border/70 bg-sidebar-accent/10 px-3 py-2 text-xs text-sidebar-foreground/70">
            Workspace hien tai chua co menu kha dung.
          </div>
        ) : null}
      </nav>

      <div className="border-t border-sidebar-border bg-sidebar-accent/5 p-4">
        <div className="text-center font-mono text-xs text-sidebar-foreground/40">
          v1.0.0 (Beta)
        </div>
      </div>
    </aside>
  );
}
