import { useState } from 'react';

export function Unlock({
  onUnlock,
  error,
  busy,
}: {
  onUnlock: (passphrase: string, setLock: boolean) => void;
  error?: string;
  busy: boolean;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [setLock, setSetLock] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passphrase || busy) return;
    onUnlock(passphrase, setLock);
  }

  return (
    <div className="unlock-screen">
      <form className="unlock-card" onSubmit={handleSubmit}>
        <div className="unlock-title">
          AVD <span className="accent">Life</span>
        </div>
        <p className="unlock-sub">Enter the passphrase to decrypt this dashboard.</p>
        <label className="unlock-field">
          <span>Passphrase</span>
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
        <label className="unlock-remember">
          <input type="checkbox" checked={setLock} onChange={(e) => setSetLock(e.target.checked)} />
          Set a short device lock after unlocking
        </label>
        {error ? (
          <div className="unlock-error" role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" className="unlock-button" disabled={busy}>
          {busy ? 'Unlocking...' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
