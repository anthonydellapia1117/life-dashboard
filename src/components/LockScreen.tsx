import { useState } from 'react';
import { MAX_LOCK_FAILURES } from '../lib/deviceLock';

/**
 * Shown instead of the full passphrase prompt when this device already holds
 * a device lock record for the current data blob (src/lib/deviceLock.ts).
 * The code typed here never touches the sealed public data directly - it
 * only unwraps a copy of the data key that App.tsx already stored on this
 * device.
 */
export function LockScreen({
  onSubmit,
  onUsePassphrase,
  error,
  busy,
  triesLeft,
}: {
  onSubmit: (code: string) => void;
  onUsePassphrase: () => void;
  error?: string;
  busy: boolean;
  triesLeft?: number;
}) {
  const [code, setCode] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || busy) return;
    onSubmit(code);
    // A lock screen that keeps a wrong code in the field makes you delete it before the next try.
    setCode('');
  }

  return (
    <div className="unlock-screen">
      <form className="unlock-card" onSubmit={handleSubmit}>
        <div className="unlock-title">
          AVD <span className="accent">Life</span>
        </div>
        <p className="unlock-sub">Enter your device lock.</p>
        <label className="unlock-field">
          <span>Device lock</span>
          <input
            type="password"
            name="lockCode"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            required
          />
        </label>
        {error ? (
          <div className="unlock-error" role="alert">
            {error}
          </div>
        ) : null}
        {triesLeft !== undefined && triesLeft < MAX_LOCK_FAILURES ? (
          <p className="caption">{triesLeft} tries left</p>
        ) : null}
        <button type="submit" className="unlock-button" disabled={busy}>
          {busy ? 'Opening...' : 'Open'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onUsePassphrase} disabled={busy}>
          Use the full passphrase instead
        </button>
      </form>
    </div>
  );
}
