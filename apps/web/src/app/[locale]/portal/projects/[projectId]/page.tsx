"use client";

import { usePortalAuth, type PortalProject } from "@/lib/portal-auth";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/currency";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/shell/Icon";

type Tab = "files" | "discussion" | "approvals" | "history";

function approvalStatusClass(status: string): string {
  switch (status) {
    case "approved": return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "changes_requested": return "border-rose-200 bg-rose-100 text-rose-800";
    default: return "border-amber-200 bg-amber-100 text-amber-800";
  }
}

function fileIcon(name: string, mime: string): string {
  const n = name.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(n)) return "image";
  if (mime === "application/pdf" || /\.pdf$/i.test(n)) return "file-text";
  if (/\.(xlsx?|csv|ods)$/i.test(n) || mime.includes("spreadsheet") || mime.includes("csv")) return "file-spreadsheet";
  if (/\.(zip|rar|7z|tar|gz)$/i.test(n) || mime.includes("zip") || mime.includes("archive")) return "archive";
  return "file";
}

function Dropzone({ onFile, label, error }: { onFile: (f: File) => void; label: string; error: string | null }) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) { setSelected(f); onFile(f); } }}
      onClick={() => inputRef.current?.click()}
      className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50"}`}
    >
      <Icon name="upload" className="h-6 w-6 text-slate-400" />
      <p className="mt-2 text-sm text-slate-600">{selected ? selected.name : label}</p>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelected(f); onFile(f); } e.target.value = ""; }} />
    </div>
  );
}

interface PortalFile { id: number; original_name: string; size_bytes: number; mime_type: string; uploader_kind: string; client_visible: boolean; created_at: string; uploaded_by?: { id: number; name: string } }
interface PortalComment { id: number; body: string; author_kind: string; author_id: number; created_at: string; author?: { id: number; name: string } }
interface PortalApproval { id: number; title: string; description: string | null; status: string; response_comment: string | null; responded_at: string | null; created_at: string; responded_by?: { id: number; name: string } }
interface HistoryEvent { type: string; created_at: string; [k: string]: unknown }

