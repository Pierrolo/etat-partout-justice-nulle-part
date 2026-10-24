import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { IconCheck, IconCopy } from '@/components/ui/icons';

export interface ShareButtonProps {
  /** Returns the full shareable URL (hash included), built from the current state at click time. */
  getUrl: () => string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * « Copier le lien » — copies the URL carrying the whole situation in its #hash.
 * Confirmation is written (button label + polite status), never just an icon change.
 * If the clipboard API is unavailable (insecure context), the URL is shown in a selected field.
 */
export function ShareButton({
  getUrl,
  variant = 'secondary',
  size = 'md',
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (manual) field.current?.select();
  }, [manual]);

  const copy = async () => {
    const url = getUrl();
    try {
      await navigator.clipboard.writeText(url);
      setManual(null);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 3000);
    } catch {
      setManual(url);
    }
  };

  return (
    <div className={className}>
      <Button variant={variant} size={size} onClick={copy}>
        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
        {copied ? 'Lien copié' : 'Copier le lien'}
      </Button>
      <span role="status" className="sr-only">
        {copied ? 'Lien copié dans le presse-papiers.' : ''}
      </span>
      {manual && (
        <label className="mt-2 block text-sm text-ink-2">
          Copiez ce lien (Ctrl + C) :
          <input
            ref={field}
            readOnly
            value={manual}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 block w-full rounded-md border-[1.5px] border-rule-strong bg-field px-3 py-2 font-mono text-xs text-ink"
          />
        </label>
      )}
    </div>
  );
}
