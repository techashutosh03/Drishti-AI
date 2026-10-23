import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import { db } from "../services/db.service";
import { authenticateRequest, requireRole, verifyToken } from "../middleware/auth";
import { AuditService } from "../services/audit.service";
import { QueueService } from "../services/queue.service";

export async function applicationsRoutes(fastify: FastifyInstance) {
  // GET /api/applications - list all applications
  fastify.get("/api/applications", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query as any) || {};
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const session = verifyToken(authHeader.substring(7));
      if (session && session.role === "INSTITUTION") {
        query.institutionId = session.institutionId || session.id;
      }
    }
    const apps = db.findApplications(query);
    return reply.send(apps);
  });

  // GET /api/applications/:id - get single application details
  fastify.get("/api/applications/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const app = db.findApplicationById(id);
    if (!app) {
      return reply.status(404).send({ error: `Application not found: ${id}` });
    }
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const session = verifyToken(authHeader.substring(7));
      if (session && session.role === "INSTITUTION") {
        const belongsToUser =
          app.institutionId === session.institutionId ||
          app.institutionId === session.id ||
          app.submittedBy === session.id;
        if (!belongsToUser) {
          return reply.status(403).send({ error: "Forbidden: You are not authorized to view this application." });
        }
      }
    }
    return reply.send(app);
  });

  // POST /api/applications - create application
  fastify.post(
    "/api/applications",
    { preHandler: [authenticateRequest] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as any;
      const user = request.user!;

      if (!body.institutionName || !body.program) {
        return reply.status(400).send({ error: "Missing required fields: institutionName and program" });
      }

      const appId = `APP-2026-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const newApp = {
        id: appId,
        institutionName: body.institutionName,
        category: body.category || "ENGINEERING_UNDERGRADUATE",
        program: body.program,
        approvalType: body.approvalType || "Extension of Approval (EOA)",
        academicYear: body.academicYear || "2026-27",
        status: "Submitted",
        submittedAt: new Date().toISOString(),
        institutionId: user.institutionId || user.id,
        submittedBy: user.id
      };

      db.createApplication(newApp);

      AuditService.log({
        actorId: user.id,
        actorRole: user.role,
        action: "APPLICATION_CREATED",
        resourceRef: `Application:${appId}`,
        appId
      });

      return reply.status(201).send(newApp);
    }
  );

  // POST /api/applications/:id/process - queue application for AI processing
  fastify.post(
    "/api/applications/:id/process",
    { preHandler: [authenticateRequest] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const app = db.findApplicationById(id);
      if (!app) {
        return reply.status(404).send({ error: `Application not found: ${id}` });
      }

      const job = await QueueService.enqueueApplication(id);
      return reply.send({
        message: "Application queued for agentic processing",
        jobId: job.id,
        status: job.status
      });
    }
  );

  // POST /api/applications/:id/approve - Official decision: Approve
  fastify.post(
    "/api/applications/:id/approve",
    { preHandler: [authenticateRequest, requireRole(["SCRUTINY_OFFICER", "ADMIN"])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};
      const user = request.user!;

      const app = db.findApplicationById(id);
      if (!app) {
        return reply.status(404).send({ error: `Application not found: ${id}` });
      }

      const updated = db.updateApplication(id, {
        status: "Approved",
        reviewedBy: user.name,
        reviewerId: user.id,
        reviewedAt: new Date().toISOString(),
        reviewDecision: "Approved",
        reviewNotes: body.notes || "Application meets all verified regulatory norms."
      });

      AuditService.log({
        actorId: user.id,
        actorRole: user.role,
        action: "APPLICATION_APPROVED",
        resourceRef: `Application:${id}`,
        appId: id
      });

      return reply.send({
        success: true,
        message: "Application successfully approved by scrutiny officer",
        application: updated
      });
    }
  );

  // POST /api/applications/:id/rectification - Official decision: Request Rectification
  fastify.post(
    "/api/applications/:id/rectification",
    { preHandler: [authenticateRequest, requireRole(["SCRUTINY_OFFICER", "ADMIN"])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};
      const user = request.user!;

      if (!body.notes || body.notes.trim().length === 0) {
        return reply.status(400).send({ error: "Rectification requires explicit deficiency notes/reasons." });
      }

      const app = db.findApplicationById(id);
      if (!app) {
        return reply.status(404).send({ error: `Application not found: ${id}` });
      }

      const updated = db.updateApplication(id, {
        status: "Rectification Requested",
        reviewedBy: user.name,
        reviewerId: user.id,
        reviewedAt: new Date().toISOString(),
        reviewDecision: "Rectification Requested",
        reviewNotes: body.notes
      });

      AuditService.log({
        actorId: user.id,
        actorRole: user.role,
        action: "APPLICATION_RECTIFICATION_REQUESTED",
        resourceRef: `Application:${id}`,
        appId: id
      });

      return reply.send({
        success: true,
        message: "Rectification notice sent to institution",
        application: updated
      });
    }
  );

  // POST /api/applications/:id/escalate - Official decision: Escalate
  fastify.post(
    "/api/applications/:id/escalate",
    { preHandler: [authenticateRequest, requireRole(["SCRUTINY_OFFICER", "ADMIN"])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};
      const user = request.user!;

      if (!body.notes || body.notes.trim().length === 0) {
        return reply.status(400).send({ error: "Escalation requires explicit rationale/reasons." });
      }

      const app = db.findApplicationById(id);
      if (!app) {
        return reply.status(404).send({ error: `Application not found: ${id}` });
      }

      const updated = db.updateApplication(id, {
        status: "Escalated",
        reviewedBy: user.name,
        reviewerId: user.id,
        reviewedAt: new Date().toISOString(),
        reviewDecision: "Escalated",
        reviewNotes: body.notes
      });

      AuditService.log({
        actorId: user.id,
        actorRole: user.role,
        action: "APPLICATION_ESCALATED",
        resourceRef: `Application:${id}`,
        appId: id
      });

      return reply.send({
        success: true,
        message: "Application escalated to Senior Regulatory Bureau",
        application: updated
      });
    }
  );
}
