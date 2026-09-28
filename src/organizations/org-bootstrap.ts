import type { PermissionModule, PrismaClient } from '@prisma/client';
import {
  PERMISSION_CATALOG,
  normalizePermission,
} from '../permissions/permissions.catalog';

type Grants = Partial<
  Record<PermissionModule, { read?: boolean; write?: boolean; edit?: boolean }>
>;

/**
 * Starter roles for a new organization (same access as the legacy ADMIN /
 * MANAGER / EXECUTIVE enum). Admins can edit everything except the Admin role.
 */
export const DEFAULT_ROLE_TEMPLATES: {
  key: 'admin' | 'manager' | 'executive';
  name: string;
  description: string;
  isSystem: boolean;
  grants: Grants;
}[] = [
  {
    key: 'admin',
    name: 'Admin',
    description: 'Full access to everything in the organization.',
    isSystem: true,
    grants: Object.fromEntries(
      PERMISSION_CATALOG.map((d) => [
        d.module,
        { read: true, write: true, edit: true },
      ]),
    ),
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Approves or rejects submitted dates and locks jobs.',
    isSystem: false,
    grants: {
      JOBS: { read: true, edit: true },
      UPLOADS: { read: true },
      VALIDATION: { read: true },
      APPROVALS: { read: true, edit: true },
      AUDIT: { read: true },
      TEAM: { read: true },
    },
  },
  {
    key: 'executive',
    name: 'Executive',
    description:
      'Creates jobs, uploads files, validates, overrides and submits dates.',
    isSystem: false,
    grants: {
      JOBS: { read: true, write: true },
      UPLOADS: { read: true, write: true },
      VALIDATION: { read: true, write: true, edit: true },
      APPROVALS: { read: true, write: true },
      AUDIT: { read: true },
    },
  },
];

/** Create (or reuse, by slug) an organization with its default roles and settings row. */
export async function bootstrapOrganization(
  prisma: PrismaClient,
  org: { name: string; slug: string },
) {
  const organization = await prisma.organization.upsert({
    where: { slug: org.slug },
    update: {},
    create: org,
  });

  const roleIds = {} as Record<
    (typeof DEFAULT_ROLE_TEMPLATES)[number]['key'],
    string
  >;
  for (const t of DEFAULT_ROLE_TEMPLATES) {
    const role = await prisma.role.upsert({
      where: { orgId_name: { orgId: organization.id, name: t.name } },
      update: {},
      create: {
        orgId: organization.id,
        name: t.name,
        description: t.description,
        isSystem: t.isSystem,
        isDefault: true,
        permissions: {
          create: PERMISSION_CATALOG.map((d) => {
            const p = normalizePermission(d.module, t.grants[d.module] ?? {});
            return {
              module: d.module,
              canRead: p.read,
              canWrite: p.write,
              canEdit: p.edit,
            };
          }),
        },
      },
    });
    roleIds[t.key] = role.id;
  }

  await prisma.settings.upsert({
    where: { orgId: organization.id },
    update: {},
    create: { orgId: organization.id },
  });
  return { organization, roleIds };
}
