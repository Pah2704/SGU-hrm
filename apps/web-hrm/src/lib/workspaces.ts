import type { AuthSnapshot } from '@/lib/authz';
import { hasAnyPermission, hasAnyRole } from '@/lib/authz';
import {
  canWorkspaceAccessPathByRegistry,
  getPreferredWorkspaceForPathByRegistry,
  resolveWorkspaceFallbackPath as resolveWorkspaceFallbackPathByRegistry,
} from '@/lib/module-workspace/policy';

export type WorkspaceKey = 'employee_self' | 'hrm_admin' | 'tccb_cms';

export type WorkspaceDefinition = {
  key: WorkspaceKey;
  label: string;
  description: string;
  landingPath: string;
};

const STORAGE_KEY = 'activeWorkspace';

const HRM_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];
const CMS_PERMISSIONS = [
  'cms:posts_manage',
  'cms:posts_publish',
  'cms:documents_manage',
  'cms:categories_manage',
];

export const WORKSPACE_DEFINITIONS: Record<WorkspaceKey, WorkspaceDefinition> = {
  employee_self: {
    key: 'employee_self',
    label: 'Vien chuc',
    description: 'Ho so ca nhan va chuc nang co ban',
    landingPath: '/my-profile',
  },
  hrm_admin: {
    key: 'hrm_admin',
    label: 'Quan ly HRM',
    description: 'Quan tri nghiep vu nhan su',
    landingPath: '/overview',
  },
  tccb_cms: {
    key: 'tccb_cms',
    label: 'Quan tri TCCB',
    description: 'Dang bai, van ban va bieu mau',
    landingPath: '/cms',
  },
};

const isWorkspaceKey = (value: string): value is WorkspaceKey =>
  value === 'employee_self' || value === 'hrm_admin' || value === 'tccb_cms';

export const getAvailableWorkspaces = (
  snapshot: AuthSnapshot,
): WorkspaceKey[] => {
  const result: WorkspaceKey[] = [];

  if (hasAnyPermission(snapshot.permissions, ['employees:read_own'])) {
    result.push('employee_self');
  }

  if (hasAnyRole(snapshot.roles, HRM_ROLES)) {
    result.push('hrm_admin');
  }

  if (hasAnyPermission(snapshot.permissions, CMS_PERMISSIONS)) {
    result.push('tccb_cms');
  }

  return result;
};

export const getDefaultWorkspace = (
  snapshot: AuthSnapshot,
): WorkspaceKey | null => {
  const available = getAvailableWorkspaces(snapshot);
  if (available.includes('hrm_admin')) {
    return 'hrm_admin';
  }
  if (available.includes('tccb_cms')) {
    return 'tccb_cms';
  }
  if (available.includes('employee_self')) {
    return 'employee_self';
  }
  return null;
};

export const getWorkspaceLandingPath = (workspace: WorkspaceKey): string =>
  WORKSPACE_DEFINITIONS[workspace].landingPath;

export const getStoredWorkspace = (): WorkspaceKey | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = localStorage.getItem(STORAGE_KEY);
  if (!value || !isWorkspaceKey(value)) {
    return null;
  }
  return value;
};

export const setStoredWorkspace = (workspace: WorkspaceKey): void => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, workspace);
  window.dispatchEvent(new Event('workspace-changed'));
};

export const canWorkspaceAccessPath = (
  workspace: WorkspaceKey,
  pathname: string,
): boolean => {
  return canWorkspaceAccessPathByRegistry(workspace, pathname);
};

export const getPreferredWorkspaceForPath = (
  pathname: string,
  available: WorkspaceKey[],
): WorkspaceKey | null => {
  return getPreferredWorkspaceForPathByRegistry(pathname, available);
};

export const resolveWorkspaceFallbackPath = (
  workspace: WorkspaceKey,
  pathname: string,
): string | null => {
  return resolveWorkspaceFallbackPathByRegistry(workspace, pathname);
};
