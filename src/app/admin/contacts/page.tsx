"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/utils/api/auth-fetch";

interface Contact {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  social_link: string | null;
  profile_id: string | null;
  phone: string | null;
}

const emptyForm = { name: "", role: "", description: "", socialLink: "", profileId: "", phone: "" };

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadContacts = useCallback(async () => {
    const response = await authFetch("/api/admin/contacts");
    const payload = await response.json() as { contacts?: Contact[] };
    if (response.ok) setContacts(payload.contacts ?? []);
    else setMessage("Не удалось загрузить контакты.");
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadContacts(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadContacts]);

  const updateField = (field: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const saveContact = async () => {
    const response = await authFetch("/api/admin/contacts", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editId ? { id: editId } : {}),
        ...form,
        profileId: form.profileId || null,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Не удалось сохранить контакт.");
      return;
    }
    setMessage(editId ? "Контакт обновлён." : "Контакт добавлен.");
    setEditId(null);
    setForm(emptyForm);
    await loadContacts();
  };

  const startEdit = (contact: Contact) => {
    setEditId(contact.id);
    setForm({
      name: contact.name,
      role: contact.role ?? "",
      description: contact.description ?? "",
      socialLink: contact.social_link ?? "",
      profileId: contact.profile_id ?? "",
      phone: contact.phone ?? "",
    });
  };

  const deleteContact = async (id: string) => {
    if (!window.confirm("Удалить контакт?")) return;
    const response = await authFetch(`/api/admin/contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { setMessage("Не удалось удалить контакт."); return; }
    setMessage("Контакт удалён.");
    await loadContacts();
  };

  return (
    <div className="min-h-screen p-4 md:p-7">
      <span className="section-kicker">АДМИН-ПАНЕЛЬ</span>
      <h1 className="mb-6 mt-2 text-3xl font-black">Контакты</h1>
      {message && <p className="mb-4 rounded-xl bg-slate-950/50 p-3">{message}</p>}
      <section className="cyber-card mb-6 max-w-2xl space-y-3 p-5">
        <h2 className="text-xl font-bold">{editId ? "Редактировать контакт" : "Добавить контакт"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input placeholder="Имя" value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          <input placeholder="Роль / должность" value={form.role} onChange={(event) => updateField("role", event.target.value)} />
          <input placeholder="Ссылка на соцсеть" type="url" value={form.socialLink} onChange={(event) => updateField("socialLink", event.target.value)} />
          <input placeholder="Номер для связи" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
          <input placeholder="ID профиля на сайте" value={form.profileId} onChange={(event) => updateField("profileId", event.target.value)} />
          <input placeholder="За что отвечает" value={form.description} onChange={(event) => updateField("description", event.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={saveContact} className="primary-button">{editId ? "Сохранить" : "Добавить"}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); }} className="secondary-button">Отмена</button>}
        </div>
      </section>

      <h2 className="mb-4 text-xl font-bold">Опубликованные контакты</h2>
      {loading ? <p>Загрузка...</p> : contacts.length === 0 ? <p className="text-slate-400">Контактов нет.</p> : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <article key={contact.id} className="cyber-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div><strong className="text-cyan-300">{contact.name}</strong>{contact.role && <span className="ml-2 text-slate-400">— {contact.role}</span>}</div>
              <div className="flex gap-2">
                <button type="button" onClick={() => startEdit(contact)} className="secondary-button">Редактировать</button>
                <button type="button" onClick={() => deleteContact(contact.id)} className="secondary-button text-red-300">Удалить</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Link href="/admin" className="mt-6 block text-cyan-300 hover:underline">← Админ-панель</Link>
    </div>
  );
}
