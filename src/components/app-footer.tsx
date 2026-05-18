import { Link } from "@tanstack/react-router";

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-border/60" role="contentinfo">
      <div className="gold-divider mb-4" />
      <div className="px-6 pb-8 text-xs text-muted-foreground space-y-4 max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>© {year} Kit TJ Services, LLC — Lotus &amp; Leaf Internal Suite. All rights reserved.</span>
          <span>Authenticated, audited access · Internal use only</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <p className="leading-relaxed">
            <strong className="text-gold/90">Confidentiality &amp; access.</strong>{" "}
            This system is restricted to authorized personnel of Kit TJ Services, LLC.
            Access is governed by the internal allowlist and authenticated through Firebase Auth.
            All sign-ins, exports, and record changes are logged for audit purposes.
            Unauthorized access, tampering, or data exfiltration may be subject to civil and
            criminal penalties under the Computer Fraud and Abuse Act (18 U.S.C. § 1030),
            state computer-trespass laws, and equivalent legislation in other jurisdictions.
          </p>
          <p className="leading-relaxed">
            <strong className="text-gold/90">Data protection.</strong>{" "}
            Personal data is processed under contract in line with the EU/UK GDPR (Reg. 2016/679),
            the California Consumer Privacy Act (Cal. Civ. Code § 1798.100 et seq.), and SOC 2
            record-keeping principles. Subjects may exercise access, correction, and deletion
            rights under our{" "}
            <Link to="/privacy" className="text-gold underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            . Records are retained per IRS Publication 583 (minimum 3 years; 7 years for
            employment-tax and asset records).
          </p>
          <p className="leading-relaxed">
            <strong className="text-gold/90">Financial reporting.</strong>{" "}
            Figures shown in Bookkeeping, Statements, and Reconciliation are unaudited
            internal management reports. They are not prepared under US GAAP (FASB ASC) or
            IFRS and must not be relied upon for tax filing, investor diligence, or third-party
            distribution without review by a licensed CPA. The reports follow the IRS
            recordkeeping guidance in{" "}
            <a
              href="https://www.irs.gov/publications/p583"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline-offset-2 hover:underline"
            >
              Publication 583
            </a>
            .
          </p>
          <p className="leading-relaxed">
            <strong className="text-gold/90">VC &amp; B Corporation readiness.</strong>{" "}
            Readiness scores are indicative self-assessments derived from CRM and bookkeeping
            data. They are not affiliated with, endorsed by, or a substitute for the official{" "}
            <a
              href="https://www.bcorporation.net/en-us/programs-and-tools/b-impact-assessment"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline-offset-2 hover:underline"
            >
              B Impact Assessment
            </a>{" "}
            from B Lab. Formal certification requires that assessment plus audited financials.
            "B Corporation®" and "Certified B Corporation®" are registered trademarks of B Lab.
          </p>
        </div>

        <nav
          aria-label="Legal and reference"
          className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-border/40"
        >
          <Link to="/terms" className="hover:text-gold underline-offset-2 hover:underline">
            Terms of Service
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacy" className="hover:text-gold underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/portal" className="hover:text-gold underline-offset-2 hover:underline">
            Client Portal
          </Link>
          <span aria-hidden="true">·</span>
          <a
            href="https://gdpr-info.eu/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gold underline-offset-2 hover:underline"
          >
            GDPR
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://oag.ca.gov/privacy/ccpa"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gold underline-offset-2 hover:underline"
          >
            CCPA
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://www.law.cornell.edu/uscode/text/18/1030"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gold underline-offset-2 hover:underline"
          >
            18 U.S.C. § 1030 (CFAA)
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gold underline-offset-2 hover:underline"
          >
            SOC 2
          </a>
        </nav>

        <p className="text-[10px] leading-relaxed text-muted-foreground/80">
          Nothing in this application constitutes legal, tax, or investment advice.
          Trademarks and external references are property of their respective owners.
        </p>
      </div>
    </footer>
  );
}

