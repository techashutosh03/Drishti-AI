import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../services/db.service";

export async function workflowRoutes(fastify: FastifyInstance) {
  // GET /api/workflow/agents - get agent activity status across system or for specific app
  fastify.get("/api/workflow/agents", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const appId = query.appId;

    if (appId) {
      const app = db.findApplicationById(appId);
      if (!app) {
        return reply.status(404).send({ error: `Application ${appId} not found` });
      }

      return reply.send({
        applicationId: appId,
        executions: app.agentExecutions || [],
        plan: app.processingPlan || null,
        status: app.status
      });
    }

    // Canonical six-agent architecture: Intake, Document, Orchestrator, Forensics, Verification, Compliance
    const canonicalAgents = [
      { id: "intake", name: "Intake Agent", type: "Core", description: "Category identification, document classification, statutory checklist selection" },
      { id: "document", name: "Document Agent", type: "Core", description: "OCR, image preprocessing, structured statutory field extraction" },
      { id: "orchestrator", name: "Orchestrator Agent", type: "Core", description: "Conditional dynamic routing to Forensics and Verification based on document types and evidence" },
      { id: "forensics", name: "Forensics Agent", type: "Conditional", description: "Level 1 ELA, pHash, metadata inspection & Level 2 semantic deduplication" },
      { id: "verification", name: "Verification Agent", type: "Conditional", description: "QR code decoding, digital signature validation, mock issuer registry check" },
      { id: "compliance", name: "Compliance Agent", type: "Core", description: "Versioned regulatory rule evaluation against APH 2026-27 norms" }
    ];

    // If no appId specified, check if there is a processed application with real executions
    const apps = db.findApplications({});
    const processedApp = apps.find((a: any) => a.agentExecutions && a.agentExecutions.length > 0);

    if (processedApp) {
      return reply.send({
        applicationId: processedApp.id,
        executions: processedApp.agentExecutions || [],
        plan: processedApp.processingPlan || null,
        status: processedApp.status,
        agents: canonicalAgents
      });
    }

    // Default system overview
    return reply.send({
      agents: canonicalAgents
    });
  });
}
