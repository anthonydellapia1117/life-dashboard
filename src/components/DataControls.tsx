import { useRef, useState } from 'react';
import type { Live } from '../lib/live';

/**
 * Getting edits off this device.
 *
 * The overlay is per device by construction - there is no server, so nothing
 * syncs on its own. Without a way out, a week of checking things off on the
 * phone would be stranded there, and the next re-seal on the Mac would look
 * like it had quietly thrown the week away. It has not: the base data and the
 * overlay are separate, and this is the bridge between them.
 *
 * Export writes plaintext, because a file you cannot read is no use to you.
 * That is the one place in this app where decrypted content leaves memory, so
 * it happens only when you press the button, and the copy says so.
 */
export function DataControls({ live }: { live: Live }) {
  const [status, setStatus] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const edited = live.all.filter((n) => n.edited).length;

  async function handleCopy() {
    const text = live.exportJson();
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied. Paste it somewhere you can get at from the Mac.');
    } catch {
      setStatus('Could not reach the clipboard. Use Download instead.');
    }
  }

  function handleDownload() {
    const blob = new Blob([live.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-edits-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('Downloaded.');
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const count = await live.importJson(await file.text());
      setStatus(`Merged ${count} change${count === 1 ? '' : 's'}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not read that file.');
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleClear() {
    await live.clearAll();
    setConfirming(false);
    setStatus('Overlay cleared. Everything is back to the sealed data.');
  }

  return (
    <section className="datactl" aria-label="Your changes">
      <h3 className="section-heading">Your changes</h3>
      <p className="caption">
        {edited === 0
          ? 'Nothing edited on this device yet. Changes live here, encrypted, and never leave until you send them.'
          : `${edited} item${edited === 1 ? '' : 's'} edited on this device. They are stored here, encrypted, and are not on your other devices.`}
      </p>

      <div className="datactl-row">
        <button type="button" className="btn" onClick={handleCopy} disabled={edited === 0}>
          Copy changes
        </button>
        <button type="button" className="btn" onClick={handleDownload} disabled={edited === 0}>
          Download
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Import a file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="datactl-file"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <p className="caption">Copy and Download write readable text, so keep the file the way you keep the passphrase.</p>

      <div className="datactl-row datactl-danger">
        {confirming ? (
          <>
            <span className="datactl-warn">Throw away every change on this device?</span>
            <button type="button" className="btn btn-danger" onClick={handleClear}>
              Yes, clear it
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
              Keep them
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => setConfirming(true)} disabled={edited === 0}>
            Clear my changes
          </button>
        )}
      </div>

      {status ? <p className="datactl-status">{status}</p> : null}
    </section>
  );
}
