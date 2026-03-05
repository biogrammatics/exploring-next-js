import Link from "next/link";

export const metadata = {
  title: "Terms and Conditions | BioGrammatics",
  description: "Terms and conditions governing use of BioGrammatics services and website.",
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
        <p className="text-gray-500 mb-8">Effective date: March 5, 2026</p>

        <div className="space-y-8 text-gray-700">
          {/* Agreement */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              1. Agreement to Terms
            </h2>
            <p>
              By accessing or using the BioGrammatics, Inc. (&quot;BioGrammatics,&quot;
              &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) website at biogrammatics.com and
              related services, you agree to be bound by these Terms and Conditions.
              If you do not agree, please do not use our services.
            </p>
          </section>

          {/* Description of Services */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              2. Description of Services
            </h2>
            <p className="mb-3">
              BioGrammatics provides biotechnology products and services, including
              but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Expression vectors for <em>Pichia pastoris</em> and other host organisms</li>
              <li>Engineered <em>Pichia</em> strains</li>
              <li>Custom strain generation and protein expression services</li>
              <li>Codon optimization tools</li>
              <li>DNA synthesis ordering through third-party partners</li>
            </ul>
          </section>

          {/* Accounts */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              3. User Accounts
            </h2>
            <p className="mb-3">
              To access certain features, you may need to create an account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Keep your account credentials secure</li>
              <li>Notify us promptly of any unauthorized access</li>
              <li>Accept responsibility for all activity under your account, including activity by authorized team members</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate
              these terms or are used for unauthorized purposes.
            </p>
          </section>

          {/* Orders and Payment */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              4. Orders and Payment
            </h2>
            <p className="mb-3">
              All orders placed through our website are subject to acceptance and
              availability. By placing an order, you agree that:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>All prices are listed in US dollars and may be subject to change</li>
              <li>Payment is processed securely through Stripe; we do not store credit card information</li>
              <li>You are responsible for applicable taxes and shipping costs</li>
              <li>We reserve the right to refuse or cancel orders at our discretion</li>
              <li>Custom orders (strain generation, expression testing) are non-refundable once work has begun</li>
            </ul>
          </section>

          {/* Shipping */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              5. Shipping and Delivery
            </h2>
            <p className="mb-3">
              Biological materials require specific shipping conditions:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Vectors and strains are shipped under conditions appropriate for the product</li>
              <li>Delivery times are estimates and not guaranteed</li>
              <li>You are responsible for ensuring someone is available to receive shipments, particularly temperature-sensitive materials</li>
              <li>International shipments may be subject to customs duties, import regulations, and additional fees</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              6. Intellectual Property
            </h2>
            <h3 className="font-semibold text-gray-900 mt-4 mb-2">Our IP</h3>
            <p className="mb-3">
              All vectors, strains, methods, website content, and associated
              documentation are the intellectual property of BioGrammatics or its
              licensors. Products are sold for research use; commercial use may
              require a separate license agreement.
            </p>
            <h3 className="font-semibold text-gray-900 mt-4 mb-2">Your Data</h3>
            <p>
              You retain ownership of all protein sequences, DNA sequences, and
              project data you submit to our platform. We use this data solely to
              provide the requested services and do not share it with third parties
              except as necessary to fulfill your order (e.g., submitting sequences
              to DNA synthesis partners at your direction).
            </p>
          </section>

          {/* Research Use */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              7. Research Use and Compliance
            </h2>
            <p className="mb-3">
              You agree to use our products and services in compliance with all
              applicable laws, regulations, and institutional guidelines, including:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Biosafety regulations and institutional biosafety committee (IBC) requirements</li>
              <li>Export control regulations (EAR, ITAR) where applicable</li>
              <li>Applicable research ethics guidelines</li>
            </ul>
            <p className="mt-3">
              Products are intended for research use only unless otherwise specified.
              You are solely responsible for obtaining necessary approvals for your
              intended use.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              8. Limitation of Liability
            </h2>
            <p className="mb-3">
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                Our products are provided &quot;as is&quot; for research purposes without
                warranty of fitness for a particular purpose
              </li>
              <li>
                We are not liable for indirect, incidental, or consequential damages
                arising from use of our products or services
              </li>
              <li>
                Our total liability shall not exceed the amount you paid for the
                specific product or service giving rise to the claim
              </li>
              <li>
                We do not guarantee specific experimental outcomes or results from
                use of our products
              </li>
            </ul>
          </section>

          {/* SMS and Communications */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              9. Communications and SMS
            </h2>
            <p className="mb-3">
              By providing your contact information, you agree to receive:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Transactional emails related to your orders, account, and projects</li>
              <li>Security notifications, including two-factor authentication codes via SMS</li>
              <li>Service updates relevant to your account</li>
            </ul>
            <p className="mt-3">
              SMS messages are used solely for account security (two-factor
              authentication) and critical order notifications. Standard message and
              data rates may apply. You may opt out of non-essential communications
              at any time through your account settings.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              10. Termination
            </h2>
            <p>
              We may terminate or suspend your account and access to our services at
              our sole discretion, without notice, for conduct that we determine
              violates these Terms or is harmful to other users, us, or third
              parties, or for any other reason. You may close your account at any
              time by contacting us.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              11. Governing Law
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the
              laws of the State of California, without regard to its conflict of law
              provisions. Any disputes arising under these Terms shall be resolved in
              the courts located in San Diego County, California.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              12. Changes to These Terms
            </h2>
            <p>
              We reserve the right to modify these Terms at any time. Material
              changes will be communicated via email or notice on our website. Your
              continued use of our services after changes take effect constitutes
              acceptance of the revised Terms.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              13. Contact Information
            </h2>
            <p>
              For questions about these Terms, contact us at:
            </p>
            <p className="mt-2">
              BioGrammatics, Inc.
              <br />
              Email:{" "}
              <a
                href="mailto:info@biogrammatics.com"
                className="text-blue-600 hover:underline"
              >
                info@biogrammatics.com
              </a>
            </p>
          </section>

          {/* Links */}
          <div className="flex flex-wrap gap-4 pt-4 border-t">
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="text-blue-600 hover:underline">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
