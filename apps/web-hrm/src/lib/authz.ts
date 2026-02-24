import { findRouteAccessRule } from '@/lib/module-workspace/policy';
export type StoredRole = string | { name?: string };

type StoredUser = {
  roles?: StoredRole[];
  permissions?: string[];
} | null;

type JwtClaims = {
  roles?: string[];
  permissions?: string[];
};

export type AuthSnapshot = {
  roles: Set<string>;
  permissions: Set<string>;
};

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

const decodeJwtClaims = (token: string | null): JwtClaims => {
  if (!token) {
    return {};
  }

  const tokenParts = token.split('.');
  if (tokenParts.length < 2) {
    return {};
  }

  try {
    const payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalizedPayload =
      payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(normalizedPayload)) as JwtClaims;
  } catch {
    return {};
  }
};

const extractRoleNames = (roles: StoredRole[] | undefined): Set<string> => {
  const roleNames = new Set<string>();

  for (const role of roles ?? []) {
    if (typeof role === 'string' && role.trim()) {
      roleNames.add(role);
      continue;
    }

    if (role && typeof role === 'object' && role.name?.trim()) {
      roleNames.add(role.name);
    }
  }

  return roleNames;
};

export const getAuthSnapshot = (): AuthSnapshot => {
  if (typeof window === 'undefined') {
    return {
      roles: new Set<string>(),
      permissions: new Set<string>(),
    };
  }

  const storedUser = parseStoredUser(localStorage.getItem('user'));
  const claims = decodeJwtClaims(localStorage.getItem('accessToken'));

  const roles = extractRoleNames(storedUser?.roles);
  for (const role of claims.roles ?? []) {
    if (role?.trim()) {
      roles.add(role);
    }
  }

  const permissions = new Set<string>([
    ...(storedUser?.permissions ?? []),
    ...(claims.permissions ?? []),
  ]);

  return { roles, permissions };
};

export const hasAnyPermission = (
  permissions: Set<string>,
  requiredPermissions: string[],
): boolean => {
  return requiredPermissions.some((permission) => permissions.has(permission));
};

export const hasAnyRole = (
  roles: Set<string>,
  requiredRoles: string[],
): boolean => {
  return requiredRoles.some((role) => roles.has(role));
};

export const canAccessPath = (
  pathname: string,
  snapshot: AuthSnapshot,
): boolean => {
  if (!pathname || pathname === '/forbidden') {
    return true;
  }

  const matchedRule = findRouteAccessRule(pathname);

  if (!matchedRule) {
    return true;
  }

  const passPermissions = matchedRule.requiredAnyPermissions
    ? hasAnyPermission(snapshot.permissions, matchedRule.requiredAnyPermissions)
    : true;

  const passRoles = matchedRule.requiredAnyRoles
    ? hasAnyRole(snapshot.roles, matchedRule.requiredAnyRoles)
    : true;

  return passPermissions && passRoles;
};
