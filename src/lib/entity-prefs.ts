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

// Resolves the active entity key for report & dashboard views that support aggregate "grup" (Semua Entitas).
// Priority:
// 1. URL searchParam:
//    - "grup" -> undefined (if canGrup is true)
//    - valid entityKey -> that entity key
// 2. Cookie "lastEntityKey":
//    - "grup" -> undefined (if canGrup is true)
//    - valid entityKey -> that entity key
// 3. Fallback:
//    - canGrup ? undefined (default Semua Entitas for roles with group access) : entityKeys[0]
export function resolveReportEntityKey(
  searchParamEntity: string | undefined,
  entityKeys: string[],
  canGrup: boolean
): string | undefined {
  if (searchParamEntity) {
    if (searchParamEntity === "grup" && canGrup) return undefined;
    if (entityKeys.includes(searchParamEntity)) return searchParamEntity;
  }
  const cookieKey = cookies().get("lastEntityKey")?.value;
  if (cookieKey) {
    if (cookieKey === "grup" && canGrup) return undefined;
    if (entityKeys.includes(cookieKey)) return cookieKey;
  }
  return canGrup ? undefined : entityKeys[0];
}

