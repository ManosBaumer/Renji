'use client';

import { useEffect, useRef, useState } from 'react';

const MIN_THUMB = 32;

function getScrollRoot(): HTMLElement {
  const el = document.scrollingElement;
  if (el && el instanceof HTMLElement) return el;
  return document.documentElement;
}

/** No layout reads — `maxScroll` must be precomputed (avoids forced reflow every pointermove). */
function applyScrollTop(top: number, maxScroll: number) {
  const t = Math.max(0, Math.min(maxScroll, top));
  getScrollRoot().scrollTop = t;
}

function withInstantDocumentScroll(run: () => void) {
  const html = document.documentElement;
  const prev = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  run();
  requestAnimationFrame(() => {
    html.style.scrollBehavior = prev;
  });
}

type DragLayout = {
  maxScroll: number;
  thumbTravel: number;
  thumbH: number;
};

export function DocumentScrollbar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startY: number;
    startScroll: number;
    pointerId: number;
    layout: DragLayout;
    savedHtmlScrollBehavior: string;
  } | null>(null);
  const finePointerRef = useRef(false);

  const [finePointer, setFinePointer] = useState(false);

  const [state, setState] = useState({
    show: false,
    thumbH: MIN_THUMB,
    thumbTop: 0,
  });

  useEffect(() => {
    function applyThumbLayout(thumbH: number, thumbTop: number) {
      const el = thumbRef.current;
      if (!el) return;
      el.style.height = `${thumbH}px`;
      el.style.transform = `translate3d(0, ${Math.round(thumbTop)}px, 0)`;
    }

    function measure() {
      if (!finePointerRef.current) return;
      if (dragRef.current) return;

      const track = trackRef.current;
      const root = getScrollRoot();
      const sh = root.scrollHeight;
      const ch = root.clientHeight;
      const st = root.scrollTop;

      if (!track || sh <= ch + 2) {
        setState((s) =>
          s.show ? { show: false, thumbH: MIN_THUMB, thumbTop: 0 } : s,
        );
        return;
      }

      const trackH = track.clientHeight;
      const ratio = ch / sh;
      const thumbH = Math.max(MIN_THUMB, ratio * trackH);
      const maxScroll = sh - ch;
      const scrollRatio = maxScroll <= 0 ? 0 : st / maxScroll;
      const thumbTravel = Math.max(0, trackH - thumbH);
      const thumbTop = scrollRatio * thumbTravel;

      setState({ show: true, thumbH, thumbTop });
      applyThumbLayout(thumbH, thumbTop);
    }

    function snapshotDragLayout(): DragLayout | null {
      const track = trackRef.current;
      const root = getScrollRoot();
      if (!track) return null;
      const sh = root.scrollHeight;
      const ch = root.clientHeight;
      const maxScroll = Math.max(0, sh - ch);
      const trackH = track.clientHeight;
      const ratio = ch / sh;
      const thumbH = Math.max(MIN_THUMB, ratio * trackH);
      const thumbTravel = Math.max(0, trackH - thumbH);
      if (thumbTravel <= 0) return null;
      return { maxScroll, thumbTravel, thumbH };
    }

    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const applyMq = () => {
      const v = mq.matches;
      finePointerRef.current = v;
      setFinePointer(v);
      requestAnimationFrame(measure);
    };
    applyMq();
    mq.addEventListener('change', applyMq);

    let scrollRaf = 0;
    const onScroll = () => {
      if (dragRef.current) return;
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        measure();
      });
    };

    const onResize = () => {
      const d = dragRef.current;
      if (d) {
        const L = snapshotDragLayout();
        if (L) {
          d.layout = L;
          const st = getScrollRoot().scrollTop;
          const { maxScroll, thumbTravel, thumbH } = L;
          const scrollRatio = maxScroll <= 0 ? 0 : st / maxScroll;
          applyThumbLayout(thumbH, scrollRatio * thumbTravel);
        }
      }
      measure();
    };

    const onMove = (e: PointerEvent) => {
      if (!finePointerRef.current || !dragRef.current) return;
      const d = dragRef.current;
      const { maxScroll, thumbTravel, thumbH } = d.layout;
      const dy = e.clientY - d.startY;
      let next = d.startScroll + (dy / thumbTravel) * maxScroll;
      next = Math.max(0, Math.min(maxScroll, next));
      applyScrollTop(next, maxScroll);
      const scrollRatio = maxScroll <= 0 ? 0 : next / maxScroll;
      applyThumbLayout(thumbH, scrollRatio * thumbTravel);
    };

    const endDrag = () => {
      const d = dragRef.current;
      dragRef.current = null;

      if (d) {
        document.documentElement.style.scrollBehavior = d.savedHtmlScrollBehavior;
        if (thumbRef.current) {
          try {
            thumbRef.current.releasePointerCapture(d.pointerId);
          } catch {
            /* already released */
          }
        }
      }
      measure();
    };

    const ro = new ResizeObserver(() => {
      if (dragRef.current) return;
      measure();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
    const track = trackRef.current;
    if (track) ro.observe(track);

    measure();

    return () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      mq.removeEventListener('change', applyMq);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      ro.disconnect();
    };
  }, []);

  const hidden = !finePointer;

  return (
    <div
      className="r-doc-scrollbar"
      aria-hidden
      style={{
        display: hidden ? 'none' : undefined,
        opacity: state.show ? 1 : 0,
      }}
    >
      <div
        ref={trackRef}
        className="r-doc-scrollbar__track"
        style={{ pointerEvents: state.show ? 'auto' : 'none' }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (e.target !== e.currentTarget) return;
          const track = trackRef.current;
          if (!track) return;
          const rect = track.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const root = getScrollRoot();
          const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
          const t = Math.max(0, Math.min(1, y / rect.height));
          withInstantDocumentScroll(() => applyScrollTop(t * maxScroll, maxScroll));
        }}
      >
        <div
          ref={thumbRef}
          className="r-doc-scrollbar__thumb"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const html = document.documentElement;
            const layout = (() => {
              const track = trackRef.current;
              const root = getScrollRoot();
              if (!track) return null;
              const sh = root.scrollHeight;
              const ch = root.clientHeight;
              const maxScroll = Math.max(0, sh - ch);
              const trackH = track.clientHeight;
              const ratio = ch / sh;
              const thumbH = Math.max(MIN_THUMB, ratio * trackH);
              const thumbTravel = Math.max(0, trackH - thumbH);
              if (thumbTravel <= 0) return null;
              return { maxScroll, thumbTravel, thumbH };
            })();
            if (!layout) return;

            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = {
              startY: e.clientY,
              startScroll: getScrollRoot().scrollTop,
              pointerId: e.pointerId,
              layout,
              savedHtmlScrollBehavior: html.style.scrollBehavior,
            };
            html.style.scrollBehavior = 'auto';
          }}
        />
      </div>
    </div>
  );
}
