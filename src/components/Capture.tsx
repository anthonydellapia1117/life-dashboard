import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildCaptureRecord,
  buildMailtoUrl,
  buildPlainTextExport,
  deleteCapture,
  hydrateCaptures,
  listCaptures,
  saveCapture,
  type CaptureView,
} from '../lib/captures';
import { formatRelativeTime } from '../lib/date';

/** Fall back to a hidden textarea + execCommand when the async Clipboard API isn't available. */
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback below.
    }
  }
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.focus();
  helper.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(helper);
  }
}

/**
 * Capture card - top of Today. A Wispr-friendly dictation box (n focuses it,
 * Cmd/Ctrl+Enter saves, Escape blurs - desktop only) plus the on-device note
 * list. Nothing here ever touches localStorage/sessionStorage; notes live
 * encrypted in IndexedDB (src/lib/captures.ts) and are only ever decrypted
 * in memory while the app is unlocked.
 */
export function Capture({
  cryptoKey,
  salt,
  captureEmail,
}: {
  cryptoKey: CryptoKey | undefined;
  salt: string;
  captureEmail?: string;
}) {
  const [text, setText] = useState('');
  const [views, setViews] = useState<CaptureView[]>([]);
  const [saving, setSaving] = useState(false);
  // Collapsed to one line until it is touched: Today's job is to answer what
  // to do next, and an open textarea pushed that answer below the fold.
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    if (!cryptoKey) {
      setViews([]);
      return;
    }
    const records = await listCaptures().catch(() => []);
    setViews(await hydrateCaptures(records, salt, cryptoKey));
  }, [cryptoKey, salt]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Desktop-only "n to focus" - only when focus isn't already in a field.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (!inField && e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed || !cryptoKey || saving) return;
    setSaving(true);
    try {
      const record = await buildCaptureRecord(cryptoKey, salt, trimmed);
      await saveCapture(record);
      setText('');
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCapture(id);
    await refresh();
  }

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      textareaRef.current?.blur();
    }
  }

  async function handleCopyAll() {
    const ok = await copyToClipboard(buildPlainTextExport(views));
    setCopyStatus(ok ? 'copied' : 'failed');
    window.setTimeout(() => setCopyStatus('idle'), 2000);
  }

  const hasNotes = views.length > 0;
  const mailtoHref = captureEmail && hasNotes ? buildMailtoUrl(captureEmail, views) : undefined;

  return (
    <section className={`capture-card${open || text ? ' capture-open' : ''}`} aria-label="Capture">
      <div className="capture-box">
        <textarea
          ref={textareaRef}
          className="capture-textarea"
          rows={open || text ? 3 : 1}
          aria-label="Capture a note"
          placeholder="Capture a thought..."
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          enterKeyHint="done"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onTextareaKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(text.trim().length > 0)}
        />
        {open || text ? (
          <>
            <div className="capture-actions">
              <button type="button" className="capture-save" onClick={handleSave} disabled={!text.trim() || !cryptoKey || saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <span className="capture-key-hint">Press N to focus, Cmd+Enter to save</span>
            </div>
            <p className="capture-hint">Dictate with Wispr, then Save. Nothing leaves this device until you copy or send it.</p>
          </>
        ) : null}
      </div>

      {hasNotes ? (
        <div className="capture-list">
          {views.map((v) => (
            <div className="capture-item" key={v.id}>
              <div className="capture-item-body">
                <div className="capture-item-time">{formatRelativeTime(v.at)}</div>
                {v.locked ? (
                  <div className="capture-item-text capture-item-locked">Locked (older key)</div>
                ) : (
                  <div className="capture-item-text">{v.text}</div>
                )}
              </div>
              <button type="button" className="capture-delete" onClick={() => handleDelete(v.id)} aria-label="Delete note">
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {hasNotes ? (
        <div className="capture-export">
          <button type="button" className="capture-copy" onClick={handleCopyAll}>
            {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Could not copy' : 'Copy all'}
          </button>
          {mailtoHref ? (
            <a className="capture-send" href={mailtoHref}>
              Send to inbox
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
