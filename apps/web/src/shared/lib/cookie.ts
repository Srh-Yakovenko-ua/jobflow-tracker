const ONE_YEAR_SECONDS = 31_536_000;

export type CookieWrite = { name: string; value: string };

export function writeCookie({ name, value }: CookieWrite): void {
  document.cookie = `${name}=${value}; Path=/; Max-Age=${String(ONE_YEAR_SECONDS)}; SameSite=Lax`;
}

export function clearCookie(name: string): void {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}
