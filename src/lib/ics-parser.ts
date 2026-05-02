import "server-only";

export interface IcsEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  durationMinutes: number;
}

function unfoldLines(raw: string): string[] {
  // RFC 5545: lines starting with whitespace continue the previous line.
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (out.length > 0) out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(value: string, params: Record<string, string>): Date | null {
  // Forms supported:
  //   20260101T093000Z              (UTC)
  //   20260101T093000               (floating / local)
  //   20260101                      (date only)
  //   TZID=Europe/Berlin:20260101T093000  (params.TZID set, value is local)
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{8}$/.test(trimmed)) {
    const y = Number(trimmed.slice(0, 4));
    const mo = Number(trimmed.slice(4, 6)) - 1;
    const d = Number(trimmed.slice(6, 8));
    return new Date(Date.UTC(y, mo, d));
  }

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(trimmed);
  if (!match) return null;

  const [, ys, mos, ds, hs, mins, ss, z] = match;
  const y = Number(ys);
  const mo = Number(mos) - 1;
  const d = Number(ds);
  const h = Number(hs);
  const mi = Number(mins);
  const se = Number(ss);

  if (z === "Z") {
    return new Date(Date.UTC(y, mo, d, h, mi, se));
  }

  // For floating times or TZID (we don't ship a tz database). FocusPomo events
  // are short-lived and only used for *duration* matching, so treating them as
  // UTC is acceptable — duration is end-start regardless of TZ.
  void params;
  return new Date(Date.UTC(y, mo, d, h, mi, se));
}

interface ParsedLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): ParsedLine | null {
  // SUMMARY:Mathe
  // DTSTART;TZID=Europe/Berlin:20260101T093000
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;

  const head = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);

  const parts = head.split(";");
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i += 1) {
    const eq = parts[i].indexOf("=");
    if (eq === -1) continue;
    params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
  }

  return { name, params, value };
}

/**
 * Parse one or more VCALENDAR / VEVENT blocks. CalDAV REPORT responses contain
 * one VCALENDAR per event, but we also tolerate concatenated multi-event ICS.
 */
export function parseIcs(raw: string): IcsEvent[] {
  const lines = unfoldLines(raw);
  const events: IcsEvent[] = [];

  let inEvent = false;
  let current: {
    uid?: string;
    summary?: string;
    start?: Date;
    end?: Date;
    duration?: number;
  } = {};

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.toUpperCase() === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (trimmed.toUpperCase() === "END:VEVENT") {
      inEvent = false;
      if (current.uid && current.summary && current.start) {
        let end = current.end;
        if (!end && current.duration) {
          end = new Date(current.start.getTime() + current.duration * 60_000);
        }
        if (!end) {
          // Skip events without duration info.
          continue;
        }
        const durationMs = end.getTime() - current.start.getTime();
        const durationMinutes = durationMs / 60_000;
        if (durationMinutes > 0 && durationMinutes < 24 * 60) {
          events.push({
            uid: current.uid,
            summary: current.summary,
            start: current.start,
            end,
            durationMinutes,
          });
        }
      }
      current = {};
      continue;
    }

    if (!inEvent) continue;

    const parsed = parseLine(trimmed);
    if (!parsed) continue;

    switch (parsed.name) {
      case "UID":
        current.uid = parsed.value.trim();
        break;
      case "SUMMARY":
        current.summary = unescape(parsed.value).trim();
        break;
      case "DTSTART": {
        const d = parseIcsDate(parsed.value, parsed.params);
        if (d) current.start = d;
        break;
      }
      case "DTEND": {
        const d = parseIcsDate(parsed.value, parsed.params);
        if (d) current.end = d;
        break;
      }
      case "DURATION": {
        const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(parsed.value.trim());
        if (m) {
          const days = Number(m[1] ?? 0);
          const hrs = Number(m[2] ?? 0);
          const mins = Number(m[3] ?? 0);
          const secs = Number(m[4] ?? 0);
          current.duration = days * 24 * 60 + hrs * 60 + mins + secs / 60;
        }
        break;
      }
      default:
        break;
    }
  }

  return events;
}
