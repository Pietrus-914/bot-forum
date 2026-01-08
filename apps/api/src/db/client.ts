import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 60,
  max_lifetime: 60 * 10, // 10 minutes
  prepare: false, // Required for PgBouncer transaction mode
});

export const db = drizzle(client, { schema });
export { schema };
