import {
  Application,
  AuditEvent,
  DashboardStats,
  AgentWorkflowStage,
  AgentExecutionStatus,
  ImpactMetrics,
  Finding,
  EvidenceItem
} from "./types";
import { getStoredToken, clearSession } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      clearSession();
      window.dispatchEvent(new CustomEvent("auth-session-expired"));
    }
  }
  if (!res.ok) {
    let errorDetail = "";
    try {
      const errJson = await res.json();
      errorDetail = errJson.error || errJson.message || errJson.detail;
    } catch {
      errorDetail = await res.text().catch(() => "");
    }
    throw new Error(errorDetail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function loginApi(email: string, password: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return handleResponse(res);
}

export async function fetchCurrentUserApi(): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  return handleResponse(res);
}

export async function fetchStats(): Promise<DashboardStats> {
  const apps = await fetchApplications();
  const total = apps.length;
  const processed = apps.filter((a) =>
    ["Needs Review", "Approved", "Rectification Requested", "Escalated"].includes(a.status)
  ).length;
  const needsReview = apps.filter((a) => a.status === "Needs Review").length;

  return {
    totalApplications: total,
    processed: processed,
    needsReview: needsReview,
    totalApplicationsTrend: "+0%",
    processedApplicationsTrend: "+0%",
    needsReviewApplicationsTrend: "+0%"
  };
}

function normalizeFinding(f: any): Finding {
  const sevRaw = (f.severity || "Low").toLowerCase();
  const severity: "High" | "Medium" | "Low" = 
    sevRaw.includes("crit") || sevRaw.includes("high") ? "High" : 
    sevRaw.includes("warn") || sevRaw.includes("med") ? "Medium" : "Low";
  
  let evidence = f.evidence;
  if (evidence) {
    evidence = {
      ...evidence,
      documentName: evidence.documentName || evidence.documentRef || "Document",
      pageNumber: evidence.pageNumber ?? evidence.page,
      methodUsed: evidence.methodUsed || f.methodUsed || "Automated Analysis",
      description: evidence.description || f.description || f.detail || "",
      heatmapUrl: evidence.heatmapUrl || evidence.imageUrl,
      originalUrl: evidence.originalUrl,
      boundingBoxes: evidence.boundingBoxes || [],
      confidence: evidence.confidence ?? f.confidence
    };
  }

  return {
    id: f.id,
    category: f.category || "Forensics",
    severity,
    title: f.title,
    detail: f.detail || f.description || "",
    tool: f.tool || f.methodUsed,
    supportingEvidence: f.supportingEvidence || (evidence ? `${evidence.methodUsed} on ${evidence.documentName}` : undefined),
    verificationStatus: f.verificationStatus || (severity === "High" ? "Discrepancy" : "Verified"),
    documentRef: f.documentRef || (evidence ? evidence.documentName : undefined),
    confidence: f.confidence,
    evidence
  };
}

export async function fetchApplications(): Promise<Application[]> {
  const res = await fetch(`${BASE_URL}/api/applications`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  const data = await handleResponse<any[]>(res);
  
  // Normalize fields to frontend Application type
  return data.map((item) => ({
    id: item.id,
    institutionName: item.institutionName,
    category: item.category || "Engineering & Tech",
    approvalType: item.approvalType || "Extension of Approval (EOA)",
    academicYear: item.academicYear || "2026-27",
    status: item.status,
    submissionDate: item.submittedAt ? item.submittedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    submittedAt: item.submittedAt || new Date().toISOString(),
    processedAt: item.processedAt,
    reviewedBy: item.reviewedBy,
    reviewerNotes: item.reviewNotes,
    riskScore: typeof item.riskScore === "number" ? item.riskScore : undefined,
    documentAuthenticityRisk: typeof item.documentAuthenticityRisk === "number" ? item.documentAuthenticityRisk : undefined,
    applicationComplianceRisk: typeof item.applicationComplianceRisk === "number" ? item.applicationComplianceRisk : undefined,
    authenticityAssessment: item.authenticityAssessment,
    complianceAssessment: item.complianceAssessment,
    authenticityExplanation: item.authenticityExplanation,
    complianceExplanation: item.complianceExplanation,
    documents: item.documents || [],
    findings: (item.findings || []).map(normalizeFinding),
    verificationResults: item.verificationResults || [],
    history: item.history || [],
    agentExecutions: item.agentExecutions || [],
    institutionId: item.institutionId,
    submittedBy: item.submittedBy
  }));
}

export async function fetchApplicationById(id: string): Promise<Application | null> {
  const res = await fetch(`${BASE_URL}/api/applications/${id}`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  const item = await handleResponse<any>(res);
  if (!item) return null;

  return {
    id: item.id,
    institutionName: item.institutionName,
    category: item.category || "Engineering & Tech",
    approvalType: item.approvalType || "Extension of Approval (EOA)",
    academicYear: item.academicYear || "2026-27",
    status: item.status,
    submissionDate: item.submittedAt ? item.submittedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    submittedAt: item.submittedAt,
    processedAt: item.processedAt,
    reviewedBy: item.reviewedBy,
    reviewerNotes: item.reviewNotes,
    riskScore: typeof item.riskScore === "number" ? item.riskScore : undefined,
    documentAuthenticityRisk: typeof item.documentAuthenticityRisk === "number" ? item.documentAuthenticityRisk : undefined,
    applicationComplianceRisk: typeof item.applicationComplianceRisk === "number" ? item.applicationComplianceRisk : undefined,
    authenticityAssessment: item.authenticityAssessment,
    complianceAssessment: item.complianceAssessment,
    authenticityExplanation: item.authenticityExplanation,
    complianceExplanation: item.complianceExplanation,
    documents: item.documents || [],
    findings: (item.findings || []).map(normalizeFinding),
    verificationResults: item.verificationResults || [],
    history: item.history || [],
    agentExecutions: item.agentExecutions || [],
    institutionId: item.institutionId,
    submittedBy: item.submittedBy
  };
}


export async function submitApplication(data: {
  institutionName: string;
  category: string;
  program?: string;
  approvalType?: string;
  academicYear?: string;
}): Promise<Application> {
  const res = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      institutionName: data.institutionName,
      category: data.category,
      program: data.program || data.category,
      approvalType: data.approvalType || "Extension of Approval (EOA)",
      academicYear: data.academicYear || "2026-27"
    })
  });
  return handleResponse<Application>(res);
}

