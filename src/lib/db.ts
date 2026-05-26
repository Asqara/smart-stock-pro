import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/drizzle-schema";

import { ConfigurationError } from "./errors";

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_URL_READ = process.env.DATABASE_URL_READ ?? DATABASE_URL;

if (!DATABASE_URL) {
  throw new ConfigurationError("DATABASE_URL belum diatur.");
}

if (!DATABASE_URL_READ) {
  throw new ConfigurationError("DATABASE_URL_READ belum diatur.");
}

const writeClient = postgres(DATABASE_URL, { prepare: false });
const readClient = postgres(DATABASE_URL_READ, { prepare: false });

/**
 * Drizzle database client for read and write queries.
 */
export const db = drizzle(writeClient, { schema });

/**
 * Drizzle database client for read-only or read-heavy queries.
 */
export const dbRead = drizzle(readClient, { schema });
