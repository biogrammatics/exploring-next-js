import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | BioGrammatics",
  description: "Learn how BioGrammatics collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: {currentDate}</p>

        <div className="space-y-8 text-gray-700">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Introduction
            </h2>
            <p>
              BioGrammatics, Inc. (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to
              protecting your privacy. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you
              visit our website or use our services. We comply with the General
              Data Protection Regulation (GDPR) and other applicable data
              protection laws.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Information We Collect
            </h2>

            <h3 className="font-semibold text-gray-900 mt-4 mb-2">
              Personal Information You Provide
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>Account Information:</strong> Name, email address,
                password, and profile details
              </li>
              <li>
                <strong>Contact Information:</strong> Phone number, mailing
                address, and billing address
              </li>
              <li>
                <strong>Payment Information:</strong> Credit card details and
                billing information (processed securely via Stripe)
              </li>
              <li>
                <strong>Project Information:</strong> Protein sequences, project
                specifications, and research data you submit
              </li>
              <li>
                <strong>Communications:</strong> Messages, feedback, and
                correspondence with our team
              </li>
            </ul>

            <h3 className="font-semibold text-gray-900 mt-4 mb-2">
              Information Collected Automatically
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>Device Information:</strong> Browser type, operating
                system, and device identifiers
              </li>
              <li>
                <strong>Usage Data:</strong> Pages visited, time spent, and
                navigation patterns
              </li>
              <li>
                <strong>Cookies:</strong> See our{" "}
                <Link href="/cookies" className="text-blue-600 hover:underline">
                  Cookie Policy
                </Link>{" "}
                for details
              </li>
            </ul>
          </section>

          {/* Legal Basis */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Legal Basis for Processing (GDPR)
            </h2>
            <p className="mb-3">
              We process your personal data based on the following legal grounds:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>Contract:</strong> Processing necessary to fulfill our
                contractual obligations to you
              </li>
              <li>
                <strong>Consent:</strong> Where you have given explicit consent
                for specific processing activities
              </li>
              <li>
                <strong>Legitimate Interests:</strong> Processing necessary for
                our legitimate business interests
              </li>
              <li>
                <strong>Legal Obligations:</strong> Processing required to comply
                with applicable laws
              </li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              How We Use Your Information
            </h2>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>To provide and maintain our services</li>
              <li>To process orders and manage your account</li>
              <li>To communicate with you about your projects and orders</li>
              <li>To send marketing communications (with your consent)</li>
              <li>To improve our website and services</li>
              <li>To comply with legal obligations</li>
              <li>To protect against fraud and unauthorized access</li>
              <li>To analyze usage patterns and optimize user experience</li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Data Sharing and Disclosure
            </h2>
            <p className="mb-3">
              We may share your information with:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>Service Providers:</strong> Third parties who assist in
                operating our website and services (e.g., payment processors,
                shipping carriers)
              </li>
              <li>
                <strong>Business Partners:</strong> Trusted partners involved in
                fulfilling your orders (e.g., Twist Bioscience for DNA synthesis)
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to
                protect our rights
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with a merger,
                acquisition, or sale of assets
              </li>
            </ul>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-blue-800 text-sm">
                <strong>Note:</strong> We do not sell your personal information
                to third parties.
              </p>
            </div>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Your Rights (GDPR)
            </h2>
            <p className="mb-3">
              Under the GDPR, you have the following rights:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>Right to Access:</strong> Request a copy of your personal
                data
              </li>
              <li>
                <strong>Right to Rectification:</strong> Request correction of
                inaccurate data
              </li>
              <li>
                <strong>Right to Erasure:</strong> Request deletion of your
                personal data
              </li>
              <li>
                <strong>Right to Restriction:</strong> Request limited processing
                of your data
              </li>
              <li>
                <strong>Right to Data Portability:</strong> Receive your data in
                a portable format
              </li>
              <li>
                <strong>Right to Object:</strong> Object to certain processing
                activities
              </li>
              <li>
                <strong>Right to Withdraw Consent:</strong> Withdraw consent at
                any time
              </li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at{" "}
              <a
                href="mailto:privacy@biogrammatics.com"
                className="text-blue-600 hover:underline"
              >
                privacy@biogrammatics.com
              </a>
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Data Retention
            </h2>
            <p className="mb-3">
              We retain your personal data for as long as necessary to fulfill
              the purposes outlined in this policy:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>Account Data:</strong> Retained while your account is
                active
              </li>
              <li>
                <strong>Order Data:</strong> Retained for 7 years for tax and
                legal compliance
              </li>
              <li>
                <strong>Marketing Data:</strong> Until you unsubscribe or withdraw
                consent
              </li>
              <li>
                <strong>Cookie Data:</strong> See our Cookie Policy for specific
                retention periods
              </li>
            </ul>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Data Security
            </h2>
            <p className="mb-3">
              We implement appropriate technical and organizational measures to
              protect your personal data:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure password hashing</li>
              <li>Regular security assessments</li>
              <li>Limited access to personal data on a need-to-know basis</li>
            </ul>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              International Data Transfers
            </h2>
            <p>
              Your data may be transferred to and processed in countries outside
              of your residence. We ensure appropriate safeguards are in place,
              including Standard Contractual Clauses approved by the European
              Commission, to protect your data in compliance with GDPR.
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Children&apos;s Privacy
            </h2>
            <p>
              Our services are not intended for individuals under 16 years of
              age. We do not knowingly collect personal data from children. If
              you believe we have collected data from a child, please contact us
              immediately.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify
              you of significant changes by posting a notice on our website or
              sending you an email. Your continued use of our services after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Contact Information
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">Data Controller</h3>
                <p>
                  BioGrammatics, Inc.
                  <br />
                  Email:{" "}
                  <a
                    href="mailto:privacy@biogrammatics.com"
                    className="text-blue-600 hover:underline"
                  >
                    privacy@biogrammatics.com
                  </a>
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Data Protection Officer
                </h3>
                <p>
                  For data protection inquiries, contact:{" "}
                  <a
                    href="mailto:dpo@biogrammatics.com"
                    className="text-blue-600 hover:underline"
                  >
                    dpo@biogrammatics.com
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Links */}
          <div className="flex flex-wrap gap-4 pt-4 border-t">
            <Link href="/cookies" className="text-blue-600 hover:underline">
              View Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
