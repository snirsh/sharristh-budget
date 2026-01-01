import { SettingsContent } from '@/components/settings/SettingsContent';

// Keep dynamic for settings - needs immediate updates
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  return <SettingsContent />;
}
