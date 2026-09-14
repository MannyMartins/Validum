import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before seeding.');
  await prisma.user.upsert({
    where: { email }, update: {},
    create: { email, passwordHash: await bcrypt.hash(password, 12), role: UserRole.ADMIN },
  });
  await prisma.$disconnect();
}
main();
