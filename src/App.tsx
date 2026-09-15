import { useEffect, useState } from 'react';
import type { SealedBlob } from './crypto';
import { WrongPassphraseError, decryptWithKey, unlockWithPassphrase } from './crypto';
import { clearRememberedKeys, loadRememberedKey, storeRememberedKey } from './idb';
import type { LifeData } from './types';
import {
  ZONE_LABELS,
  SECTIONS_BY_ZONE,
  SECTION_LABELS,
  parseHash,
  routeToHash,
  type ZoneId,
  type Route,
  type SectionId,
} from './lib/routing';
import { Header } from './components/Header';
import { NavBar } from './components/NavBar';
import { SegmentedControl } from './components/SegmentedControl';
import { Unlock } from './components/Unlock';
import { Today } from './tabs/Today';
import { Work } from './tabs/Work';
import { Career } from './tabs/Career';
import { Ayvede } from './tabs/Ayvede';
import { Family } from './tabs/Family';
import { Finances } from './tabs/Finances';
import { Unico } from './tabs/Unico';
import { Projects } from './tabs/Projects';
import { AiStack } from './tabs/AiStack';

type Phase = 'loading' | 'error' | 'locked' | 'unlocked';

function renderRoute(route: Route, data: LifeData) {
  if (route.zone === 'today') return <Today data={data} />;
  switch (route.section) {
    case 'engagement':
      return <Work data={data.work} />;
    case 'career':
      return <Career data={data.career} />;
    case 'business':
      return <Ayvede data={data.ayvede} />;
    case 'family':
      return <Family data={data.family} />;
    case 'finances':
      return <Finances data={data.finances} />;
    case 'community':
      return <Unico data={data.unico} />;
    case 'projects':
      return <Projects data={data.projects} />;
    case 'ai-stack':
      return <AiStack data={data.aiStack} />;
    default:
      return null;
  }
}

/** The active screen's heading: a data-carried title where one exists (Work/Career), else a neutral word. */
function routeTitle(route: Route, data: LifeData | undefined): string {
  if (route.zone === 'today') return ZONE_LABELS.today;
  if (!route.section) return ZONE_LABELS[route.zone];
  if (route.section === 'engagement') return data?.work?.title ?? SECTION_LABELS.engagement;
  if (route.section === 'career') return data?.career?.title ?? SECTION_LABELS.career;
  return SECTION_LABELS[route.section];
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [blob, setBlob] = useState<SealedBlob | undefined>();
  const [data, setData] = useState<LifeData | undefined>();
  const [fetchError, setFetchError] = useState<string | undefined>();
  const [unlockError, setUnlockError] = useState<string | undefined>();
  const [unlocking, setUnlocking] = useState(false);
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    function onHashChange() {
      setRoute(parseHash(window.location.hash));
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    // Keep the address bar canonical (a legacy hash like "#work" becomes
    // "#work/engagement") without adding a history entry or re-firing hashchange.
    const canonical = routeToHash(route);
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical);
    }
  }, [route]);

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

  function goToZone(id: ZoneId) {
    const sections = SECTIONS_BY_ZONE[id];
    setRoute(sections.length > 0 ? { zone: id, section: sections[0] } : { zone: id });
  }

  function goToSection(section: SectionId) {
    setRoute((prev) => ({ zone: prev.zone, section }));
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

  const sections = SECTIONS_BY_ZONE[route.zone];
  const title = routeTitle(route, data);

  return (
    <div className="app-shell">
      {phase === 'unlocked' ? <NavBar active={route.zone} onChange={goToZone} /> : null}
      <div className="app-body">
        <div className="app-topbar">
          <Header title={title} asOf={data?.meta.asOf} unlocked={phase === 'unlocked'} onLock={handleLock} />
          {phase === 'unlocked' && sections.length > 0 && route.section ? (
            <SegmentedControl
              ariaLabel={`${ZONE_LABELS[route.zone]} sections`}
              options={sections.map((id) => ({ id, label: SECTION_LABELS[id] }))}
              active={route.section}
              onChange={goToSection}
            />
          ) : null}
        </div>
        <main className="app-main">
          {phase === 'loading' ? <div className="status-message">Loading...</div> : null}
          {phase === 'error' ? <div className="status-message status-error">{fetchError}</div> : null}
          {phase === 'locked' ? <Unlock onUnlock={handleUnlock} error={unlockError} busy={unlocking} /> : null}
          {phase === 'unlocked' && data ? (
            <div id={`panel-${route.zone}${route.section ? `-${route.section}` : ''}`}>
              {renderRoute(route, data)}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
