import { useRef, useState } from 'react';
import type { SealedBlob } from '../crypto';
import { WrongPassphraseError } from '../crypto';
import { clearRememberedKeys } from '../idb';
import { createLockRecord, clearLock, saveLock, unlockExtractable } from '../lib/deviceLock';
import { SetLock } from './SetLock';

type Step = 'idle' | 'passphrase' | 'code';

/**
 * Device lock settings, shown on Map > Progress.
 *
 * Setting or changing a lock always starts from a fresh full passphrase
 * unlock (never from a remembered key), so a lock can never be created or
 * replaced without the owner typing the real passphrase at that moment. The
 * raw data key only ever lives in a ref between that passphrase check and
 * the moment createLockRecord wraps it - never in React state, never logged.
 */
export function DeviceLockSettings({
  blob,
  hasLock,
  onChanged,
}: {
  blob: SealedBlob;
  hasLock: boolean;
  onChanged: () => void;
}) {
  const [step, setStep] = useState<Step>('idle');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const rawRef = useRef<Uint8Array | undefined>(undefined);

  /** Every exit from holding the raw key - set, cancel, error - goes through here. */
  function zeroRaw() {
    if (rawRef.current) {
      rawRef.current.fill(0);
      rawRef.current = undefined;
    }
  }

  function reset() {
    setStep('idle');
    setPassphrase('');
    setError(undefined);
    setConfirmingRemove(false);
    zeroRaw();
  }

  async function handlePassphraseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passphrase || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const { raw } = await unlockExtractable(blob, passphrase);
      rawRef.current = raw;
      setPassphrase('');
      setStep('code');
    } catch (err) {
      setError(err instanceof WrongPassphraseError ? err.message : 'Something went wrong unlocking the data.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetCode(code: string) {
    if (!rawRef.current) {
      reset();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const record = await createLockRecord(rawRef.current, code);
      await saveLock(blob.salt, record);
      // A plain remembered key would let the app open without the code,
      // which defeats the point of setting a lock.
      await clearRememberedKeys().catch(() => {
        // Best effort - the lock itself is already saved above.
      });
      zeroRaw();
      setStep('idle');
      setConfirmingRemove(false);
      onChanged();
    } catch {
      // Not kept for a retry - it would sit in memory while the form stays open.
      zeroRaw();
      setStep('idle');
      setError('Could not save the lock on this device. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    await clearLock(blob.salt).catch(() => {
      // Best effort - the confirm below still closes either way.
    });
    setConfirmingRemove(false);
    onChanged();
  }

  return (
    <section className="datactl" aria-label="Device lock">
      <h3 className="section-heading">Device lock</h3>

      {step === 'idle' ? (
        <>
          <p className="caption">
            {hasLock ? 'This device asks for your lock each time it opens.' : 'This device opens without a code.'}
          </p>
          {error ? <p className="datactl-status" role="alert">{error}</p> : null}
          <div className="datactl-row">
            {hasLock ? (
              <>
                <button type="button" className="btn" onClick={() => setStep('passphrase')}>
                  Change lock
                </button>
                {confirmingRemove ? (
                  <>
                    <span className="caption">Remove the lock from this device?</span>
                    <button type="button" className="btn btn-danger" onClick={handleRemove}>
                      Yes, remove it
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={() => setConfirmingRemove(false)}>
                      Keep it
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirmingRemove(true)}>
                    Remove lock
                  </button>
                )}
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setStep('passphrase')}>
                Set a device lock
              </button>
            )}
          </div>
        </>
      ) : null}

      {step === 'passphrase' ? (
        <form onSubmit={handlePassphraseSubmit}>
          <label className="unlock-field">
            <span>Full passphrase</span>
            <input
              type="password"
              name="passphrase"
              autoComplete="current-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              required
            />
          </label>
          <div className="datactl-row">
            <button type="submit" className="btn" disabled={busy || !passphrase}>
              {busy ? 'Checking...' : 'Continue'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={reset} disabled={busy}>
              Cancel
            </button>
          </div>
          {error ? <p className="datactl-status">{error}</p> : null}
        </form>
      ) : null}

      {step === 'code' ? <SetLock onSet={handleSetCode} onSkip={reset} busy={busy} error={error} inline /> : null}
    </section>
  );
}
