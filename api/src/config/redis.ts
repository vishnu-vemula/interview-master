'use strict';

/**
 * redis.ts — Redis client singleton (official `redis` package).
 *
 * Exposes a small compatibility wrapper so call-sites can use the
 * classic get/set/del/pipeline API regardless of the underlying
 * driver version, plus lifecycle helpers (connect/disconnect) and a
 * jobs-cache invalidation utility.
 */

import { createClient } from 'redis';

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

/** Minimal structural type for the official redis client surface we use */
type NativeRedisClient = ReturnType<typeof createClient>;

interface PipelineResult {
  sadd: (key: string, member: string) => PipelineResult;
  expire: (key: string, ttl: number) => PipelineResult;
  exec: () => Promise<[Error | null, unknown][]>;
}

class OfficialRedisCompatWrapper {
  native: NativeRedisClient;

  constructor(nativeClient: NativeRedisClient) {
    this.native = nativeClient;
  }

  on(event: string, handler: (...args: any[]) => void): this {
    this.native.on(event as any, handler as any);
    return this;
  }

  async get(key: string): Promise<string | null> {
    // @ts-expect-error TODO(ts-migration): type this site
    return await this.native.get(key);
  }

  async set(key: string, value: string, ...args: any[]): Promise<unknown> {
    if (args[0] === 'EX') {
      const ttl = Number(args[1]);
      return await this.native.set(key, value, { EX: ttl });
    }
    return await this.native.set(key, value);
  }

  async del(key: string | string[]): Promise<number> {
    // @ts-expect-error TODO(ts-migration): type this site
    return await this.native.del(key);
  }

  async info(section?: string): Promise<string> {
    // @ts-expect-error TODO(ts-migration): type this site
    return await this.native.info(section);
  }

  async dbsize(): Promise<number> {
    return await (this.native as any).dbSize();
  }

  pipeline(): PipelineResult {
    const multi = (this.native as any).multi();
    const commands: string[] = [];

    return {
      sadd: (key: string, member: string) => {
        multi.sAdd(key, member);
        commands.push('sadd');
        return this.pipeline();
      },
      expire: (key: string, ttl: number) => {
        multi.expire(key, ttl);
        commands.push('expire');
        return this.pipeline();
      },
      exec: async () => {
        const results: unknown[] = await multi.exec();
        // ioredis-style result shape: array of [err, value]
        return results.map((val) => [null, val]) as [Error | null, unknown][];
      },
    };
  }

  async quit(): Promise<void> {
    await this.native.quit();
  }
}

let client: NativeRedisClient | null = null;
let compatClient: OfficialRedisCompatWrapper | null = null;

if (REDIS_ENABLED) {
  const url =
    process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;

  client = createClient({
    url,
    socket: {
      reconnectStrategy: (retries: number) => {
        if (retries > 5) {
          console.warn('[Redis] Max reconnection attempts reached. Disabling connection retries.');
          return false; // Stop retrying
        }
        return Math.min(retries * 500, 2000);
      },
    },
  });

  client.on('error', (err: Error) => console.warn('[Redis] Error:', err.message));
  client.on('connect', () => console.log('[Redis] Connecting...'));
  client.on('ready', () => console.log('[Redis] Redis Connected'));
  client.on('end', () => console.warn('[Redis] Connection closed'));

  compatClient = new OfficialRedisCompatWrapper(client);
} else {
  console.log('[Redis] Disabled via REDIS_ENABLED=false');
}

function getClient(): OfficialRedisCompatWrapper | null {
  return compatClient;
}

async function connect(): Promise<void> {
  if (client) {
    try {
      await client.connect();
    } catch (err) {
      console.error('[Redis] Failed to connect on startup:', (err as Error).message);
      throw err;
    }
  }
}

async function disconnect(): Promise<void> {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
    compatClient = null;
  }
}

async function clearJobsCache(): Promise<void> {
  if (client) {
    try {
      await client.del('jobs:all');

      let cursor = 0;
      do {
        const reply = await client.scan(String(cursor), { MATCH: 'jobs:*', COUNT: 100 });
    // @ts-expect-error TODO(ts-migration): type this site
        cursor = reply.cursor;
        if (reply.keys && reply.keys.length > 0) {
          await client.del(reply.keys);
        }
      } while (cursor !== 0);

      console.log('[Redis] Cleared "jobs:all" and all "jobs:*" cache keys');
    } catch (err) {
      console.warn('[Redis] Failed to clear jobs cache keys:', (err as Error).message);
    }
  }
}

export { getClient, connect, disconnect, clearJobsCache };
