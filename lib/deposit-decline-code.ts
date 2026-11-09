export function depositDeclineCode(error: string | null | undefined) {
  return error?.match(/\[decline_code:\s*([a-z0-9_]+)\]/i)?.[1]?.toLowerCase()
    ?? (error?.toLowerCase().includes("insufficient funds") ? "insufficient_funds" : null);
}
