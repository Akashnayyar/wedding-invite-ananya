const intro = document.getElementById("intro");
const page = document.getElementById("page");
const video = document.getElementById("envelope-video");
const loopVideo = document.getElementById("loop-video");
const bgm = document.getElementById("bgm");
const weddingSong = document.getElementById("wedding-song");
const welcome = document.getElementById("welcome");
const scrollHint = document.getElementById("scroll-hint");
const showerCanvas = document.getElementById("shower");

const TOTAL_CARDS = document.querySelectorAll(".scratch-card__foil").length;
let revealedCount = 0;
let celebrating = false;

let started = false;
let unlocked = false;

function showFirstFrame() {
  if (video.readyState >= 2) {
    video.currentTime = 0.01;
  }
}

function revealWelcomeOnScroll() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          welcome.classList.add("is-visible");
          observer.disconnect();
        }
      });
    },
    { threshold: 0.25 }
  );

  observer.observe(welcome);
}

function hideScrollHint() {
  scrollHint.classList.remove("is-visible");
  scrollHint.classList.add("is-gone");
}

function settleNudge(nudge) {
  page.style.transition = "none";
  page.style.transform = "";
  document.body.classList.remove("locked");
  window.scrollTo(0, nudge);
  revealWelcomeOnScroll();

  window.addEventListener("scroll", hideScrollHint, { once: true, passive: true });
  window.addEventListener("touchmove", hideScrollHint, { once: true, passive: true });
}

function unlockPage() {
  if (unlocked) return;
  unlocked = true;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nudge = Math.round(window.innerHeight * 0.11);

  if (reducedMotion) {
    scrollHint.classList.add("is-visible");
    settleNudge(0);
    return;
  }

  welcome.classList.add("is-visible");

  requestAnimationFrame(() => {
    page.style.transition = "transform 1.45s cubic-bezier(0.16, 1, 0.3, 1)";
    page.style.transform = `translateY(-${nudge}px)`;
    scrollHint.classList.add("is-visible");
  });

  window.setTimeout(() => {
    settleNudge(nudge);
  }, 1500);
}

async function startBgm() {
  if (!bgm) return;

  bgm.muted = false;
  bgm.volume = 0.72;

  try {
    await bgm.play();
  } catch {
    window.setTimeout(() => {
      bgm.play().catch(() => {});
    }, 0);
  }
}

function keepBgmPlaying() {
  if (!started || !bgm || !bgm.paused) return;
  if (document.body.classList.contains("theme-festive") || document.documentElement.classList.contains("theme-festive")) return;
  if (weddingSong && !weddingSong.paused) return;
  bgm.play().catch(() => {});
}

async function startLoopVideo() {
  intro.classList.add("is-looping");

  if (loopVideo) {
    loopVideo.muted = true;
    loopVideo.loop = true;
    try {
      await loopVideo.play();
    } catch {
      loopVideo.play().catch(() => {});
    }
  }

  keepBgmPlaying();
  unlockPage();
}

async function openEnvelope() {
  if (started) return;
  started = true;

  await startBgm();

  video.muted = true;
  try {
    await video.play();
  } catch {
    startLoopVideo();
  }

  keepBgmPlaying();
}

video.addEventListener("loadeddata", showFirstFrame);
video.addEventListener("playing", keepBgmPlaying);
video.addEventListener("ended", startLoopVideo);
if (loopVideo) {
  loopVideo.addEventListener("playing", keepBgmPlaying);
}

intro.addEventListener("pointerup", openEnvelope);

