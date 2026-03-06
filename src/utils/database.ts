import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

interface DbConfig {
  host: string;
  port: number;
  name: string;
  ssl_mode: string;
  pool: {
    max_connections: number;
    idle_timeout: number;
    connection_timeout: number;
  };
}

function loadConfig(): DbConfig {
  const configPath = path.resolve(__dirname, "../../db/config.yaml");
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = yaml.parse(raw);
  return parsed.database;
}

const config = loadConfig();

export const db = {
  async query(sql: string, params: unknown[] = []) {
    // Database query implementation
    return { rows: [], rowCount: 0 };
  },

  async healthCheck(): Promise<boolean> {
    try {
      await this.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  },
};
