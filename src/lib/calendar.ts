// ICS calendar export for reminders. Compatible with Apple Calendar,
// Google Calendar, Outlook. The user can import the file once or — if
// they host the file at a stable URL — subscribe via webcal:// and get
// updates automatically.
import { notifications } from "./store";
import { logAudit } from "./security";

const PRODID = "-//Kit TJ Services//Lotus & Leaf//EN";

function pad(n: number) { return String(n).padStart(2, "0"); }

function fmtDate(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeICS(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line: string) {
  // RFC 5545: lines >75 octets must be folded with CRLF + space
  if (line.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    out.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) out.push(" " + rest);
  return out.join("\r\n");
}

export function buildIcsForReminders(): string {
  const list = notifications.list().filter((n) => !n.dismissed && n.type !== "system");
  const now = fmtDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Kit TJ Services — Reminders",
    "X-WR-TIMEZONE:UTC",
  ];
  for (const n of list) {
    const start = new Date(n.dueAt);
    const end = new Date(n.dueAt + 30 * 60_000); // 30-min block
    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:${n.id}@lotus-leaf`));
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${fmtDate(start)}`);
    lines.push(`DTEND:${fmtDate(end)}`);
    lines.push(fold(`SUMMARY:${escapeICS(n.title)}`));
    lines.push(fold(`DESCRIPTION:${escapeICS(n.body)}`));
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(fold(`DESCRIPTION:${escapeICS(n.title)}`));
    lines.push("TRIGGER:-PT60M");
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadReminderIcs() {
  const ics = buildIcsForReminders();
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lotus-leaf-reminders-${new Date().toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  logAudit("calendar.ics.download", `${(ics.match(/BEGIN:VEVENT/g) ?? []).length} events`);
}
