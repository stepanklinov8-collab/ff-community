export const modules = [
  { id: "foundation-demo", href: "/extensions/foundation-demo", title: { ru: "Пример раздела", kk: "Бөлім үлгісі", ky: "Бөлүм үлгүсү" } },
] as const;
export type ModuleMode = "off" | "preview" | "public";
export function moduleMode(id: string, settings = ""): ModuleMode {
  if (!modules.some(module => module.id === id)) return "off";
  const entries = settings.split(",").map(item => item.trim().split("="));
  const matches = entries.filter(([key]) => key === id);
  if (matches.length !== 1 || matches[0].length !== 2) return "off";
  const value = matches[0][1];
  return value === "preview" || value === "public" ? value : "off";
}
export function canUseModule(mode: ModuleMode, roles: readonly string[] = []) {
  return mode === "public" || mode === "preview" && roles.some(role => role === "admin" || role === "superadmin");
}
