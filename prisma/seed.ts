import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { bootstrapOrganization } from '../src/organizations/org-bootstrap';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'password123';

// Two orgs so organization isolation can be exercised locally.
const DEV_ORGS = [
  {
    org: { name: 'Default Organization', slug: 'default' },
    users: [
      { email: 'admin@aeon.dev', name: 'Dev Admin', role: 'admin' as const },
      {
        email: 'executive@aeon.dev',
        name: 'Dev Executive',
        role: 'executive' as const,
      },
      {
        email: 'manager@aeon.dev',
        name: 'Dev Manager',
        role: 'manager' as const,
      },
    ],
  },
  {
    org: { name: 'Acme Logistics', slug: 'acme' },
    users: [
      { email: 'admin@acme.dev', name: 'Acme Admin', role: 'admin' as const },
    ],
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the dev seed script with NODE_ENV=production -- ' +
        'it creates accounts (including an ADMIN) with a hardcoded, ' +
        'publicly-visible password and must never run against a real ' +
        'production database.',
    );
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  for (const { org, users } of DEV_ORGS) {
    const { organization, roleIds } = await bootstrapOrganization(prisma, org);
    for (const user of users) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          email: user.email,
          name: user.name,
          passwordHash,
          orgId: organization.id,
          roleId: roleIds[user.role],
        },
      });
      console.log(`Seeded user: ${user.email} (${org.slug} / ${user.role})`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
