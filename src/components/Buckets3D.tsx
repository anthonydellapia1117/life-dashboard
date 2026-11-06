import { useEffect, useRef, useState } from 'react';
import { BUCKETS, type BucketId } from '../lib/bucket';

/**
 * Six glass buckets in a row (three.js, loaded on demand so no other tab pays
 * for it). Liquid height is value / max. Hover lifts a bucket to 1.08 and
 * shows its label; drag spins the row; a click (not a drag) sets the global
 * filter through onSelect. Calls onUnavailable when WebGL cannot start, so
 * the caller can fall back to tiles.
 */
export interface Buckets3DProps {
  values: Record<BucketId, number>;
  unit: string;
  selected: BucketId | null;
  onSelect: (id: BucketId) => void;
  onUnavailable: () => void;
}

const SPACING = 2.05;
const WALL_H = 1.6;
const R_TOP = 0.78;
const R_BOTTOM = 0.66;

function cssColor(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || '#8e8e93';
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Buckets3D({ values, unit, selected, onSelect, onUnavailable }: Buckets3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const capRefs = useRef<Array<HTMLDivElement | null>>([]);
  const stateRef = useRef({ values, selected, onSelect });
  stateRef.current = { values, selected, onSelect };
  const [hovered, setHovered] = useState<BucketId | null>(null);
  const hoveredRef = useRef<BucketId | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!webglAvailable()) {
      onUnavailable();
      return;
    }
    let disposed = false;
    let cleanup = () => {};

    import('three')
      .then((THREE) => {
        if (disposed) return;
        let renderer: InstanceType<typeof THREE.WebGLRenderer>;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch {
          onUnavailable();
          return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.className = 'b3d-canvas';
        host.prepend(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x888899, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.4);
        key.position.set(3, 6, 5);
        scene.add(key);

        const row = new THREE.Group();
        scene.add(row);

        // Soft shadow: one radial-gradient texture shared by all six discs.
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = shadowCanvas.height = 128;
        const sctx = shadowCanvas.getContext('2d');
        if (sctx) {
          const g = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
          g.addColorStop(0, 'rgba(0,0,0,0.32)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          sctx.fillStyle = g;
          sctx.fillRect(0, 0, 128, 128);
        }
        const shadowTex = new THREE.CanvasTexture(shadowCanvas);

        const wallGeo = new THREE.CylinderGeometry(R_TOP, R_BOTTOM, WALL_H, 64, 1, true);
        const baseGeo = new THREE.CircleGeometry(R_BOTTOM, 64);
        const rimGeo = new THREE.TorusGeometry(R_TOP, 0.035, 12, 96);
        const liquidGeo = new THREE.CylinderGeometry(R_TOP - 0.06, R_BOTTOM - 0.05, 1, 64);
        liquidGeo.translate(0, 0.5, 0); // grow from the floor up
        const shadowGeo = new THREE.PlaneGeometry(2.4, 2.4);

        interface Unit {
          id: BucketId;
          group: InstanceType<typeof THREE.Group>;
          liquid: InstanceType<typeof THREE.Mesh>;
          mats: Array<InstanceType<typeof THREE.MeshPhysicalMaterial>>;
          baseOpacity: number[];
          fill: number;
          scale: number;
          fade: number;
        }
        const units: Unit[] = BUCKETS.map((b, i) => {
          const color = new THREE.Color(cssColor(b.token));
          const wallMat = new THREE.MeshPhysicalMaterial({
            color, transparent: true, opacity: 0.28, roughness: 0.15, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
          });
          const baseMat = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.35, roughness: 0.3, side: THREE.DoubleSide });
          const rimMat = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.95, roughness: 0.25 });
          const liquidMat = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.9, roughness: 0.35 });
          const group = new THREE.Group();
          group.position.x = (i - 2.5) * SPACING;
          group.userData.bucket = b.id;
          const wall = new THREE.Mesh(wallGeo, wallMat);
          wall.position.y = WALL_H / 2;
          const base = new THREE.Mesh(baseGeo, baseMat);
          base.rotation.x = -Math.PI / 2;
          base.position.y = 0.002;
          const rim = new THREE.Mesh(rimGeo, rimMat);
          rim.rotation.x = Math.PI / 2;
          rim.position.y = WALL_H;
          const liquid = new THREE.Mesh(liquidGeo, liquidMat);
          liquid.position.y = 0.01;
          liquid.scale.y = 0.001;
          const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
          shadow.rotation.x = -Math.PI / 2;
          shadow.position.y = -0.01;
          group.add(shadow, base, liquid, wall, rim);
          row.add(group);
          const mats = [wallMat, baseMat, rimMat, liquidMat];
          return { id: b.id, group, liquid, mats, baseOpacity: mats.map((m) => m.opacity), fill: 0, scale: 1, fade: 1 };
        });

        // Bucket colours from the tokens, re-read when the theme changes.
        const ownColors = BUCKETS.map((b) => new THREE.Color(cssColor(b.token)));
        function recolor() {
          BUCKETS.forEach((b, i) => ownColors[i].set(cssColor(b.token)));
        }
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', recolor);
        const themeObserver = new MutationObserver(recolor);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        function resize() {
          const w = host!.clientWidth || 600;
          const h = host!.clientHeight || 260;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          const extent = SPACING * 6 + 0.4;
          const halfFov = (camera.fov * Math.PI) / 360;
          const dist = Math.max(extent / 2 / (Math.tan(halfFov) * camera.aspect), 6.5) * 1.02;
          camera.position.set(0, dist * 0.42, dist);
          camera.lookAt(0, 0.75, 0);
          camera.updateProjectionMatrix();
        }
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        resize();

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let dragging = false;
        let dragStartX = 0;
        let dragMoved = 0;
        let spin = 0;
        let spinTarget = 0;

        function pick(ev: PointerEvent): BucketId | null {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(row.children, true)[0];
          let o = hit?.object as { parent?: unknown; userData?: { bucket?: BucketId } } | undefined;
          while (o && !o.userData?.bucket) o = o.parent as typeof o;
          return o?.userData?.bucket ?? null;
        }
        function setHover(id: BucketId | null) {
          if (hoveredRef.current === id) return;
          hoveredRef.current = id;
          setHovered(id);
          renderer.domElement.style.cursor = id ? 'pointer' : dragging ? 'grabbing' : 'grab';
        }
        const el = renderer.domElement;
        const onDown = (ev: PointerEvent) => {
          dragging = true;
          dragStartX = ev.clientX;
          dragMoved = 0;
          el.setPointerCapture(ev.pointerId);
        };
        const onMove = (ev: PointerEvent) => {
          if (dragging) {
            const dx = ev.clientX - dragStartX;
            dragMoved = Math.max(dragMoved, Math.abs(dx));
            spinTarget = Math.max(-0.7, Math.min(0.7, spinTarget + dx * 0.006));
            dragStartX = ev.clientX;
          }
          if (ev.pointerType !== 'touch') setHover(pick(ev));
        };
        const onUp = (ev: PointerEvent) => {
          const wasClick = dragging && dragMoved < 6;
          dragging = false;
          if (wasClick) {
            const id = pick(ev);
            if (id) stateRef.current.onSelect(id);
          }
        };
        const onLeave = () => setHover(null);
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointerleave', onLeave);

        const v3 = new THREE.Vector3();
        const gray = new THREE.Color('#8e8e93');
        let raf = 0;
        let running = true;
        const clock = new THREE.Clock();
        function frame() {
          if (!running) return;
          const t = clock.getElapsedTime();
          const { values: vals, selected: sel } = stateRef.current;
          const max = Math.max(1, ...BUCKETS.map((b) => vals[b.id] ?? 0));
          if (!dragging && !reduce.matches) spinTarget *= 0.985;
          spin += (spinTarget - spin) * 0.12;
          row.rotation.y = spin;
          const w = host!.clientWidth;
          const h = host!.clientHeight;
          units.forEach((u, i) => {
            const target = Math.max(0.02, (vals[u.id] ?? 0) / max) * (WALL_H - 0.08);
            u.fill += (target - u.fill) * (reduce.matches ? 1 : 0.08);
            u.liquid.scale.y = Math.max(0.001, u.fill);
            const hover = hoveredRef.current === u.id;
            u.scale += ((hover ? 1.08 : 1) - u.scale) * 0.18;
            u.group.scale.setScalar(u.scale);
            u.group.rotation.z = reduce.matches ? 0 : Math.sin(t * 0.6 + i * 1.1) * 0.025;
            u.group.rotation.x = reduce.matches ? 0 : Math.cos(t * 0.5 + i) * 0.015;
            const dimTarget = sel !== null && sel !== u.id ? 0.15 : 1;
            u.fade += (dimTarget - u.fade) * 0.2;
            u.mats.forEach((m, k) => {
              m.opacity = u.baseOpacity[k] * u.fade;
              m.color.copy(ownColors[i]).lerp(gray, 1 - u.fade);
            });
            // Project the rim centre and the floor to place the labels.
            u.group.getWorldPosition(v3);
            v3.y += WALL_H * u.scale + 0.25;
            v3.project(camera);
            const label = labelRefs.current[i];
            if (label) label.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, -100%)`;
            u.group.getWorldPosition(v3);
            v3.y -= 0.25;
            v3.project(camera);
            const cap = capRefs.current[i];
            if (cap) {
              cap.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, 0)`;
              cap.style.opacity = String(Math.max(0.2, u.fade));
            }
          });
          renderer.render(scene, camera);
          raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);
        const onVis = () => {
          running = !document.hidden;
          if (running) raf = requestAnimationFrame(frame);
        };
        document.addEventListener('visibilitychange', onVis);

        cleanup = () => {
          running = false;
          cancelAnimationFrame(raf);
          document.removeEventListener('visibilitychange', onVis);
          mq.removeEventListener('change', recolor);
          themeObserver.disconnect();
          ro.disconnect();
          el.removeEventListener('pointerdown', onDown);
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointerleave', onLeave);
          scene.traverse((o) => {
            const m = o as { geometry?: { dispose(): void }; material?: { dispose(): void } };
            m.material?.dispose();
          });
          [wallGeo, baseGeo, rimGeo, liquidGeo, shadowGeo].forEach((g) => g.dispose());
          shadowTex.dispose();
          renderer.dispose();
          el.remove();
        };
      })
      .catch(() => {
        if (!disposed) onUnavailable();
      });

    return () => {
      disposed = true;
      cleanup();
    };
    // Built once; values and selection are read live from stateRef each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="b3d" ref={hostRef}>
      {BUCKETS.map((b, i) => (
        <div
          key={`l${b.id}`}
          ref={(n) => {
            labelRefs.current[i] = n;
          }}
          className={`b3d-label ${b.className}${hovered === b.id ? ' is-shown' : ''}`}
          aria-hidden="true"
        >
          <span className="b3d-label-num">{b.id}</span>
          <span className="b3d-label-name">{b.name}</span>
          <span className="b3d-label-val">
            {values[b.id] ?? 0} {unit}
          </span>
        </div>
      ))}
      {BUCKETS.map((b, i) => (
        <div
          key={`c${b.id}`}
          ref={(n) => {
            capRefs.current[i] = n;
          }}
          className="b3d-cap"
          aria-hidden="true"
        >
          <span className="b3d-cap-num">{b.id}</span> {values[b.id] ?? 0}
        </div>
      ))}
    </div>
  );
}
