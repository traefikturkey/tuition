/**
 * Simple structured logger for consistent runtime logging
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getCurrentLevel(): LogLevel {
  const configured = process.env.TUITION_LOG_LEVEL?.toLowerCase();
  if (configured === "debug" || configured === "info" || configured === "warn" || configured === "error") {
    return configured;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getCurrentLevel()];
}

function emit(level: LogLevel, scope: string, message: string): void {
  if (!shouldLog(level)) {
    return;
  }

  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${scope}: ${message}`;
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug(scope: string, message: string): void {
    emit("debug", scope, message);
  },
  info(scope: string, message: string): void {
    emit("info", scope, message);
  },
  warn(scope: string, message: string): void {
    emit("warn", scope, message);
  },
  error(scope: string, message: string): void {
    emit("error", scope, message);
  },
};
