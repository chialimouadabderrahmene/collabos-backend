import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOG } from '../src/admin/rbac/permission-catalog.constant';

const prisma = new PrismaClient();

const BASELINE_CATEGORIES = [
  'Streetwear',
  'Luxury',
  'Sustainable',
  'Footwear',
  'Accessories',
  'Formalwear',
  'Activewear',
  'Denim',
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function main(): Promise<void> {
  await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER' },
  });

  await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  for (const name of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const permissions = await prisma.permission.findMany({
    where: { name: { in: [...PERMISSION_CATALOG] } },
  });

  await prisma.role.update({
    where: { name: 'ADMIN' },
    data: {
      permissions: {
        connect: permissions.map((permission) => ({ id: permission.id })),
      },
    },
  });

  for (const name of BASELINE_CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
