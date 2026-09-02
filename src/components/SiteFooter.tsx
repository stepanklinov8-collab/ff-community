import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>OMCITE ARENA</strong>
        <p>Турниры и сообщество Free Fire</p>
      </div>
      <nav aria-label="Юридическая информация">
        <Link href="/rules">Правила</Link>
        <Link href="/privacy">Конфиденциальность</Link>
        <Link href="/terms">Условия использования</Link>
        <Link href="/contacts">Контакты</Link>
      </nav>
    </footer>
  );
}
