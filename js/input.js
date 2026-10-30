// Touch and mouse: one-finger drag pans (or paints in paint mode), pinch and
// wheel zoom, tap selects. Right/middle drag always pans on desktop.

export function attachInput(canvas, R, handlers) {
  const pts = new Map();
  let drag = null;      // { x, y, sx, sy, moved, paint, pan }
  let pinch = null;     // { d, cx, cy, z, wx, wy }
  let vel = [0, 0], lastMove = 0;

  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  function zoomAt(sx, sy, z, free = false) {
    const [wx, wy] = R.toWorld(sx, sy);
    R.cam.free = free;
    R.cam.z = Math.max(1, Math.min(7, z));
    if (!free) R.cam.z = Math.max(1, Math.round(R.cam.z * R.dpr)) / R.dpr;
    const [ax, ay] = R.toWorld(sx, sy);
    R.cam.x += wx - ax; R.cam.y += wy - ay;
    R.clampCam();
  }

  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    const [x, y] = local(e);
    pts.set(e.pointerId, [x, y]);
    vel = [0, 0];
    if (pts.size === 2) {
      // second finger: cancel any paint and start a pinch
      if (drag && drag.paint) handlers.paintEnd?.();
      const [[x1, y1], [x2, y2]] = [...pts.values()];
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      pinch = { d: Math.hypot(x2 - x1, y2 - y1), cx, cy, z: R.cam.z * (R.cam.free ? 1 : 1) };
      drag = null;
      return;
    }
    if (pts.size > 2) return;
    const pan = e.button === 1 || e.button === 2 || e.shiftKey;
    drag = { x, y, sx: x, sy: y, moved: false, pan, paint: false, t: performance.now() };
  });

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    if (!pts.has(e.pointerId)) { if (e.pointerType === 'mouse') handlers.hover?.(x, y); return; }
    pts.set(e.pointerId, [x, y]);
    if (pinch && pts.size >= 2) {
      const [[x1, y1], [x2, y2]] = [...pts.values()];
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, d = Math.hypot(x2 - x1, y2 - y1);
      const S0 = R.scale;
      R.cam.x -= (cx - pinch.cx) * R.dpr / S0; R.cam.y -= (cy - pinch.cy) * R.dpr / S0;
      zoomAt(cx, cy, pinch.z * (d / pinch.d), true);
      pinch.cx = cx; pinch.cy = cy;
      return;
    }
    if (!drag) return;
    const dx = x - drag.x, dy = y - drag.y;
    if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) > 7) {
      drag.moved = true;
      if (!drag.pan && handlers.isPaint?.()) { drag.paint = true; handlers.paint?.(drag.sx, drag.sy, true); }
    }
    if (!drag.moved) return;
    if (drag.paint) handlers.paint?.(x, y, false);
    else {
      const S = R.scale;
      R.cam.x -= dx * R.dpr / S; R.cam.y -= dy * R.dpr / S;
      R.clampCam();
      const now = performance.now();
      const dtm = Math.max(1, now - lastMove);
      vel = [dx / dtm * 16, dy / dtm * 16];
      lastMove = now;
    }
    drag.x = x; drag.y = y;
    if (e.pointerType === 'mouse') handlers.hover?.(x, y);
  });

  const up = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pinch) {
      if (pts.size < 2) {
        const c = pinch;
        pinch = null;
        zoomAt(c.cx, c.cy, R.cam.z, false);
        drag = null;
      }
      return;
    }
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved && e.type === 'pointerup' && !d.pan) handlers.tap?.(d.sx, d.sy);
    else if (d.paint) handlers.paintEnd?.();
    else if (performance.now() - lastMove > 60) vel = [0, 0];
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [x, y] = local(e);
    if (e.ctrlKey) { zoomAt(x, y, R.cam.z * Math.exp(-e.deltaY * 0.01), false); return; }
    const step = 1 / R.dpr;
    const dir = e.deltaY < 0 ? 1 : -1;
    if (Math.abs(e.deltaY) < 4 && !e.deltaMode) return;
    zoomAt(x, y, R.cam.z + dir * Math.max(step, R.cam.z * 0.18), false);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    const k = e.key;
    const S = R.scale, move = 48 * R.dpr / S * 4;
    if (k === 'Escape') handlers.escape?.();
    else if (k === 'ArrowLeft' || k === 'a') { R.cam.x -= move / R.dpr; R.clampCam(); }
    else if (k === 'ArrowRight' || k === 'd') { R.cam.x += move / R.dpr; R.clampCam(); }
    else if (k === 'ArrowUp' || k === 'w') { R.cam.y -= move / R.dpr; R.clampCam(); }
    else if (k === 'ArrowDown' || k === 's') { R.cam.y += move / R.dpr; R.clampCam(); }
    else if (k === '+' || k === '=') zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, R.cam.z + 1 / R.dpr);
    else if (k === '-' || k === '_') zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, R.cam.z - 1 / R.dpr);
  });

  return {
    // pan inertia, called every frame
    tick() {
      if (drag || pinch) return;
      if (Math.abs(vel[0]) + Math.abs(vel[1]) < 0.05) return;
      const S = R.scale;
      R.cam.x -= vel[0] * R.dpr / S; R.cam.y -= vel[1] * R.dpr / S;
      vel[0] *= 0.9; vel[1] *= 0.9;
      R.clampCam();
    },
    zoomBy(k) { zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, R.cam.z + k / R.dpr); },
  };
}
