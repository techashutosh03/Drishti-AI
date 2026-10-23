"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  X,
  Plus,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  FileDown,
  UploadCloud,
} from "lucide-react";
import { Application, Finding } from "@/lib/types";
import { EvidenceModal } from "./evidence-modal";
import {
  approveApplicationApi,
  rectifyApplicationApi,
  escalateApplicationApi,
  downloadReportApi,
  resubmitDocumentApi,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AgentTimeline } from "@/components/drishti/agent-timeline";
import { OCRViewer } from "@/components/drishti/ocr-viewer";
import { VerificationLadder } from "@/components/drishti/verification-ladder";

interface RecentApplicationsTableProps {
  applications: Application[];
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
  onActionComplete?: () => void;
}

export function RecentApplicationsTable({
  applications,
  loading,
  error,
  onRefresh,
  onActionComplete,
}: RecentApplicationsTableProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [activeTab, setActiveTab] = useState<
    "Overview" | "Documents" | "OCR Extraction" | "AI Findings" | "Agent Timeline" | "Review History"
  >("Overview");
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Evidence Modal state
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);

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

  const handleDownloadReport = async (appId: string) => {
    try {
      setDownloadingReport(true);
      const blob = await downloadReportApi(appId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `drishti-scrutiny-report-${appId}.pdf`;
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

  const filtered = applications.filter(
    (app) =>
      app.institutionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: Application["status"] | string) => {
    switch (status) {
      case "Approved":
      case "Cleared":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {status}
          </span>
        );
      case "Needs Review":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            Needs Review
          </span>
        );
      case "Processing":
      case "Queued":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            <Clock className="w-3 h-3 text-indigo-400" />
            {status}
          </span>
        );
      case "Rectification Requested":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            Rectification
          </span>
        );
      case "Escalated":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
            <AlertCircle className="w-3 h-3 text-purple-400" />
            Escalated
          </span>
        );
      case "Submitted":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
            {status || "Submitted"}
          </span>
        );
    }
  };

  const handleOpenEvidence = (finding: Finding) => {
    setSelectedFinding(finding);
    setEvidenceModalOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedApp || !actionType) return;

    if (actionType === "approve" && !isConfirmed) {
      setActionMessage({
        type: "error",
        text: "Please check confirmation box to approve statutory clearance.",
      });
      return;
    }

    if ((actionType === "rectify" || actionType === "escalate") && !actionReason.trim()) {
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
        updated = await approveApplicationApi(selectedApp.id, actionReason);
      } else if (actionType === "rectify") {
        updated = await rectifyApplicationApi(selectedApp.id, actionReason);
      } else {
        updated = await escalateApplicationApi(selectedApp.id, actionReason);
      }

      setSelectedApp(updated);
      setActionMessage({
        type: "success",
        text: `Action successfully recorded and logged to audit trail.`,
      });
      setActionType(null);
      setActionReason("");
      setIsConfirmed(false);
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Failed to execute review action.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (error) {
    return (
      <div className="bg-[#101116] rounded-xl border border-white/10 p-8 text-center space-y-3">
        <p className="text-xs text-rose-400 font-medium">
          Unable to connect to the server. Please try again.
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#101116] rounded-xl border border-white/10 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.01]">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Recent Applications
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Submitted applications and regulatory validation status
          </p>
        </div>

        {applications.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by ID or institution..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/[0.04] border border-white/10 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
            />
          </div>
        )}
      </div>

      {/* Body Content */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
          Loading applications...
        </div>
      ) : applications.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <p className="text-xs text-slate-400">
            No applications have been submitted yet.
          </p>
          <p className="text-[11px] text-slate-500">
            Upload your first application to begin document validation.
          </p>
          <div className="pt-2">
            <Link
              href="/upload"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Application</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-medium">
                <th className="py-2.5 px-4">Application ID</th>
                <th className="py-2.5 px-4">Institution</th>
                <th className="py-2.5 px-4">Submission Date</th>
                <th className="py-2.5 px-4">Risk Score</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => {
                    setSelectedApp(app);
                    setActiveTab("Overview");
                    setActionType(null);
                    setActionMessage(null);
                  }}
                  className="hover:bg-white/[0.04] active:bg-white/[0.06] cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium text-indigo-400">
                    {app.id}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-white">
                      {app.institutionName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {app.category}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                    {app.submissionDate}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {app.riskScore !== undefined ? (
                      <span
                        className={
                          app.riskScore >= 70
                            ? "text-rose-400 font-medium"
                            : app.riskScore >= 40
                            ? "text-amber-400 font-medium"
                            : "text-emerald-400 font-medium"
                        }
                      >
                        {app.riskScore}/100
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(app.status)}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedApp(app);
                        setActiveTab("Overview");
                        setActionType(null);
                        setActionMessage(null);
                      }}
                      className="px-2.5 py-1 rounded text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabbed Application Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101116] rounded-xl border border-white/10 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] text-slate-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-indigo-400">
                    {selectedApp.id}
                  </span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-400">
                    {selectedApp.category}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mt-0.5">
                  {selectedApp.institutionName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/applications/${selectedApp.id}`}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Result Page</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDownloadReport(selectedApp.id)}
                  disabled={downloadingReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
                  title="Generate regulatory decision-support scrutiny PDF report"
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
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Clean Tabs with OCR Extraction */}
            <div className="flex items-center border-b border-white/10 px-4 bg-[#101116] text-xs font-medium text-slate-400 overflow-x-auto">
              {(
                ["Overview", "Documents", "OCR Extraction", "AI Findings", "Agent Timeline", "Review History"] as const
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? "border-red-500 text-red-400 font-semibold"
                      : "border-transparent hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Tab 1: Overview */}
              {activeTab === "Overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div className="text-[10px] uppercase font-medium text-slate-400">
                        Document Authenticity Risk
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-base font-semibold text-white">
                          {selectedApp.documentAuthenticityRisk !== undefined ? `${selectedApp.documentAuthenticityRisk}/100` : "—"}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          selectedApp.authenticityAssessment === "HIGH_RISK"
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : selectedApp.authenticityAssessment === "SUSPICIOUS"
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : selectedApp.authenticityAssessment === "INCONCLUSIVE"
                            ? "bg-slate-500/10 border-slate-500/30 text-slate-400"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        }`}>
                          {selectedApp.authenticityAssessment || "LOW_RISK"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                        {selectedApp.authenticityExplanation || "Forensic & verification evidence summary."}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div className="text-[10px] uppercase font-medium text-slate-400">
                        Application Compliance Risk
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-base font-semibold text-white">
                          {selectedApp.applicationComplianceRisk !== undefined ? `${selectedApp.applicationComplianceRisk}/100` : "—"}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          (selectedApp.applicationComplianceRisk || 0) >= 40
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : (selectedApp.applicationComplianceRisk || 0) > 0
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        }`}>
                          {selectedApp.complianceAssessment || "COMPLIANT"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                        {selectedApp.complianceExplanation || "Regulatory checklist evaluation."}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div className="text-[10px] uppercase font-medium text-slate-400">
                        Application Type
                      </div>
                      <div className="mt-1 font-medium text-white">
                        {selectedApp.approvalType}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div className="text-[10px] uppercase font-medium text-slate-400">
                        Academic Year
                      </div>
                      <div className="mt-1 font-mono text-white">
                        {selectedApp.academicYear}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div className="text-[10px] uppercase font-medium text-slate-400">
                        Submission Date
                      </div>
                      <div className="mt-1 font-mono text-white">
                        {selectedApp.submissionDate}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div className="text-[10px] uppercase font-medium text-slate-400">
                        Current Status
                      </div>
                      <div className="mt-1">{getStatusBadge(selectedApp.status)}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-white mb-1">
                      Scrutiny Summary
                    </h4>
                    <p className="text-xs text-slate-300 p-3 rounded-lg border border-white/10 bg-white/[0.02] leading-relaxed">
                      {selectedApp.summary ||
                        "Application registered. Awaiting automated or manual scrutiny execution."}
                    </p>
                  </div>

                  {/* Verification Ladder Section (Feature 1) */}
                  <div className="pt-2 border-t border-white/10">
                    <VerificationLadder applicationId={selectedApp.id} />
                  </div>
                </div>
              )}

              {/* Tab 2: Documents with Version Tracking (Feature 4) */}
              {activeTab === "Documents" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-white">
                      Attached Documents & Version Ledger ({selectedApp.documents.length})
                    </div>
                    {selectedApp.status === "Rectification Requested" && (
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Rectification Active: Version Resubmission Permitted
                      </span>
                    )}
                  </div>
                  {selectedApp.documents.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No documents attached to this application.
                    </p>
                  ) : (
                    selectedApp.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white truncate text-xs">
                                {doc.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                v{(doc as any).revision || 1}
                              </span>
                              {(doc as any).isCurrent === false && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-500/20 text-slate-400 border border-white/10">
                                  Superseded
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                              SHA-256: {doc.hash}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {doc.ocrStatus || "EXTRACTED"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: OCR Extraction (Feature 2) */}
              {activeTab === "OCR Extraction" && (
                <div className="pt-1">
                  <OCRViewer applicationId={selectedApp.id} />
                </div>
              )}

              {/* Tab 4: AI Findings with View Evidence button */}
              {activeTab === "AI Findings" && (
                <div className="space-y-3">
                  {selectedApp.findings.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-white/[0.02] rounded-lg border border-white/10">
                      No AI findings available. Document analysis has not been
                      completed.
                    </div>
                  ) : (
                    selectedApp.findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="p-3.5 rounded-lg border border-white/10 bg-white/[0.02] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">
                            {finding.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                finding.severity === "High"
                                  ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                                  : finding.severity === "Medium"
                                  ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              }`}
                            >
                              {finding.severity} Severity
                            </span>
                            {/* View Evidence Button */}
                            <button
                              onClick={() => handleOpenEvidence(finding)}
                              className="px-2 py-0.5 rounded text-[11px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors inline-flex items-center gap-1"
                            >
                              <span>View Evidence</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          {finding.detail}
                        </p>

                        {finding.supportingEvidence && (
                          <div className="text-[11px] text-slate-300 bg-white/[0.03] p-2 rounded border border-white/10">
                            <span className="font-semibold text-slate-400">
                              Supporting Evidence:{" "}
                            </span>
                            {finding.supportingEvidence}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                          {finding.tool && <span>Tool: {finding.tool}</span>}
                          {finding.confidence !== undefined && (
                            <span>Confidence: {finding.confidence}%</span>
                          )}
                          {finding.documentRef && (
                            <span>Ref: {finding.documentRef}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 4: Review History */}
              {activeTab === "Review History" && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-white">
                    Application Audit History
                  </div>

                  {selectedApp.history.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No review actions recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedApp.history.map((h) => (
                        <div
                          key={h.id}
                          className="p-2.5 rounded-lg border border-white/10 bg-white/[0.02] flex items-start gap-2"
                        >
                          <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap mt-0.5">
                            {h.timestamp}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-white">
                              {h.actor}:
                            </span>{" "}
                            <span className="text-slate-300 text-[11px]">
                              {h.action}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Agent Execution Timeline */}
              {activeTab === "Agent Timeline" && (
                <div className="space-y-4">
                  <AgentTimeline applicationId={selectedApp.id} />
                </div>
              )}

              {/* Human Review Action Controls (Approve | Request Rectification | Escalate) */}
              <div className="pt-3 border-t border-white/10 space-y-3 bg-white/[0.02] p-3 rounded-lg border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Authorized Official Determination
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {user ? `Official: ${user.name} (${user.role})` : "Authenticated Official"}
                  </span>
                </div>

                {actionMessage && (
                  <div
                    className={`p-2.5 rounded text-xs ${
                      actionMessage.type === "success"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    }`}
                  >
                    {actionMessage.text}
                  </div>
                )}

                {/* Primary 3 Decision Buttons */}
                {!actionType ? (
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      onClick={() => setActionType("approve")}
                      className="px-3 py-1.5 rounded text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setActionType("rectify")}
                      className="px-3 py-1.5 rounded text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                    >
                      Request Rectification
                    </button>
                    <button
                      onClick={() => setActionType("escalate")}
                      className="px-3 py-1.5 rounded text-xs font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      Escalate
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white capitalize">
                        Confirm Decision: {actionType}
                      </span>
                      <button
                        onClick={() => {
                          setActionType(null);
                          setActionReason("");
                          setIsConfirmed(false);
                          setActionMessage(null);
                        }}
                        className="text-[11px] text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>

                    {actionType === "approve" ? (
                      <div className="space-y-2">
                        <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={isConfirmed}
                            onChange={(e) => setIsConfirmed(e.target.checked)}
                            className="mt-0.5 rounded border-white/20 bg-white/5 text-red-600 focus:ring-red-500"
                          />
                          <span>
                            I confirm that statutory norms under APH 2026–27 have been
                            verified and grant regulatory approval.
                          </span>
                        </label>
                        <input
                          type="text"
                          placeholder="Optional approval notes or conditions..."
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white/[0.04] border border-white/10 rounded text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-slate-300">
                          {actionType === "rectify"
                            ? "Documented Rectification Mandate:"
                            : "Escalation Justification for Standing Appellate Committee:"}
                        </label>
                        <textarea
                          rows={2}
                          required
                          placeholder={
                            actionType === "rectify"
                              ? "Specify deficiency (e.g. Provide valid Fire NOC renewal proof within 15 days)..."
                              : "Specify reason for escalation (e.g. Forged surveyor seal detected; referral to SAC committee)..."
                          }
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white/[0.04] border border-white/10 rounded text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={handleExecuteAction}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? "Recording Decision..." : "Submit Determination"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10 bg-white/[0.02] flex justify-end">
              <button
                onClick={() => setSelectedApp(null)}
                className="px-3 py-1.5 rounded text-xs font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forensic Evidence Viewer Modal */}
      <EvidenceModal
        finding={selectedFinding}
        open={evidenceModalOpen}
        onOpenChange={setEvidenceModalOpen}
      />
    </div>
  );
}
