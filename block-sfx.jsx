/* global window */
/**
 * 블록 착지·회전 효과음 — Web Audio (외부 파일 없음, PWA/Safari 대응)
 */
(function () {
  let ctx = null;
  let unlocked = false;

  function getCtx() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    return ctx;
  }

  function unlockAudio() {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    unlocked = true;
  }

  function ensureReady() {
    const c = getCtx();
    if (!c) return null;
    if (c.state === "suspended") c.resume().catch(() => {});
    return c;
  }

  /** 착지 — 귀여운 pop / 뿅 (말랑하게 올랐다 내려오는 톤) */
  function playBlockLandSfx() {
    const c = ensureReady();
    if (!c) return;
    const t = c.currentTime;
    const master = c.createGain();
    master.gain.setValueAtTime(0.001, t);
    master.gain.linearRampToValueAtTime(0.36, t + 0.006);
    master.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    master.connect(c.destination);

    const pop = c.createOscillator();
    pop.type = "sine";
    pop.frequency.setValueAtTime(300, t);
    pop.frequency.linearRampToValueAtTime(720, t + 0.03);
    pop.frequency.exponentialRampToValueAtTime(420, t + 0.1);
    pop.frequency.exponentialRampToValueAtTime(280, t + 0.16);
    const popG = c.createGain();
    popG.gain.setValueAtTime(0.9, t);
    pop.connect(popG);
    popG.connect(master);
    pop.start(t);
    pop.stop(t + 0.17);

    const ping = c.createOscillator();
    ping.type = "triangle";
    ping.frequency.setValueAtTime(620, t);
    ping.frequency.exponentialRampToValueAtTime(980, t + 0.018);
    ping.frequency.exponentialRampToValueAtTime(540, t + 0.08);
    const pingG = c.createGain();
    pingG.gain.setValueAtTime(0.14, t);
    pingG.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
    ping.connect(pingG);
    pingG.connect(master);
    ping.start(t);
    ping.stop(t + 0.08);
  }

  /** 회전 — 짧은 상승 톤 */
  function playBlockRotateSfx() {
    const c = ensureReady();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.055);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  if (typeof document !== "undefined") {
    const arm = () => unlockAudio();
    document.addEventListener("pointerdown", arm, { once: true, passive: true });
    document.addEventListener("touchstart", arm, { once: true, passive: true });
    document.addEventListener("keydown", arm, { once: true });
  }

  Object.assign(window, { playBlockLandSfx, playBlockRotateSfx, unlockBlockSfx: unlockAudio });
})();
