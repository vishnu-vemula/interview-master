'use strict';

import { getClient } from '../config/redis';
import prisma from '../config/prisma';

const presentDbJob = (job) => {
  const salaryMin = job.salaryMin !== undefined ? job.salaryMin : job.salary_min;
  const salaryMax = job.salaryMax !== undefined ? job.salaryMax : job.salary_max;
  const redirectUrl = job.applyUrl || job.redirectUrl || job.redirect_url || job.url || '';
  const postedTime = job.postedAt || job.postedTime || job.posted_time || job.createdAt || job.created_at || null;
  const isActive = job.active ?? job.isActive ?? job.is_active ?? true;

  let salaryStr = 'Competitive Salary';
  if (salaryMin || salaryMax) {
    const minVal = salaryMin ? Math.round(salaryMin).toLocaleString() : null;
    const maxVal = salaryMax ? Math.round(salaryMax).toLocaleString() : null;
    if (minVal && maxVal) {
      salaryStr = minVal === maxVal ? `£${minVal}` : `£${minVal} – £${maxVal}`;
    } else if (minVal) {
      salaryStr = `£${minVal}+`;
    } else if (maxVal) {
      salaryStr = `£${maxVal}`;
    }
  }

  let summaryStr = 'No description provided.';
  if (job.description) {
    const flat = job.description.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (flat.length <= 150) {
      summaryStr = flat;
    } else {
      const sentenceEnd = flat.slice(0, 150).lastIndexOf('.');
      if (sentenceEnd > 75) {
        summaryStr = flat.slice(0, sentenceEnd + 1);
      } else {
        const wordEnd = flat.slice(0, 150).lastIndexOf(' ');
        summaryStr = `${flat.slice(0, wordEnd > 0 ? wordEnd : 150)}…`;
      }
    }
  }

  return {
    id: job.id ? job.id.toString() : (job.externalId || job.adzunaId || job.adzuna_id || ''),
    title: job.title || '',
    company: job.company || 'Not Specified',
    location: job.location || 'Remote',
    salary: salaryStr,
    summary: summaryStr,
    apply_url: redirectUrl,
    url: redirectUrl,
    category: job.category || '',
    postedTime,
    isActive,
    salaryMin: salaryMin || null,
    salaryMax: salaryMax || null,
    contractType: job.contractType || job.contract_type || null,
    source: typeof job.source === 'object' ? job.source?.name : job.source,
    skills: job.skills || []
  };
};

/**
 * Fetches all jobs from PostgreSQL, with caching in Redis.
 * Key: "jobs:all"
 * TTL: 2 hours (7200 seconds)
 * 
 * @returns {Promise<Array>} List of jobs
 */
async function getAllJobs() {
  const redis = getClient();
  const cacheKey = 'jobs:all';
  const cacheTTL = 2 * 60 * 60; // 2 hours in seconds

  // 1. Try to fetch from Redis cache first
  if (redis) {
    try {
      const cachedJobs = await redis.get(cacheKey);
      if (cachedJobs) {
        console.log(`[Redis] Cache HIT (data served from Redis) for key: ${cacheKey}`);
        return JSON.parse(cachedJobs);
      }
    } catch (err) {
      console.warn('[PostgresJobService] Redis read error:', (err as Error).message);
    }
  }

  // 2. Cache miss: query the application Prisma schema.
  console.log(`[Redis] Cache MISS (data served from Database) for key: ${cacheKey}`);
  const rows = await prisma.jobListing.findMany({ where: {
    active: true, archived: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  }, include: { source: { select: { name: true } } }, orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }] });
  const jobs = rows.map(presentDbJob);

  // 3. Store the result in Redis with a 2-hour TTL
  if (redis && jobs.length > 0) {
    try {
      await redis.set(cacheKey, JSON.stringify(jobs), 'EX', cacheTTL);
      console.log(`[Redis] Cache Updated for key: ${cacheKey} (TTL: ${cacheTTL}s)`);
    } catch (err) {
      console.warn('[PostgresJobService] Redis write error:', (err as Error).message);
    }
  }

  return jobs;
}

