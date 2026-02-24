export type WorkspaceKey = 'employee_self' | 'hrm_admin' | 'tccb_cms';

export type ModuleSurfaceMode = 'self' | 'management' | 'workspace';

export type SidebarIconKey =
  | 'layout-dashboard'
  | 'building-2'
  | 'users'
  | 'calendar-clock'
  | 'briefcase-business'
  | 'circle-user'
  | 'clipboard-check'
  | 'newspaper'
  | 'file-text'
  | 'folder-tree'
  | 'file-spreadsheet';

export type RouteAccessRule = {
  id: string;
  moduleKey: string;
  mode: ModuleSurfaceMode;
  pathPrefix: string;
  allowedWorkspaces: WorkspaceKey[];
  requiredAnyPermissions?: string[];
  requiredAnyRoles?: string[];
};

export type SidebarMenuItemConfig = {
  id: string;
  workspace: WorkspaceKey;
  label: string;
  href: string;
  iconKey: SidebarIconKey;
  requiredAnyPermissions?: string[];
  requiredAnyRoles?: string[];
  activeIncludePrefixes?: string[];
  activeExcludePrefixes?: string[];
};

const EMPLOYEE_READ_PERMISSIONS = [
  'employees:read',
  'employees:read_unit',
  'employees:read_own',
];

const LEAVES_MANAGEMENT_PERMISSIONS = [
  'leaves:read',
  'leaves:read_unit',
  'leaves:approve',
];

const EDUCATION_SELF_PERMISSIONS = [
  'education:read',
  'education:write',
  'employees:read_own',
];

const EDUCATION_MANAGEMENT_PERMISSIONS = [
  'education:read',
  'education:approve',
];

export const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  {
    id: 'overview',
    moduleKey: 'overview',
    mode: 'workspace',
    pathPrefix: '/overview',
    allowedWorkspaces: ['hrm_admin'],
    requiredAnyRoles: ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'],
  },
  {
    id: 'organizations',
    moduleKey: 'organizations',
    mode: 'management',
    pathPrefix: '/organizations',
    allowedWorkspaces: ['hrm_admin'],
    requiredAnyRoles: ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'],
  },
  {
    id: 'employees',
    moduleKey: 'employees',
    mode: 'management',
    pathPrefix: '/employees',
    allowedWorkspaces: ['employee_self', 'hrm_admin'],
    requiredAnyPermissions: EMPLOYEE_READ_PERMISSIONS,
  },
  {
    id: 'salary-config',
    moduleKey: 'salary',
    mode: 'management',
    pathPrefix: '/salary-config',
    allowedWorkspaces: ['hrm_admin'],
    requiredAnyPermissions: ['salary:config_manage'],
  },
  {
    id: 'leaves-management',
    moduleKey: 'leaves',
    mode: 'management',
    pathPrefix: '/leaves/manage',
    allowedWorkspaces: ['hrm_admin'],
    requiredAnyPermissions: LEAVES_MANAGEMENT_PERMISSIONS,
  },
  {
    id: 'leaves-approval-legacy',
    moduleKey: 'leaves',
    mode: 'management',
    pathPrefix: '/leaves/approval',
    allowedWorkspaces: ['hrm_admin'],
    requiredAnyPermissions: ['leaves:approve'],
  },
  {
    id: 'leaves-self',
    moduleKey: 'leaves',
    mode: 'self',
    pathPrefix: '/leaves',
    allowedWorkspaces: ['employee_self'],
    requiredAnyPermissions: ['leaves:read_own', 'leaves:write'],
  },
  {
    id: 'my-profile',
    moduleKey: 'my_profile',
    mode: 'self',
    pathPrefix: '/my-profile',
    allowedWorkspaces: ['employee_self'],
    requiredAnyPermissions: ['employees:read_own'],
  },
  {
    id: 'education-management',
    moduleKey: 'education',
    mode: 'management',
    pathPrefix: '/education/manage',
    allowedWorkspaces: ['hrm_admin'],
    requiredAnyPermissions: EDUCATION_MANAGEMENT_PERMISSIONS,
  },
  {
    id: 'education-self',
    moduleKey: 'education',
    mode: 'self',
    pathPrefix: '/education',
    allowedWorkspaces: ['employee_self'],
    requiredAnyPermissions: EDUCATION_SELF_PERMISSIONS,
  },
  {
    id: 'recruitment-management',
    moduleKey: 'recruitment',
    mode: 'management',
    pathPrefix: '/recruitment/manage',
    allowedWorkspaces: ['hrm_admin'],
    requiredAnyPermissions: ['recruitment:read'],
  },
  {
    id: 'recruitment-legacy',
    moduleKey: 'recruitment',
    mode: 'management',
    pathPrefix: '/recruitment',
    allowedWorkspaces: ['hrm_admin'],
    requiredAnyPermissions: ['recruitment:read'],
  },
  {
    id: 'cms-posts',
    moduleKey: 'cms',
    mode: 'management',
    pathPrefix: '/cms/posts',
    allowedWorkspaces: ['tccb_cms'],
    requiredAnyPermissions: ['cms:posts_manage', 'cms:posts_publish'],
  },
  {
    id: 'cms-documents',
    moduleKey: 'cms',
    mode: 'management',
    pathPrefix: '/cms/documents',
    allowedWorkspaces: ['tccb_cms'],
    requiredAnyPermissions: ['cms:documents_manage'],
  },
  {
    id: 'cms-categories',
    moduleKey: 'cms',
    mode: 'management',
    pathPrefix: '/cms/categories',
    allowedWorkspaces: ['tccb_cms'],
    requiredAnyPermissions: ['cms:categories_manage'],
  },
  {
    id: 'cms-forms',
    moduleKey: 'cms',
    mode: 'management',
    pathPrefix: '/cms/forms',
    allowedWorkspaces: ['tccb_cms'],
    requiredAnyPermissions: ['cms:documents_manage'],
  },
  {
    id: 'cms-overview',
    moduleKey: 'cms',
    mode: 'workspace',
    pathPrefix: '/cms',
    allowedWorkspaces: ['tccb_cms'],
    requiredAnyPermissions: [
      'cms:posts_manage',
      'cms:posts_publish',
      'cms:documents_manage',
      'cms:categories_manage',
    ],
  },
];

