function getLastEntityKeyCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)lastEntityKey=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function resolveEntityKey(
  searchParamEntity: string | undefined,
  entityKeys: string[]
): string {
  if (searchParamEntity && entityKeys.includes(searchParamEntity)) {
    return searchParamEntity;
  }
  const cookieKey = getLastEntityKeyCookie();
  if (cookieKey && entityKeys.includes(cookieKey)) {
    return cookieKey;
  }
  return entityKeys[0];
}

export function resolveReportEntityKey(
  searchParamEntity: string | undefined,
  entityKeys: string[],
  canGrup: boolean
): string | undefined {
  if (searchParamEntity) {
    if (searchParamEntity === "grup" && canGrup) return undefined;
    if (entityKeys.includes(searchParamEntity)) return searchParamEntity;
  }
  const cookieKey = getLastEntityKeyCookie();
  if (cookieKey) {
    if (cookieKey === "grup" && canGrup) return undefined;
    if (entityKeys.includes(cookieKey)) return cookieKey;
  }
  return canGrup ? undefined : entityKeys[0];
}
