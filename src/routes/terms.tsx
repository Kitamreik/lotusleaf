import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Kit TJ Services" },
      { name: "description", content: "Terms of Service for Kit TJ Services internal suite." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="lotus-bg min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-12 text-sm leading-relaxed text-foreground">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Link to="/app" className="hover:text-gold">← Back to app</Link>
        </p>
        <h1 className="heading-display text-3xl text-gold mt-4">Terms of Service</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Template — review with counsel before public use. Effective: {new Date().toLocaleDateString()}
        </p>
        <div className="gold-divider my-6" />

        <section className="space-y-3">
          <h2 className="text-lg text-gold">1. Acceptance of terms</h2>
          <p>
            By accessing or using the Kit TJ Services, LLC (&ldquo;Company,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us&rdquo;) internal suite (the &ldquo;Service&rdquo;), you agree to be bound by these
            Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the Service.
          </p>

          <h2 className="text-lg text-gold mt-6">2. Authorized use</h2>
          <p>
            The Service is provided to authorized employees, contractors, and clients of the Company.
            You agree to use it only for legitimate business purposes and in compliance with all
            applicable laws, including the Computer Fraud and Abuse Act (18 U.S.C. § 1030).
          </p>

          <h2 className="text-lg text-gold mt-6">3. Accounts &amp; security</h2>
          <p>
            You are responsible for safeguarding your credentials and for all activity under your
            account. Notify us immediately of any unauthorized access. We may suspend or terminate
            accounts that violate these Terms or pose a security risk.
          </p>

          <h2 className="text-lg text-gold mt-6">4. Acceptable use</h2>
          <p>You will not, and will not attempt to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Reverse engineer, decompile, or tamper with the Service or its security controls.</li>
            <li>Upload malicious code, attempt injection attacks, or probe for vulnerabilities.</li>
            <li>Access data, accounts, or systems for which you lack authorization.</li>
            <li>Use the Service to violate any law, regulation, or third-party right.</li>
          </ul>

          <h2 className="text-lg text-gold mt-6">5. Client portal &amp; e-signatures</h2>
          <p>
            E-signatures captured through the Client Portal are stored with the signer&rsquo;s name,
            timestamp, IP address, and a cryptographic integrity hash. By signing, you intend to be
            legally bound under the U.S. ESIGN Act (15 U.S.C. § 7001 et seq.) and equivalent laws.
          </p>

          <h2 className="text-lg text-gold mt-6">6. Intellectual property</h2>
          <p>
            All software, branding, and content of the Service are owned by the Company or its
            licensors. You receive a limited, non-exclusive, non-transferable license to use the
            Service for its intended purpose.
          </p>

          <h2 className="text-lg text-gold mt-6">7. Disclaimer</h2>
          <p>
            The Service is provided &ldquo;AS IS&rdquo; without warranties of any kind. Financial
            figures, readiness scores, and reports are for internal management use and are not a
            substitute for an audit prepared under US GAAP or IFRS.
          </p>

          <h2 className="text-lg text-gold mt-6">8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, the Company shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages arising from your use
            of the Service.
          </p>

          <h2 className="text-lg text-gold mt-6">9. Termination</h2>
          <p>
            We may suspend or terminate your access at any time, with or without cause. Upon
            termination, your right to use the Service ceases immediately.
          </p>

          <h2 className="text-lg text-gold mt-6">10. Changes</h2>
          <p>
            We may update these Terms from time to time. Continued use after a change constitutes
            acceptance of the revised Terms.
          </p>

          <h2 className="text-lg text-gold mt-6">11. Contact</h2>
          <p>
            Questions about these Terms: <span className="text-gold">legal@kittjservices.com</span>.
          </p>
        </section>

        <div className="gold-divider my-8" />
        <p className="text-xs text-muted-foreground">
          See also: <Link to="/privacy" className="text-gold hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
