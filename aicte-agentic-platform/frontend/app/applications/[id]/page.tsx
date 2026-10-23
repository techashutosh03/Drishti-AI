"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import {
  fetchApplicationById,
  fetchApplicationExecutions,
  fetchApplicationVerifications,
  approveApplicationApi,
  rectifyApplicationApi,
  escalateApplicationApi,
  downloadReportApi,
} from "@/lib/api";
import { Application, Finding } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { EvidenceModal } from "@/components/dashboard/evidence-modal";
import { OCRViewer } from "@/components/drishti/ocr-viewer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  ArrowLeft,
  FileDown,
  Layers,
  FileText,
  AlertTriangle,
  RefreshCw,
  Eye,
  ShieldCheck,
} from "lucide-react";

function ApplicationDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const applicationId = resolvedParams.id;
  const { user } = useAuth();

  const [application, setApplication] = useState<Application | null>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Official Action state
  const [actionType, setActionType] = useState<
    "approve" | "rectify" | "escalate" | null
  >(null);
  const [actionReason, setActionReason] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [appData, execData, verifData] = await Promise.all([
        fetchApplicationById(applicationId),
        fetchApplicationExecutions(applicationId).catch(() => []),
        fetchApplicationVerifications(applicationId).catch(() => []),
      ]);

      if (!appData) {
        setError(`Application ${applicationId} not found.`);
        setLoading(false);
        return;
      }

      setApplication(appData);
      setExecutions(execData || appData.agentExecutions || []);
      setVerifications(verifData || appData.verificationResults || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load application details.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real polling when application is processing or queued
  useEffect(() => {
    if (!application) return;
    const isProcessing =
      application.status === "Processing" || application.status === "Queued";

    if (!isProcessing) return;

    const interval = setInterval(() => {
      loadData();
    }, 2500);

    return () => clearInterval(interval);
  }, [application, loadData]);

  const handleDownloadReport = async () => {
    if (!application) return;
    try {
      setDownloadingReport(true);
      const blob = await downloadReportApi(application.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `drishti-scrutiny-report-${application.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || "Failed to download PDF report");
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!application || !actionType) return;

    if (actionType === "approve" && !isConfirmed) {
      setActionMessage({
        type: "error",
        text: "Please check confirmation box to approve statutory clearance.",
      });
      return;
    }

    if (
      (actionType === "rectify" || actionType === "escalate") &&
      !actionReason.trim()
    ) {
      setActionMessage({
        type: "error",
        text: "A documented rationale/reason is strictly required.",
      });
      return;
    }

    setActionLoading(true);
    setActionMessage(null);

    try {
      let updated: Application;
      if (actionType === "approve") {
        updated = await approveApplicationApi(application.id, actionReason);
      } else if (actionType === "rectify") {
        updated = await rectifyApplicationApi(application.id, actionReason);
      } else {
        updated = await escalateApplicationApi(application.id, actionReason);
      }

      setApplication(updated);
      setActionMessage({
        type: "success",
        text: `Action successfully recorded and logged to immutable audit trail.`,
      });
      setActionType(null);
      setActionReason("");
      setIsConfirmed(false);
      loadData();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Failed to execute review action.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
      case "Cleared":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {status}
          </span>
        );
      case "Needs Review":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            Needs Review
          </span>
        );
      case "Processing":
      case "Queued":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            {status}...
          </span>
        );
      case "Rectification Requested":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Rectification Requested
          </span>
        );
      case "Escalated":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
            Escalated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-white/5 px-2.5 py-1 rounded border border-white/10">
            {status || "Submitted"}
          </span>
        );
    }
  };

  // Role-based Access check
  if (user && user.role === "INSTITUTION" && application) {
    const belongsToUser =
      !application.institutionId ||
      application.institutionId === user.institutionId ||
      application.institutionId === user.id ||
      application.submittedBy === user.id;

    if (!belongsToUser) {
      return (
        <div className="flex h-screen w-full bg-[#08090d] text-slate-100">
          <Sidebar className="hidden md:flex" />
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            <Header
              title="Application Result"
              subtitle="Access verification"
              showNewButton={false}
            />
            <main className="flex-1 p-8 flex items-center justify-center">
              <div className="bg-[#101116] border border-rose-500/30 rounded-xl p-8 max-w-md text-center space-y-4">
                <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
                <h2 className="text-base font-semibold text-white">Access Denied</h2>
                <p className="text-xs text-slate-400">
                  You are not authorized to view this application dossier. Institutional access is strictly restricted to owned submissions.
                </p>
                <Link
                  href="/applications"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-200 border border-white/10"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to My Applications
                </Link>
              </div>
            </main>
          </div>
        </div>
      );
    }
  }

  // Resolve dynamic agent execution names from backend data
  const docExec = executions.find((e) =>
    e.agentName?.toLowerCase().includes("document")
  );
  const compExec = executions.find((e) =>
    e.agentName?.toLowerCase().includes("compliance")
  );
  const verifExec = executions.find((e) =>
    e.agentName?.toLowerCase().includes("verification")
  );
  const forensicsExec = executions.find((e) =>
    e.agentName?.toLowerCase().includes("forensic")
  );

  const docAgentName = docExec?.agentName || "Document Agent";
  const compAgentName = compExec?.agentName || "Compliance Agent";
  const verifAgentName = verifExec?.agentName || "Verification Agent";
  const forensicsAgentName = forensicsExec?.agentName || "Forensics Agent";

  // Resolve verification ladder checks from real records
  const qrCheck = verifications.find(
    (v) => (v.method || v.checkType) === "QR"
  );
  const sigCheck = verifications.find(
    (v) => (v.method || v.checkType) === "SIGNATURE"
  );
  const issuerCheck = verifications.find(
    (v) => (v.method || v.checkType) === "ISSUER"
  );

  // Forensic findings from real findings list
  const forensicFindings =
    application?.findings?.filter(
      (f) =>
        f.category === "Forensics" ||
        f.category === "Verification" ||
        Boolean(f.evidence)
    ) || [];

  const findingsWithEvidence =
    application?.findings?.filter((f) => Boolean(f.evidence)) || [];

  const handleOpenEvidence = () => {
    if (findingsWithEvidence.length > 0) {
      setSelectedFinding(findingsWithEvidence[0]);
      setEvidenceModalOpen(true);
    } else if (forensicFindings.length > 0) {
      setSelectedFinding(forensicFindings[0]);
      setEvidenceModalOpen(true);
    } else {
      alert("No visual forensic evidence attachments found for this application.");
    }
  };

  const isOfficerOrAdmin =
    user?.role === "SCRUTINY_OFFICER" || user?.role === "ADMIN";

  return (
    <div className="flex h-screen w-full bg-[#08090d] overflow-hidden text-slate-100">
      <Sidebar className="hidden md:flex" />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          title="Application Result"
          subtitle="Multi-agent regulatory scrutiny evaluation & officer decision support"
          showNewButton={true}
        />

        <main className="flex-1 overflow-y-auto p-6 max-w-5xl space-y-6">
          {/* Top Navigation & Status Bar */}
          <div className="flex items-center justify-between">
            <Link
              href="/applications"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Applications List
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                />
                <span>Refresh</span>
              </button>

              {application && (
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={downloadingReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
                  title="Download decision-support scrutiny PDF report"
                >
                  {downloadingReport ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5" />
                      <span>PDF Scrutiny Report</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={loadData}
                className="underline text-xs hover:text-white"
              >
                Retry
              </button>
            </div>
          )}

          {loading && !application ? (
            <div className="bg-[#101116] rounded-xl border border-white/10 p-12 text-center text-xs text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading application data from backend...</p>
            </div>
          ) : !application ? (
            <div className="bg-[#101116] rounded-xl border border-white/10 p-12 text-center text-xs text-slate-400">
              Application not found.
            </div>
          ) : (
            <div className="bg-[#101116] rounded-xl border border-white/10 shadow-2xl overflow-hidden divide-y divide-white/10">
              {/* SECTION 1: APPLICATION HEADER */}
              <div className="p-5 bg-white/[0.02]">
                <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-semibold mb-1">
                  APPLICATION HEADER: {application.id} | {application.institutionName}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Status:</span>
                    {getStatusBadge(application.status)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Submission Date:{" "}
                    <span className="text-white">
                      {application.submissionDate ||
                        application.submittedAt?.slice(0, 10) ||
                        "—"}
                    </span>
                  </div>
                </div>
                {application.program && (
                  <div className="mt-2 text-xs text-slate-400">
                    Program / Category:{" "}
                    <span className="text-slate-300 font-medium">
                      {application.program}
                    </span>{" "}
                    • Academic Year:{" "}
                    <span className="text-slate-300 font-mono">
                      {application.academicYear || "2026-27"}
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION 2: DOCUMENT AGENT + COMPLIANCE AGENT — RISK SUMMARY */}
              <div className="p-5 space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {docAgentName.toUpperCase()} + {compAgentName.toUpperCase()} — RISK SUMMARY
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Document Authenticity Risk */}
                  <div className="p-3.5 rounded-lg border border-white/10 bg-white/[0.02] space-y-1.5">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">
                      Document Authenticity Risk
                    </div>
                    {application.documentAuthenticityRisk !== undefined ? (
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-lg font-bold text-white">
                          {application.documentAuthenticityRisk}/100
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            application.authenticityAssessment === "HIGH_RISK"
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                              : application.authenticityAssessment === "SUSPICIOUS"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              : application.authenticityAssessment === "INCONCLUSIVE"
                              ? "bg-slate-500/10 border-slate-500/30 text-slate-400"
                              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          }`}
                        >
                          [{application.authenticityAssessment || "LOW_RISK"}]
                        </span>
                      </div>
                    ) : application.status === "Processing" ||
                      application.status === "Queued" ? (
                      <div className="text-xs text-indigo-400 font-mono animate-pulse">
                        {docAgentName}: Processing...
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 font-mono">
                        Document Authenticity Risk: — [Pending Execution]
                      </div>
                    )}
                    {application.authenticityExplanation && (
                      <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                        {application.authenticityExplanation}
                      </p>
                    )}
                  </div>

                  {/* Application Compliance Risk */}
                  <div className="p-3.5 rounded-lg border border-white/10 bg-white/[0.02] space-y-1.5">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">
                      Application Compliance Risk
                    </div>
                    {application.applicationComplianceRisk !== undefined ? (
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-lg font-bold text-white">
                          {application.applicationComplianceRisk}/100
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            (application.applicationComplianceRisk || 0) >= 40
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                              : (application.applicationComplianceRisk || 0) > 0
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          }`}
                        >
                          [{application.complianceAssessment || "COMPLIANT"}]
                        </span>
                      </div>
                    ) : application.status === "Processing" ||
                      application.status === "Queued" ? (
                      <div className="text-xs text-indigo-400 font-mono animate-pulse">
                        {compAgentName}: Processing...
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 font-mono">
                        Application Compliance Risk: — [Pending Execution]
                      </div>
                    )}
                    {application.complianceExplanation && (
                      <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                        {application.complianceExplanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: VERIFICATION AGENT — QR / SIGNATURE / ISSUER CHECKS */}
              <div className="p-5 space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {verifAgentName.toUpperCase()} — QR / SIGNATURE / ISSUER CHECKS
                  </span>
                </div>

                {verifExec?.status === "RUNNING" ||
                ((application.status === "Processing" ||
                  application.status === "Queued") &&
                  !verifExec) ? (
                  <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10 text-xs text-indigo-400 font-mono flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>{verifAgentName}: Processing...</span>
                  </div>
                ) : verifExec?.status === "SKIPPED" ? (
                  <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/10 text-xs text-slate-400 font-mono">
                    {verifAgentName}: Skipped (
                    {verifExec.routingReason ||
                      verifExec.reason ||
                      "No cryptographic signatures or QR codes detected."}
                    )
                  </div>
                ) : (
                  <div className="space-y-2 text-xs font-mono">
                    {/* QR Verification Row */}
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">QR Verification:</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                            qrCheck?.status === "VERIFIED"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : qrCheck?.status === "EXPIRED" || qrCheck?.status === "MISMATCH"
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                              : "bg-white/5 border-white/10 text-slate-400"
                          }`}
                        >
                          {qrCheck?.status || "NOT_PERFORMED"}
                        </span>
                      </div>
                      <div className="text-slate-300 text-[11px]">
                        {qrCheck?.details?.certId ||
                        qrCheck?.details?.certificateId ||
                        qrCheck?.details?.reference
                          ? `Cert ID: ${
                              qrCheck.details.certId ||
                              qrCheck.details.certificateId ||
                              qrCheck.details.reference
                            }`
                          : qrCheck?.details?.integrity === "VALID_MATCH"
                          ? "Regulatory QR Header Decoded"
                          : ""}{" "}
                        {qrCheck?.details?.expiryDate || qrCheck?.details?.expiry
                          ? `(Expires: ${
                              qrCheck.details.expiryDate || qrCheck.details.expiry
                            })`
                          : ""}
                      </div>
                    </div>

                    {/* Digital Signature Row */}
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">
                          Digital Signature:
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                            sigCheck?.status === "VERIFIED"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : sigCheck?.status === "MANUAL_REVIEW_REQUIRED"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              : "bg-white/5 border-white/10 text-slate-400"
                          }`}
                        >
                          {sigCheck?.status || "NOT_PERFORMED"}
                        </span>
                      </div>
                      <div className="text-slate-300 text-[11px]">
                        {sigCheck?.details?.signatureChain
                          ? `Chain: ${sigCheck.details.signatureChain}`
                          : sigCheck?.details?.signerName
                          ? `Signer: ${sigCheck.details.signerName}`
                          : sigCheck?.source || "pyHanko PKI Validator"}
                      </div>
                    </div>

                    {/* Mock Issuer Source Row */}
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">
                          Mock Issuer Source:
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                            issuerCheck?.status === "VERIFIED"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-white/5 border-white/10 text-slate-400"
                          }`}
                        >
                          {issuerCheck?.status || "NOT_PERFORMED"}
                        </span>
                      </div>
                      <div className="text-slate-300 text-[11px]">
                        {issuerCheck?.source ||
                          issuerCheck?.details?.registryName ||
                          issuerCheck?.details?.registryStatus ||
                          "State Technical Education Council"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: FORENSICS AGENT — EVIDENCE & ANOMALIES */}
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {forensicsAgentName.toUpperCase()} — EVIDENCE & ANOMALIES
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenEvidence}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Side-by-Side Evidence</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOcrModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>View OCR Extraction</span>
                    </button>
                  </div>
                </div>

                {forensicsExec?.status === "RUNNING" ||
                ((application.status === "Processing" ||
                  application.status === "Queued") &&
                  !forensicsExec) ? (
                  <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10 text-xs text-indigo-400 font-mono flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>{forensicsAgentName}: Processing...</span>
                  </div>
                ) : forensicsExec?.status === "SKIPPED" ? (
                  <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/10 text-xs text-slate-400 font-mono">
                    {forensicsAgentName}: Skipped (
                    {forensicsExec.routingReason ||
                      forensicsExec.reason ||
                      "No applicable image-based raster checks required."}
                    )
                  </div>
                ) : forensicFindings.length === 0 ? (
                  <div className="p-6 rounded-lg bg-white/[0.02] border border-white/10 text-center text-xs text-slate-400 font-mono">
                    No forensic anomalies detected
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {forensicFindings.map((finding) => (
                      <div
                        key={finding.id}
                        onClick={() => {
                          setSelectedFinding(finding);
                          setEvidenceModalOpen(true);
                        }}
                        className="p-3.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                                finding.severity === "High"
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                  : finding.severity === "Medium"
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              }`}
                            >
                              {finding.severity}
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {finding.title}
                            </span>
                          </div>
                          {finding.evidence && (
                            <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                              <Eye className="w-3 h-3" /> Artifact Available
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {finding.detail}
                        </p>
                        {finding.tool && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Engine: {finding.tool}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 5: HUMAN REVIEW — OFFICER DECISION (AI DOES NOT DECIDE) */}
              <div className="p-5 space-y-4 bg-white/[0.01]">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    HUMAN REVIEW — OFFICER DECISION (AI DOES NOT DECIDE)
                  </div>
                  {actionMessage && (
                    <span
                      className={`text-xs px-2.5 py-1 rounded border ${
                        actionMessage.type === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      }`}
                    >
                      {actionMessage.text}
                    </span>
                  )}
                </div>

                {/* Decision Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActionType(actionType === "approve" ? null : "approve");
                      setActionMessage(null);
                    }}
                    disabled={!isOfficerOrAdmin}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      actionType === "approve"
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20"
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    } ${!isOfficerOrAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Approve Application
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActionType(actionType === "rectify" ? null : "rectify");
                      setActionMessage(null);
                    }}
                    disabled={!isOfficerOrAdmin}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      actionType === "rectify"
                        ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-500/20"
                        : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30"
                    } ${!isOfficerOrAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Request Rectification
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActionType(actionType === "escalate" ? null : "escalate");
                      setActionMessage(null);
                    }}
                    disabled={!isOfficerOrAdmin}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      actionType === "escalate"
                        ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20"
                        : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30"
                    } ${!isOfficerOrAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Escalate
                  </button>
                </div>

                {!isOfficerOrAdmin && (
                  <p className="text-[11px] text-slate-500 italic">
                    Institutional representative view. Decision actions are reserved for designated AICTE Scrutiny Officers.
                  </p>
                )}

                {/* Expanded Action Panel */}
                {actionType && isOfficerOrAdmin && (
                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
                    <div className="text-xs font-semibold text-white">
                      {actionType === "approve"
                        ? "Statutory Approval Confirmation"
                        : actionType === "rectify"
                        ? "Documented Rectification Notice"
                        : "Regional Committee Escalation Memo"}
                    </div>

                    {actionType === "approve" ? (
                      <div className="space-y-3">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isConfirmed}
                            onChange={(e) => setIsConfirmed(e.target.checked)}
                            className="mt-0.5 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-0"
                          />
                          <span className="text-xs text-slate-300 leading-snug">
                            I confirm statutory verification clearance under APH 2026-27 norms. AI agent outputs have been reviewed and accepted by a human official.
                          </span>
                        </label>
                        <input
                          type="text"
                          placeholder="Optional approval notes for audit record..."
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block text-xs text-slate-400">
                          Documented Rationale / Official Statement:{" "}
                          <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          rows={3}
                          required
                          placeholder={
                            actionType === "rectify"
                              ? "Specify deficient documents and 15-day statutory cure requirements..."
                              : "Specify policy conflict or escalation justification for Executive Committee review..."
                          }
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleExecuteAction}
                        disabled={actionLoading}
                        className="px-4 py-1.5 rounded-md text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? "Submitting Action..." : "Confirm & Submit Decision"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionType(null);
                          setActionReason("");
                          setIsConfirmed(false);
                        }}
                        className="px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Mandatory Legal Disclaimer */}
                <div className="pt-2 border-t border-white/5 text-xs text-slate-400 italic">
                  Disclaimer: AICTE officials retain final authority. AI does not decide.
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Side-by-Side Evidence Comparison Modal */}
      <EvidenceModal
        finding={selectedFinding}
        open={evidenceModalOpen}
        onOpenChange={setEvidenceModalOpen}
      />

      {/* OCR Extraction Modal */}
      {application && (
        <Dialog open={ocrModalOpen} onOpenChange={setOcrModalOpen}>
          <DialogContent className="max-w-4xl bg-[#0d0f17] p-6 border border-white/10 rounded-2xl shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1 pb-3 border-b border-white/10">
              <DialogTitle className="text-base font-semibold text-slate-100 tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Extracted OCR Dossier & Structured Key-Values</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                OCR and bounding-box extraction artifacts for application {application.id}
              </DialogDescription>
            </DialogHeader>
            <div className="pt-4">
              <OCRViewer applicationId={application.id} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-screen w-full bg-[#08090d] items-center justify-center text-xs text-slate-400">
          Loading application...
        </div>
      }
    >
      <ApplicationDetailContent params={params} />
    </React.Suspense>
  );
}
