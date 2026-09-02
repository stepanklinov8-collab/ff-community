"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flag, MessageCircle, Pencil, Send, Trash2, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

interface CommentRow {
  id: string;
  author_id: string;
  body: string;
  is_edited: boolean;
  created_at: string;
  nickname: string;
  avatar_url: string | null;
}

export default function CommentsSection({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadComments = useCallback(async () => {
    const { data: rows } = await supabase
      .from("comments")
      .select("id, author_id, body, is_edited, created_at")
      .eq("event_id", eventId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });
    const authorIds = [...new Set((rows ?? []).map((row) => row.author_id))];
    const { data: profiles } = authorIds.length
      ? await supabase.from("profiles").select("id, nickname, avatar_url").in("id", authorIds)
      : { data: [] };
    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    setComments((rows ?? []).map((row) => ({
      ...row,
      nickname: profilesById.get(row.author_id)?.nickname ?? "Игрок OMCITE",
      avatar_url: profilesById.get(row.author_id)?.avatar_url ?? null,
    })));
  }, [eventId, supabase]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) setUser(data.user); });
    const timer = window.setTimeout(() => { void loadComments(); }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [loadComments, supabase]);

  async function submitComment() {
    if (!user) { setMessage("Войдите, чтобы оставить комментарий"); return; }
    const cleanBody = body.trim();
    if (!cleanBody) return;
    setBusy(true);
    const { error } = await supabase.from("comments").insert({
      event_id: eventId,
      author_id: user.id,
      body: cleanBody,
    });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setBody("");
    setMessage("");
    await loadComments();
  }

  async function saveEdit(commentId: string) {
    const cleanBody = editingBody.trim();
    if (!cleanBody) return;
    const { error } = await supabase.from("comments").update({
      body: cleanBody,
      is_edited: true,
      updated_at: new Date().toISOString(),
    }).eq("id", commentId);
    if (error) { setMessage(error.message); return; }
    setEditingId(null);
    await loadComments();
  }

  async function removeComment(commentId: string) {
    if (!window.confirm("Удалить комментарий?")) return;
    const { error } = await supabase.from("comments").update({
      is_deleted: true,
      body: "Комментарий удалён",
      updated_at: new Date().toISOString(),
    }).eq("id", commentId);
    if (error) { setMessage(error.message); return; }
    await loadComments();
  }

  async function reportComment(commentId: string) {
    if (!user) { setMessage("Войдите, чтобы отправить жалобу"); return; }
    const reason = window.prompt("Кратко укажите причину жалобы");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("comment_reports").insert({
      comment_id: commentId,
      reported_by: user.id,
      reason: reason.trim(),
    });
    setMessage(error ? error.message : "Жалоба отправлена модератору");
  }

  return (
    <section className="cyber-card mt-6 p-5 md:p-7">
      <div className="flex items-center gap-3 mb-5">
        <MessageCircle className="text-cyan-300" />
        <div><span className="section-kicker">ОБСУЖДЕНИЕ</span><h2 className="text-xl font-bold">Комментарии · {comments.length}</h2></div>
      </div>

      <div className="flex gap-2 items-end mb-6">
        <textarea
          rows={2}
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={user ? "Напишите комментарий..." : "Войдите, чтобы участвовать в обсуждении"}
          disabled={!user || busy}
        />
        <button type="button" onClick={submitComment} disabled={!user || busy || !body.trim()} className="icon-button shrink-0 disabled:opacity-40" aria-label="Отправить">
          <Send size={18} />
        </button>
      </div>

      {message && <p className="text-sm text-cyan-200 mb-4">{message}</p>}
      <div className="space-y-3">
        {comments.length === 0 && <p className="text-slate-500 text-sm py-5 text-center">Начните обсуждение мероприятия.</p>}
        {comments.map((comment) => (
          <article key={comment.id} className="rounded-xl border border-sky-900/20 bg-slate-950/35 p-4">
            <header className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-cyan-950 text-cyan-200 font-bold">{comment.nickname[0]?.toUpperCase()}</span>
                <div><strong className="text-sm">{comment.nickname}</strong><p className="text-xs text-slate-500">{new Date(comment.created_at).toLocaleString("ru")}{comment.is_edited ? " · изменён" : ""}</p></div>
              </div>
              <div className="flex items-center gap-1">
                {user?.id === comment.author_id && (
                  <>
                    <button type="button" onClick={() => { setEditingId(comment.id); setEditingBody(comment.body); }} className="p-2 text-slate-500 hover:text-cyan-300" aria-label="Редактировать"><Pencil size={15} /></button>
                    <button type="button" onClick={() => removeComment(comment.id)} className="p-2 text-slate-500 hover:text-red-300" aria-label="Удалить"><Trash2 size={15} /></button>
                  </>
                )}
                {user?.id !== comment.author_id && (
                  <button type="button" onClick={() => reportComment(comment.id)} className="p-2 text-slate-500 hover:text-amber-300" aria-label="Пожаловаться"><Flag size={15} /></button>
                )}
              </div>
            </header>
            {editingId === comment.id ? (
              <div className="flex gap-2 items-end">
                <textarea rows={2} value={editingBody} onChange={(event) => setEditingBody(event.target.value)} />
                <button type="button" onClick={() => saveEdit(comment.id)} className="icon-button"><Send size={16} /></button>
                <button type="button" onClick={() => setEditingId(null)} className="icon-button"><X size={16} /></button>
              </div>
            ) : <p className="text-sm text-slate-200 whitespace-pre-wrap leading-6">{comment.body}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
