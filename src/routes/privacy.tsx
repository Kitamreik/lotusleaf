import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Kit TJ Services" },
      { name: "description", content: "Privacy Policy for Kit TJ Services internal suite." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="lotus-bg min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-12 text-sm leading-relaxed text-foreground">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Link to="/app" className="hover:text-gold">← Back to app</Link>
        </p>
        <h1 className="heading-display text-3xl text-gold mt-4">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Template — review with counsel before public use. Effective: {new Date().toLocaleDateString()}
        </p>
        <div className="gold-divider my-6" />

        <section className="space-y-3">
          <h2 className="text-lg text-gold">1. Who we are</h2>
          <p>
            Kit TJ Services, LLC (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) operates
            an internal CRM, bookkeeping, and client portal (the &ldquo;Service&rdquo;). This Policy
            explains what personal data we collect and how we use it.
          </p>

          <h2 className="text-lg text-gold mt-6">2. Information we collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account data:</strong> name, email, hashed password (via Firebase Auth).</li>
            <li><strong>Operational data:</strong> cases, ledger entries, audits, notifications, and client documents you create.</li>
            <li><strong>Portal e-signatures:</strong> signer name, timestamp, IP address, and SHA-256 integrity hash of the signature.</li>
            <li><strong>Security telemetry:</strong> login attempts (success/failure), data changes, uploads, downloads, and rate-limit events.</li>
            <li><strong>Technical data:</strong> browser type, device, and basic request metadata required to deliver the Service.</li>
          </ul>

          <h2 className="text-lg text-gold mt-6">3. How we use it</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To operate, secure, and improve the Service.</li>
            <li>To detect and prevent fraud, abuse, injection attacks, and credential stuffing.</li>
            <li>To produce internal management reports and client deliverables.</li>
            <li>To comply with legal obligations and respond to lawful requests.</li>
          </ul>

          <h2 className="text-lg text-gold mt-6">4. Legal bases (GDPR)</h2>
          <p>
            We process personal data under the legal bases of (a) performance of a contract,
            (b) legitimate interests in operating and securing the Service, (c) legal obligation,
            and (d) consent where required.
          </p>

          <h2 className="text-lg text-gold mt-6">5. Sharing</h2>
          <p>
            We do not sell personal data. We share it only with: (i) sub-processors required to run
            the Service (e.g. Google Firebase), (ii) professional advisors, and (iii) authorities
            when required by law.
          </p>

          <h2 className="text-lg text-gold mt-6">6. Retention</h2>
          <p>
            We retain operational and audit data for the duration of the engagement plus the period
            required by tax, accounting, and regulatory rules (typically up to 7 years). Security
            logs are capped at the most recent 1,000 events per browser.
          </p>

          <h2 className="text-lg text-gold mt-6">7. Security</h2>
          <p>
            We use industry-standard controls: Firebase Auth, transport encryption (HTTPS),
            input sanitization (DOMPurify), rate limiting, lockouts on token guessing, and audit
            logging of sensitive actions. No system is perfectly secure; you use the Service at
            your own risk.
          </p>

          <h2 className="text-lg text-gold mt-6">8. Your rights</h2>
          <p>
            Depending on your jurisdiction (GDPR, CCPA, and similar), you may have the right to
            access, correct, delete, port, or restrict processing of your personal data, and to
            withdraw consent. Submit requests to{" "}
            <span className="text-gold">privacy@kittjservices.com</span>.
          </p>

          <h2 className="text-lg text-gold mt-6">9. Cookies &amp; local storage</h2>
          <p>
            The Service uses browser local storage to persist sessions, settings, and a failsafe
            copy of your data when the backend is unreachable. Clearing your browser storage will
            sign you out and remove that local copy.
          </p>

          <h2 className="text-lg text-gold mt-6">10. International transfers</h2>
          <p>
            Data may be processed in the United States and other countries where our sub-processors
            operate. We rely on Standard Contractual Clauses or equivalent safeguards where required.
          </p>

          <h2 className="text-lg text-gold mt-6">11. Children</h2>
          <p>The Service is not directed to children under 16, and we do not knowingly collect their data.</p>

          <h2 className="text-lg text-gold mt-6">12. Changes</h2>
          <p>
            We may update this Policy. Material changes will be posted here with a new effective date.
          </p>

          <h2 className="text-lg text-gold mt-6">13. Contact</h2>
          <p>
            Privacy inquiries: <span className="text-gold">privacy@kittjservices.com</span>.
          </p>
        </section>

        <div className="gold-divider my-8" />
        <p className="text-xs text-muted-foreground">
          See also: <Link to="/terms" className="text-gold hover:underline">Terms of Service</Link>.
        </p>
      </div>
    </main>
  );
}
