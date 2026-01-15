import Link from "next/link";

export const metadata = {
  title: "Cookie Policy | BioGrammatics",
  description: "Learn how BioGrammatics uses cookies on our website.",
};

export default function CookiePolicyPage() {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: {currentDate}</p>

        <div className="space-y-8 text-gray-700">
          {/* What Are Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              What Are Cookies
            </h2>
            <p>
              Cookies are small text files that are stored on your computer or
              mobile device when you visit our website. They help us provide you
              with a better experience by remembering your preferences,
              understanding how you use our site, and improving our services.
            </p>
          </section>

          {/* How We Use Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              How We Use Cookies
            </h2>
            <p className="mb-3">We use cookies for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>Essential functionality:</strong> To enable core website
                features like user authentication and shopping cart
              </li>
              <li>
                <strong>Preferences:</strong> To remember your settings and
                choices
              </li>
              <li>
                <strong>Analytics:</strong> To understand how visitors interact
                with our website
              </li>
              <li>
                <strong>Marketing:</strong> To deliver relevant advertisements
                and measure their effectiveness
              </li>
            </ul>
          </section>

          {/* Types of Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Types of Cookies We Use
            </h2>

            {/* Essential Cookies */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">
                  Essential Cookies
                </h3>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Always Active
                </span>
              </div>
              <p className="text-sm mb-2">
                These cookies are necessary for the website to function and
                cannot be switched off. They are usually only set in response to
                actions you take, such as logging in or filling in forms.
              </p>
              <div className="text-xs text-gray-500">
                <strong>Examples:</strong> session_id, cookie_consent, csrf_token
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">
                  Analytics Cookies
                </h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Optional
                </span>
              </div>
              <p className="text-sm mb-2">
                These cookies help us understand how visitors interact with our
                website by collecting and reporting information anonymously.
              </p>
              <div className="text-xs text-gray-500">
                <strong>Examples:</strong> Google Analytics (_ga, _gid, _gat)
              </div>
            </div>

            {/* Marketing Cookies */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">
                  Marketing Cookies
                </h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Optional
                </span>
              </div>
              <p className="text-sm mb-2">
                These cookies are used to track visitors across websites to
                display relevant advertisements.
              </p>
              <div className="text-xs text-gray-500">
                <strong>Purpose:</strong> Ad targeting and campaign measurement
              </div>
            </div>
          </section>

          {/* Your Cookie Choices */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Your Cookie Choices
            </h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Accept or reject non-essential cookies when you first visit</li>
              <li>Change your cookie preferences at any time</li>
              <li>
                Delete cookies through your browser settings (note: this may
                affect website functionality)
              </li>
            </ul>
          </section>

          {/* Third-Party Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Third-Party Cookies
            </h2>
            <p className="mb-3">
              We may use third-party services that set their own cookies:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>Google Analytics:</strong> For website analytics and
                performance monitoring
              </li>
              <li>
                <strong>Stripe:</strong> For secure payment processing
              </li>
            </ul>
          </section>

          {/* How to Control Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              How to Control Cookies
            </h2>
            <p className="mb-3">
              Most web browsers allow you to control cookies through their
              settings. Here are links to cookie management instructions for
              popular browsers:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <a
                  href="https://support.google.com/chrome/answer/95647"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google Chrome
                </a>
              </li>
              <li>
                <a
                  href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Mozilla Firefox
                </a>
              </li>
              <li>
                <a
                  href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Safari
                </a>
              </li>
              <li>
                <a
                  href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Microsoft Edge
                </a>
              </li>
            </ul>
          </section>

          {/* Changes to This Policy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Changes to This Policy
            </h2>
            <p>
              We may update this Cookie Policy from time to time. Any changes
              will be posted on this page with an updated revision date.
            </p>
          </section>

          {/* Contact Us */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Contact Us
            </h2>
            <p>
              If you have any questions about our use of cookies, please contact
              us at{" "}
              <a
                href="mailto:privacy@biogrammatics.com"
                className="text-blue-600 hover:underline"
              >
                privacy@biogrammatics.com
              </a>
            </p>
          </section>

          {/* Links */}
          <div className="flex flex-wrap gap-4 pt-4 border-t">
            <Link
              href="/privacy"
              className="text-blue-600 hover:underline"
            >
              View Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
