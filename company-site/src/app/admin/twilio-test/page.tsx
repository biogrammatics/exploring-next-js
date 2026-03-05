"use client";

import { useState, useEffect } from "react";

interface TwilioStatus {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  ready: boolean;
}

interface SendResult {
  success: boolean;
  messageSid?: string;
  status?: string;
  error?: string;
  code?: number;
  details?: string;
}

export default function TwilioTestPage() {
  const [twilioStatus, setTwilioStatus] = useState<TwilioStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    "Test SMS from BioGrammatics beta site. If you received this, Twilio is working!"
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // Load Twilio status on mount
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/admin/twilio-test");
        if (res.ok) {
          const data = await res.json();
          setTwilioStatus(data.status);
        }
      } catch (err) {
        console.error("Failed to load Twilio status:", err);
      } finally {
        setStatusLoading(false);
      }
    }
    loadStatus();
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/twilio-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });

      const data: SendResult = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Twilio SMS Test</h1>
      <p className="text-gray-500 mb-8">
        Verify Twilio credentials and send a test SMS message.
      </p>

      <div className="space-y-8 max-w-2xl">
        {/* Credential Status */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Credential Status</h2>
          {statusLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : twilioStatus ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Overall Status
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-sm font-medium ${
                    twilioStatus.ready
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {twilioStatus.ready ? "Ready" : "Not Configured"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Account SID
                </span>
                <code className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {twilioStatus.accountSid}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Auth Token
                </span>
                <code className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {twilioStatus.authToken}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Phone Number
                </span>
                <code className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {twilioStatus.phoneNumber}
                </code>
              </div>
            </div>
          ) : (
            <p className="text-red-600">Failed to load status</p>
          )}
        </div>

        {/* Send Test SMS */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Send Test SMS</h2>

          {twilioStatus && !twilioStatus.ready ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                Twilio credentials are not fully configured. Add{" "}
                <code className="bg-yellow-100 px-1 rounded">TWILIO_ACCOUNT_SID</code>,{" "}
                <code className="bg-yellow-100 px-1 rounded">TWILIO_AUTH_TOKEN</code>, and{" "}
                <code className="bg-yellow-100 px-1 rounded">TWILIO_PHONE_NUMBER</code>{" "}
                to your environment variables.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Recipient Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  US numbers: 10 digits or with +1 prefix. On trial accounts,
                  this must be a verified number.
                </p>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {message.length}/1600 characters
                </p>
              </div>

              <button
                type="submit"
                disabled={sending || !phone || !message}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {sending ? "Sending..." : "Send Test SMS"}
              </button>
            </form>
          )}

          {/* Result */}
          {result && (
            <div
              className={`mt-4 border rounded-lg p-4 ${
                result.success
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <h3
                className={`font-medium mb-2 ${
                  result.success ? "text-green-800" : "text-red-800"
                }`}
              >
                {result.success ? "SMS Sent Successfully" : "SMS Failed"}
              </h3>
              <dl className="text-sm space-y-1">
                {result.messageSid && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Message SID:</dt>
                    <dd className="font-mono text-gray-800">
                      {result.messageSid}
                    </dd>
                  </div>
                )}
                {result.status && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Status:</dt>
                    <dd className="text-gray-800">{result.status}</dd>
                  </div>
                )}
                {result.error && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Error:</dt>
                    <dd className="text-red-700">{result.error}</dd>
                  </div>
                )}
                {result.code && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Error Code:</dt>
                    <dd className="font-mono text-red-700">{result.code}</dd>
                  </div>
                )}
                {result.details && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Details:</dt>
                    <dd className="text-red-700">{result.details}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Trial Account Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-1">Trial Account Note</h3>
          <p className="text-sm text-blue-700">
            On a Twilio trial account, you can only send SMS to{" "}
            <strong>verified phone numbers</strong>. Add your number in the
            Twilio Console under{" "}
            <em>Phone Numbers → Manage → Verified Caller IDs</em> before
            testing. For production use (sending to any customer), you&apos;ll need
            to upgrade and complete A2P 10DLC registration.
          </p>
        </div>
      </div>
    </div>
  );
}
