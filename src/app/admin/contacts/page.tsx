"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Contact {
  id: string;
  name: string;
  role: string;
  description: string;
  social_link: string;
}

export default function AdminContactsPage() {
  const supabase = createClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [socialLink, setSocialLink] = useState("");

  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setContacts(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setMessage("Введите имя");
      return;
    }

    if (editId) {
      await supabase.from("contacts").update({
        name,
        role,
        description,
        social_link: socialLink,
      }).eq("id", editId);
      setMessage("Контакт обновлён!");
    } else {
      await supabase.from("contacts").insert({
        name,
        role,
        description,
        social_link: socialLink,
      });
      setMessage("Контакт добавлен!");
    }

    // Сброс формы
    setName("");
    setRole("");
    setDescription("");
    setSocialLink("");
    setEditId(null);
    fetchContacts();
  };

  const editContact = (contact: Contact) => {
    setEditId(contact.id);
    setName(contact.name);
    setRole(contact.role);
    setDescription(contact.description);
    setSocialLink(contact.social_link);
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Удалить контакт?")) return;
    await supabase.from("contacts").delete().eq("id", id);
    fetchContacts();
    setMessage("Контакт удалён.");
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-red-500">Управление контактами</h1>
      {message && <div className="mb-4 p-3 bg-gray-800 rounded">{message}</div>}

      {/* Форма */}
      <div className="bg-gray-800 p-4 rounded mb-6 max-w-md">
        <h2 className="text-xl font-semibold mb-4">{editId ? "Редактировать" : "Добавить"} контакт</h2>
        <input
          className="w-full p-2 mb-2 text-black rounded"
          placeholder="Имя (обязательно)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full p-2 mb-2 text-black rounded"
          placeholder="Должность (например: Организатор турниров)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <input
          className="w-full p-2 mb-2 text-black rounded"
          placeholder="За что отвечает"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="w-full p-2 mb-4 text-black rounded"
          placeholder="Ссылка на соцсеть (VK, Telegram и т.д.)"
          value={socialLink}
          onChange={(e) => setSocialLink(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">
            {editId ? "Сохранить" : "Добавить"}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setName(""); setRole(""); setDescription(""); setSocialLink(""); }} className="px-4 py-2 bg-gray-600 rounded">
              Отмена
            </button>
          )}
        </div>
      </div>

      {/* Список контактов */}
      <h2 className="text-xl font-semibold mb-4">Существующие контакты</h2>
      {loading ? <p>Загрузка...</p> : contacts.length === 0 ? (
        <p className="text-gray-400">Контактов нет.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="bg-gray-800 p-3 rounded flex justify-between items-center">
              <div>
                <span className="font-semibold text-blue-400">{c.name}</span>
                {c.role && <span className="text-gray-400 ml-2">— {c.role}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => editContact(c)} className="px-3 py-1 bg-blue-500 rounded text-sm">Редактировать</button>
                <button onClick={() => deleteContact(c.id)} className="px-3 py-1 bg-red-500 rounded text-sm">Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/admin" className="block mt-6 text-blue-400 hover:underline">← Админ-панель</Link>
    </div>
  );
}