/**
 * Filter, sort, and paginate cached/retrieved jobs.
 * Brings keyword matching jobs to the top of the list.
 */
async function getFilteredJobs({
  page = 1,
  limit = 20,
  keyword,
  location,
  category,
  contractType,
  salaryMin
}) {
  const allJobs = await getAllJobs();
  let filtered = [...allJobs];

  // 1. Apply keyword/search filter
  if (keyword) {
    const kw = keyword.toLowerCase().trim();
    filtered = filtered.filter(job => 
      (job.title && job.title.toLowerCase().includes(kw)) ||
      (job.company && job.company.toLowerCase().includes(kw)) ||
      (job.summary && job.summary.toLowerCase().includes(kw)) ||
      (job.location && job.location.toLowerCase().includes(kw)) ||
      (job.category && job.category.toLowerCase().includes(kw)) ||
      (Array.isArray(job.skills) && job.skills.some(skill => skill.toLowerCase().includes(kw)))
    );
  }

  // 2. Apply location filter
  if (location) {
    const loc = location.toLowerCase().trim();
    filtered = filtered.filter(job => 
      job.location && job.location.toLowerCase().includes(loc)
    );
  }

  // 3. Apply category filter
  if (category) {
    const cat = category.toLowerCase().trim();
    filtered = filtered.filter(job => 
      job.category && job.category.toLowerCase().includes(cat)
    );
  }

  // 4. Apply contractType filter
  if (contractType) {
    const ct = contractType.toLowerCase().trim().replace('-', '_');
    filtered = filtered.filter(job => {
      if (!job.contractType) return false;
      const jobCt = job.contractType.toLowerCase().trim().replace('-', '_');
      return jobCt.includes(ct) || ct.includes(jobCt);
    });
  }

  // 5. Apply salaryMin filter
  if (salaryMin) {
    const minSal = parseFloat(salaryMin);
    if (!isNaN(minSal)) {
      filtered = filtered.filter(job => {
        return !job.salaryMin || job.salaryMin >= minSal;
      });
    }
  }

  // 6. Sort by search relevance (matches first)
  if (keyword) {
    const kw = keyword.toLowerCase().trim();
    const scoreJob = (job) => {
      let score = 0;
      if (job.title && job.title.toLowerCase().includes(kw)) {
        score += 10;
        if (job.title.toLowerCase().startsWith(kw)) score += 5;
      }
      if (job.company && job.company.toLowerCase().includes(kw)) score += 5;
      if (job.summary && job.summary.toLowerCase().includes(kw)) score += 2;
      if (Array.isArray(job.skills) && job.skills.some(s => s.toLowerCase() === kw)) score += 4;
      return score;
    };

    filtered.sort((a, b) => {
      const scoreA = scoreJob(a);
      const scoreB = scoreJob(b);
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // highest relevance score first
      }
      const dateA = a.postedTime ? new Date(a.postedTime) : new Date(0);
      const dateB = b.postedTime ? new Date(b.postedTime) : new Date(0);
    // @ts-expect-error TODO(ts-migration): type this site
      return dateB - dateA;
    });
  } else {
    // Default sort: Latest first
    filtered.sort((a, b) => {
      const dateA = a.postedTime ? new Date(a.postedTime) : new Date(0);
      const dateB = b.postedTime ? new Date(b.postedTime) : new Date(0);
    // @ts-expect-error TODO(ts-migration): type this site
      return dateB - dateA;
    });
  }

  // 7. Paginate
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, parseInt(String(limit), 10));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limitNum) || 1;
  const skip = (pageNum - 1) * limitNum;
  const results = filtered.slice(skip, skip + limitNum);

  return {
    total,
    page: pageNum,
    totalPages,
    results
  };
}

export {
  getAllJobs,
  getFilteredJobs,
};
