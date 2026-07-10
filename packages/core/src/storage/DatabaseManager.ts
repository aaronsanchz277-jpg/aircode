import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { SCHEMA_DDL } from './schema';

export class DatabaseManager {
  private instance!: DuckDBInstance;
  private connection!: DuckDBConnection;

  async open(dbPath: string): Promise<void> {
    this.instance = await DuckDBInstance.create(dbPath);
    this.connection = await this.instance.connect();
    await this.runMigrations();
  }

  async execute(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
    const reader = await this.connection.runAndReadAll(sql, params);
    const columns = reader.columnNames();
    return reader.getRows().map((row) =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    );
  }

  async close(): Promise<void> {
    this.connection?.closeSync?.();
    this.instance?.closeSync?.();
  }

  private async runMigrations(): Promise<void> {
    await this.connection.run(SCHEMA_DDL);
  }
}
