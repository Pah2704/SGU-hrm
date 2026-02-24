import {
  ROUTE_ACCESS_RULES,
  SIDEBAR_MENU_ITEMS,
  type RouteAccessRule,
  type SidebarMenuItemConfig,
  type WorkspaceKey,
} from '@/lib/module-workspace/registry';

const matchesPrefix = (pathname: string, prefix: string): boolean => {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

export const findRouteAccessRule = (
  pathname: string,
): RouteAccessRule | undefined => {
  return ROUTE_ACCESS_RULES.find((rule) => matchesPrefix(pathname, rule.pathPrefix));
};

export const getSidebarMenuItemsForWorkspace = (
  workspace: WorkspaceKey | null,
): SidebarMenuItemConfig[] => {
  if (!workspace) {
    return [];
  }

  return SIDEBAR_MENU_ITEMS.filter((item) => item.workspace === workspace);
};

export const isSidebarItemActive = (
  pathname: string,
  item: SidebarMenuItemConfig,
): boolean => {
  const includePrefixes = item.activeIncludePrefixes ?? [item.href];
  const excludePrefixes = item.activeExcludePrefixes ?? [];

  const included = includePrefixes.some((prefix) => matchesPrefix(pathname, prefix));
  if (!included) {
    return false;
  }

  return !excludePrefixes.some((prefix) => matchesPrefix(pathname, prefix));
};

export const canWorkspaceAccessPathByRegistry = (
  workspace: WorkspaceKey,
  pathname: string,
): boolean => {
  if (!pathname || pathname === '/forbidden') {
    return true;
  }

  const rule = findRouteAccessRule(pathname);
  if (!rule) {
    return true;
  }

  return rule.allowedWorkspaces.includes(workspace);
};

export const getPreferredWorkspaceForPathByRegistry = (
  pathname: string,
  availableWorkspaces: WorkspaceKey[],
): WorkspaceKey | null => {
  const rule = findRouteAccessRule(pathname);
  if (!rule) {
    return null;
  }

  return (
    rule.allowedWorkspaces.find((workspace) =>
      availableWorkspaces.includes(workspace),
    ) ?? null
  );
};

const WORKSPACE_MODE_PRIORITY: Record<WorkspaceKey, Array<RouteAccessRule['mode']>> = {
  employee_self: ['self', 'workspace', 'management'],
  hrm_admin: ['management', 'workspace', 'self'],
  tccb_cms: ['management', 'workspace', 'self'],
};

export const resolveWorkspaceFallbackPath = (
  workspace: WorkspaceKey,
  pathname: string,
): string | null => {
  const currentRule = findRouteAccessRule(pathname);
  if (!currentRule) {
    return null;
  }

  const candidates = ROUTE_ACCESS_RULES.filter(
    (rule) =>
      rule.moduleKey === currentRule.moduleKey &&
      rule.allowedWorkspaces.includes(workspace),
  );

  if (!candidates.length) {
    return null;
  }

  const modePriority = WORKSPACE_MODE_PRIORITY[workspace];
  for (const mode of modePriority) {
    const matched = candidates.find((candidate) => candidate.mode === mode);
    if (matched) {
      return matched.pathPrefix;
    }
  }

  return candidates[0].pathPrefix;
};
