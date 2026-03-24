import { Logtail } from "@logtail/edge";

type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  level: LogLevel;
  event: string;
  [key: string]: unknown;
};

type EdgeExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

type LoggerOptions = {
  edgeContext?: EdgeExecutionContext;
};

const sourceToken = process.env.LOGTAIL_SOURCE_TOKEN?.trim() || "";
const logtail = sourceToken ? new Logtail(sourceToken) : null;

function writeConsole(level: LogLevel, payload: Omit<LogPayload, "level">) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...payload });

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
}

async function emit(payload: LogPayload, options?: LoggerOptions) {
  const { level, ...rest } = payload;
  writeConsole(level, rest);

  if (!logtail) {
    return { configured: false, sent: false as const };
  }

  try {
    const sendPromise = options?.edgeContext
      ? logtail[level](payload.event, rest, options.edgeContext as never)
      : logtail[level](payload.event, rest);

    if (options?.edgeContext) {
      options.edgeContext.waitUntil(sendPromise);
      return { configured: true, sent: true as const };
    }

    await sendPromise;
    await logtail.flush();
    return { configured: true, sent: true as const };
  } catch (error) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        event: "better_stack_emit_failed",
        original_event: payload.event,
        error: error instanceof Error ? error.message : String(error),
      })
    );

    return {
      configured: true,
      sent: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const logger = {
  configured: Boolean(logtail),
  info(event: string, data?: Record<string, unknown>, options?: LoggerOptions) {
    return emit({ level: "info", event, ...data }, options);
  },
  warn(event: string, data?: Record<string, unknown>, options?: LoggerOptions) {
    return emit({ level: "warn", event, ...data }, options);
  },
  error(event: string, data?: Record<string, unknown>, options?: LoggerOptions) {
    return emit({ level: "error", event, ...data }, options);
  },
  async flush() {
    if (!logtail) return;
    await logtail.flush();
  },
};
