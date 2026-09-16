import type { Metadata } from "next";
import ConfirmEmailForm from "./ConfirmEmailForm";

export const metadata: Metadata = {
  title: "Подтверждение почты",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ConfirmEmailPage({ searchParams }: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;
  const type = params.type === "signup" || params.type === "recovery" ? params.type : null;
  return <ConfirmEmailForm tokenHash={params.token_hash ?? ""} type={type} />;
}
