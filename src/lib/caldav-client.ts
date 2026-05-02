import "server-only";

import { parseIcs, type IcsEvent } from "@/lib/ics-parser";

export interface CalDavCalendar {
  url: string;
  name: string;
  color?: string;
}

export interface CalDavCredentials {
  serverUrl: string; // e.g. https://caldav.icloud.com
  email: string;
  appPassword: string;
}

function authHeader(c: CalDavCredentials): string {
  return "Basic " + Buffer.from(`${c.email}:${c.appPassword}`).toString("base64");
}

function absolute(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTagText(xml: string, localName: string): string[] {
  // Match any element ending in :localName or just localName, ignoring namespaces.
  const pattern = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${localName}>`,
    "gi"
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(xml)) !== null) {
    out.push(decodeXmlEntities(m[1].trim()));
  }
  return out;
}

function extractCdataOrText(xml: string, localName: string): string[] {
  const raws = extractTagText(xml, localName);
  return raws.map((value) => {
    const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(value);
    return cdata ? cdata[1] : value;
  });
}

interface DavResponseBlock {
  href: string;
  body: string;
}

function splitResponses(xml: string): DavResponseBlock[] {
  const pattern = /<(?:[a-zA-Z0-9_-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?response>/gi;
  const out: DavResponseBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(xml)) !== null) {
    const body = m[1];
    const href = extractTagText(body, "href")[0] ?? "";
    out.push({ href, body });
  }
  return out;
}

async function dav(
  method: string,
  url: string,
  credentials: CalDavCredentials,
  body: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; text: string }> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(credentials),
      "Content-Type": 'application/xml; charset="utf-8"',
      Depth: "0",
      ...extraHeaders,
    },
    body,
    redirect: "follow",
  });
  const text = await res.text();
  return { status: res.status, text };
}

export interface DiscoveryDebug {
  startUrl: string;
  step1: { status: number; text: string };
  principalUrl?: string;
  step2?: { status: number; text: string };
  homeHrefs: string[];
  step3?: { url: string; status: number; text: string }[];
  rawCandidates: {
    href: string;
    resourceType: string;
    displayName: string;
    compSet: string;
    skippedReason?: string;
  }[];
}

/**
 * iCloud CalDAV discovery flow:
 *   1. PROPFIND on server → currentUserPrincipal
 *   2. PROPFIND on principal → calendarHomeSet
 *   3. PROPFIND depth=1 on home set → list of calendars
 */
export async function discoverCalendars(
  credentials: CalDavCredentials,
  options: { debug?: boolean } = {}
): Promise<{ calendars: CalDavCalendar[]; debug?: DiscoveryDebug }> {
  const startUrl = credentials.serverUrl.endsWith("/")
    ? credentials.serverUrl
    : credentials.serverUrl + "/";

  const debug: DiscoveryDebug | undefined = options.debug
    ? { startUrl, step1: { status: 0, text: "" }, homeHrefs: [], rawCandidates: [] }
    : undefined;

  // Step 1: principal.
  const principalBody = `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:">
  <prop><current-user-principal/></prop>
</propfind>`;

  const step1 = await dav("PROPFIND", startUrl, credentials, principalBody, { Depth: "0" });
  if (debug) debug.step1 = step1;
  if (step1.status === 401) {
    throw new Error("Anmeldung fehlgeschlagen. Apple-ID oder App-Passwort prüfen.");
  }
  if (step1.status >= 400) {
    throw new Error(`CalDAV-Server antwortete mit Status ${step1.status} bei der Discovery.`);
  }

  const principalHrefRaw = extractTagText(step1.text, "href").find((h) =>
    /\/principal/i.test(h)
  ) ?? extractCdataOrText(step1.text, "current-user-principal")
    .map((block) => extractTagText(block, "href")[0])
    .find(Boolean);

  if (!principalHrefRaw) {
    throw new Error("Kein Principal in der CalDAV-Antwort gefunden.");
  }
  const principalUrl = absolute(principalHrefRaw, startUrl);
  if (debug) debug.principalUrl = principalUrl;

  // Step 2: calendar-home-set.
  const homeBody = `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <prop><c:calendar-home-set/></prop>
</propfind>`;

  const step2 = await dav("PROPFIND", principalUrl, credentials, homeBody, { Depth: "0" });
  if (debug) debug.step2 = step2;
  if (step2.status >= 400) {
    throw new Error(`CalDAV-Server antwortete mit Status ${step2.status} beim Home-Set.`);
  }

  const homeHrefs: string[] = [];
  const homeBlocks = extractCdataOrText(step2.text, "calendar-home-set");
  for (const block of homeBlocks) {
    for (const href of extractTagText(block, "href")) {
      const resolved = absolute(href, principalUrl);
      if (!homeHrefs.includes(resolved)) homeHrefs.push(resolved);
    }
  }

  if (homeHrefs.length === 0) {
    throw new Error("Kein calendar-home-set in der Antwort.");
  }
  if (debug) debug.homeHrefs = homeHrefs;

  // Step 3: list calendars under each home set.
  const listBody = `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:i="http://apple.com/ns/ical/">
  <prop>
    <displayname/>
    <resourcetype/>
    <c:supported-calendar-component-set/>
    <i:calendar-color/>
  </prop>
</propfind>`;

  const calendars: CalDavCalendar[] = [];
  if (debug) debug.step3 = [];

  for (const home of homeHrefs) {
    const step3 = await dav("PROPFIND", home, credentials, listBody, { Depth: "1" });
    if (debug) debug.step3!.push({ url: home, status: step3.status, text: step3.text });
    if (step3.status >= 400) continue;

    for (const block of splitResponses(step3.text)) {
      const resourceType = extractTagText(block.body, "resourcetype")[0] ?? "";
      const displayName = extractTagText(block.body, "displayname")[0] ?? "";
      const compSet = extractTagText(block.body, "supported-calendar-component-set")[0] ?? "";
      const calUrl = absolute(block.href, home);

      const candidate = {
        href: block.href,
        resourceType,
        displayName,
        compSet,
        skippedReason: undefined as string | undefined,
      };

      if (!/calendar/i.test(resourceType)) {
        candidate.skippedReason = "resourcetype hat kein <calendar/>";
        if (debug) debug.rawCandidates.push(candidate);
        continue;
      }
      if (compSet && /name="VTODO"/i.test(compSet) && !/name="VEVENT"/i.test(compSet)) {
        candidate.skippedReason = "Reminder-Liste (nur VTODO)";
        if (debug) debug.rawCandidates.push(candidate);
        continue;
      }
      if (calUrl.replace(/\/+$/, "") === home.replace(/\/+$/, "")) {
        candidate.skippedReason = "ist Home-Set selbst";
        if (debug) debug.rawCandidates.push(candidate);
        continue;
      }

      const fallbackName =
        decodeURIComponent(calUrl.replace(/\/+$/, "").split("/").pop() ?? "")
          .replace(/[-_]/g, " ")
          .trim() || "Unbenannt";
      const color = extractTagText(block.body, "calendar-color")[0];

      if (debug) debug.rawCandidates.push(candidate);

      calendars.push({
        url: calUrl,
        name: displayName || fallbackName,
        color: color || undefined,
      });
    }
  }

  return { calendars, debug };
}

function toIcsTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Fetch events in a time range from a calendar via CalDAV REPORT calendar-query.
 */
export async function fetchEvents(
  credentials: CalDavCredentials,
  calendarUrl: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<IcsEvent[]> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${toIcsTimestamp(rangeStart)}" end="${toIcsTimestamp(rangeEnd)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

  const res = await dav("REPORT", calendarUrl, credentials, body, { Depth: "1" });
  if (res.status === 401) {
    throw new Error("Anmeldung fehlgeschlagen. Apple-ID oder App-Passwort prüfen.");
  }
  if (res.status >= 400) {
    throw new Error(`CalDAV-Server antwortete mit Status ${res.status} beim Event-Abruf.`);
  }

  const events: IcsEvent[] = [];
  for (const block of splitResponses(res.text)) {
    const calData = extractCdataOrText(block.body, "calendar-data")[0];
    if (!calData) continue;
    events.push(...parseIcs(calData));
  }

  // De-dup within a response (recurring events may yield multiple VEVENTs).
  const byUid = new Map<string, IcsEvent>();
  for (const ev of events) {
    const existing = byUid.get(ev.uid);
    if (!existing || ev.start.getTime() > existing.start.getTime()) {
      byUid.set(ev.uid, ev);
    }
  }

  // Also dedup by (start, summary): FocusPomo occasionally creates two
  // VEVENTs for the same pomodoro session with different UIDs (e.g. one
  // "planned" 25-min event at start and one "actual" 28-min event at stop).
  // Keep the longer one — that's the actual elapsed time.
  const byStartSummary = new Map<string, IcsEvent>();
  for (const ev of byUid.values()) {
    const key = `${ev.start.getTime()}|${ev.summary}`;
    const existing = byStartSummary.get(key);
    if (!existing || ev.durationMinutes > existing.durationMinutes) {
      byStartSummary.set(key, ev);
    }
  }
  return [...byStartSummary.values()];
}
