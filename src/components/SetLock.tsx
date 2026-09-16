import { useState } from 'react';
import { MIN_LOCK_LENGTH } from '../lib/deviceLock';

/**
 * Collects a new device lock code and its confirmation.
 *
 * Shown straight after a passphrase unlock when setLock was ticked in
 * Unlock.tsx (App.tsx's phase 'setlock'), and reused by DeviceLockSettings
 * for "Set a device lock" / "Change lock" once the full passphrase has
 * already been checked there. This component never sees the passphrase or
 * the raw data key - it only hands the finished code string to onSet.
 */
export function SetLock({
  onSet,
  onSkip,
  busy,
  error,
  inline = false,
}: {
  onSet: (code: string) => void;
  onSkip: () => void;
  busy: boolean;
  error?: string;
  /** Just the fields, for use inside a page (Settings) rather than as a full screen of its own. */
  inline?: boolean;
}) {
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (code.length < MIN_LOCK_LENGTH) {
      setLocalError(`A device lock code must be at least ${MIN_LOCK_LENGTH} characters.`);
      return;
    }
    if (code !== confirm) {
      setLocalError('Those two codes did not match.');
      return;
    }
    setLocalError(undefined);
    onSet(code);
  }

  const shownError = localError ?? error;

  const form = (
    <form className={inline ? 'setlock-inline' : 'unlock-card'} onSubmit={handleSubmit}>
      {inline ? null : (
        <>
          <div className="unlock-title">
            AVD <span className="accent">Life</span>
          </div>
          <p className="unlock-sub">Set a short code to open this device next time.</p>
        </>
      )}
      <label className="unlock-field">
        <span>New code</span>
        <input
          type="password"
          name="newLockCode"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          required
        />
      </label>
      <label className="unlock-field">
        <span>Confirm code</span>
        <input
          type="password"
          name="confirmLockCode"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </label>
      {shownError ? (
        <div className="unlock-error" role="alert">
          {shownError}
        </div>
      ) : null}
      <button type="submit" className="unlock-button" disabled={busy}>
        {busy ? 'Setting...' : 'Set lock'}
      </button>
      <button type="button" className="btn btn-quiet" onClick={onSkip} disabled={busy}>
        {inline ? 'Cancel' : 'Skip'}
      </button>
      {inline ? null : <p className="caption">Skip, and this device asks for the full passphrase every time.</p>}
    </form>
  );

  return inline ? form : <div className="unlock-screen">{form}</div>;
}
