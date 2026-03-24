import { Logtail } from "@logtail/edge";

type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  level: LogLevel;
  event: string;
  [key: string]: unknown;
};

const logtail = process.env.LOGTAIL_SOURCE_TOKEN
  ? new Logtail(process.env.LOGTAIL_SOURCE_TOKEN)
  : null;

function emit(payload: LogPayload) {
  const { level, ...rest } = payload;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...rest });

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }

  if (logtail) {
    logtail[level](payload.event, rest);
  }
}

export const logger = {
  info(event: string, data?: Record<string, unknown>) {
    emit({ level: "info", event, ...data });
  },
  warn(event: string, data?: Record<string, unknown>) {
    emit({ level: "warn", event, ...data });
  },
  error(event: string, data?: Record<string, unknown>) {
    emit({ level: "error", event, ...data });
  },
};
