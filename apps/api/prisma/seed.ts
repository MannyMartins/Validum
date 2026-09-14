import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before seeding.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  await prisma.user.upsert({
    where: { email }, update: { active: true },
    create: { email, fullName: process.env.ADMIN_NAME?.trim() || 'Administrador', passwordHash: await bcrypt.hash(password, 12), role: UserRole.ADMIN, active: true },
  });
  await prisma.$disconnect();
}
main();
