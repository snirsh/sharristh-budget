'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { UserPlus, Copy, Check, Trash2, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function PartnerInvites() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [role, setRole] = useState<'owner' | 'member'>('member');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<{
    code: string;
    expiresAt: Date | null;
    householdName?: string;
  } | null>(null);

  const utils = trpc.useUtils();

  // Fetch active invites
  const { data: activeInvites, isLoading } = trpc.invites.listActiveInvites.useQuery();

  // Create invite mutation
  const createInviteMutation = trpc.invites.createPartnerInvite.useMutation({
    onSuccess: (data) => {
      setGeneratedInvite({
        code: data.code,
        expiresAt: data.expiresAt,
        householdName: data.householdName,
      });
      utils.invites.listActiveInvites.invalidate();
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  // Revoke invite mutation
  const revokeInviteMutation = trpc.invites.revokeInvite.useMutation({
    onSuccess: () => {
      utils.invites.listActiveInvites.invalidate();
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleCreateInvite = () => {
    createInviteMutation.mutate({ role, expiresInDays });
    setShowCreateForm(false);
  };

  const handleCopyInviteLink = (code: string) => {
    const inviteUrl = `${window.location.origin}/register?invite=${code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="card">
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-primary-100 rounded-lg">
          <UserPlus className="h-6 w-6 text-primary-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Partner Invites</h2>
          <p className="text-sm text-gray-600">
            Invite your partner to join your household and manage finances together
          </p>
        </div>
      </div>

      {/* Generated Invite Display */}
      {generatedInvite && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-semibold text-green-900 mb-2">Invite Created!</h3>
          <p className="text-sm text-gray-700 mb-3">
            Share this invite code or link with your partner. It can only be used once.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-mono">
                {generatedInvite.code}
              </code>
              <button
                onClick={() => handleCopyCode(generatedInvite.code)}
                className="btn btn-sm bg-primary-600 text-white hover:bg-primary-700"
              >
                {copiedCode === generatedInvite.code ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copiedCode === generatedInvite.code ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            <button
              onClick={() => handleCopyInviteLink(generatedInvite.code)}
              className="w-full btn btn-sm btn-outline"
            >
              {copiedCode === generatedInvite.code ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy Registration Link
            </button>
          </div>

          {generatedInvite.expiresAt && (
            <p className="text-xs text-gray-600 mt-2">
              Expires {formatDistanceToNow(new Date(generatedInvite.expiresAt), { addSuffix: true })}
            </p>
          )}

          <button
            onClick={() => setGeneratedInvite(null)}
            className="mt-3 text-sm text-gray-600 hover:text-gray-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create Invite Form */}
      {!showCreateForm ? (
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn bg-primary-600 text-white hover:bg-primary-700"
        >
          <UserPlus className="h-4 w-4" />
          Create Partner Invite
        </button>
      ) : (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'owner' | 'member')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="member">Member (Can view and manage finances)</option>
              <option value="owner">Owner (Full access including settings)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expires In (Days)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Between 1-30 days</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreateInvite}
              disabled={createInviteMutation.isPending}
              className="btn bg-primary-600 text-white hover:bg-primary-700"
            >
              {createInviteMutation.isPending ? 'Creating...' : 'Generate Invite'}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Invites List */}
      {isLoading ? (
        <div className="mt-6 text-center text-gray-500">Loading invites...</div>
      ) : activeInvites && activeInvites.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Active Invites</h3>
          <div className="space-y-2">
            {activeInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 capitalize">
                      {invite.role} Invite
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {invite.expiresAt
                        ? `Expires ${formatDistanceToNow(new Date(invite.expiresAt), {
                            addSuffix: true,
                          })}`
                        : 'No expiration'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => revokeInviteMutation.mutate({ inviteId: invite.id })}
                  disabled={revokeInviteMutation.isPending}
                  className="btn btn-sm btn-outline text-danger-600 border-danger-300 hover:bg-danger-50"
                  title="Revoke invite"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !showCreateForm && (
          <p className="mt-4 text-sm text-gray-500">No active invites. Create one to invite your partner.</p>
        )
      )}
    </div>
  );
}
