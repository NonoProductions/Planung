import { format } from "date-fns";

export function toLocalDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function toLocalDateTimeString(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

export function extractDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}
