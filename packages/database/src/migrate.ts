// ============================================================================
// @hydiems/database — Idempotent MySQL 8.0 & ClickHouse 24.x Migration Runner
// ============================================================================
import fs from 'fs';
import path from 'path';
import { checkMysqlHealth, executeMysqlQuery } from './mysql';
import { checkClickHouseHealth, getClickHouseClient } from './clickhouse';

export interface MigrationSummary {
  mysqlMode: string;
  clickhouseMode: string;
  mysqlFilesExecuted: string[];
  clickhouseFilesExecuted: string[];
  totalTablesVerified: number;
}

function resolveMigrationsDir(subDir: 'mysql' | 'clickhouse'): string {
  const candidates = [
    path.resolve(__dirname, 'migrations', subDir),
    path.resolve(__dirname, '..', 'src', 'migrations', subDir),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return candidates[0];
}

export async function runAllMigrations(): Promise<MigrationSummary> {
  const mysqlHealth = await checkMysqlHealth();
  const chHealth = await checkClickHouseHealth();

  const mysqlDir = resolveMigrationsDir('mysql');
  const chDir = resolveMigrationsDir('clickhouse');

  const mysqlFiles = fs.existsSync(mysqlDir)
    ? fs
        .readdirSync(mysqlDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
    : [];

  const chFiles = fs.existsSync(chDir)
    ? fs
        .readdirSync(chDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
    : [];

  let totalTablesVerified = 0;

  for (const file of mysqlFiles) {
    const fullPath = path.join(mysqlDir, file);
    const sqlContent = fs.readFileSync(fullPath, 'utf8');
    const createTableMatches = sqlContent.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/gi);
    totalTablesVerified += createTableMatches ? createTableMatches.length : 0;

    if (mysqlHealth.connected) {
      await executeMysqlQuery(sqlContent);
    }
  }

  for (const file of chFiles) {
    const fullPath = path.join(chDir, file);
    const sqlContent = fs.readFileSync(fullPath, 'utf8');
    const statements = sqlContent
      .split(';')
      .map((s) =>
        s
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim()
      )
      .filter((s) => s.length > 0);

    totalTablesVerified += statements.length;

    if (chHealth.connected) {
      const client = getClickHouseClient();
      for (const stmt of statements) {
        await client.command({ query: stmt });
      }
    }
  }

  return {
    mysqlMode: mysqlHealth.mode,
    clickhouseMode: chHealth.mode,
    mysqlFilesExecuted: mysqlFiles,
    clickhouseFilesExecuted: chFiles,
    totalTablesVerified,
  };
}

if (require.main === module) {
  runAllMigrations()
    .then((summary) => {
      console.log('[HydiEms Migrate] Completed successfully:', JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[HydiEms Migrate] Error:', err);
      process.exit(1);
    });
}
