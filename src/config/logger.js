import { config } from "./config.js";

export function getLoggerConfig() {
  if (config.NODE_ENV === "development") {
    return {
      level: config.LOG_LEVEL,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    };
  }

  return {
    level: config.LOG_LEVEL,
  };
}
