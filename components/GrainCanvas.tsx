'use client';

import { useEffect, useRef } from 'react';

// Direct port of examplenoise/noise.js into a React/Next.js client component.
//
// Key choices (matching the reference implementation):
//  - Dave Hoskins' hash13 (vec3 → float) — eliminates the diagonal stripes that
//    the classic sin(dot()) random gets at large coordinate values.
//  - Time is quantized to 60 fps frames (floor(time * 60)) so the noise
//    updates once per frame and feels like real film grain rather than smooth
//    continuous noise.
//  - Output is monochrome ~[0.225, 0.775], centred on ~0.5.  With overlay,
//    0.5 is invisible; wider spread than the old [0.3,0.7] so grain reads on
//    dark CPPN backgrounds too.

const GL_OPTS: WebGLContextAttributes = {
  antialias: false,
  alpha: true,
  premultipliedAlpha: false,
  stencil: false,
  depth: false,
  failIfMajorPerformanceCaveat: false,
};

const VERT_WG1 = `
precision highp float;
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG_WG1 = `
precision mediump float;
uniform float u_time;

float hash13(vec3 p3) {
  p3  = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float frame = floor(u_time * 60.0);
  float noise = hash13(vec3(gl_FragCoord.xy, frame));
  noise = noise * 0.55 + 0.225;
  gl_FragColor = vec4(vec3(noise), 1.0);
}
`;

const VERT_WG2 = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG_WG2 = `#version 300 es
precision highp float;
uniform float u_time;
out vec4 outColor;

float hash13(vec3 p3) {
  p3  = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float frame = floor(u_time * 60.0);
  float noise = hash13(vec3(gl_FragCoord.xy, frame));
  noise = noise * 0.55 + 0.225;
  outColor = vec4(vec3(noise), 1.0);
}
`;

type GL = WebGLRenderingContext | WebGL2RenderingContext;

function logShaderFail(gl: GL, kind: string, shader: WebGLShader) {
  const msg = gl.getShaderInfoLog(shader)?.trim();
  console.error('[GrainCanvas]', kind, 'shader failed:', msg?.length ? msg : '(empty shader log)');
}

function compile(gl: GL, vertSrc: string, fragSrc: string) {
  function createShader(type: number, source: string): WebGLShader | null {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      logShaderFail(gl, type === gl.VERTEX_SHADER ? 'vertex' : 'fragment', s);
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = createShader(gl.VERTEX_SHADER, vertSrc);
  const fs = createShader(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[GrainCanvas] link failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  return { program, vs, fs };
}

export function GrainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /** Prefer WebGL 2 where available (often more predictable on Chromium + ANGLE). */
    const gl: GL | null =
      (canvas.getContext('webgl2', GL_OPTS) as WebGL2RenderingContext | null) ??
      (canvas.getContext('webgl', GL_OPTS) as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl', GL_OPTS) as WebGLRenderingContext | null);

    if (!gl) return;
    const g = gl;

    const useWg2 = typeof WebGL2RenderingContext !== 'undefined' && g instanceof WebGL2RenderingContext;
    const built = compile(g, useWg2 ? VERT_WG2 : VERT_WG1, useWg2 ? FRAG_WG2 : FRAG_WG1);
    if (!built) return;

    const { program, vs, fs } = built;

    // ── Fullscreen quad (two triangles) ──────────────────────────────────────
    const posLoc = g.getAttribLocation(program, 'a_position');
    const buf = g.createBuffer();
    if (!buf) {
      g.deleteProgram(program);
      g.deleteShader(vs);
      g.deleteShader(fs);
      return;
    }
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(
      g.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      g.STATIC_DRAW,
    );

    const uTime = g.getUniformLocation(program, 'u_time');

    // ── Resize — full device-pixel resolution for fine grain ─────────────────
    function resize() {
      const surface = canvasRef.current;
      if (!surface) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = window.innerWidth * dpr;
      surface.height = window.innerHeight * dpr;
      g.viewport(0, 0, surface.width, surface.height);
    }
    window.addEventListener('resize', resize);
    resize();

    // ── Render loop ──────────────────────────────────────────────────────────
    let raf = 0;
    function render(now: number) {
      g.useProgram(program);
      g.uniform1f(uTime, now * 0.001);
      g.enableVertexAttribArray(posLoc);
      g.bindBuffer(g.ARRAY_BUFFER, buf);
      g.vertexAttribPointer(posLoc, 2, g.FLOAT, false, 0, 0);
      g.drawArrays(g.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      g.deleteBuffer(buf);
      g.deleteProgram(program);
      g.deleteShader(vs);
      g.deleteShader(fs);
      // Intentionally do NOT call WEBGL_lose_context.loseContext() here: in React
      // Strict Mode dev, the effect mounts → unmounts → remounts on the same
      // canvas; a lost GL context permanently poisons further getContext/compiles
      // until navigation (auth hit this reliably; landing depended on timing).
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 6,
        pointerEvents: 'none',
        display: 'block',
        opacity: 0.82,
        mixBlendMode: 'overlay',
      }}
    />
  );
}
