"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { authFetch } from "@/utils/api/auth-fetch";
import { createClient } from "@/utils/supabase/client";

interface ImportLog {
  id: string;
  file_name: string;
  status: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  imported_at: string;
}

export default function StatsImportPage() {
  const supabase = useMemo(() => createClient(), []);
  const [file, setFile] = useState<File | null>(null);
  const [imports, setImports] = useState<ImportLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadImports = useCallback(async () => {
    const { data } = await supabase
      .from("excel_import_logs")
      .select("id, file_name, status, total_rows, successful_rows, failed_rows, imported_at")
      .order("imported_at", { ascending: false })
      .limit(30);
    setImports((data ?? []) as ImportLog[]);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadImports(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadImports]);

  async function downloadTemplate() {
    setMessage("");
    const response = await authFetch("/api/admin/stats/template");
    if (!response.ok) {
      setMessage("Не удалось скачать шаблон");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "omcite-stats-template.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importFile() {
    if (!file) {
      setMessage("Выберите заполненный файл .xlsx");
      return;
    }
    setBusy(true);
    setMessage("Проверяем и импортируем строки...");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await authFetch("/api/admin/stats/import", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Ошибка импорта");
      setMessage(`Импорт завершён: ${payload.successfulRows} успешно, ${payload.failedRows} с ошибками.`);
      setFile(null);
      await loadImports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось импортировать файл");
    } finally {
      setBusy(false);
    }
  }

  async function rollback(importId: string) {
    if (!window.confirm("Откатить все изменения этого импорта?")) return;
    setBusy(true);
    try {
      const response = await authFetch("/api/admin/stats/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Ошибка отката");
      setMessage(`Откат выполнен. Восстановлено изменений: ${payload.rolledBack}.`);
      await loadImports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось выполнить откат");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/admin/stats" className="inline-flex items-center gap-2 text-cyan-300 text-sm mb-4">
          <ArrowLeft size={16} /> К статистике
        </Link>
        <span className="section-kicker block">МАССОВОЕ ОБНОВЛЕНИЕ</span>
        <h1 className="section-title">Импорт статистики из Excel</h1>
        <p className="text-slate-400 mt-3 max-w-2xl">
          Игрок определяется по игровому ID, затем по email. Каждое изменение сохраняется в журнале и может быть отменено.
        </p>
      </div>

      <section className="cyber-card p-6 grid md:grid-cols-[1fr_auto] gap-5 items-end">
        <div>
          <label className="block text-sm font-semibold mb-2">Заполненный файл .xlsx</label>
          <input type="file" accept=".xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <p className="text-xs text-slate-500 mt-2">Максимальный размер — 10 МБ. Не меняйте названия колонок шаблона.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadTemplate} className="secondary-button">
            <Download size={17} /> Скачать шаблон
          </button>
          <button type="button" onClick={importFile} disabled={busy} className="primary-button disabled:opacity-50">
            <Upload size={17} /> {busy ? "Обработка..." : "Импортировать"}
          </button>
        </div>
      </section>

      {message && <div className="cyber-card p-4 text-sm text-cyan-100">{message}</div>}

      <section className="cyber-card overflow-hidden">
        <div className="p-5 border-b flex items-center gap-3">
          <FileSpreadsheet className="text-cyan-300" />
          <h2 className="font-bold text-lg">История импортов</h2>
        </div>
        {imports.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Импортов пока нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400 bg-slate-950/40">
                <tr><th className="p-4">Файл</th><th className="p-4">Дата</th><th className="p-4">Результат</th><th className="p-4">Статус</th><th className="p-4" /></tr>
              </thead>
              <tbody>
                {imports.map((item) => (
                  <tr key={item.id} className="border-t border-sky-900/20">
                    <td className="p-4 font-medium">{item.file_name}</td>
                    <td className="p-4 text-slate-400">{new Date(item.imported_at).toLocaleString("ru")}</td>
                    <td className="p-4"><span className="text-emerald-400">{item.successful_rows}</span> / <span className="text-red-400">{item.failed_rows}</span></td>
                    <td className="p-4 uppercase text-xs tracking-wider text-slate-400">{item.status}</td>
                    <td className="p-4 text-right">
                      {item.status === "completed" && (
                        <button type="button" onClick={() => rollback(item.id)} disabled={busy} className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200">
                          <RotateCcw size={15} /> Откатить
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
