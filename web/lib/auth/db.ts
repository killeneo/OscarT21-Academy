import { Pool } from "pg";

// One pool per server process; cached on globalThis so dev hot reloads do not leak connections.
const globalForPool = globalThis as unknown as { __authPool?: Pool };

export function db(): Pool {
  if (!globalForPool.__authPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    globalForPool.__authPool = new Pool({ connectionString, max: 10 });
  }
  return globalForPool.__authPool;
}
