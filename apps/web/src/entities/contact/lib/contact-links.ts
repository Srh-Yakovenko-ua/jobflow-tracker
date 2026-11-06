const HANDLE_MARK = '@';

function bareHandleOf(raw: string): string {
  return raw.startsWith(HANDLE_MARK) ? raw.slice(HANDLE_MARK.length) : raw;
}

export function telegramHandleOf(raw: string): string {
  return `${HANDLE_MARK}${bareHandleOf(raw)}`;
}

export function telegramUrlOf(raw: string): string {
  return `https://t.me/${encodeURIComponent(bareHandleOf(raw))}`;
}

export function mailtoOf(email: string): string {
  return `mailto:${email}`;
}
