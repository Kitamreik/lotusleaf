import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { firebaseEnabled, missingFirebaseVars, firebaseInitError } from "@/lib/firebase";
import {
  getSettings, saveSettings, sendReminderEmail, emailRemindersAvailable,
  pullSettingsFromCloud, type Settings,
} from "@/lib/settings";
import { seedDemoData, clearDemoData } from "@/lib/seed";
import { downloadReminderIcs } from "@/lib/calendar";
import { Database, Calendar, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const [s, setS] = useState<Settings>(() => getSettings());
  const [testing, setTesting] = useState(false);

  useEffect(() => { pullSettingsFromCloud().then((r) => { if (r) setS(r); }); }, []);

  function patch<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((old) => ({ ...old, [k]: v }));
  }

  function persist(next = s) {
    saveSettings(next);
    toast.success("Settings saved");
  }

  async function testEmail() {
    setTesting(true);
    saveSettings(s);
    const r = await sendReminderEmail({
      to: s.reminderEmail,
      subject: "Kit TJ Services, LLC — test reminder",
      body: "If you received this, your Firebase email function is wired up correctly.",
      type: "test",
    });
    setTesting(false);
    if (r.ok) toast.success("Test email sent");
    else toast.error(r.error ?? "Failed");
  }

  const emailReady = emailRemindersAvailable(s);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="heading-display text-3xl text-gold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Reminders, integrations, and admin preferences.
        </p>
      </div>

      <Card className="gold-frame">
        <CardHeader>
          <CardTitle className="text-gold">Email reminders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable email reminders</Label>
              <p className="text-xs text-muted-foreground">
                Sends notifications to your inbox in addition to the in-app bell. On by default.
              </p>
            </div>
            <Switch
              checked={s.emailReminders}
              onCheckedChange={(v) => patch("emailReminders", v)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={s.emailRemindersBiweekly}
                disabled={!s.emailReminders}
                onCheckedChange={(v) => patch("emailRemindersBiweekly", v)}
              />
              <Label className="text-sm">Bi-weekly check-ins</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={s.emailRemindersMonthly}
                disabled={!s.emailReminders}
                onCheckedChange={(v) => patch("emailRemindersMonthly", v)}
              />
              <Label className="text-sm">Monthly audit</Label>
            </div>
          </div>

          <div>
            <Label>Reminder destination email</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={s.reminderEmail}
              onChange={(e) => patch("reminderEmail", e.target.value)}
            />
          </div>

          <div className="border-t border-border/50 pt-4 space-y-3">
            <div>
              <Label>Firebase email function URL</Label>
              <Input
                placeholder="https://us-central1-PROJECT.cloudfunctions.net/sendReminder"
                value={s.emailFnUrl}
                onChange={(e) => patch("emailFnUrl", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Optional. Deploy a Firebase HTTPS function (or use the
                "Trigger Email" Firebase extension behind one) that accepts{" "}
                <code>{`{ to, subject, body, type }`}</code>. Leave blank to use in-app reminders only.
              </p>
            </div>
            <div>
              <Label>Shared secret (sent as <code>x-app-secret</code>)</Label>
              <Input
                type="password"
                value={s.emailFnSecret}
                onChange={(e) => patch("emailFnSecret", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Stored only in memory for this tab. Re-enter after reload — never written to localStorage or Firestore.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs">
              Status:{" "}
              {!s.emailReminders ? <span className="text-muted-foreground">disabled</span>
                : emailReady ? <span className="text-gold">ready</span>
                  : <span className="text-destructive">needs setup</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!emailReady || testing} onClick={testEmail}>
                {testing ? "Sending…" : "Send test"}
              </Button>
              <Button onClick={() => persist()}>Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="gold-frame">
        <CardHeader>
          <CardTitle className="text-gold flex items-center gap-2"><Calendar className="w-4 h-4" />Calendar sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Export upcoming reminders as an <code>.ics</code> file. Open it on macOS/iOS to add to
            Apple Calendar, or in Google Calendar use <em>Settings → Import &amp; export → Import</em>.
            Each reminder becomes a 30-minute event with a 1-hour pre-alert.
          </p>
          <Button onClick={downloadReminderIcs} variant="outline">
            <Calendar className="w-4 h-4 mr-2" />Download reminders.ics
          </Button>
          <p className="text-[11px] text-muted-foreground">
            For a self-updating subscription (<code>webcal://</code>), host this file at a stable URL —
            both Apple and Google Calendar can subscribe to it and refresh automatically.
          </p>
        </CardContent>
      </Card>

      <Card className="gold-frame">
        <CardHeader>
          <CardTitle className="text-gold flex items-center gap-2"><Database className="w-4 h-4" />Demo data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Seed sample cases, ledger entries, balance-sheet items, an audit note, and a notification
            so you can walk through the app without entering data by hand. Every demo record is tagged
            <code className="mx-1">[SEED]</code> and can be wiped in one click.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => { const r = seedDemoData(); toast.success(`Added ${r.cases} cases, ${r.ledger} ledger entries, ${r.audits} audit, ${r.notifications} notification.`); }}>
              <Database className="w-4 h-4 mr-2" />Load demo data
            </Button>
            <Button variant="outline" onClick={() => { const n = clearDemoData(); toast.success(`Removed ${n} demo records.`); }}>
              <Trash2 className="w-4 h-4 mr-2" />Clear demo data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">Backend</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            Firebase: <span className={firebaseEnabled ? "text-gold" : "text-muted-foreground"}>
              {firebaseEnabled ? "connected" : "not configured"}
            </span>
          </p>
          {missingFirebaseVars.length > 0 && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="font-semibold mb-1">Missing env var(s):</div>
              <ul className="list-disc ml-4">
                {missingFirebaseVars.map((v) => <li key={v}><code>{v}</code></li>)}
              </ul>
              <div className="mt-2 text-muted-foreground">
                Copy <code>.env.example</code> to <code>.env</code> and restart the dev server.
                For published builds, add the same keys in Workspace Settings → Build Secrets.
              </div>
            </div>
          )}
          {firebaseInitError && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="font-semibold mb-1">Firebase init error:</div>
              <code>{firebaseInitError}</code>
            </div>
          )}
          {!firebaseEnabled && missingFirebaseVars.length === 0 && (
            <p className="text-xs text-muted-foreground">
              All data persists in localStorage. Firebase is currently off.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
