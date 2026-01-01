'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { formatDate, cn } from '@/lib/utils';
import {
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  CreditCard,
  Loader2,
  KeyRound,
} from 'lucide-react';

type Provider = 'onezero' | 'isracard';

interface AddConnectionForm {
  provider: Provider;
  displayName: string;
  // OneZero fields
  email?: string;
  password?: string;
  phoneNumber?: string;
  // Isracard fields
  id?: string;
  card6Digits?: string;
}

export function ConnectionsContent() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [twoFactorConnectionId, setTwoFactorConnectionId] = useState<string | null>(null);
  const [twoFactorSessionId, setTwoFactorSessionId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [formData, setFormData] = useState<AddConnectionForm>({
    provider: 'isracard',
    displayName: '',
  });

  const utils = trpc.useUtils();

  // Queries
  const { data: connections, isLoading } = trpc.bankConnections.list.useQuery();
  const { data: providers } = trpc.bankConnections.providers.useQuery();

  // Mutations
  const createMutation = trpc.bankConnections.create.useMutation({
    onSuccess: (data) => {
      utils.bankConnections.list.invalidate();
      if (data.requiresTwoFactor) {
        setTwoFactorConnectionId(data.id);
        initTwoFactorMutation.mutate({ connectionId: data.id });
      } else {
        setShowAddForm(false);
        resetForm();
      }
    },
  });

  const deleteMutation = trpc.bankConnections.delete.useMutation({
    onSuccess: () => {
      utils.bankConnections.list.invalidate();
    },
  });

  const syncMutation = trpc.bankConnections.syncNow.useMutation({
    onSuccess: () => {
      utils.bankConnections.list.invalidate();
    },
  });

  const syncAllMutation = trpc.bankConnections.syncAll.useMutation({
    onSuccess: () => {
      utils.bankConnections.list.invalidate();
    },
  });

  const initTwoFactorMutation = trpc.bankConnections.initTwoFactor.useMutation({
    onSuccess: (data) => {
      // Store the sessionId for stateful 2FA completion
      if (data.sessionId) {
        setTwoFactorSessionId(data.sessionId);
        console.log('[2FA] Received sessionId:', data.sessionId);
      }
    },
  });

  const completeTwoFactorMutation = trpc.bankConnections.completeTwoFactor.useMutation({
    onSuccess: () => {
      utils.bankConnections.list.invalidate();
      setTwoFactorConnectionId(null);
      setTwoFactorSessionId(null);
      setOtpCode('');
      setShowAddForm(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      provider: 'isracard',
      displayName: '',
    });
    setTwoFactorSessionId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.provider === 'onezero') {
      createMutation.mutate({
        provider: 'onezero',
        displayName: formData.displayName,
        credentials: {
          email: formData.email!,
          password: formData.password!,
          phoneNumber: formData.phoneNumber!,
        },
      });
    } else {
      createMutation.mutate({
        provider: 'isracard',
        displayName: formData.displayName,
        credentials: {
          id: formData.id!,
          card6Digits: formData.card6Digits!,
          password: formData.password!,
        },
      });
    }
  };

  const handleCompleteTwoFactor = () => {
    if (twoFactorConnectionId && otpCode) {
      console.log('[2FA] Completing with sessionId:', twoFactorSessionId);
      completeTwoFactorMutation.mutate({
        connectionId: twoFactorConnectionId,
        otpCode,
        sessionId: twoFactorSessionId || undefined, // Pass sessionId for stateful 2FA
      });
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-success-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-error-500" />;
      case 'auth_required':
        return <KeyRound className="h-5 w-5 text-warning-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-warning-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'auth_required':
        return 'Re-auth required';
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'pending':
        return 'Pending';
      default:
        return 'Never synced';
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'onezero':
        return <Building2 className="h-5 w-5" />;
      case 'isracard':
        return <CreditCard className="h-5 w-5" />;
      default:
        return <Building2 className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Connections</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Connect your bank accounts and credit cards for automatic transaction sync
          </p>
        </div>
        <div className="flex items-center gap-3">
          {connections && connections.filter((c) => c.isActive).length > 0 && (
            <button
              onClick={() => syncAllMutation.mutate({})}
              disabled={syncAllMutation.isPending}
              className="btn btn-outline"
            >
              {syncAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync All
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Connection
          </button>
        </div>
      </div>

      {/* Add Connection Form */}
      {showAddForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {twoFactorConnectionId ? 'Complete 2FA Setup' : 'Add New Connection'}
          </h2>

          {twoFactorConnectionId ? (
            // 2FA Completion Form
            <div className="space-y-4">
              {initTwoFactorMutation.isPending ? (
                <div className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <div>
                      <p className="font-medium">Sending OTP code...</p>
                      <p className="text-sm">A browser window may open briefly. Please wait.</p>
                    </div>
                  </div>
                </div>
              ) : initTwoFactorMutation.error ? (
                <div className="bg-error-50 dark:bg-error-900/30 text-error-700 dark:text-error-300 p-4 rounded-lg">
                  <p className="font-medium">Failed to send OTP</p>
                  <p className="text-sm">{initTwoFactorMutation.error.message}</p>
                  <button
                    onClick={() => {
                      if (twoFactorConnectionId) {
                        initTwoFactorMutation.mutate({ connectionId: twoFactorConnectionId });
                      }
                    }}
                    className="btn btn-sm btn-outline mt-2"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 p-4 rounded-lg">
                  <p className="font-medium">OTP code sent to your phone</p>
                  <p className="text-sm">Enter the code you received via SMS to complete the setup.</p>
                  {twoFactorSessionId && (
                    <p className="text-xs mt-1 opacity-60">Session: {twoFactorSessionId.slice(0, 20)}...</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  OTP Code
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter OTP code"
                  className="input"
                  maxLength={10}
                  disabled={initTwoFactorMutation.isPending}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCompleteTwoFactor}
                  disabled={!otpCode || completeTwoFactorMutation.isPending || initTwoFactorMutation.isPending}
                  className="btn btn-primary"
                >
                  {completeTwoFactorMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <KeyRound className="h-4 w-4 mr-2" />
                  Complete Setup
                </button>
                <button
                  onClick={() => {
                    setTwoFactorConnectionId(null);
                    setTwoFactorSessionId(null);
                    setOtpCode('');
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              </div>

              {completeTwoFactorMutation.error && (
                <p className="text-sm text-error-600 dark:text-error-400">
                  {completeTwoFactorMutation.error.message}
                </p>
              )}
            </div>
          ) : (
            // New Connection Form
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Provider
                  </label>
                  <select
                    value={formData.provider}
                    onChange={(e) =>
                      setFormData({ ...formData, provider: e.target.value as Provider })
                    }
                    className="input"
                  >
                    {providers?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    placeholder="e.g., My OneZero Account"
                    className="input"
                    required
                  />
                </div>
              </div>

              {formData.provider === 'onezero' ? (
                // OneZero credentials
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={formData.password || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phoneNumber || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, phoneNumber: e.target.value })
                      }
                      placeholder="+972501234567"
                      className="input"
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      International format (e.g., +972501234567) or local (0501234567)
                    </p>
                  </div>
                </div>
              ) : (
                // Isracard credentials
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      ID Number
                    </label>
                    <input
                      type="text"
                      value={formData.id || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, id: e.target.value })
                      }
                      placeholder="123456789"
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Last 6 Digits of Card
                    </label>
                    <input
                      type="text"
                      value={formData.card6Digits || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, card6Digits: e.target.value })
                      }
                      placeholder="123456"
                      maxLength={6}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={formData.password || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="input"
                      required
                    />
                  </div>
                </div>
              )}

              {formData.provider === 'onezero' && (
                <div className="bg-warning-50 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 p-3 rounded-lg text-sm">
                  <strong>Note:</strong> OneZero requires 2FA setup. After adding, you'll receive an OTP code via SMS to complete the connection.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn btn-primary"
                >
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Add Connection
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              </div>

              {createMutation.error && (
                <p className="text-sm text-error-600 dark:text-error-400">
                  {createMutation.error.message}
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {/* Connections List */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Connection
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Sync
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {connections?.map((connection) => (
              <tr key={connection.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        connection.isActive
                          ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                      )}
                    >
                      {getProviderIcon(connection.provider)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {connection.displayName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Added {formatDate(connection.createdAt)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {connection.providerDisplayName}
                  </span>
                  {connection.requiresTwoFactor && !connection.isActive && (
                    <span className="ml-2 badge badge-warning text-xs">
                      2FA Required
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(connection.lastSyncStatus)}
                    <span
                      className={cn(
                        'text-sm',
                        connection.lastSyncStatus === 'success' && 'text-success-600 dark:text-success-400',
                        connection.lastSyncStatus === 'error' && 'text-error-600 dark:text-error-400',
                        connection.lastSyncStatus === 'auth_required' && 'text-warning-600 dark:text-warning-400',
                        !connection.lastSyncStatus && 'text-gray-400 dark:text-gray-500'
                      )}
                    >
                      {getStatusLabel(connection.lastSyncStatus)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {connection.lastSyncAt
                    ? formatDate(connection.lastSyncAt)
                    : 'Never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Show Re-authenticate button for auth_required status */}
                    {connection.lastSyncStatus === 'auth_required' && connection.requiresTwoFactor && (
                      <button
                        onClick={() => {
                          setTwoFactorConnectionId(connection.id);
                          setShowAddForm(true);
                          initTwoFactorMutation.mutate({
                            connectionId: connection.id,
                          });
                        }}
                        className="btn btn-sm btn-warning"
                      >
                        <KeyRound className="h-4 w-4 mr-1" />
                        Re-authenticate
                      </button>
                    )}
                    {/* Show Sync button for active connections without auth issues */}
                    {connection.isActive && connection.lastSyncStatus !== 'auth_required' && (
                      <button
                        onClick={() =>
                          syncMutation.mutate({ connectionId: connection.id })
                        }
                        disabled={syncMutation.isPending}
                        className="btn btn-sm btn-outline"
                        title="Sync now"
                      >
                        {syncMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {/* Show Setup 2FA for inactive connections */}
                    {!connection.isActive && connection.requiresTwoFactor && (
                      <button
                        onClick={() => {
                          setTwoFactorConnectionId(connection.id);
                          setShowAddForm(true);
                          initTwoFactorMutation.mutate({
                            connectionId: connection.id,
                          });
                        }}
                        className="btn btn-sm btn-primary"
                      >
                        <KeyRound className="h-4 w-4 mr-1" />
                        Setup 2FA
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this connection?')) {
                          deleteMutation.mutate(connection.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="btn btn-sm btn-outline text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/30"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!connections || connections.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-12 w-12 text-gray-300" />
                    <p>No bank connections yet</p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="btn btn-primary btn-sm mt-2"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add your first connection
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sync Status Messages */}
      {syncMutation.isSuccess && (
        <div className="fixed bottom-4 right-4 bg-success-50 dark:bg-success-900/90 text-success-700 dark:text-success-200 px-4 py-3 rounded-lg shadow-lg animate-in border border-success-200 dark:border-success-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <span>
              Sync complete! Found {syncMutation.data.transactionsFound} transactions,{' '}
              {syncMutation.data.transactionsNew} new.
            </span>
          </div>
        </div>
      )}

      {syncMutation.error && (
        <div className="fixed bottom-4 right-4 bg-error-50 dark:bg-error-900/90 text-error-700 dark:text-error-200 px-4 py-3 rounded-lg shadow-lg animate-in border border-error-200 dark:border-error-800">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            <span>Sync failed: {syncMutation.error.message}</span>
          </div>
        </div>
      )}

      {/* Sync All Status Messages */}
      {syncAllMutation.isSuccess && (
        <div className="fixed bottom-4 right-4 bg-success-50 dark:bg-success-900/90 text-success-700 dark:text-success-200 px-4 py-3 rounded-lg shadow-lg animate-in max-w-md border border-success-200 dark:border-success-800">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{syncAllMutation.data.message}</p>
              <p className="text-sm">
                Found {syncAllMutation.data.totalTransactionsFound} transactions,{' '}
                {syncAllMutation.data.totalTransactionsNew} new.
              </p>
              {syncAllMutation.data.results.some((r) => !r.success) && (
                <div className="mt-2 text-sm text-error-600 dark:text-error-300">
                  <p className="font-medium">Failed connections:</p>
                  <ul className="list-disc list-inside">
                    {syncAllMutation.data.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <li key={r.connectionId}>{r.displayName}: {r.errorMessage}</li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {syncAllMutation.error && (
        <div className="fixed bottom-4 right-4 bg-error-50 dark:bg-error-900/90 text-error-700 dark:text-error-200 px-4 py-3 rounded-lg shadow-lg animate-in border border-error-200 dark:border-error-800">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            <span>Sync all failed: {syncAllMutation.error.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

