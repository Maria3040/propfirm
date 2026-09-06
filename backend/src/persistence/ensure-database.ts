import { Client } from 'pg';
import { parseDatabaseUrl, settings } from '../config';

const SCHEMAS = [
  'users',
  'catalog',
  'commerce',
  'challenges',
  'trading',
  'risk',
  'payouts',
  'notifications',
  'audithub',
];

export async function ensureDatabase() {
  const cfg = parseDatabaseUrl(settings.databaseUrl);
  const admin = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.username,
    password: cfg.password,
    database: 'postgres',
  });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      cfg.database,
    ]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${cfg.database}"`);
    }
  } finally {
    await admin.end();
  }

  const db = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.username,
    password: cfg.password,
    database: cfg.database,
  });
  await db.connect();
  try {
    for (const s of SCHEMAS) {
      await db.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
    }
  } finally {
    await db.end();
  }
}
