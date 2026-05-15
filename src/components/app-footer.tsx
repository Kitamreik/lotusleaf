import { Link } from "@tanstack/react-router";
import { firebaseEnabled } from "@/lib/firebase";

export function AppFooter() {
  return (
    <footer className="mt-12 border-t border-border/60" role="contentinfo">
      <div className="gold-divider mb-4" />
      <div className="px-6 pb-8 text-xs text-muted-foreground space-y-3 max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>© {new Date().getFullYear()} Lotus &amp; Leaf Suite — Internal Use Only</span>
          <span>Backend: {firebaseEnabled ? "Firebase + localStorage failsafe" : "localStorage failsafe (Firebase not configured)"}</span>
        </div>
        <p className="leading-relaxed">
          <strong className="text-gold/90">Compliance notice:</strong> This application is restricted
          to authorized personnel. All actions are logged. Data is processed in accordance with
          GDPR (EU 2016/679), CCPA, and SOC 2 record-keeping principles. Financial figures are for
          internal management reporting and are not a substitute for an audited statement prepared
          under US GAAP / IFRS. B Corporation and Venture Capital readiness scores are indicative
          only. Unauthorized access, tampering, or exfiltration may be subject to civil and criminal
          penalties under the Computer Fraud and Abuse Act (18 U.S.C. § 1030) and equivalent laws.
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <Link to="/terms" className="hover:text-gold underline-offset-2 hover:underline">
            Terms of Service
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacy" className="hover:text-gold underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

