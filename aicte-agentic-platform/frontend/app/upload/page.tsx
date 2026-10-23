"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { UploadCloud, FileText, X, ArrowRight, Plus } from "lucide-react";
import {
  submitApplication,
  uploadApplicationDocument,
  queueApplicationForProcessing,
} from "@/lib/api";

interface SelectedFile {
  name: string;
  size: string;
  type: string;
  rawFile?: File;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [institutionName, setInstitutionName] = useState("");
  const [category, setCategory] = useState<
    "Engineering & Tech" | "Management" | "Pharmacy" | "Architecture"
  >("Engineering & Tech");
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [approvalType, setApprovalType] = useState(
    "Extension of Approval (EOA)"
  );
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles: SelectedFile[] = Array.from(e.target.files).map((f) => ({
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      type: f.name.toLowerCase().includes("noc")
        ? "Statutory NOC"
        : f.name.toLowerCase().includes("land")
        ? "Land Ownership"
        : f.name.toLowerCase().includes("faculty")
        ? "Faculty Roster"
        : "Institutional Document",
      rawFile: f
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleAddSamplePack = () => {
    // Generate actual synthetic sample blobs so backend receives genuine files
    const dummyPdfContent = "%PDF-1.4\n1 0 obj\n<< /Title (Synthetic AICTE Test Dossier) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF";
    const f1 = new File([dummyPdfContent], "Fire_Safety_NOC.pdf", { type: "application/pdf" });
    const f2 = new File([dummyPdfContent], "Land_Title_Deed.pdf", { type: "application/pdf" });
    const f3 = new File([dummyPdfContent], "Faculty_Roster.pdf", { type: "application/pdf" });

    setFiles([
      { name: "Fire_Safety_NOC.pdf", size: "1.8 KB", type: "Statutory NOC", rawFile: f1 },
      { name: "Land_Title_Deed.pdf", size: "1.8 KB", type: "Land Ownership", rawFile: f2 },
      { name: "Faculty_Roster.pdf", size: "1.8 KB", type: "Faculty Roster", rawFile: f3 },
    ]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleStartValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionName.trim()) {
      setError("Please enter the Institution Name.");
      return;
    }
    if (files.length === 0) {
      setError("Please attach at least one document before submitting.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // 1. Create application record
      const app = await submitApplication({
        institutionName,
        category,
        program: category,
        approvalType,
        academicYear,
      });

      // 2. Upload actual files
      for (const f of files) {
        if (f.rawFile) {
          try {
            await uploadApplicationDocument(app.id, f.rawFile, f.type);
          } catch (uploadErr) {
            console.warn(`Failed to upload ${f.name}:`, uploadErr);
          }
        }
      }

      // 3. Queue for AI agentic processing
      try {
        await queueApplicationForProcessing(app.id);
      } catch (queueErr) {
        console.warn("Processing job queueing notice:", queueErr);
      }

      router.push(`/applications/${app.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex h-screen w-full bg-[#08090d] overflow-hidden text-slate-100">
      <Sidebar className="hidden md:flex" />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          title="Upload Documents"
          subtitle="Submit institutional application dossiers for multi-agent validation"
          showNewButton={false}
        />

        <main className="flex-1 overflow-y-auto p-6 max-w-4xl">
          <form onSubmit={handleStartValidation} className="space-y-6">
            {error && (
              <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            {/* Institution Metadata Form */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">
                1. Institutional Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter official institution name"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    disabled
                    value={academicYear}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(
                        e.target.value as
                          | "Engineering & Tech"
                          | "Management"
                          | "Pharmacy"
                          | "Architecture"
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Engineering & Tech">
                      Engineering & Technology
                    </option>
                    <option value="Management">Management (MBA/PGDM)</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Architecture">Architecture & Planning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Application Type
                  </label>
                  <select
                    value={approvalType}
                    onChange={(e) => setApprovalType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Extension of Approval (EOA)">
                      Extension of Approval (EOA)
                    </option>
                    <option value="New Institution Establishment">
                      New Institution Establishment
                    </option>
                    <option value="Intake Variation / Course Addition">
                      Intake Variation / Course Addition
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Document Upload Zone */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  2. Statutory Document Attachments
                </h2>
                <button
                  type="button"
                  onClick={handleAddSamplePack}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  + Add Sample Document Pack
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-white/20 rounded-lg p-8 text-center bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-medium text-slate-800">
                  Click to browse files or drag and drop document PDFs
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Supports Land Deeds, Fire NOCs, Building Plans, Faculty Rosters
                </div>
              </div>

              {/* Uploaded File List */}
              {files.length > 0 ? (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-medium text-slate-700">
                    Attached for Intake ({files.length} document
                    {files.length === 1 ? "" : "s"})
                  </div>
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-slate-800 truncate">
                            {file.name}
                          </span>
                          <span className="text-slate-400 ml-2 font-mono text-[11px]">
                            {file.size} • {file.type}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No documents selected yet.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSubmitting || files.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <span>
                  {isSubmitting
                    ? "Recording Application..."
                    : "Submit Application"}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
