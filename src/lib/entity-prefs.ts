import { cookies } from "next/headers";

// Resolves the active entity key, with priority:
// 1. URL searchParam (explicit user navigation)
// 2. Cookie (persisted from last switch via EntitySwitcher)
// 3. First available entity (default)
export function resolveEntityKey(
  searchParamEntity: string | undefined,
  entityKeys: string[]
): string {
  if (searchParamEntity && entityKeys.includes(searchParamEntity)) {
    return searchParamEntity;
  }
  const cookieKey = cookies().get("lastEntityKey")?.value;
  if (cookieKey && entityKeys.includes(cookieKey)) {
    return cookieKey;
  }
  return entityKeys[0];
}