export default function PortalProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { session, isLoading } = usePortalAuth();
  const router = useRouter();
  const tp = useTranslations("Portal");
  const ts = useTranslations("Projects");
  const locale = useLocale();
  const t = useTranslations("Portal");

  const [project, setProject] = useState<PortalProject | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>("files");

  // Files
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  // Discussion
  const [comments, setComments] = useState<PortalComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  // Approvals
  const [approvals, setApprovals] = useState<PortalApproval[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [responseComment, setResponseComment] = useState("");
  const [approvalError, setApprovalError] = useState<string | null>(null);
  // History
  const [history, setHistory] = useState<HistoryEvent[]>([]);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/portal/login");
  }, [isLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portal/projects/${projectId}`, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("load failed");
        const body = await res.json();
        if (!cancelled) setProject(body.data as PortalProject);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, projectId]);

  useEffect(() => {
    if (!session || !project) return;
    let cancelled = false;
    (async () => {
      setFilesLoading(true);
      try {
        const res = await fetch(`/api/portal/projects/${projectId}/files`, { headers: { Accept: "application/json" } });
        if (res.ok) { const b = await res.json(); if (!cancelled) setFiles(b.data || []); }
      } catch {}
      try {
        const res = await fetch(`/api/portal/projects/${projectId}/comments`, { headers: { Accept: "application/json" } });
        if (res.ok) { const b = await res.json(); if (!cancelled) setComments(b.data || []); }
      } catch {}
      try {
        const res = await fetch(`/api/portal/projects/${projectId}/approvals`, { headers: { Accept: "application/json" } });
        if (res.ok) { const b = await res.json(); if (!cancelled) setApprovals(b.data || []); }
      } catch {}
      try {
        const res = await fetch(`/api/portal/projects/${projectId}/history`, { headers: { Accept: "application/json" } });
        if (res.ok) { const b = await res.json(); if (!cancelled) setHistory(b.data || []); }
      } catch {}
      if (!cancelled) setFilesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session, project, projectId]);

  const [fileError, setFileError] = useState<string | null>(null);
  const handleUpload = async (file: File) => {
    setFileError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/portal/projects/${projectId}/files`, { method: "POST", body: fd });
      if (res.ok) {
        const b = await res.json();
        setFiles((prev) => [b.data, ...prev]);
      } else {
        const b = await res.json().catch(() => null);
        setFileError(b?.error?.message || t("uploadFailed"));
      }
    } catch {
      setFileError(t("uploadFailed"));
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    setFileError(null);
    try {
      const res = await fetch(`/api/portal/projects/${projectId}/files/${fileId}`, { method: "DELETE" });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } else {
        const b = await res.json().catch(() => null);
        setFileError(b?.error?.message || t("deleteFailed"));
      }
    } catch {
      setFileError(t("deleteFailed"));
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommentError(null);
    try {
      const res = await fetch(`/api/portal/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      if (!res.ok) throw new Error("fail");
      const b = await res.json();
      setComments((prev) => [...prev, b.data]);
      setNewComment("");
    } catch {
      setCommentError(t("loadError"));
    }
  };

  const handleRespond = async (approvalId: number, decision: "approved" | "changes_requested") => {
    setApprovalError(null);
    if (decision === "changes_requested" && !responseComment.trim()) {
      setApprovalError(t("commentRequired"));
      return;
    }
    setRespondingId(approvalId);
    try {
      const res = await fetch(`/api/portal/projects/${projectId}/approvals/${approvalId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ decision, comment: responseComment.trim() || undefined }),
      });
      if (res.status === 422) {
        setApprovalError(t("alreadyResponded"));
        // reload approvals
        const r = await fetch(`/api/portal/projects/${projectId}/approvals`, { headers: { Accept: "application/json" } });
        if (r.ok) { const b = await r.json(); setApprovals(b.data || []); }
        return;
      }
      if (!res.ok) throw new Error("fail");
      const b = await res.json();
      setApprovals((prev) => prev.map((a) => (a.id === approvalId ? b.data : a)));
      setResponseComment("");
    } catch {
      setApprovalError(t("loadError"));
    } finally {
      setRespondingId(null);
    }
  };

  if (isLoading || !session) return null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
        ← {tp("back")}
      </Link>

      {loadError ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{tp("loadError")}</p>
      ) : project === null ? (
        <p className="mt-6 text-sm text-slate-500">…</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
          </div>
          {project.description && (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{project.description}</p>
          )}

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{tp("progress")}</span>
              <span>{tp("tasksDone", { done: project.tasks_done_count ?? 0, total: project.tasks_count ?? 0 })} · {project.progress_percent ?? 0}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${project.progress_percent ?? 0}%` }} />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200">
            {(["files", "discussion", "approvals", "history"] as Tab[]).map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTab(tb)}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors rounded-sm flex-1 ${
                  tab === tb ? "border-emerald-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t(tb === "files" ? "files" : tb === "discussion" ? "discussion" : tb === "approvals" ? "approvals" : "history")}
              </button>
            ))}
          </div>

          {/* Files */}
          {tab === "files" && (
            <section className="mt-4">
              <h2 className="text-lg font-semibold text-slate-900">{t("files")}</h2>
              <Dropzone onFile={handleUpload} label={t("upload")} error={fileError} />
              {files.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">{t("noFiles")}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Icon name={fileIcon(f.original_name, f.mime_type)} className="h-5 w-5 shrink-0 text-slate-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-900">{f.original_name}</p>
                          {f.uploaded_by && (
                            <p className="flex items-center gap-1 text-xs text-slate-500">
                              <Avatar name={f.uploaded_by.name} seed={f.uploaded_by.id} className="h-4 w-4 text-[9px]" />
                              {f.uploaded_by.name} · {String(f.created_at).slice(0, 10)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <a href={`/api/portal/projects/${projectId}/files/${f.id}/download`} className="text-xs font-medium text-emerald-700 hover:underline">{t("download")}</a>
                        {f.uploader_kind === "client" && (
                          <button type="button" onClick={() => handleDeleteFile(f.id)} className="text-xs font-medium text-red-600 hover:underline">{t("delete")}</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Discussion */}
          {tab === "discussion" && (
            <section className="mt-4">
              <h2 className="text-lg font-semibold text-slate-900">{t("discussion")}</h2>
              {comments.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">{t("noComments")}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className={`flex gap-3 rounded-xl px-4 py-3 text-sm ${c.author_kind === "client" ? "bg-emerald-50/60" : "bg-violet-50/60"}`}>
                      <Avatar name={c.author?.name ?? t("unknownAuthor")} seed={c.author_id} className="h-8 w-8 shrink-0 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-600">{c.author?.name ?? t("unknownAuthor")} · {c.created_at.slice(0, 10)}</p>
                        <p className="mt-1 whitespace-pre-wrap text-slate-900">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={handleComment} className="mt-4 space-y-2">
                {commentError && <p className="text-sm text-red-700">{commentError}</p>}
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder={t("comment")} />
                <div className="flex justify-center text-center">
                  <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                    <Icon name="send" className="h-4 w-4" />
                    {t("send")}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Approvals */}
          {tab === "approvals" && (
            <section className="mt-4">
              <h2 className="text-lg font-semibold text-slate-900">{t("approvals")}</h2>
              {approvalError && <p className="mt-2 text-sm text-red-700">{approvalError}</p>}
              {approvals.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">{t("noApprovals")}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {approvals.map((a) => (
                    <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                        <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${approvalStatusClass(a.status)}`}>{t(`approvalStatuses.${a.status}`)}</span>
                      </div>
                      {a.description && <p className="mt-1 text-sm text-slate-600">{a.description}</p>}
                      {a.status === "pending" && (
                        <div className="mt-3 space-y-2">
                          <textarea value={responseComment} onChange={(e) => setResponseComment(e.target.value)} rows={2} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder={t("comment")} />
                          <div className="flex gap-2">
                            <button type="button" disabled={respondingId === a.id} onClick={() => handleRespond(a.id, "approved")} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                              <Icon name="check" className="h-3.5 w-3.5" />
                              {t("approve")}
                            </button>
                            <button type="button" disabled={respondingId === a.id} onClick={() => handleRespond(a.id, "changes_requested")} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
                              <Icon name="x" className="h-3.5 w-3.5" />
                              {t("requestChanges")}
                            </button>
                          </div>
                        </div>
                      )}
                      {a.response_comment && a.responded_at && (
                        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Icon name="reply" className="h-3.5 w-3.5 text-slate-400" />
                            <Avatar name={a.responded_by?.name ?? "Unknown"} seed={a.responded_by?.id ?? 0} className="h-5 w-5 text-[9px]" />
                            <span className="text-xs font-medium text-slate-700">{a.responded_by?.name ?? "Unknown"}</span>
                            <span className="text-xs text-slate-400">{new Date(String(a.responded_at)).toLocaleString(locale)}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{a.response_comment}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* History */}
          {tab === "history" && (
            <section className="mt-4">
              <h2 className="text-lg font-semibold text-slate-900">{t("history")}</h2>
              {history.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">{t("noHistory")}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {history.map((e, i) => {
                    const d = e as Record<string, unknown>;
                    const actorName = String((d.actor as { name?: string } | null)?.name ?? (d.author as { name?: string } | null)?.name ?? "");
                    const actorId = Number((d.actor as { id?: number } | null)?.id ?? (d.author as { id?: number } | null)?.id ?? 0);
                    const title = String(d.approval_title ?? "");
                    const number = String(d.invoice_number ?? "");
                    const amount = formatMoney(d.amount as string | number, "USD", locale) || String(d.amount ?? "");
                    const decisionRaw = String(d.decision ?? "");
                    const excerpt = String(d.body ?? "").slice(0, 80);
                    const excerptDisplay = String(d.body ?? "").length > 80 ? excerpt + "…" : excerpt;
                    let text = "";
                    switch (String(d.type)) {
                      case "comment":
                        text = t("historyTypes.comment", { actor: actorName, excerpt: excerptDisplay });
                        break;
                      case "approval_requested":
                        text = t("historyTypes.approval_requested", { title });
                        break;
                      case "approval_responded": {
                        const decLabel = decisionRaw === "approved" ? t("historyDecisionApproved") : t("historyDecisionChanges");
                        text = t("historyTypes.approval_responded", { actor: actorName, decision: decLabel, title });
                        break;
                      }
                      case "invoice_issued":
                        text = t("historyTypes.invoice_issued", { number, amount });
                        break;
                      case "invoice_paid":
                        text = t("historyTypes.invoice_paid", { number, amount });
                        break;
                      default:
                        text = String(d.type);
                    }
                    return (
                      <li key={i} className="flex gap-3 rounded-xl bg-slate-50/60 px-4 py-3 text-sm text-slate-700">
                        <Avatar name={actorName || "?"} seed={actorId} className="h-8 w-8 shrink-0 text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="text-slate-900">{text}</p>
                          <p className="mt-1 text-xs text-slate-500">{new Date(String(d.occurred_at)).toLocaleString(locale)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
