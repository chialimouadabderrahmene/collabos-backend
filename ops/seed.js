// Idempotent production seed. The runtime image ships compiled JS only (no
// ts-node), so this mirrors prisma/seed.ts using the compiled permission
// catalog. Upserts only — never deletes, never creates users or demo data.
// Run inside the API container:
//   docker exec -i collabos-api node - < ops/seed.js
const { PrismaClient } = require('@prisma/client');
const { PERMISSION_CATALOG } = require('/app/dist/admin/rbac/permission-catalog.constant');

const prisma = new PrismaClient();

const BASELINE_CATEGORIES = [
  'Streetwear', 'Luxury', 'Sustainable', 'Footwear',
  'Accessories', 'Formalwear', 'Activewear', 'Denim',
];
const slugify = (v) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function main() {
  for (const name of ['USER', 'ADMIN']) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of PERMISSION_CATALOG) {
    await prisma.permission.upsert({ where: { name }, update: {}, create: { name } });
  }
  const permissions = await prisma.permission.findMany({
    where: { name: { in: [...PERMISSION_CATALOG] } },
  });
  await prisma.role.update({
    where: { name: 'ADMIN' },
    data: { permissions: { connect: permissions.map((p) => ({ id: p.id })) } },
  });
  for (const name of BASELINE_CATEGORIES) {
    await prisma.category.upsert({
      where: { name }, update: {}, create: { name, slug: slugify(name) },
    });
  }
  console.log('[seed] roles, permissions, categories ensured');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
