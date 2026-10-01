export const playerRoles = [
  { id: "sniper", label: "Снайпер" },
  { id: "rifleman", label: "Стрелок" },
  { id: "entry", label: "Упор" },
  { id: "grenadier", label: "Гренадер" },
  { id: "machine_gunner", label: "Пулемётчик" },
  { id: "healer", label: "Хиллер" },
] as const;

export type PlayerRoleId = (typeof playerRoles)[number]["id"];
export const playerRoleIds = new Set<string>(playerRoles.map(role => role.id));
