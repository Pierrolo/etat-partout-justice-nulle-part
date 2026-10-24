import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { IconCheck, IconCopy } from '@/components/ui/icons';

export interface ShareButtonProps {
  /** Returns the full shareable URL (hash included), built from the CURRENT valid answers at click time. */
  getUrl: () => string;
  /** Neutral sentence handed to the share sheet along with the link. */
  text?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  className?: string;
}

const IconShare = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 10V2.5M5 5l3-3 3 3M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" />
  </svg>
);

/**
 * Shares the link carrying the whole situation in its #hash.
 *  - on a phone (touch device with the Web Share API): « Partager » opens the system share sheet
 *    (WhatsApp, SMS, mail…); if it fails for any reason other than the person cancelling, the link is copied;
 *  - everywhere else: « Copier le lien » copies it; if the clipboard is unavailable (insecure context),
 *    the URL is shown in a selected field.
 * Confirmation is written (button label + polite status), never just an icon change.
 */
export function ShareButton({
  getUrl,
  text,
  variant = 'secondary',
  size = 'md',
  className,
}: ShareButtonProps) {
  const [native, setNative] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNative(
      typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        window.matchMedia('(pointer: coarse)').matches,
    );
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    if (manual) field.current?.select();
  }, [manual]);

  const copy = async (url: string) => {
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

  const onClick = async () => {
    const url = getUrl();
    if (native) {
      try {
        await navigator.share({ title: 'Et moi, dans tout ça ?', text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // the person closed the sheet
      }
    }
    await copy(url);
  };

  return (
    <div className={className}>
      <Button variant={variant} size={size} onClick={onClick}>
        {copied ? <IconCheck size={16} /> : native ? <IconShare /> : <IconCopy size={16} />}
        {copied ? 'Lien copié' : native ? 'Partager' : 'Copier le lien'}
      </Button>
      <span role="status" className="sr-only">
        {copied ? 'Lien copié dans le presse-papiers.' : ''}
      </span>
      {manual && (
        <label className="mt-2 block text-sm text-ink-2">
          Copiez ce lien (Ctrl + C) :
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
