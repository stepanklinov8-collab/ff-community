"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { authFetch, createClient } from "@/platform/browser-services";
import type { ChatHistory, ChatIndex, ChatMessage, ChatMutation, ChatRoom } from "../model";
import { copy, type CopyKey } from "../copy";
import styles from "./chat.module.css";

async function api<T>(query = "", input?: ChatMutation): Promise<T> {
  const response = await authFetch("/api/chat" + query, input ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.code ?? (response.status === 401 ? "CHAT_AUTH" : "CHAT_UNAVAILABLE"));
  return data as T;
}
function Avatar({ name, url }: { name: string; url?: string | null }) {
  const [failed, setFailed] = useState(false);
  return <span className={styles.avatar}>{url && !failed ? <Image src={url} alt="" width={40} height={40} unoptimized onError={() => setFailed(true)} /> : name.slice(0, 2)}</span>;
}
type Paging = { before?: number; after?: number };
type Draft = { body: string; reply: ChatMessage | null; notice: "none" | "admins" | "all" | "user"; recipient: string; people: { id: string; nickname: string }[]; search: string };
export default function ChatPage() {
  const { locale, formatDate } = useLanguage();
  const t = useCallback((key: string) => (copy[key as CopyKey] ?? copy.CHAT_UNAVAILABLE)[locale === "kk" ? 1 : locale === "ky" ? 2 : 0], [locale]);
  const db = useMemo(() => createClient(), []);
  const [account, setAccount] = useState<string | null | undefined>();
  const [index, setIndex] = useState<ChatIndex | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatHistory | null>(null);
  const [paging, setPaging] = useState<Paging>({});
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [notice, setNotice] = useState<"none" | "admins" | "all" | "user">("none");
  const [recipient, setRecipient] = useState("");
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<{ id: string; nickname: string }[]>([]);
  const [editing, setEditing] = useState<{ message: ChatMessage; body: string } | null>(null);
  const [mute, setMute] = useState<{ id: string | null; name: string } | null>(null);
  const [muteMinutes, setMuteMinutes] = useState("30");
  const [forever, setForever] = useState(false);
  const [reason, setReason] = useState("");
  const lastRequests = useRef<Record<string, { fingerprint: string; id: string }>>({});
  const drafts = useRef<Record<string, Draft>>({});
  const bottom = useRef<HTMLDivElement>(null);
  const currentRoom = index?.rooms.find(room => room.id === roomId);
  const isAdmin = Boolean(index?.isAdmin);

  const loadIndex = useCallback(async () => {
    const value = await api<ChatIndex>();
    setIndex(value);
    return value;
  }, []);
  const showError = useCallback((failure: unknown) => setError(failure instanceof Error ? failure.message : "CHAT_UNAVAILABLE"), []);

  useEffect(() => {
    let active = true;
    void db.auth.getUser().then(({ data }) => { if (active) setAccount(data.user?.id ?? null); }).catch(() => { if (active) setAccount(null); });
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      if (active) setAccount(session?.user.id ?? null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [db]);

  useEffect(() => {
    if (!account) return;
    let active = true;
    void api<ChatIndex>().then(value => {
      if (!active) return;
      setIndex(value);
      setHistory(null); setBody(""); setReply(null); setPaging({}); drafts.current = {}; lastRequests.current = {};
      setNotice("none"); setRecipient(""); setSearch(""); setPeople([]); setEditing(null); setMute(null);
      const requested = new URLSearchParams(window.location.search).get("room");
      setRoomId(requested && /^[0-9a-f-]{36}$/i.test(requested) ? requested : value.rooms.find(room => room.kind === "common")?.id ?? null);
    }).catch(failure => { if (active) showError(failure); });
    return () => { active = false; };
  }, [account, showError]);

  useEffect(() => {
    if (!account || !roomId) return;
    let active = true;
    const query = new URLSearchParams({ roomId });
    if (paging.before !== undefined) query.set("before", String(paging.before));
    if (paging.after !== undefined) query.set("after", String(paging.after));
    void api<ChatHistory>("?" + query).then(value => {
      if (!active) return;
      setHistory(value); setLoading(false);
      if (paging.before === undefined && paging.after === undefined) requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: "nearest" }));
    }).catch(failure => {
      if (!active) return;
      if (["CHAT_AUTH", "CHAT_FORBIDDEN"].includes(failure.message)) setHistory(null);
      setLoading(false); showError(failure);
    });
    return () => { active = false; };
  }, [account, roomId, paging, refresh, showError]);

  useEffect(() => {
    if (!account || !roomId || !index) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    let online = false;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!active || document.visibilityState !== "visible") return;
        setRefresh(value => value + 1);
        void loadIndex().catch(showError);
      }, 300);
    };
    const roomChannel = db.channel("chat:room:" + roomId, { config: { private: true } })
      .on("broadcast", { event: "changed" }, update)
      .subscribe(status => {
        online = status === "SUBSCRIBED";
        if (active) setConnected(online);
        if (online) update();
      });
    const inboxChannel = db.channel(isAdmin ? "chat:admins" : "chat:user:" + account, { config: { private: true } })
      .on("broadcast", { event: "changed" }, update).subscribe();
    // Recover dropped hints and changed permissions even with a connected socket.
    let ticks = 0;
    const fallback = setInterval(() => { if (!online || ++ticks % 2 === 0) update(); }, 30000);
    window.addEventListener("online", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false; clearTimeout(timer); clearInterval(fallback);
      window.removeEventListener("online", update); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update);
      void db.removeChannel(roomChannel); void db.removeChannel(inboxChannel);
    };
    // The subscription depends on identity and role, not on unread counters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, roomId, isAdmin, db, loadIndex, showError]);

  useEffect(() => {
    const position = history?.messages.at(-1)?.position;
    if (!roomId || position === undefined) return;
    let active = true;
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      void api("", { action: "read", roomId, position }).then(() => {
        if (!active) return;
        if (!history?.hasNewer) setIndex(value => value ? { ...value, rooms: value.rooms.map(room => room.id === roomId ? { ...room, unread: false } : room) } : value);
        window.dispatchEvent(new Event("omcite-chat-read"));
      }).catch(() => undefined);
    };
    mark(); document.addEventListener("visibilitychange", mark);
    return () => { active = false; document.removeEventListener("visibilitychange", mark); };
  }, [history, roomId]);

  useEffect(() => {
    if (notice !== "user" || search.trim().length < 2 || !roomId) return;
    let active = true;
    const timer = setTimeout(() => {
      void api<{ people: typeof people }>("?" + new URLSearchParams({ roomId, search: search.trim() })).then(value => {
        if (active) setPeople(value.people);
      }).catch(showError);
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [search, notice, roomId, showError]);

  function choose(room: string) {
    if (roomId) drafts.current[roomId] = { body, reply, notice, recipient, people, search };
    const draft = drafts.current[room];
    setRoomId(room); setHistory(null); setPaging({}); setLoading(true); setError("");
    setBody(draft?.body ?? ""); setReply(draft?.reply ?? null); setNotice(draft?.notice ?? "none"); setRecipient(draft?.recipient ?? "");
    setPeople(draft?.people ?? []); setSearch(draft?.search ?? ""); setEditing(null); setMute(null);
    window.history.replaceState(null, "", "/chat?room=" + room);
  }
  async function openSupport() {
    setBusy(true); setError("");
    try { const result = await api<{ roomId: string }>("", { action: "open_support" }); await loadIndex(); choose(result.roomId); }
    catch (failure) { showError(failure); } finally { setBusy(false); }
  }
  async function mutate(input: ChatMutation) {
    setBusy(true); setError("");
    try { await api("", input); setRefresh(value => value + 1); return true; }
    catch (failure) { showError(failure); setRefresh(value => value + 1); return false; }
    finally { setBusy(false); }
  }
  async function send() {
    if (!roomId || !body.trim()) return;
    const payload = { action: "send" as const, roomId, body: body.trim(), replyTo: reply?.id ?? null, notify: notice, notifyUserId: notice === "user" ? recipient : null };
    const fingerprint = JSON.stringify(payload);
    if (lastRequests.current[roomId]?.fingerprint !== fingerprint) lastRequests.current[roomId] = { fingerprint, id: crypto.randomUUID() };
    if (await mutate({ ...payload, id: lastRequests.current[roomId].id })) {
      setBody(""); delete drafts.current[roomId]; setReply(null); setNotice("none"); delete lastRequests.current[roomId]; setPaging({});
      void loadIndex().catch(showError);
    }
  }
  function paginate(next: Paging) { setPaging(next); setHistory(null); setLoading(true); setError(""); }
  async function moreRooms() {
    if (!index?.nextCursor) return;
    setBusy(true);
    try {
      const next = await api<ChatIndex>("?" + new URLSearchParams({ cursorTime: index.nextCursor.time, cursorId: index.nextCursor.id }));
      setIndex(value => value ? { ...next, rooms: [...value.rooms, ...next.rooms.filter(room => !value.rooms.some(old => old.id === room.id))] } : next);
    } catch (failure) { showError(failure); } finally { setBusy(false); }
  }
  function roomTitle(room?: ChatRoom) { return room?.kind === "common" ? t("common") : isAdmin && room?.ownerId !== account ? room?.nickname ?? t("support") : t("support"); }

  if (account === undefined) return <section className="page-shell"><p>{t("loading")}</p></section>;
  if (account === null) return <section className="page-shell"><div className="panel p-6"><h1 className="section-title">{t("title")}</h1><p className="my-4">{t("guest")}</p><Link className="primary-button" href="/auth">{t("login")}</Link></div></section>;
  if (index && index.userId !== account) return <section className="page-shell"><p>{t("loading")}</p></section>;

  return <section className={"page-shell " + styles.shell}>
    <h1 className="section-title">{t("title")}</h1>
    {error && <div role="alert" className={styles.error}>{t(error)} <button type="button" onClick={() => { setError(""); void loadIndex().then(value => { if (!roomId) setRoomId(value.rooms[0]?.id ?? null); setRefresh(n => n + 1); }).catch(showError); }}>{t("retry")}</button></div>}
    {!index ? <p>{error ? "" : t("loading")}</p> : <div className={styles.layout}>
      <nav className={styles.rooms} aria-label={t("title")}>
        {index.rooms.filter(room => room.kind === "common").map(room => <button type="button" key={room.id} disabled={busy} aria-current={room.id === roomId ? "page" : undefined} onClick={() => choose(room.id)}>{t("common")}{room.unread && <span className={styles.dot} aria-label={t("unread")} />}</button>)}
        {!isAdmin && <button type="button" disabled={busy} aria-current={currentRoom?.kind === "support" ? "page" : undefined} onClick={() => void openSupport()}>{t("support")}{index.rooms.some(room => room.kind === "support" && room.unread) && <span className={styles.dot} aria-label={t("unread")} />}</button>}
        {isAdmin && <><h2>{t("requests")}</h2>{index.rooms.filter(room => room.kind === "support").map(room => <button type="button" key={room.id} disabled={busy} aria-current={room.id === roomId ? "page" : undefined} onClick={() => choose(room.id)}><Avatar name={room.nickname ?? "?"} url={room.avatar} /><span>{room.nickname}</span>{room.unread && <span className={styles.dot} aria-label={t("unread")} />}</button>)}{index.nextCursor && <button type="button" disabled={busy} onClick={() => void moreRooms()}>{t("more")}</button>}</>}
      </nav>
      <div className={styles.conversation}>
        <header className={styles.header}><div><h2>{roomTitle(currentRoom)}</h2><p>{currentRoom?.kind === "common" ? t("commonInfo") : t("closed")}</p></div>
          {isAdmin && currentRoom?.kind === "common" && <button type="button" onClick={() => setMute({ id: null, name: t("all") })}>{t("muteAll")}</button>}
        </header>
        {!connected && <p role="status" className={styles.hint}>{t("connection")}</p>}
        {loading && <p role="status">{t("loading")}</p>}
        {history && <>
          {history.pins.length > 0 && <details className={styles.pins}><summary>{t("pins")} · {history.pins.length}</summary>{history.pins.map(message => <div key={message.id}><strong>{message.author.nickname}</strong><p>{message.body}</p>{isAdmin && <button disabled={busy} type="button" onClick={() => void mutate({ action: "unpin", roomId: message.roomId, id: message.id, version: message.version })}>{t("unpin")}</button>}</div>)}</details>}
          <div className={styles.pagination}><button type="button" disabled={!history.hasOlder || busy} onClick={() => paginate({ before: history.messages[0]?.position })}>{t("older")}</button><button type="button" disabled={busy} onClick={() => paginate({})}>{t("latest")}</button><button type="button" disabled={!history.hasNewer || busy} onClick={() => paginate({ after: history.messages.at(-1)?.position })}>{t("newer")}</button></div>
          <div className={styles.messages} aria-label={t("message")}>
            {!history.messages.length && <p className={styles.empty}>{t("empty")}</p>}
            {history.messages.map(message => <article key={message.id} className={styles.message} data-message-id={message.id}>
              <Link href={"/profile/" + message.author.id} className={styles.author}><Avatar name={message.author.nickname} url={message.author.avatar} /><strong>{message.author.nickname}</strong></Link>
              <time dateTime={message.createdAt}>{formatDate(message.createdAt, { dateStyle: "short", timeStyle: "short" })}</time>
              {message.reply && <blockquote><strong>{message.reply.nickname}</strong><p>{message.reply.deleted ? t("deleted") : message.reply.body}</p></blockquote>}
              <p className={styles.text}>{message.deleted ? t("deleted") : message.body}</p>
              {message.editedAt && !message.deleted && <small>{t("edited")}</small>}
              {!message.deleted && <div className={styles.actions}>
                {history.canWrite && <button type="button" disabled={busy} onClick={() => setReply(message)}>{t("reply")}</button>}
                {isAdmin && <><button type="button" disabled={busy} onClick={() => setEditing({ message, body: message.body })}>{t("edit")}</button><button type="button" disabled={busy} onClick={() => { if (window.confirm(t("confirmDelete"))) void mutate({ action: "delete", roomId: message.roomId, id: message.id, version: message.version }); }}>{t("remove")}</button><button type="button" disabled={busy} onClick={() => void mutate({ action: message.pinned ? "unpin" : "pin", roomId: message.roomId, id: message.id, version: message.version })}>{t(message.pinned ? "unpin" : "pin")}</button>{message.author.id !== account && <button type="button" onClick={() => setMute({ id: message.author.id, name: message.author.nickname })}>{t("mute")}</button>}</>}
              </div>}
              {editing?.message.id === message.id && <form className={styles.editor} onSubmit={event => { event.preventDefault(); void mutate({ action: "edit", roomId: message.roomId, id: message.id, version: editing.message.version, body: editing.body }).then(ok => { if (ok) setEditing(null); }); }}><textarea aria-label={t("edit")} required maxLength={4000} value={editing.body} onChange={event => setEditing({ ...editing, body: event.target.value })} /><button disabled={busy} type="submit">{t("save")}</button><button type="button" onClick={() => setEditing(null)}>{t("cancel")}</button></form>}
            </article>)}<div ref={bottom} />
          </div>
          {history.mutes.length > 0 && <details className={styles.restrictions}><summary>{t("restrictions")}</summary>{history.mutes.map(item => <div key={item.id}><strong>{item.nickname ?? t("all")}</strong> · {item.endsAt ? formatDate(item.endsAt, { dateStyle: "short", timeStyle: "short" }) : t("forever")}<p>{item.reason}</p>{isAdmin && roomId && <button type="button" disabled={busy} onClick={() => void mutate({ action: "unmute", roomId, muteId: item.id })}>{t("unmute")}</button>}</div>)}</details>}
          {!history.canWrite ? <p className={styles.hint}>{t("muted")}</p> : <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
            {reply && <div className={styles.replying}><strong>{t("replying")}: {reply.author.nickname}</strong><p>{reply.body.slice(0, 200)}</p><button type="button" onClick={() => setReply(null)}>{t("cancel")}</button></div>}
            <label>{t("message")}<textarea required maxLength={4000} value={body} disabled={busy} onChange={event => setBody(event.target.value)} /></label>
            <div className={styles.sendRow}><label>{t("notify")}<select value={notice} disabled={busy} onChange={event => { setNotice(event.target.value as typeof notice); setRecipient(""); setSearch(""); setPeople([]); }}><option value="none">{t("none")}</option><option value="admins">{t("admins")}</option>{isAdmin && currentRoom?.kind === "common" && <option value="all">{t("all")}</option>}{isAdmin && <option value="user">{t("person")}</option>}</select></label><small>{body.length}/4000</small><button className="primary-button" type="submit" disabled={busy || !body.trim() || notice === "user" && !recipient}>{t(busy ? "sending" : "send")}</button></div>
            {notice === "user" && <div className={styles.recipient}><label>{t("search")}<input value={search} maxLength={80} onChange={event => { setSearch(event.target.value); setPeople([]); setRecipient(""); }} /></label><select aria-label={t("person")} required value={recipient} onChange={event => setRecipient(event.target.value)}><option value="">{people.length ? t("person") : t("noPeople")}</option>{people.map(person => <option key={person.id} value={person.id}>{person.nickname}</option>)}</select></div>}
            {error && body && <p className={styles.hint}>{t("draft")}</p>}
          </form>}
        </>}
        {mute && isAdmin && roomId && <form className={styles.muteForm} onSubmit={event => { event.preventDefault(); void mutate({ action: "mute", roomId, userId: mute.id, durationMinutes: forever ? null : Number(muteMinutes), reason }).then(ok => { if (ok) { setMute(null); setReason(""); } }); }}><h3>{t("mute")} · {mute.name}</h3><label>{t("minutes")}<input type="number" min={30} max={5256000} required disabled={forever} value={muteMinutes} onChange={event => setMuteMinutes(event.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={forever} onChange={event => setForever(event.target.checked)} />{t("forever")}</label><label>{t("reason")}<input maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label><button type="submit" disabled={busy}>{t("save")}</button><button type="button" onClick={() => setMute(null)}>{t("cancel")}</button></form>}
      </div>
    </div>}
  </section>;
}
