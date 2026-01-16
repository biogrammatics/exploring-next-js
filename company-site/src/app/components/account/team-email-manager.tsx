"use client";

import { useState } from "react";

interface TeamEmail {
  id: string;
  email: string;
  status: "ACTIVE" | "PENDING";
  invitedAt: Date;
  confirmedAt: Date | null;
}

interface TeamEmailManagerProps {
  initialTeamEmails: TeamEmail[];
}

export function TeamEmailManager({ initialTeamEmails }: TeamEmailManagerProps) {
  const [teamEmails, setTeamEmails] = useState<TeamEmail[]>(initialTeamEmails);
  const [newEmail, setNewEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsInviting(true);

    try {
      const response = await fetch("/api/account/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      setTeamEmails((prev) => [
        {
          ...data.teamEmail,
          invitedAt: new Date(data.teamEmail.invitedAt),
          confirmedAt: null,
        },
        ...prev,
      ]);
      setNewEmail("");
      setSuccess(`Invitation sent to ${newEmail}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRevoke(emailId: string, emailAddress: string) {
    if (
      !confirm(
        `Are you sure you want to revoke access for ${emailAddress}? They will no longer be able to sign in to your account.`
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/account/team?id=${emailId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke access");
      }

      setTeamEmails((prev) => prev.filter((te) => te.id !== emailId));
      setSuccess(`Access revoked for ${emailAddress}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke access");
    }
  }

  const activeEmails = teamEmails.filter((te) => te.status === "ACTIVE");
  const pendingEmails = teamEmails.filter((te) => te.status === "PENDING");

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">
          Invite Team Member
        </h3>
        <form onSubmit={handleInvite} className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            disabled={isInviting}
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isInviting || !newEmail}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 font-medium"
          >
            {isInviting ? "Sending..." : "Invite"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-red-600 text-sm">{error}</p>
        )}
        {success && (
          <p className="mt-3 text-green-600 text-sm">{success}</p>
        )}
      </div>

      {/* Active team members */}
      {activeEmails.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-3">
            Active Team Members
          </h3>
          <ul className="divide-y">
            {activeEmails.map((te) => (
              <li
                key={te.id}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-800">{te.email}</p>
                  <p className="text-sm text-gray-500">
                    Joined{" "}
                    {te.confirmedAt
                      ? new Date(te.confirmedAt).toLocaleDateString()
                      : "recently"}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(te.id, te.email)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Revoke Access
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pending invitations */}
      {pendingEmails.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-3">
            Pending Invitations
          </h3>
          <ul className="divide-y">
            {pendingEmails.map((te) => (
              <li
                key={te.id}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-800">{te.email}</p>
                  <p className="text-sm text-gray-500">
                    Invited{" "}
                    {new Date(te.invitedAt).toLocaleDateString()}
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(te.id, te.email)}
                  className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                >
                  Cancel Invitation
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {teamEmails.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No team members yet.</p>
          <p className="text-sm mt-1">
            Invite colleagues to give them access to your account.
          </p>
        </div>
      )}
    </div>
  );
}
