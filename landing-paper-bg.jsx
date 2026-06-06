/* global React, THREE */
/**
 * 랜딩 히어로 셰이더 — mesh 글로우 + 골드 링 파동 + dot orbit (vanilla THREE)
 */
(function () {
  const { useRef, useEffect } = React;

  const VERTEX_SHADER = `
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      pos.y += sin(pos.x * 10.0 + time) * 0.1 * intensity;
      pos.x += cos(pos.y * 8.0 + time * 1.5) * 0.05 * intensity;
      pos.z += sin(pos.x * 8.0 + time * 1.2) * 0.05 * intensity;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    uniform float time;
    uniform float intensity;
    uniform vec3 color1;
    uniform vec3 color2;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float dist = length(c);
      float noise = sin(uv.x * 20.0 + time) * cos(uv.y * 15.0 + time * 0.8);
      noise += sin(uv.x * 35.0 - time * 2.0) * cos(uv.y * 25.0 + time * 1.2) * 0.5;
      vec3 color = mix(color1, color2, noise * 0.5 + 0.5);
      color = mix(color, vec3(1.0, 0.92, 0.55), pow(abs(noise), 1.4) * intensity * 0.45);
      float centerGlow = pow(max(1.0 - dist * 1.85, 0.0), 1.35);
      float pulse = 0.7 + 0.3 * sin(time * 2.5 - dist * 7.0);
      float glow = centerGlow * pulse;
      gl_FragColor = vec4(color * glow * 1.15, glow * 0.88);
    }
  `;

  function LandingPaperBackground({
    variant = "combined",
    color1 = "#0b1130",
    color2 = "#ffe899",
    centerY = 0.5,
    heroMode = false,
  }) {
    const meshRef = useRef(null);
    const showMesh = variant === "mesh" || variant === "combined";
    const showDots = variant === "dots" || variant === "combined";
    const showSparkle = variant === "sparkle" || variant === "combined";

    useEffect(() => {
      if (!showMesh || !meshRef.current || typeof THREE === "undefined") return undefined;
      const wrap = meshRef.current;
      const w = wrap.clientWidth || 320;
      const h = wrap.clientHeight || 400;

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.setClearColor(0x000000, 0);
      wrap.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(heroMode ? 48 : 42, w / h, 0.1, 30);
      camera.position.set(0, 0, heroMode ? 2.35 : 2.85);

      const uniforms = {
        time: { value: 0 },
        intensity: { value: heroMode ? 1.65 : 1.2 },
        color1: { value: new THREE.Color(color1) },
        color2: { value: new THREE.Color(color2) },
      };

      const planeMat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const planeSize = heroMode ? 3.4 : 2.8;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(planeSize, planeSize, 48, 48),
        planeMat
      );
      scene.add(plane);

      const ringSpecs = [
        { inner: 0.28, outer: 0.4, color: "#ffd059", speed: 1.1 },
        { inner: 0.44, outer: 0.56, color: "#ffe899", speed: 1.35 },
        { inner: 0.6, outer: 0.72, color: "#ffb347", speed: 0.95 },
        { inner: 0.76, outer: 0.88, color: "#ffd059", speed: 0.7 },
      ];
      const rings = ringSpecs.map((spec, i) => {
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(spec.color),
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(
          new THREE.RingGeometry(spec.inner, spec.outer, 80),
          mat
        );
        mesh.userData = { phase: i * 1.2, speed: spec.speed };
        scene.add(mesh);
        return { mesh, mat, spec };
      });

      const clock = new THREE.Clock();
      let raf = 0;
      let running = true;

      const resize = () => {
        const nw = wrap.clientWidth || w;
        const nh = wrap.clientHeight || h;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      ro?.observe(wrap);

      const tick = () => {
        if (!running) return;
        const t = clock.getElapsedTime();
        uniforms.time.value = t;
        uniforms.intensity.value = (heroMode ? 1.55 : 1.15) + Math.sin(t * 2.2) * 0.42;
        plane.rotation.z = Math.sin(t * 0.15) * 0.06;

        rings.forEach(({ mesh, mat, spec }, i) => {
          const phase = mesh.userData.phase ?? i * 1.2;
          const wave = Math.sin(t * spec.speed - phase);
          const pulse = 1 + wave * 0.2;
          mesh.scale.set(pulse, pulse, 1);
          mesh.rotation.z = t * 0.55 + i * 0.25;
          mat.opacity = (heroMode ? 0.35 : 0.22) + (0.38 + wave * 0.22) * (1 - i * 0.08);
        });

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      return () => {
        running = false;
        cancelAnimationFrame(raf);
        ro?.disconnect();
        planeMat.dispose();
        plane.geometry.dispose();
        rings.forEach(({ mesh, mat }) => {
          mat.dispose();
          mesh.geometry.dispose();
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === wrap) wrap.removeChild(renderer.domElement);
      };
    }, [color1, color2, showMesh, heroMode]);

    return (
      <div className={`landing-paper-wrap landing-paper-wrap--${variant}${heroMode ? " is-hero" : ""}`} aria-hidden="true">
        {showMesh && <div className="landing-paper-mesh landing-paper-mesh--hero" ref={meshRef} />}
        {showDots && (
          <DotOrbitLayer
            centerY={centerY}
            heroMode={heroMode}
            className={variant === "combined" ? "is-overlay" : "is-full"}
          />
        )}
        {showSparkle && <SparkleLayer heroMode={heroMode} />}
        {variant === "dots" && <div className="landing-paper-dots-bg" />}
      </div>
    );
  }

  function DotOrbitLayer({ centerY = 0.5, heroMode = false, className = "" }) {
    const ref = useRef(null);
    useEffect(() => {
      const canvas = ref.current;
      if (!canvas) return undefined;
      const ctx = canvas.getContext("2d");
      let raf = 0;
      let t = 0;

      const resize = () => {
        const parent = canvas.parentElement;
        const pw = parent?.clientWidth || 320;
        const ph = parent?.clientHeight || 400;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = pw * dpr;
        canvas.height = ph * dpr;
        canvas.style.width = `${pw}px`;
        canvas.style.height = `${ph}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      ro?.observe(canvas.parentElement);

      const ringCount = heroMode ? 6 : 4;

      const draw = () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        const cx = w * 0.5;
        const cy = h * centerY;
        const baseR = Math.min(w, h) * (heroMode ? 0.38 : 0.22);

        for (let ring = 0; ring < ringCount; ring++) {
          const phase = t * (heroMode ? 1.45 : 1.1) - ring * 0.48;
          const expand = (phase % 2.0) / 2.0;
          const r = baseR * (0.35 + expand * 1.05);
          const alpha = (1 - expand) * (heroMode ? 0.58 : 0.35);
          if (alpha <= 0.02) continue;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 208, 89, ${alpha})`;
          ctx.lineWidth = heroMode ? 2.8 - ring * 0.25 : 2 - ring * 0.2;
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 232, 153, ${alpha * 0.45})`;
          ctx.lineWidth = 1;
          ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
          ctx.stroke();
        }

        t += heroMode ? 0.022 : 0.016;
        raf = requestAnimationFrame(draw);
      };
      draw();

      return () => {
        cancelAnimationFrame(raf);
        ro?.disconnect();
      };
    }, [centerY, heroMode]);

    return <canvas ref={ref} className={`landing-paper-dots ${className}`.trim()} aria-hidden="true" />;
  }

  function SparkleLayer({ heroMode = false }) {
    const ref = useRef(null);
    useEffect(() => {
      const canvas = ref.current;
      if (!canvas) return undefined;
      const ctx = canvas.getContext("2d");
      const count = heroMode ? 48 : 24;
      const particles = Array.from({ length: count }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 0.5 + Math.random() * (heroMode ? 2.2 : 1.2),
        sp: 0.2 + Math.random() * 0.8,
        ph: Math.random() * Math.PI * 2,
      }));
      let raf = 0;
      let t = 0;

      const resize = () => {
        const parent = canvas.parentElement;
        const pw = parent?.clientWidth || 320;
        const ph = parent?.clientHeight || 400;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = pw * dpr;
        canvas.height = ph * dpr;
        canvas.style.width = `${pw}px`;
        canvas.style.height = `${ph}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      ro?.observe(canvas.parentElement);

      const draw = () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        particles.forEach((p) => {
          const a = 0.25 + Math.sin(t * p.sp + p.ph) * 0.35;
          const px = p.x * w + Math.sin(t * 0.4 + p.ph) * 8;
          const py = p.y * h + Math.cos(t * 0.35 + p.ph) * 6;
          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 232, 153, ${a})`;
          ctx.arc(px, py, p.r, 0, Math.PI * 2);
          ctx.fill();
        });
        t += 0.016;
        raf = requestAnimationFrame(draw);
      };
      draw();

      return () => {
        cancelAnimationFrame(raf);
        ro?.disconnect();
      };
    }, [heroMode]);

    return <canvas ref={ref} className="landing-paper-sparkle" aria-hidden="true" />;
  }

  Object.assign(window, { LandingPaperBackground });
})();
