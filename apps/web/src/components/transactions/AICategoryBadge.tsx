import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface AICategoryBadgeProps {
  source: string | null;
  confidence?: number | null;
  categoryName?: string | null;
  className?: string;
}

/**
 * Visual indicator for AI-suggested categories
 * Shows a sparkle icon and confidence score
 */
export function AICategoryBadge({
  source,
  confidence,
  categoryName,
  className,
}: AICategoryBadgeProps) {
  // Only show for AI suggestions
  if (source !== 'ai_suggestion') {
    return null;
  }

  const confidencePercent = confidence ? Math.round(confidence * 100) : 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
        'bg-purple-100 text-purple-800 border border-purple-200',
        className
      )}
      title={`AI suggested ${categoryName || 'this category'} with ${confidencePercent}% confidence`}
    >
      <Sparkles className="h-3 w-3" />
      <span>AI: {confidencePercent}%</span>
    </span>
  );
}

/**
 * Inline version for compact spaces (just the icon)
 */
export function AICategoryBadgeCompact({
  source,
  confidence,
}: Pick<AICategoryBadgeProps, 'source' | 'confidence'>) {
  if (source !== 'ai_suggestion') {
    return null;
  }

  const confidencePercent = confidence ? Math.round(confidence * 100) : 0;

  return (
    <span
      className="inline-flex items-center"
      title={`AI suggested (${confidencePercent}% confidence)`}
    >
      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
    </span>
  );
}
