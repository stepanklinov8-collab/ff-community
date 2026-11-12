import Link from "next/link";

export default function Loading() {
  return (
    <section className="page-shell">
      <div className="panel space-y-4 p-6">
        <p className="section-title">OMCITE Arena</p>
        <p role="status">Страница загружается…</p>
        <nav aria-label="Разделы сайта" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link prefetch={false} href="/tournaments" className="text-link">Турниры и тренировки</Link>
          <Link prefetch={false} href="/teams" className="text-link">Команды и гильдии</Link>
          <Link prefetch={false} href="/auth" className="text-link">Войти</Link>
        </nav>
      </div>
    </section>
  );
}
