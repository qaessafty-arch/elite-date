'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const vertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec3 p = position;
    float hang = 1.0 - uv.y;            // pinned along the top edge
    p.z += sin(p.x * 2.4 + uTime * 0.9) * 0.10 * hang;
    p.z += sin(p.x * 5.1 - uTime * 0.6 + p.y * 1.7) * 0.035 * hang;
    p.x += sin(p.y * 2.0 + uTime * 0.5) * 0.02 * hang;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uWeave;
  varying vec2 vUv;
  varying vec3 vView;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
    if (!gl_FrontFacing) n = -n;
    vec3 light = normalize(vec3(-0.5, 0.7, 0.8));
    float diffuse = clamp(dot(n, light), 0.0, 1.0);

    vec3 base = uColor;
    float tex = 0.0;
    if (uWeave < 0.5) {
      // melton: fulled, felt-like surface
      tex = (noise(vUv * 220.0) - 0.5) * 0.16 + (noise(vUv * 60.0) - 0.5) * 0.08;
    } else if (uWeave < 1.5) {
      // twill: steep diagonal rib
      float rib = sin((vUv.x * 1.0 + vUv.y * 1.9) * 260.0);
      tex = rib * 0.085 + (noise(vUv * 300.0) - 0.5) * 0.05;
    } else {
      // denim: indigo warp over a pale weft
      float rib = sin((vUv.x + vUv.y * 1.6) * 300.0);
      float weft = smoothstep(0.55, 1.0, rib) * (0.4 + 0.6 * noise(vUv * vec2(40.0, 400.0)));
      base = mix(base, vec3(0.78, 0.80, 0.84), weft * 0.42);
      tex = rib * 0.05 + (noise(vUv * vec2(30.0, 500.0)) - 0.5) * 0.10;
    }

    vec3 col = base * (0.42 + 0.78 * diffuse) + tex;
    float rim = pow(1.0 - clamp(dot(n, normalize(-vView)), 0.0, 1.0), 3.0);
    col += rim * 0.06;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Cloth({ color, weave, animate }: { color: string; weave: number; animate: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const target = useRef({ x: 0, y: -0.35 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const { gl, invalidate } = useThree();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uWeave: { value: weave } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.uniforms.uColor.value.set(color);
    material.uniforms.uWeave.value = weave;
    invalidate();
  }, [color, weave, material, invalidate]);

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      target.current.y = THREE.MathUtils.clamp(target.current.y + (e.clientX - drag.current.x) * 0.008, -1.1, 1.1);
      target.current.x = THREE.MathUtils.clamp(target.current.x + (e.clientY - drag.current.y) * 0.004, -0.35, 0.35);
      drag.current = { x: e.clientX, y: e.clientY };
      invalidate();
    };
    const up = () => (drag.current = null);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [gl, invalidate]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    if (animate) material.uniforms.uTime.value += Math.min(delta, 0.05);
    mesh.current.rotation.y += (target.current.y - mesh.current.rotation.y) * 0.12;
    mesh.current.rotation.x += (target.current.x - mesh.current.rotation.x) * 0.12;
  });

  return (
    <mesh ref={mesh} material={material} rotation={[0, -0.35, 0]}>
      <planeGeometry args={[2.5, 2.9, 72, 72]} />
    </mesh>
  );
}

export default function ClothCanvas({ color, weave, label }: { color: string; weave: number; label: string }) {
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const el = wrap.current;
    if (!el) return;
    // Stop rendering when the swatch is off screen.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing" role="img" aria-label={label}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 4.6], fov: 38 }}
        frameloop={visible && !reduced ? 'always' : 'demand'}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      >
        <Cloth color={color} weave={weave} animate={!reduced} />
      </Canvas>
    </div>
  );
}
