"use client";

import { usePortalAuth, type PortalProject } from "@/lib/portal-auth";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/currency";
import Link from "next/link";

type Tab = "files" | "discussion" | "approvals" | "history";

interface PortalFile { id: number; original_name: string; size_bytes: number; mime_type: string; uploader_kind: string; client_visible: boolean; created_at: string }
interface PortalComment { id: number; body: string; author_kind: string; author_id: number; created_at: string }
interface PortalApproval { id: number; title: string; description: string | null; status: string; response_comment: string | null; responded_at: string | null; created_at: string }
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
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{t("files")}</h2>
                <label className="cursor-pointer rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                  {t("upload")}
                  <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                </label>
              </div>
              {fileError && <p className="mb-2 text-sm text-red-700">{fileError}</p>}
              {files.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">{t("noFiles")}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                      <span className="truncate text-sm text-slate-900">{f.original_name}</span>
                      <div className="flex gap-2">
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
                <ul className="mt-3 space-y-2">
                  {comments.map((c) => (
                    <li key={c.id} className={`rounded-xl border px-4 py-3 text-sm ${c.author_kind === "client" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                      <p className="text-xs text-slate-500">{c.author_kind === "client" ? "You" : "Agency"} · {c.created_at.slice(0, 10)}</p>
                      <p className="mt-1 text-slate-900 whitespace-pre-wrap">{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={handleComment} className="mt-4 space-y-2">
                {commentError && <p className="text-sm text-red-700">{commentError}</p>}
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder={t("comment")} />
                <div className="flex justify-center text-center">
                  <button type="submit" className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">{t("send")}</button>
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
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                        <span className="text-xs font-medium text-slate-500">{a.status}</span>
                      </div>
                      {a.description && <p className="mt-1 text-sm text-slate-600">{a.description}</p>}
                      {a.status === "pending" && (
                        <div className="mt-3 space-y-2">
                          <textarea value={responseComment} onChange={(e) => setResponseComment(e.target.value)} rows={2} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder={t("comment")} />
                          <div className="flex gap-2">
                            <button type="button" disabled={respondingId === a.id} onClick={() => handleRespond(a.id, "approved")} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{t("approve")}</button>
                            <button type="button" disabled={respondingId === a.id} onClick={() => handleRespond(a.id, "changes_requested")} className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">{t("requestChanges")}</button>
                          </div>
                        </div>
                      )}
                      {a.response_comment && (
                        <p className="mt-2 text-sm text-slate-600">“{a.response_comment}”</p>
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
                <ul className="mt-3 space-y-2">
                  {history.map((e, i) => {
                    const d = e as Record<string, unknown>;
                    const actor = String((d.actor as { name?: string } | null)?.name ?? "");
                    const title = String(d.approval_title ?? "");
                    const number = String(d.invoice_number ?? "");
                    const amount = formatMoney(d.amount as string | number, "USD", locale) || String(d.amount ?? "");
                    const decisionRaw = String(d.decision ?? "");
                    const excerpt = String(d.body ?? "").slice(0, 80);
                    let text = "";
                    switch (String(d.type)) {
                      case "comment":
                        text = t("historyTypes.comment", { actor, excerpt });
                        break;
                      case "approval_requested":
                        text = t("historyTypes.approval_requested", { title });
                        break;
                      case "approval_responded": {
                        const decLabel = decisionRaw === "approved" ? t("historyDecisionApproved") : t("historyDecisionChanges");
                        text = t("historyTypes.approval_responded", { actor, decision: decLabel, title });
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
                      <li key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        <p>{text}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(String(d.occurred_at)).toLocaleString(locale)}</p>
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
