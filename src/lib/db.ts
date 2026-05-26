import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/drizzle-schema";

import { ConfigurationError } from "./errors";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | undefined;
let _dbRead: Db | undefined;

function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new ConfigurationError("DATABASE_URL belum diatur.");
  _db = drizzle(postgres(url, { prepare: false }), { schema });
  return _db;
}

function getDbRead(): Db {
  if (_dbRead) return _dbRead;
  const url = process.env.DATABASE_URL_READ ?? process.env.DATABASE_URL;
  if (!url) throw new ConfigurationError("DATABASE_URL_READ belum diatur.");
  _dbRead = drizzle(postgres(url, { prepare: false }), { schema });
  return _dbRead;
}

/**
 * Drizzle database client for read and write queries.
 */
export const db: Db = new Proxy({} as Db, {
  get(_, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

/**
 * Drizzle database client for read-only or read-heavy queries.
 */
export const dbRead: Db = new Proxy({} as Db, {
  get(_, prop, receiver) {
    return Reflect.get(getDbRead(), prop, receiver);
  },
});
