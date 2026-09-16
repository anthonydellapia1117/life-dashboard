import { useEffect, useMemo, useRef, useState } from 'react';
import type { SealedBlob } from './crypto';
import { WrongPassphraseError, decryptWithKey, unlockWithPassphrase } from './crypto';
import { clearRememberedKeys, loadRememberedKey } from './idb';
import {
  LockStorageError,
  WrongLockCodeError,
  attemptUnlock,
  clearLock,
  createLockRecord,
  loadLock,
  saveLock,
  triesLeft,
  unlockExtractable,
  type LockRecord,
} from './lib/deviceLock';
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
import { useLive } from './lib/live';
import type { EditFields } from './lib/edits';
import { Header } from './components/Header';
import { NavBar } from './components/NavBar';
import { SegmentedControl } from './components/SegmentedControl';
import { Unlock } from './components/Unlock';
import { LockScreen } from './components/LockScreen';
import { SetLock } from './components/SetLock';
import { EditSheet } from './components/EditSheet';
import { SectionOverview } from './components/SectionOverview';
import { Today } from './tabs/Today';
import { MapTab } from './tabs/Map';
import { Work } from './tabs/Work';
import { Career } from './tabs/Career';
import { Ayvede } from './tabs/Ayvede';
import { Family } from './tabs/Family';
import { Finances } from './tabs/Finances';
import { Unico } from './tabs/Unico';
import { Projects } from './tabs/Projects';
import { AiStack } from './tabs/AiStack';

type Phase = 'loading' | 'error' | 'locked' | 'lockcode' | 'setlock' | 'unlocked';

