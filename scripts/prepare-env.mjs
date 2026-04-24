import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");

function read() {
  if (!existsSync(ENV_PATH)) return "";
  return readFileSync(ENV_PATH, "utf8");
}

function upsert(body, key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(body)) return body.replace(re, line);
  return body.replace(/\s*$/, "") + `\n${line}\n`;
}

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_POSTGRES_URL_NON_POOLING;

const directUrl =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL_NON_POOLING ||
  databaseUrl;

let body = read();

if (databaseUrl) {
  const source = process.env.DATABASE_URL
    ? "DATABASE_URL"
    : process.env.POSTGRES_PRISMA_URL
      ? "POSTGRES_PRISMA_URL"
      : process.env.POSTGRES_URL_NON_POOLING
        ? "POSTGRES_URL_NON_POOLING"
        : "POSTGRES_URL";
  body = upsert(body, "DATABASE_URL", databaseUrl);
  body = upsert(body, "DIRECT_URL", directUrl);
  writeFileSync(ENV_PATH, body);
  console.log(`[prepare-env] DATABASE_URL resolved from ${source}, .env synced.`);
} else if (/^DATABASE_URL=/m.test(body)) {
  console.log("[prepare-env] No DB env in process; .env already has DATABASE_URL — keeping it.");
} else {
  console.error(
    "[prepare-env] No DATABASE_URL / POSTGRES_PRISMA_URL / POSTGRES_URL found in env or .env. Aborting.",
  );
  process.exit(1);
}
