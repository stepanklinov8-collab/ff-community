"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import TranslatedText from "@/components/TranslatedText";

interface Contact {
  id: string;
  name: string;
  role: string;
  description: string;
  social_link: string;
}

export default function ContactsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: true });
      if (data) setContacts(data);
      setLoading(false);
    };
    fetchContacts();
  }, [supabase]);

  return (
    <div className="min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">{t("contacts")}</h1>

      {loading ? (
        <p>{t("common.loading")}</p>
      ) : contacts.length === 0 ? (
        <p className="text-gray-400">{t("contacts.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c) => (
            <div key={c.id} className="bg-gray-800 p-4 rounded">
              <h2 className="text-xl font-semibold text-blue-400">{c.name}</h2>
              {c.role && <TranslatedText sourceType="contact" sourceId={c.id} sourceField="role" original={c.role} textClassName="text-gray-300 text-sm mt-1" />}
              {c.description && <TranslatedText sourceType="contact" sourceId={c.id} sourceField="description" original={c.description} textClassName="text-gray-400 text-sm mt-1" />}
              {c.social_link && (
                <a
                  href={c.social_link}
                  target="_blank"
                  className="inline-block mt-3 text-blue-400 hover:underline"
                >
                  {t("contacts.action")}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