export const SIDEBAR_MENU_ITEMS: SidebarMenuItemConfig[] = [
  {
    id: 'employee-profile',
    workspace: 'employee_self',
    label: 'Ho so ca nhan',
    href: '/my-profile',
    iconKey: 'circle-user',
    requiredAnyPermissions: ['employees:read_own'],
  },
  {
    id: 'employee-leaves',
    workspace: 'employee_self',
    label: 'Nghi phep',
    href: '/leaves',
    iconKey: 'calendar-clock',
    requiredAnyPermissions: ['leaves:read_own', 'leaves:write'],
  },
  {
    id: 'employee-education',
    workspace: 'employee_self',
    label: 'Dao tao',
    href: '/education',
    iconKey: 'file-text',
    requiredAnyPermissions: EDUCATION_SELF_PERMISSIONS,
  },
  {
    id: 'hrm-overview',
    workspace: 'hrm_admin',
    label: 'Tong quan',
    href: '/overview',
    iconKey: 'layout-dashboard',
    requiredAnyRoles: ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'],
  },
  {
    id: 'hrm-organizations',
    workspace: 'hrm_admin',
    label: 'To chuc',
    href: '/organizations',
    iconKey: 'building-2',
    requiredAnyRoles: ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'],
  },
  {
    id: 'hrm-employees',
    workspace: 'hrm_admin',
    label: 'Nhan su',
    href: '/employees',
    iconKey: 'users',
    requiredAnyPermissions: ['employees:read', 'employees:read_unit'],
  },
  {
    id: 'hrm-salary-config',
    workspace: 'hrm_admin',
    label: 'Cau hinh luong',
    href: '/salary-config',
    iconKey: 'file-spreadsheet',
    requiredAnyPermissions: ['salary:config_manage'],
    activeIncludePrefixes: ['/salary-config'],
  },
  {
    id: 'hrm-leaves-management',
    workspace: 'hrm_admin',
    label: 'Quan ly nghi phep',
    href: '/leaves/manage',
    iconKey: 'clipboard-check',
    requiredAnyPermissions: LEAVES_MANAGEMENT_PERMISSIONS,
    activeIncludePrefixes: ['/leaves/manage', '/leaves/approval'],
  },
  {
    id: 'hrm-education-management',
    workspace: 'hrm_admin',
    label: 'Quan ly dao tao',
    href: '/education/manage',
    iconKey: 'file-text',
    requiredAnyPermissions: EDUCATION_MANAGEMENT_PERMISSIONS,
    activeIncludePrefixes: ['/education/manage'],
  },
  {
    id: 'hrm-recruitment',
    workspace: 'hrm_admin',
    label: 'Tuyen dung',
    href: '/recruitment/manage',
    iconKey: 'briefcase-business',
    requiredAnyPermissions: ['recruitment:read'],
    activeIncludePrefixes: ['/recruitment/manage', '/recruitment'],
  },
  {
    id: 'cms-overview',
    workspace: 'tccb_cms',
    label: 'Tong quan CMS',
    href: '/cms',
    iconKey: 'layout-dashboard',
    requiredAnyPermissions: [
      'cms:posts_manage',
      'cms:posts_publish',
      'cms:documents_manage',
      'cms:categories_manage',
    ],
  },
  {
    id: 'cms-posts',
    workspace: 'tccb_cms',
    label: 'Bai viet',
    href: '/cms/posts',
    iconKey: 'newspaper',
    requiredAnyPermissions: ['cms:posts_manage', 'cms:posts_publish'],
  },
  {
    id: 'cms-documents',
    workspace: 'tccb_cms',
    label: 'Van ban',
    href: '/cms/documents',
    iconKey: 'file-text',
    requiredAnyPermissions: ['cms:documents_manage'],
  },
  {
    id: 'cms-categories',
    workspace: 'tccb_cms',
    label: 'Danh muc',
    href: '/cms/categories',
    iconKey: 'folder-tree',
    requiredAnyPermissions: ['cms:categories_manage'],
  },
  {
    id: 'cms-forms',
    workspace: 'tccb_cms',
    label: 'Bieu mau',
    href: '/cms/forms',
    iconKey: 'file-spreadsheet',
    requiredAnyPermissions: ['cms:documents_manage'],
  },
];
