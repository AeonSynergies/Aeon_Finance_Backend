import type { PrismaClient } from '@prisma/client';
import { bootstrapOrganization } from '../organizations/org-bootstrap';

/** A throwaway organization (with the default roles) for integration specs. */
export async function createTestOrg(prisma: PrismaClient) {
  const slug = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { organization, roleIds } = await bootstrapOrganization(prisma, {
    name: `Test Org ${slug}`,
    slug,
  });
  return { orgId: organization.id, roleIds };
}

/** Remove a test org; call after the spec has deleted its own jobs and users. */
export async function deleteTestOrg(prisma: PrismaClient, orgId: string) {
  await prisma.invitation.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}