function paintFoil(ctx, width, height) {
  const wash = ctx.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, "#e6cbc5");
  wash.addColorStop(0.4, "#f7efe5");
  wash.addColorStop(0.75, "#d9b5b0");
  wash.addColorStop(1, "#c9a8a4");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 90; i += 1) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(11, 23, 43, 0.42)";
  ctx.font = `600 ${Math.max(9, width * 0.14)}px "Cormorant Garamond", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SCRATCH", width / 2, height / 2);
}

function clearedRatio(ctx, canvas) {
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let cleared = 0;
  const step = 16;

  for (let i = 3; i < data.length; i += step) {
    if (data[i] < 20) cleared += 1;
  }

  return cleared / (data.length / step);
}

function setupScratch(canvas) {
  const box = canvas.parentElement;
  let ctx = canvas.getContext("2d", { willReadFrequently: true });
  let scratching = false;
  let last = null;
  let revealed = false;
  let cssWidth = 0;
  let cssHeight = 0;

  function resize() {
    if (revealed) return;

    const rect = box.getBoundingClientRect();
    if (Math.abs(rect.width - cssWidth) < 0.5 && Math.abs(rect.height - cssHeight) < 0.5) {
      return;
    }

    cssWidth = rect.width;
    cssHeight = rect.height;
    if (cssWidth < 2 || cssHeight < 2) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFoil(ctx, cssWidth, cssHeight);
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    canvas.classList.add("is-revealed");
    onCardRevealed();
  }

  function scratchTo(next) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(26, cssWidth * 0.28);
    ctx.beginPath();

    if (last) {
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(next.x, next.y);
    } else {
      ctx.moveTo(next.x - 0.01, next.y);
      ctx.lineTo(next.x, next.y);
    }

    ctx.stroke();
    last = next;

    if (clearedRatio(ctx, canvas) > 0.42) reveal();
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (revealed) return;
    scratching = true;
    last = null;
    canvas.setPointerCapture(event.pointerId);
    scratchTo(point(event));
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!scratching || revealed) return;
    scratchTo(point(event));
    event.preventDefault();
  });

  const stop = () => {
    scratching = false;
    last = null;
  };

  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("pointerleave", stop);

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(box);
}

function startSilverShower() {
  if (celebrating) return;
  celebrating = true;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ctx = showerCanvas.getContext("2d");
  const width = window.innerWidth;
  const height = window.innerHeight;

  showerCanvas.width = Math.round(width * dpr);
  showerCanvas.height = Math.round(height * dpr);
  showerCanvas.style.width = `${width}px`;
  showerCanvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  showerCanvas.classList.add("is-on");

  const silvers = ["#f7efe5", "#fff9f1", "#d8bd7a", "#c6a15b", "#e6cbc5", "#d9b5b0"];
  const count = reducedMotion ? 40 : 160;
  const particles = [];

  function spawn(burst) {
    particles.push({
      x: Math.random() * width,
      y: burst ? -20 - Math.random() * 80 : -12,
      w: 3 + Math.random() * (burst ? 7 : 5),
      h: 8 + Math.random() * (burst ? 16 : 12),
      vx: (Math.random() - 0.5) * 1.6,
      vy: 1.8 + Math.random() * 3.4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.14,
      alpha: 0.65 + Math.random() * 0.35,
      color: silvers[Math.floor(Math.random() * silvers.length)],
      spark: Math.random() > 0.72,
    });
  }

  for (let i = 0; i < count; i += 1) spawn(true);

  const startedAt = performance.now();
  const spawnUntil = 2200;
  const endAt = 5200;
  let lastSpawn = 0;

  function frame(now) {
    const elapsed = now - startedAt;
    ctx.clearRect(0, 0, width, height);

    if (elapsed < spawnUntil && now - lastSpawn > 40) {
      lastSpawn = now;
      const extra = reducedMotion ? 1 : 4;
      for (let i = 0; i < extra; i += 1) spawn(false);
    }

    particles.forEach((p) => {
      p.x += p.vx + Math.sin(now / 420 + p.rot) * 0.35;
      p.y += p.vy;
      p.rot += p.vr;
      p.vy += 0.012;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha * Math.max(0, 1 - elapsed / endAt);
      ctx.fillStyle = p.color;

      if (p.spark) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }

      ctx.restore();
    });

    if (elapsed < endAt) {
      requestAnimationFrame(frame);
      return;
    }

    showerCanvas.classList.remove("is-on");
    ctx.clearRect(0, 0, width, height);
  }

  requestAnimationFrame(frame);
}

function onCardRevealed() {
  revealedCount += 1;
  if (revealedCount >= TOTAL_CARDS) startSilverShower();
}

document.querySelectorAll(".scratch-card__foil").forEach(setupScratch);

const WEDDING_DATE = new Date(2026, 11, 1);

function padCount(value) {
  return String(value).padStart(2, "0");
}

function updateCountdown() {
  const units = {
    days: document.querySelector('[data-unit="days"]'),
    hours: document.querySelector('[data-unit="hours"]'),
    minutes: document.querySelector('[data-unit="minutes"]'),
    seconds: document.querySelector('[data-unit="seconds"]'),
  };

  if (!units.days) return;

  const diff = Math.max(0, WEDDING_DATE.getTime() - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  units.days.textContent = padCount(days);
  units.hours.textContent = padCount(hours);
  units.minutes.textContent = padCount(minutes);
  units.seconds.textContent = padCount(seconds);
}

updateCountdown();
window.setInterval(updateCountdown, 1000);

function setupStoryStack() {
  const track = document.getElementById("story-track");
  const hint = document.getElementById("story-hint");
  const cards = [...document.querySelectorAll("[data-story-card]")];
  if (!track || cards.length === 0) return;

  const total = cards.length;
  const last = total - 1;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function update() {
    const rect = track.getBoundingClientRect();
    const range = Math.max(track.offsetHeight - window.innerHeight, 1);
    const passed = Math.min(Math.max(-rect.top, 0), range);
    const progress = passed / range;
    const stacked = progress * last;

    cards.forEach((card, i) => {
      const tilt = getComputedStyle(card).getPropertyValue("--tilt").trim() || "0deg";
      card.style.zIndex = String(i + 1);
      card.style.opacity = "1";

      if (reducedMotion) {
        const shown = Math.round(stacked);
        const y = i <= shown ? 0 : 105;
        card.style.transform = `translate3d(0, ${y}%, 0) rotate(${tilt})`;
        return;
      }

      if (i === 0) {
        card.style.transform = `translate3d(0, 0, 0) rotate(${tilt})`;
        return;
      }

      const local = Math.min(1, Math.max(0, stacked - (i - 1)));
      const y = (1 - local) * 105;
      card.style.transform = `translate3d(0, ${y}%, 0) rotate(${tilt})`;
    });

    if (hint) {
      hint.classList.toggle("is-visible", stacked < last - 0.08);
    }
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

setupStoryStack();

function fadeVolume(audio, from, to, ms) {
  if (!audio) return Promise.resolve();
  const steps = 24;
  const step = (to - from) / steps;
  const wait = ms / steps;
  audio.volume = from;
  return new Promise((resolve) => {
    let i = 0;
    const tick = window.setInterval(() => {
      i += 1;
      audio.volume = Math.min(1, Math.max(0, from + step * i));
      if (i >= steps) {
        window.clearInterval(tick);
        audio.volume = to;
        resolve();
      }
    }, wait);
  });
}

async function crossfadeToWeddingSong() {
  if (!weddingSong) return;
  if (!weddingSong.paused && weddingSong.volume > 0.1) return;
  weddingSong.currentTime = 0;
  weddingSong.volume = 0;
  try {
    await weddingSong.play();
  } catch {
    return;
  }
  await Promise.all([
    fadeVolume(bgm, bgm ? bgm.volume : 0, 0, 3200),
    fadeVolume(weddingSong, 0, 0.78, 3800),
  ]);
  if (bgm) bgm.pause();
}

const THEME_CLASSES = [
  "theme-mehendi",
  "theme-ring",
  "theme-haldi",
  "theme-serabandhi",
  "theme-barat",
  "theme-vows",
];

const THEME_COLORS = {
  night: "#0B172B",
  mehendi: "#17301f",
  ring: "#07090e",
  haldi: "#3d2c0a",
  serabandhi: "#3a1219",
  barat: "#4a1612",
  vows: "#16121f",
};

function setupRites() {
  const scenes = [...document.querySelectorAll("[data-theme]")];
  const ceremonyVideos = [...document.querySelectorAll("[data-ceremony-video]")];
  if (!scenes.length) return;

  let currentTheme = "night";
  let celebrated = false;
  let ticking = false;

  function playSceneVideo(name) {
    ceremonyVideos.forEach((video) => {
      video.muted = true;
      video.playsInline = true;
      if (video.dataset.ceremonyVideo === name) {
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  }

  function applyTheme(name) {
    if (!name || name === currentTheme) return;
    currentTheme = name;

    THEME_CLASSES.forEach((cls) => {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    });

    if (name !== "night") {
      const cls = `theme-${name}`;
      document.documentElement.classList.add(cls);
      document.body.classList.add(cls);
      document.documentElement.classList.add("theme-festive");
      document.body.classList.add("theme-festive");
    } else {
      document.documentElement.classList.remove("theme-festive");
      document.body.classList.remove("theme-festive");
    }

    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      THEME_COLORS[name] || THEME_COLORS.night
    );

    if (name !== "night" && !celebrated) {
      celebrated = true;
      crossfadeToWeddingSong();
    }

    playSceneVideo(name);
  }

  function pickTheme() {
    const mid = window.innerHeight * 0.42;
    let best = null;
    let bestDist = Infinity;

    scenes.forEach((scene) => {
      const rect = scene.getBoundingClientRect();
      if (rect.bottom < 90 || rect.top > window.innerHeight - 50) return;
      const focus = rect.top + Math.min(rect.height * 0.38, 180);
      const dist = Math.abs(focus - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = scene;
      }
    });

    if (best) applyTheme(best.dataset.theme);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      pickTheme();
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  pickTheme();
}

setupRites();