function renderSection(section: SectionId | undefined, data: LifeData) {
  switch (section) {
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
  // Kept in state (not just used transiently to decrypt) so Today's Capture
  // card and the edit overlay can encrypt/decrypt for as long as the app stays
  // unlocked; handleLock below clears it and both disappear with it.
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | undefined>();
  const [fetchError, setFetchError] = useState<string | undefined>();
  const [unlockError, setUnlockError] = useState<string | undefined>();
  const [unlocking, setUnlocking] = useState(false);
  // The device lock record for the current blob's salt (src/lib/deviceLock.ts) -
  // undefined means this device has no lock set. hasLock mirrors "a record
  // exists" as a plain boolean for MapTab/DeviceLockSettings, refreshed after
  // load and whenever DeviceLockSettings reports a change.
  const [lockRecord, setLockRecord] = useState<LockRecord | undefined>();
  const [hasLock, setHasLock] = useState(false);
  const [lockCodeError, setLockCodeError] = useState<string | undefined>();
  const [lockCodeBusy, setLockCodeBusy] = useState(false);
  const [setLockBusy, setSetLockBusy] = useState(false);
  const [setLockError, setSetLockError] = useState<string | undefined>();
  // Raw data-key bytes, only ever held here (never in React state, never
  // logged) between a passphrase unlock with setLock ticked and the moment
  // SetLock's onSet wraps them into a LockRecord and zeroes them.
  const rawRef = useRef<Uint8Array | undefined>(undefined);
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [editing, setEditing] = useState<string | undefined>();

  const now = useMemo(() => new Date(), []);
  const live = useLive(data, cryptoKey, blob?.salt ?? '');

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

        const lock = await loadLock(parsedBlob.salt).catch(() => undefined);
        if (cancelled) return;
        setHasLock(!!lock);
        if (lock) {
          setLockRecord(lock);
          setPhase('lockcode');
          return;
        }

        const stored = await loadRememberedKey(parsedBlob.salt).catch(() => undefined);
        if (stored) {
          try {
            const decrypted = await decryptWithKey(parsedBlob, stored);
            if (!cancelled) {
              setData(decrypted as LifeData);
              setCryptoKey(stored);
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

  /** setLock ticked -> keep the app decrypted, but detour through 'setlock' before it is browsable. Otherwise, unchanged. */
  async function handleUnlock(passphrase: string, setLock: boolean) {
    if (!blob) return;
    setUnlocking(true);
    setUnlockError(undefined);
    try {
      if (setLock) {
        const { raw, key, data: decrypted } = await unlockExtractable(blob, passphrase);
        rawRef.current = raw;
        setData(decrypted as LifeData);
        setCryptoKey(key);
        setPhase('setlock');
      } else {
        const { key, data: decrypted } = await unlockWithPassphrase(blob, passphrase, false);
        setData(decrypted as LifeData);
        setCryptoKey(key);
        setPhase('unlocked');
      }
    } catch (err) {
      zeroRaw();
      setUnlockError(err instanceof WrongPassphraseError ? err.message : 'Something went wrong unlocking the data.');
    } finally {
      setUnlocking(false);
    }
  }

  async function handleLockCodeSubmit(code: string) {
    if (!blob || !lockRecord) return;
    const salt = blob.salt;
    setLockCodeBusy(true);
    setLockCodeError(undefined);
    try {
      // Read the stored record, never React state, so a second tab or a reload
      // can never hand this attempt a stale, lower failure count. If storage
      // cannot be read, the try is refused rather than counted against memory.
      let current: LockRecord | undefined;
      try {
        current = await loadLock(salt);
      } catch {
        throw new LockStorageError();
      }
      if (!current) {
        // Wiped elsewhere (another tab ran out of tries).
        setLockRecord(undefined);
        setHasLock(false);
        setUnlockError('Enter the full passphrase to open this device.');
        setPhase('locked');
        return;
      }

      const result = await attemptUnlock(
        current,
        code,
        (record) => saveLock(salt, record),
        () => clearLock(salt),
      );

      if (result.ok) {
        try {
          const decrypted = await decryptWithKey(blob, result.key);
          setLockRecord(result.record);
          setData(decrypted as LifeData);
          setCryptoKey(result.key);
          setPhase('unlocked');
        } catch {
          // The code was right but the key it guards no longer opens the data:
          // the file was re-sealed with a new passphrase under the same salt.
          // The lock is stale, not wrong - clear it rather than strand the owner.
          await clearLock(salt).catch(() => undefined);
          setLockRecord(undefined);
          setHasLock(false);
          setUnlockError('Your data was re-sealed with a new passphrase. Enter it, then set your lock again.');
          setPhase('locked');
        }
      } else if (result.wiped) {
        setLockRecord(undefined);
        setHasLock(false);
        setUnlockError('Too many tries. Enter the full passphrase, then set a new lock.');
        setPhase('locked');
      } else {
        setLockRecord(result.record);
        setLockCodeError(new WrongLockCodeError().message);
      }
    } catch (err) {
      setLockCodeError(
        err instanceof LockStorageError
          ? `${err.message} Use the full passphrase instead.`
          : 'Something went wrong opening the device lock.',
      );
    } finally {
      setLockCodeBusy(false);
    }
  }

  /** Bails out of the device lock screen without touching the stored lock record. */
  function handleUseFullPassphrase() {
    setLockCodeError(undefined);
    setPhase('locked');
  }

  /** Every exit from holding the raw key - set, skip, error - goes through here. */
  function zeroRaw() {
    if (rawRef.current) {
      rawRef.current.fill(0);
      rawRef.current = undefined;
    }
  }

  async function handleSetLockCode(code: string) {
    if (!blob) return;
    if (!rawRef.current) {
      setSetLockError('This step expired. Skip for now, then set the lock from Map > Progress.');
      return;
    }
    setSetLockBusy(true);
    setSetLockError(undefined);
    try {
      const record = await createLockRecord(rawRef.current, code);
      await saveLock(blob.salt, record);
      // A plain remembered key would let the app open without the code,
      // which defeats the point of setting a lock.
      await clearRememberedKeys().catch(() => {
        // Best effort - the new lock record is already saved above.
      });
      zeroRaw();
      setLockRecord(record);
      setHasLock(true);
      setPhase('unlocked');
    } catch {
      // The key is not kept around for a retry: it would sit in memory for as
      // long as this screen stays open. Skip, then set the lock from Settings,
      // which asks for the passphrase again.
      zeroRaw();
      setSetLockError('Could not save the lock on this device. Skip for now, then set it from Map > Progress.');
    } finally {
      setSetLockBusy(false);
    }
  }

  function handleSkipSetLock() {
    zeroRaw();
    setSetLockError(undefined);
    setPhase('unlocked');
  }

  /** Refreshed after load and whenever DeviceLockSettings reports a change - never inferred from stale state. */
  async function refreshHasLock() {
    if (!blob) return;
    const lock = await loadLock(blob.salt).catch(() => undefined);
    setHasLock(!!lock);
  }

  async function handleLock() {
    if (hasLock && blob) {
      const lock = await loadLock(blob.salt).catch(() => undefined);
      if (lock) {
        setLockRecord(lock);
        setData(undefined);
        setCryptoKey(undefined);
        setPhase('lockcode');
        setUnlockError(undefined);
        setLockCodeError(undefined);
        setEditing(undefined);
        return;
      }
    }
    await clearRememberedKeys().catch(() => {
      // Best effort - still lock the UI even if IndexedDB is unavailable.
    });
    setData(undefined);
    setCryptoKey(undefined);
    setPhase('locked');
    setUnlockError(undefined);
    setEditing(undefined);
  }

  /** New items land in the zone you are standing in, then open straight into the editor. */
  async function handleAdd() {
    const fields: EditFields = {
      title: 'New item',
      zone: route.zone === 'map' || route.zone === 'today' ? 'today' : route.zone,
      section: route.zone === 'map' || route.zone === 'today' ? undefined : route.section,
      area: route.section ? SECTION_LABELS[route.section] : 'Inbox',
      horizon: 'week',
    };
    const id = await live.create(fields);
    setEditing(id);
  }

  function handlePatch(id: string, fields: EditFields) {
    live.patch(id, fields);
  }

  const sections = SECTIONS_BY_ZONE[route.zone];
  const title = routeTitle(route, data);
  const editingNode = editing ? live.byId.get(editing) : undefined;

  const sectionNodes = useMemo(() => {
    if (route.zone === 'today' || route.zone === 'map' || !route.section) return [];
    return live.nodes.filter((n) => n.zone === route.zone && n.section === route.section);
  }, [live.nodes, route.zone, route.section]);

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
          {phase === 'lockcode' ? (
            <LockScreen
              onSubmit={handleLockCodeSubmit}
              onUsePassphrase={handleUseFullPassphrase}
              error={lockCodeError}
              busy={lockCodeBusy}
              triesLeft={lockRecord ? triesLeft(lockRecord) : undefined}
            />
          ) : null}
          {phase === 'setlock' ? (
            <SetLock onSet={handleSetLockCode} onSkip={handleSkipSetLock} busy={setLockBusy} error={setLockError} />
          ) : null}
          {phase === 'unlocked' && data ? (
            <div id={`panel-${route.zone}${route.section ? `-${route.section}` : ''}`}>
              {live.lockedCount > 0 ? (
                <p className="status-message status-error">
                  {live.lockedCount} saved change{live.lockedCount === 1 ? '' : 's'} on this device were written under an
                  older key and cannot be read. They are still stored, not lost.
                </p>
              ) : null}

              {route.zone === 'today' ? (
                <Today
                  data={data}
                  cryptoKey={cryptoKey}
                  salt={blob?.salt ?? ''}
                  live={live}
                  now={now}
                  onOpen={setEditing}
                />
              ) : route.zone === 'map' ? (
                <MapTab
                  section={route.section}
                  live={live}
                  nodes={live.nodes}
                  now={now}
                  onPatch={handlePatch}
                  onToggle={live.toggleDone}
                  onOpen={setEditing}
                  blob={blob}
                  hasLock={hasLock}
                  onLockChanged={refreshHasLock}
                />
              ) : (
                <>
                  <SectionOverview
                    title={title}
                    nodes={sectionNodes}
                    now={now}
                    onToggle={live.toggleDone}
                    onOpen={setEditing}
                  />
                  {renderSection(route.section, data)}
                </>
              )}
            </div>
          ) : null}
        </main>
      </div>

      {phase === 'unlocked' ? (
        <button type="button" className="fab" onClick={handleAdd} aria-label="Add an item">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}

      {editingNode ? (
        <EditSheet
          key={editingNode.id}
          node={editingNode}
          now={now}
          onSave={handlePatch}
          onRevert={live.revert}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}
