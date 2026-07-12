import { on } from "./events";
import { qualifyLead, triageTicket, aiEnabled } from "./ai";
import { logger } from "./logger";

// The AI layer subscribes to domain events here. This is what makes NEXUS AI
// act like an employee instead of a chatbot: it reacts to what happens across
// every module without anyone asking it to.
export function registerAutomations() {
  on("lead.created", async (_payload, entityId) => {
    if (!aiEnabled() || entityId === null) return;
    logger.info({ entityId }, "AI auto-qualifying new lead");
    await qualifyLead(entityId);
  });

  on("ticket.created", async (_payload, entityId) => {
    if (!aiEnabled() || entityId === null) return;
    logger.info({ entityId }, "AI auto-triaging new ticket");
    await triageTicket(entityId);
  });
}
