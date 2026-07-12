import { db, eventsTable } from "@workspace/db";
import { logger } from "./logger";

type Handler = (payload: Record<string, unknown>, entityId: number | null) => Promise<void>;

// Lightweight in-process event bus. Every module publishes domain events here
// (persisted for audit/replay), and any number of subscribers — most
// importantly the AI layer — react without the publishing module knowing
// who's listening. This is what lets modules stay independent while still
// acting on each other's data.
const subscribers = new Map<string, Handler[]>();

export function on(type: string, handler: Handler) {
  const list = subscribers.get(type) ?? [];
  list.push(handler);
  subscribers.set(type, list);
}

export async function emit(
  module: string,
  type: string,
  payload: Record<string, unknown>,
  entityId: number | null = null,
) {
  try {
    await db.insert(eventsTable).values({ module, type, entityId, payload });
  } catch (err) {
    logger.error({ err, type }, "failed to persist event");
  }

  const handlers = subscribers.get(type) ?? [];
  for (const handler of handlers) {
    // Fire-and-forget: the AI layer should never block the request that
    // triggered it. Failures are logged, not surfaced to the caller.
    handler(payload, entityId).catch((err) =>
      logger.error({ err, type }, "event handler failed"),
    );
  }
}
