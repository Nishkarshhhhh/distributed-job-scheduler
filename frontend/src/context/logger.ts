const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString().slice(11, 19);
  return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
}

export const logger = {
  debug: (message: string, ...meta: unknown[]): void => {
    if (isDev) {
      console.debug(formatMessage("debug", message), ...meta);
    }
  },
  info: (message: string, ...meta: unknown[]): void => {
    console.info(formatMessage("info", message), ...meta);
  },
  warn: (message: string, ...meta: unknown[]): void => {
    console.warn(formatMessage("warn", message), ...meta);
  },
  error: (message: string, ...meta: unknown[]): void => {
    console.error(formatMessage("error", message), ...meta);
  },
  http: (message: string, ...meta: unknown[]): void => {
    if (isDev) {
      console.log(formatMessage("http", message), ...meta);
    }
  },
};

export const httpLogStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

export default logger;