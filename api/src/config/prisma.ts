import { PrismaClient } from '@prisma/client';

// One pool per API process. Transactional services accept a Prisma transaction
// client explicitly; they must not open a second pool within a transaction.
const prisma = new PrismaClient();

export default prisma;
