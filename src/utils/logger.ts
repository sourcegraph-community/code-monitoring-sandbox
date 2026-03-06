type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
}

function writeLog(level: LogLevel, message: string): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string) => writeLog("debug", msg),
  info: (msg: string) => writeLog("info", msg),
  warn: (msg: string) => writeLog("warn", msg),
  error: (msg: string) => writeLog("error", msg),
};
