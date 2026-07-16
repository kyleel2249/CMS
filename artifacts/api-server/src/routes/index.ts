import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import contactsRouter from "./contacts";
import companiesRouter from "./companies";
import leadsRouter from "./leads";
import dealsRouter from "./deals";
import ticketsRouter from "./tickets";
import campaignsRouter from "./campaigns";
import invoicesRouter from "./invoices";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import aiRouter from "./ai";
import knowledgeRouter from "./knowledge";
import automationsRouter from "./automations";
import notesRouter from "./notes";
import extensionsRouter from "./extensions";
import activityStreamRouter from "./activity";
import anomaliesRouter from "./anomalies";
import goalsRouter from "./goals";
// New feature routes
import emailsRouter from "./emails";
import customObjectsRouter from "./custom-objects";
import workflowBuilderRouter from "./workflow-builder";
import marketplaceRouter from "./marketplace";
import billingRouter from "./billing";
import projectDocsRouter from "./project-docs";
import nexusRouter from "./nexus";
// Website, Blog, Visuals, Vouchers
import websiteAnalyticsRouter from "./website-analytics";
import vouchersRouter from "./vouchers-api";
import blogRouter from "./blog-api";
import visualsRouter from "./visuals-api";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(contactsRouter);
router.use(companiesRouter);
router.use(leadsRouter);
router.use(dealsRouter);
router.use(ticketsRouter);
router.use(campaignsRouter);
router.use(invoicesRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(aiRouter);
router.use(knowledgeRouter);
router.use(automationsRouter);
router.use(notesRouter);
router.use(extensionsRouter);
router.use(activityStreamRouter);
router.use(anomaliesRouter);
router.use(goalsRouter);
// New feature routes
router.use(emailsRouter);
router.use(customObjectsRouter);
router.use(workflowBuilderRouter);
router.use(marketplaceRouter);
router.use(billingRouter);
router.use(projectDocsRouter);
router.use(nexusRouter);
// Website, Blog, Visuals, Vouchers
router.use(websiteAnalyticsRouter);
router.use(vouchersRouter);
router.use(blogRouter);
router.use(visualsRouter);

export default router;