export async function queueApplicationForProcessing(applicationId: string): Promise<{ jobId: string; status: string }> {
  const res = await fetch(`${BASE_URL}/api/applications/${applicationId}/process`, {
    method: "POST",
    headers: getAuthHeaders()
  });
  return handleResponse(res);
}

export async function uploadApplicationDocument(
  applicationId: string,
  file: File,
  documentType: string
): Promise<any> {
  const formData = new FormData();
  formData.append("applicationId", applicationId);
  formData.append("documentType", documentType);
  formData.append("file", file);

  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: "POST",
    headers,
    body: formData
  });
  return handleResponse(res);
}

export async function approveApplicationApi(id: string, notes?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/applications/${id}/approve`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ notes: notes || "Application meets all verified regulatory norms." })
  });
  return handleResponse(res);
}

export async function rectifyApplicationApi(id: string, reason: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/applications/${id}/rectification`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ notes: reason })
  });
  return handleResponse(res);
}

export async function escalateApplicationApi(id: string, reason: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/applications/${id}/escalate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ notes: reason })
  });
  return handleResponse(res);
}

export async function fetchImpactMetrics(): Promise<ImpactMetrics> {
  const res = await fetch(`${BASE_URL}/api/analytics/impact`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  const data = await handleResponse<any>(res);
  return {
    applicationsProcessed: data.processedCount || 0,
    averageProcessingTimeFormatted: data.averageProcessingDisplay || "—",
    estimatedTimeSavedFormatted: data.estimatedManualTimeSavedDisplay || "—",
    hasBaselineData: data.hasSufficientData ?? false,
    isBaselineConfigured: data.isBaselineConfigured,
    baselineManualMinutes: data.baselineManualMinutes,
    baselineMethodology: data.baselineMethodology
  };
}


export async function fetchFindingEvidence(findingId: string): Promise<EvidenceItem | null> {
  const res = await fetch(`${BASE_URL}/api/findings/${findingId}/evidence`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  const data = await handleResponse<any>(res);
  if (!data.hasEvidence || !data.evidence) {
    return null;
  }
  return data.evidence;
}

export async function fetchWorkflow(appId?: string): Promise<AgentWorkflowStage[]> {
  const url = appId ? `${BASE_URL}/api/workflow/agents?appId=${appId}` : `${BASE_URL}/api/workflow/agents`;
  const res = await fetch(url, { headers: getAuthHeaders(), cache: "no-store" });
  const data = await handleResponse<any>(res);

  const canonicalDescriptions: Record<string, string> = {
    intake: "Category identification, document classification, statutory checklist selection",
    document: "OCR, image preprocessing, structured statutory field extraction",
    orchestrator: "Routing decision engine: dynamic conditional dispatch to Forensics and Verification",
    forensics: "Level 1 ELA, pHash, metadata inspection & Level 2 semantic deduplication",
    verification: "QR code decoding, digital signature validation, mock issuer registry check",
    compliance: "Versioned regulatory rule evaluation against APH 2026-27 norms",
  };

  if (data.executions && data.executions.length > 0) {
    return data.executions.map((exec: any, idx: number) => {
      const agentName = exec.agentName || exec.name || "Agent";
      let id = (exec.id || "").toLowerCase();
      const lowerName = agentName.toLowerCase();
      if (!id || id.startsWith("exec_")) {
        if (lowerName.includes("intake")) id = "intake";
        else if (lowerName.includes("document")) id = "document";
        else if (lowerName.includes("orchestrator") || lowerName.includes("routing")) id = "orchestrator";
        else if (lowerName.includes("forensic")) id = "forensics";
        else if (lowerName.includes("verification")) id = "verification";
        else if (lowerName.includes("compliance")) id = "compliance";
        else id = `agent-${idx + 1}`;
      }

      let status = exec.status || "Completed";
      const s = String(status).toUpperCase();
      if (s === "COMPLETED") status = "Completed";
      else if (s === "RUNNING") status = "Running";
      else if (s === "FAILED") status = "Failed";
      else if (s === "NEEDS_REVIEW" || s === "NEEDS REVIEW") status = "Needs Review";
      else if (s === "SKIPPED") status = "Skipped";
      else if (s === "NOT_STARTED" || s === "NOT STARTED") status = "Not Started";

      const duration = exec.duration || (exec.durationMs !== undefined ? `${(exec.durationMs / 1000).toFixed(1)}s` : undefined) || "0.4s";

      let description = exec.description || "";
      if (!description && exec.details) {
        if (exec.details.decisionRationale) {
          description = exec.details.decisionRationale;
        } else if (exec.details.category) {
          description = `Category: ${exec.details.category} (${exec.details.approvalType || "EOA"})`;
        } else if (exec.details.extractedCount !== undefined) {
          description = `OCR text extraction and structured statutory field parsing (${exec.details.extractedCount} documents parsed)`;
        } else if (exec.details.checksCount !== undefined) {
          description = `QR code decoding, digital signature validation & issuer registry checks (${exec.details.checksCount} cryptographic checks completed)`;
        } else if (exec.details.findingsCount !== undefined) {
          description = `Versioned regulatory rule evaluation against APH 2026-27 norms (${exec.details.findingsCount} findings recorded)`;
        }
      }
      if (!description) {
        description = canonicalDescriptions[id] || `${agentName} execution`;
      }

      return {
        id,
        number: `0${idx + 1}`,
        name: agentName,
        status: status as AgentExecutionStatus,
        description,
        duration,
        reason: exec.routingReason || exec.reason || undefined,
        subModules: exec.subModules || []
      };
    });
  }
  if (data.agents && data.agents.length > 0) {
    return data.agents.map((ag: any, idx: number) => ({
      id: ag.id,
      number: `0${idx + 1}`,
      name: ag.name,
      status: ag.status || "Completed",
      description: ag.description || canonicalDescriptions[ag.id] || "AI Agent Execution",
      duration: ag.duration || "0.4s",
      subModules: ag.subModules || []
    }));
  }
  return [];
}

export async function fetchAuditLogs(applicationId?: string): Promise<AuditEvent[]> {
  const url = applicationId ? `${BASE_URL}/api/audit?applicationId=${encodeURIComponent(applicationId)}` : `${BASE_URL}/api/audit`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  const data = await handleResponse<any[]>(res);
  if (!Array.isArray(data)) return [];
  return data.map((item, index) => ({
    id: item.id || `audit-${index}`,
    sequence: item.sequence || (index + 1),
    timestamp: item.timestamp || new Date().toISOString(),
    appId: item.appId || item.applicationId || "SYSTEM",
    actor: item.actor || item.actorId || item.actorRole || "SYSTEM_ORCHESTRATOR",
    actorRole: item.actorRole || "SYSTEM",
    action: item.action || "AUDIT_RECORD",
    hash: item.currentHash || item.hash || item.previousHash || "SHA-256-GENESIS",
    previousHash: item.previousHash || "",
    currentHash: item.currentHash || item.hash || "",
    hashChainStatus: (item.hashChainStatus === "Verified" || item.hashChainStatus === "Unverified") ? item.hashChainStatus : "Verified"
  }));
}

export async function verifyAuditChainApi(): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/audit/verify`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  return handleResponse(res);
}

export async function fetchApplicationExecutions(applicationId: string): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/applications/${applicationId}/executions`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await handleResponse<{ executions: any[] }>(res);
  return data.executions ?? [];
}

export async function fetchApplicationOCR(applicationId: string): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/applications/${applicationId}/ocr`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await handleResponse<{ results: any[] }>(res);
  return data.results ?? [];
}

export async function fetchApplicationVerifications(applicationId: string): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/applications/${applicationId}/verifications`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await handleResponse<{ results: any[] }>(res);
  return data.results ?? [];
}

export async function resubmitDocumentApi(
  applicationId: string,
  previousDocumentId: string,
  newDocumentId: string
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/applications/${applicationId}/resubmit`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ previousDocumentId, newDocumentId }),
  });
  return handleResponse(res);
}

export async function downloadReportApi(applicationId: string): Promise<Blob> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}/api/applications/${applicationId}/report`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to download scrutiny report (status ${res.status})`);
  }
  return res.blob();
}

export async function fetchAuthenticatedBlobUrl(url: string): Promise<string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  const res = await fetch(fullUrl, { headers });
  if (!res.ok) {
    throw new Error(`Failed to load evidence file: status ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}


