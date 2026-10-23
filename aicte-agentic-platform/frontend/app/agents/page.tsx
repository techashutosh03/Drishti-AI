"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AgentWorkflow, AgentExecution } from "@/components/drishti/agent-workflow";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  XCircle,
  MinusCircle,
  GitFork,
  ListTree,
} from "lucide-react";
import { fetchWorkflow } from "@/lib/api";
import { AgentWorkflowStage, AgentExecutionStatus } from "@/lib/types";

export default function AgentsPage() {
  const [stages, setStages] = useState<AgentWorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string>("orchestrator");
  const [activeTab, setActiveTab] = useState<"flow" | "list">("flow");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      let targetAppId: string | undefined = undefined;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        targetAppId = params.get("appId") || undefined;
      }
      const data = await fetchWorkflow(targetAppId);
      setStages(data);
    } catch (err: any) {
      setError(err?.message || "Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map actual API agent execution stages to the interactive workflow graph format
  const actualExecutions: AgentExecution[] = useMemo(() => {
    if (!stages || stages.length === 0) return [];

    const getStage = (idMatch: string) =>
      stages.find(
        (s) =>
          (s.id && s.id.toLowerCase().includes(idMatch)) ||
          (s.name && s.name.toLowerCase().includes(idMatch))
      );

    const intakeStage = getStage("intake");
    const docStage = getStage("document");
    const orchStage = getStage("orchestrator") || getStage("routing");
    const forensicsStage =
      stages.find(
        (s) => s.id === "forensics" || s.name?.toLowerCase().includes("forensic")
      ) ||
      orchStage?.subModules?.find((m) =>
        m.name?.toLowerCase().includes("forensic")
      );
    const verificationStage =
      stages.find(
        (s) => s.id === "verification" || s.name?.toLowerCase().includes("verification")
      ) ||
      orchStage?.subModules?.find(
        (m) =>
          m.name?.toLowerCase().includes("verification") ||
          m.name?.toLowerCase().includes("registry")
      );
    const complianceStage = getStage("compliance");

    const list: AgentExecution[] = [];

    if (intakeStage) {
      list.push({
        id: "intake",
        name: intakeStage.name || "Intake Agent",
        status: intakeStage.status,
      });
    }
    if (docStage) {
      list.push({
        id: "document",
        name: docStage.name || "Document Agent",
        status: docStage.status,
      });
    }
    if (orchStage) {
      list.push({
        id: "orchestrator",
        name: orchStage.name || "Orchestrator Agent",
        status: orchStage.status,
      });
    }
    if (forensicsStage) {
      list.push({
        id: "forensics",
        name: forensicsStage.name || "Forensics Agent",
        status: forensicsStage.status,
      });
    }
    if (verificationStage) {
      list.push({
        id: "verification",
        name: verificationStage.name || "Verification Agent",
        status: verificationStage.status,
      });
    }
    if (complianceStage) {
      list.push({
        id: "compliance",
        name: complianceStage.name || "Compliance Agent",
        status: complianceStage.status,
      });
    }

    return list;
  }, [stages]);

  const getStatusBadge = (status: AgentExecutionStatus | string) => {
    const s = (status || "").toLowerCase();
    if (s === "completed") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Completed
        </span>
      );
    }
    if (s === "running") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
          <Clock className="w-3 h-3 text-amber-400" />
          Running
        </span>
      );
    }
    if (s === "needs review") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
          <AlertCircle className="w-3 h-3 text-orange-400" />
          Needs Review
        </span>
      );
    }
    if (s === "skipped") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
          <MinusCircle className="w-3 h-3 text-slate-400" />
          Skipped
        </span>
      );
    }
    if (s === "failed") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
          <XCircle className="w-3 h-3 text-rose-400" />
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
        Not Started
      </span>
    );
  };

  return (
    <div className="flex h-screen w-full bg-[#08090d] overflow-hidden text-slate-100">
      <Sidebar className="hidden md:flex" />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          title="AI Processing Pipeline"
          subtitle="Multi-agent workflow: Intake → Document → Orchestrator → Forensics/Verification → Compliance"
          showNewButton={false}
        />

        <main className="flex-1 overflow-y-auto p-6 max-w-6xl space-y-6">
          {/* Header Controls & View Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Agentic Orchestration Graph
              </h2>
              <p className="text-xs text-gray-400">
                Real-time multi-agent execution pipeline with conditional routing branches
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#12131a] p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab("flow")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "flow"
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <GitFork size={14} />
                Interactive Flow
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "list"
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <ListTree size={14} />
                Detailed List
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-xs text-red-400">
              {error}
            </div>
          )}

          {loading && !error && (
            <div className="rounded-xl border border-white/10 bg-[#101116] p-12 text-center text-xs text-gray-400 animate-pulse">
              Loading agent execution states...
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Interactive Flow Graph */}
              {activeTab === "flow" && (
                <div className="space-y-4">
                  <AgentWorkflow executions={actualExecutions} />
                  <p className="text-xs text-gray-400 text-center">
                    Visualizing actual pipeline execution state. Pan and zoom using the controls.
                  </p>
                </div>
              )}

              {/* Detailed Breakdown List */}
              <div className={`space-y-3 ${activeTab === "flow" ? "mt-6" : ""}`}>
                <h3 className="text-sm font-semibold text-white tracking-tight pt-2">
                  Stage Execution Details
                </h3>

                {stages.map((stage) => {
                  const isExpanded = expandedId === stage.id;

                  return (
                    <div
                      key={stage.id}
                      className="drishti-card overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? "" : stage.id)
                        }
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs text-red-400/80 font-bold">
                            {stage.number}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-white">
                              {stage.name}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                              {stage.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {stage.duration && (
                            <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">
                              {stage.duration}
                            </span>
                          )}
                          {getStatusBadge(stage.status)}
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Stage Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-white/10 bg-[#0d0e13]/60 space-y-3">
                          {stage.reason && (
                            <p className="text-[11px] text-gray-400 italic">
                              Status Reason: {stage.reason}
                            </p>
                          )}

                          {stage.subModules && stage.subModules.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Conditional Branch Executions:
                              </div>
                              {stage.subModules.map((sub, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="p-3 rounded-lg border border-white/10 bg-[#14151c] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                  <div>
                                    <div className="font-medium text-white">
                                      {sub.name}
                                      <span className="text-gray-400 font-normal ml-2 font-mono text-[10px]">
                                        ({sub.engine})
                                      </span>
                                    </div>
                                    <p className="text-gray-400 text-[11px] mt-0.5">
                                      {sub.findings ||
                                        sub.reason ||
                                        "Awaiting execution criteria."}
                                    </p>
                                  </div>
                                  <div>{getStatusBadge(sub.status)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
