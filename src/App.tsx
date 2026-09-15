import { useEffect, useState } from 'react';
import type { SealedBlob } from './crypto';
import { WrongPassphraseError, decryptWithKey, unlockWithPassphrase } from './crypto';
import { clearRememberedKeys, loadRememberedKey, storeRememberedKey } from './idb';
import { TAB_IDS, type LifeData, type TabId } from './types';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { Unlock } from './components/Unlock';
import { Overview } from './tabs/Overview';
import { Work } from './tabs/Work';
import { Career } from './tabs/Career';
import { Unico } from './tabs/Unico';
import { Projects } from './tabs/Projects';
import { Ayvede } from './tabs/Ayvede';
import { Family } from './tabs/Family';
import { Finances } from './tabs/Finances';
import { AiStack } from './tabs/AiStack';

type Phase = 'loading' | 'error' | 'locked' | 'unlocked';

function getTabFromHash(): TabId {
  const raw = window.location.hash.replace(/^#/, '');
  return (TAB_IDS as readonly string[]).includes(raw) ? (raw as TabId) : 'overview';
}

function renderTab(tab: TabId, data: LifeData) {
  switch (tab) {
    case 'overview':
      return <Overview data={data} />;
    case 'work':
      return <Work data={data.work} />;
    case 'career':
      return <Career data={data.career} />;
    case 'unico':
      return <Unico data={data.unico} />;
    case 'projects':
      return <Projects data={data.projects} />;
    case 'ayvede':
      return <Ayvede data={data.ayvede} />;
    case 'family':
      return <Family data={data.family} />;
    case 'finances':
      return <Finances data={data.finances} />;
    case 'ai-stack':
      return <AiStack data={data.aiStack} />;
    default:
      return null;
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [blob, setBlob] = useState<SealedBlob | undefined>();
  const [data, setData] = useState<LifeData | undefined>();
  const [fetchError, setFetchError] = useState<string | undefined>();
  const [unlockError, setUnlockError] = useState<string | undefined>();
  const [unlocking, setUnlocking] = useState(false);
  const [tab, setTab] = useState<TabId>(() => getTabFromHash());

  useEffect(() => {
    function onHashChange() {
      setTab(getTabFromHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const url = `${import.meta.env.BASE_URL}data/life.enc.json`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Could not load the data file (HTTP ${res.status}).`);
        const parsedBlob = (await res.json()) as SealedBlob;
        if (cancelled) return;
        setBlob(parsedBlob);

        const stored = await loadRememberedKey(parsedBlob.salt).catch(() => undefined);
        if (stored) {
          try {
            const decrypted = await decryptWithKey(parsedBlob, stored);
            if (!cancelled) {
              setData(decrypted as LifeData);
              setPhase('unlocked');
              return;
            }
          } catch {
            // Stored key no longer opens this blob (salt rotated, or the key
            // was corrupted) - fall through to the passphrase prompt below.
          }
        }
        if (!cancelled) setPhase('locked');
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Could not load the data file.');
          setPhase('error');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function changeTab(id: TabId) {
    setTab(id);
    if (window.location.hash !== `#${id}`) {
      window.location.hash = id;
    }
  }

  async function handleUnlock(passphrase: string, remember: boolean) {
    if (!blob) return;
    setUnlocking(true);
    setUnlockError(undefined);
    try {
      const { key, data: decrypted } = await unlockWithPassphrase(blob, passphrase, false);
      setData(decrypted as LifeData);
      setPhase('unlocked');
      if (remember) {
        await storeRememberedKey(blob.salt, key).catch(() => {
          // Remembering is a convenience, not a requirement - ignore failures.
        });
      }
    } catch (err) {
      setUnlockError(err instanceof WrongPassphraseError ? err.message : 'Something went wrong unlocking the data.');
    } finally {
      setUnlocking(false);
    }
  }

  async function handleLock() {
    await clearRememberedKeys().catch(() => {
      // Best effort - still lock the UI even if IndexedDB is unavailable.
    });
    setData(undefined);
    setPhase('locked');
    setUnlockError(undefined);
  }

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <Header asOf={data?.meta.asOf} unlocked={phase === 'unlocked'} onLock={handleLock} />
        {phase === 'unlocked' ? <TabBar active={tab} onChange={changeTab} /> : null}
      </div>
      <main className="app-main">
        {phase === 'loading' ? <div className="status-message">Loading...</div> : null}
        {phase === 'error' ? <div className="status-message status-error">{fetchError}</div> : null}
        {phase === 'locked' ? <Unlock onUnlock={handleUnlock} error={unlockError} busy={unlocking} /> : null}
        {phase === 'unlocked' && data ? (
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {renderTab(tab, data)}
          </div>
        ) : null}
      </main>
    </div>
  );
}
