'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Trash2, AlertTriangle } from 'lucide-react';
import { PartnerInvites } from './PartnerInvites';

export function SettingsContent() {
  const [showConfirm, setShowConfirm] = useState(false);

  const clearDataMutation = trpc.demo.clearAllData.useMutation({
    onSuccess: (data) => {
      alert(data.message);
      setShowConfirm(false);
      window.location.reload();
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your household settings and data</p>
      </div>

      {/* Partner Invites */}
      <PartnerInvites />

      {/* Danger Zone */}
      <div className="card border-danger-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-danger-100 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-danger-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-danger-900 mb-1">Danger Zone</h2>
            <p className="text-sm text-gray-600 mb-4">
              Permanently delete all data from your household. This action cannot be undone!
            </p>
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="btn btn-outline border-danger-300 text-danger-700 hover:bg-danger-50"
              >
                <Trash2 className="h-4 w-4" />
                Clear All Data
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-danger-700">
                  Are you sure? This will delete ALL transactions, accounts, categories, rules, and budgets.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => clearDataMutation.mutate()}
                    disabled={clearDataMutation.isPending}
                    className="btn bg-danger-600 text-white hover:bg-danger-700"
                  >
                    {clearDataMutation.isPending ? 'Deleting...' : 'Yes, Delete Everything'}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
