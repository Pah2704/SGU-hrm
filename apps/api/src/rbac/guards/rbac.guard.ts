import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';
import type { CurrentUserPayload } from '../../auth/interfaces';

/**
 * RBAC Guard
 * Checks roles and permissions after JWT authentication
 *
 * - @Roles() → user.roles must include ANY of the specified roles
 * - @RequirePermissions() → user.permissions must include ALL specified permissions
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAnyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No RBAC decorators = allow (only JWT required)
    if (
      !requiredRoles?.length &&
      !requiredPermissions?.length &&
      !requiredAnyPermissions?.length
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUserPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check roles (ANY match)
    if (requiredRoles?.length) {
      const hasRole = requiredRoles.some((role) => user.roles.includes(role));
      if (!hasRole) {
        throw new ForbiddenException(
          `Insufficient role. Required: ${requiredRoles.join(' or ')}`,
        );
      }
    }

    // Check permissions (ALL must match)
    if (requiredPermissions?.length) {
      const missingPermissions = requiredPermissions.filter(
        (perm) => !user.permissions.includes(perm),
      );

      if (missingPermissions.length > 0) {
        throw new ForbiddenException(
          `Insufficient permissions. Missing: ${missingPermissions.join(', ')}`,
        );
      }
    }

    // Check permissions (ANY match)
    if (requiredAnyPermissions?.length) {
      const hasAnyPermission = requiredAnyPermissions.some((perm) =>
        user.permissions.includes(perm),
      );

      if (!hasAnyPermission) {
        throw new ForbiddenException(
          `Insufficient permissions. Required any of: ${requiredAnyPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }
}
