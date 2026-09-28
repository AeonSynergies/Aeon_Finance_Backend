import { PermissionModule } from '@prisma/client';

export type PermissionAction = 'read' | 'write' | 'edit';
export const PERMISSION_ACTIONS: PermissionAction[] = ['read', 'write', 'edit'];

export type ModulePermission = Record<PermissionAction, boolean>;
export type PermissionMap = Record<PermissionModule, ModulePermission>;

interface ModuleDefinition {
  module: PermissionModule;
  label: string;
  description: string;
  /** What each action allows; an action missing here doesn't apply to the module. */
  actions: Partial<Record<PermissionAction, string>>;
}

/**
 * Single source of truth for what every permission means. The guards enforce it
 * (see @RequirePermission on each route) and GET /permissions/modules serves it
 * to the frontend so the permissions matrix renders from the same definitions.
 */
export const PERMISSION_CATALOG: ModuleDefinition[] = [
  {
    module: 'JOBS',
    label: 'Jobs',
    description: 'Timecard jobs for a pay period.',
    actions: {
      read: 'View jobs',
      write: 'Create jobs',
      edit: 'Lock approved jobs',
    },
  },
  {
    module: 'UPLOADS',
    label: 'Source files',
    description: 'Payroll exports, Amazon itineraries and break reports.',
    actions: { read: 'View uploaded files', write: 'Upload files' },
  },
  {
    module: 'VALIDATION',
    label: 'Validation',
    description: 'Timecard rows produced by the validation engine.',
    actions: {
      read: 'View validated rows',
      write: 'Run validation',
      edit: 'Override row status',
    },
  },
  {
    module: 'APPROVALS',
    label: 'Approvals',
    description: 'Per-date submit / approve / reject workflow.',
    actions: {
      read: 'View date approvals',
      write: 'Submit dates for approval',
      edit: 'Approve or reject dates',
    },
  },
  {
    module: 'AUDIT',
    label: 'Audit trail',
    description: 'History of actions taken on a job.',
    actions: { read: 'View the audit trail' },
  },
  {
    module: 'SETTINGS',
    label: 'Settings',
    description: 'Validation engine thresholds for the organization.',
    actions: { read: 'View settings', edit: 'Change settings' },
  },
  {
    module: 'TEAM',
    label: 'Team & permissions',
    description: 'Members, roles and what each role can do.',
    actions: {
      read: 'View members and roles',
      write: 'Add members and create roles',
      edit: 'Change roles, permissions and member access',
    },
  },
];

const CATALOG_BY_MODULE = new Map(PERMISSION_CATALOG.map((d) => [d.module, d]));

export const isApplicable = (
  module: PermissionModule,
  action: PermissionAction,
) => !!CATALOG_BY_MODULE.get(module)?.actions[action];

export function emptyPermissionMap(): PermissionMap {
  return Object.fromEntries(
    PERMISSION_CATALOG.map((d) => [
      d.module,
      { read: false, write: false, edit: false },
    ]),
  ) as PermissionMap;
}

/** Every applicable action granted (used for system roles). */
export function fullPermissionMap(): PermissionMap {
  return Object.fromEntries(
    PERMISSION_CATALOG.map((d) => [
      d.module,
      {
        read: isApplicable(d.module, 'read'),
        write: isApplicable(d.module, 'write'),
        edit: isApplicable(d.module, 'edit'),
      },
    ]),
  ) as PermissionMap;
}

/**
 * Canonical form of one module's grant: actions that don't apply are dropped,
 * and write / edit imply read (you can't change what you can't see).
 */
export function normalizePermission(
  module: PermissionModule,
  p: Partial<ModulePermission>,
): ModulePermission {
  const write = !!p.write && isApplicable(module, 'write');
  const edit = !!p.edit && isApplicable(module, 'edit');
  return {
    read: (!!p.read || write || edit) && isApplicable(module, 'read'),
    write,
    edit,
  };
}

export interface RolePermissionRecord {
  module: PermissionModule;
  canRead: boolean;
  canWrite: boolean;
  canEdit: boolean;
}

export function toPermissionMap(
  rows: RolePermissionRecord[],
  isSystem = false,
): PermissionMap {
  if (isSystem) return fullPermissionMap();
  const map = emptyPermissionMap();
  for (const r of rows) {
    if (map[r.module])
      map[r.module] = normalizePermission(r.module, {
        read: r.canRead,
        write: r.canWrite,
        edit: r.canEdit,
      });
  }
  return map;
}

/** Modules/actions in `wanted` that `held` doesn't grant (for anti-escalation checks). */
export function missingGrants(
  held: PermissionMap,
  wanted: PermissionMap,
): string[] {
  const missing: string[] = [];
  for (const d of PERMISSION_CATALOG) {
    for (const a of PERMISSION_ACTIONS) {
      if (wanted[d.module]?.[a] && !held[d.module]?.[a])
        missing.push(`${d.label}: ${a}`);
    }
  }
  return missing;
}
