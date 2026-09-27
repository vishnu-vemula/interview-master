import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { deduplicateAndSave } from '../utils/deduplicator';
import { runJobCleanup } from './job-cleanup-service';

const url = process.env.TEST_DATABASE_URL;
test('consolidated Prisma job listing is served without the legacy jobs table',
  { skip: !url?.endsWith('/interviewmaster_test') }, async () => {
    process.env.DATABASE_URL = url;
    process.env.REDIS_ENABLED = 'false';
    const db = new PrismaClient();
    const externalId = randomUUID();
    const source = await db.jobSource.create({ data: { name: `pg-test-${externalId}` } });
    try {
      const listing = await db.jobListing.create({ data: { sourceId: source.id, externalId,
        title: 'PostgreSQL Engineer', company: 'Test Company', description: 'Prisma listing',
        applyUrl: 'https://example.com/apply', location: 'Remote', salaryMin: 50000,
      } });
      const { getAllJobs } = await import('./postgres-job-service.js');
      const jobs = await getAllJobs();
      const found = jobs.find((job: any) => job.id === listing.id);
      assert.equal(found?.title, 'PostgreSQL Engineer');
      assert.equal(found?.salaryMin, 50000);
      assert.equal(found?.apply_url, 'https://example.com/apply');
    } finally {
      await db.jobListing.deleteMany({ where: { sourceId: source.id } });
      await db.jobSource.delete({ where: { id: source.id } });
      await db.$disconnect();
    }
  });

test('Adzuna sync upserts Prisma listings and cleanup deactivates stale listings',
  { skip: !url?.endsWith('/interviewmaster_test') }, async () => {
    process.env.DATABASE_URL = url;
    process.env.REDIS_ENABLED = 'false';
    const db = new PrismaClient();
    const externalId = randomUUID();
    try {
      const first: any = await deduplicateAndSave([{ adzunaId: externalId, title: 'Platform Engineer',
        company: 'Fixture', location: 'Remote', description: 'Old listing',
        redirectUrl: 'https://example.com/jobs/one', postedTime: new Date('2020-01-01') }]);
      assert.equal(first.insertedCount, 1);
      const second: any = await deduplicateAndSave([{ adzunaId: externalId, title: 'Senior Platform Engineer',
        company: 'Fixture', location: 'Remote', description: 'Updated listing',
        redirectUrl: 'https://example.com/jobs/one', postedTime: new Date('2020-01-01') }]);
      assert.equal(second.updatedCount, 1);
      const source = await db.jobSource.findUniqueOrThrow({ where: { name: 'Adzuna' } });
      const listing = await db.jobListing.findUniqueOrThrow({ where: { sourceId_externalId: { sourceId: source.id, externalId } } });
      assert.equal(listing.title, 'Senior Platform Engineer');
      await runJobCleanup();
      assert.equal((await db.jobListing.findUnique({ where: { id: listing.id } }))?.active, false);
      assert.equal((await db.jobSyncRun.count({ where: { sourceId: source.id, status: 'succeeded' } })) >= 2, true);
    } finally {
      const source = await db.jobSource.findUnique({ where: { name: 'Adzuna' } });
      if (source) await db.jobListing.deleteMany({ where: { sourceId: source.id, externalId } });
      await db.$disconnect();
    }
  });
