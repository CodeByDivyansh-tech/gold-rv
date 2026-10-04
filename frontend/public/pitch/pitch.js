/**
 * Gold RV Intelligence — Cinematic 3D Presentation Pitch
 * Team NEXORA (Divyansh, Ishant Bhaudhira, Noni Gopal Das)
 * Hack in Hills '26 · Problem Statement 03
 *
 * Built with Three.js (ES modules), GSAP 3.12.5, Web Speech API.
 * Apple Keynote aesthetic: Pure black #000000, Bullion Gold #F2A93B.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ============================================================
// GLOBAL STATE & DATA
// ============================================================

const state = {
  currentStage: 'opening', // 'opening' | '3d-bars' | 'slides'
  currentSlide: 1,
  totalSlides: 8,
  voiceEnabled: true,
  mascotVisible: true,
  notesVisible: false,
  isNormalized: false,
  isSpeaking: false,
  isTransitioning: false,
  pointer: { x: window.innerWidth / 2, y: window.innerHeight / 2, ndcX: 0, ndcY: 0 },
};

// Spoken voice lines for Goldie
const spokenLines = {
  opening: "Hi judges! I'm Goldie. MCX sells the same gold in four sizes, at four different prices. Team NEXORA asked one question: is the gap real money, or a mirage?",
  stage2: "Look at the raw prices. They seem far apart. Now watch me price them the same way. The real gap is only six hundred eighty-seven rupees per ten grams.",
  1: "Meet Team NEXORA. Divyansh built the data and quant pipeline, Ishant built the frontend, and Noni led research and the pitch.",
  2: "Big raw gap, tiny real gap. Lot sizes, purity, expiry and costs all hide the truth, and backtests can easily cheat by peeking at the future.",
  3: "Our solution covers all five directions of the brief: relative value, the futures curve and carry, walk-forward testing, quiet alerts, and contract lifecycle.",
  4: "All the heavy work happens once, in a Python pipeline. The website reads one file, so there is no server and nothing can crash while you watch.",
  5: "Here is a real example from thirty September. The gap is unusual, but it is only thirty-five point eight basis points, and a trade needs forty-eight point eight. One failed check is enough. So I stay quiet.",
  6: "On twelve months the model never saw, the rule made twenty trades and one lakh thirteen thousand rupees. But the t-statistic is only one point eight nine, and training lost money. Take out one crash, and the rule loses. So no persistent edge is proven after costs.",
  7: "The market is growing fast: gold futures turnover grew three point four times in a year. Our next step is a forward test with real fills.",
  8: "Thank you, judges! Please try the live website while we take your questions.",
};

// Speaker Notes for Judges / Presenter (N key)
const speakerNotes = {
  1: "Welcome judges. Team NEXORA built Gold RV Intelligence to investigate cross-contract commodity pricing on MCX. We mathematically normalized all four gold contracts to pure gold and tested whether cross-contract spreads survive real-world execution costs. Our headline finding is simple and honest: the gaps are real, but a proven edge after costs is not.",
  2: "Raw quotes look wildly dispersed—over 1.3 lakh rupees apart—because MCX quotes 1g, 8g, 10g, and 100g in different quote units and purities. Once normalized to pure gold, the actual gap is only 687 rupees, or 46 basis points. The problem is that once you account for real trading costs, carry, and liquidity, this apparent arbitrage completely evaporates.",
  3: "Our solution evaluates all contracts on equal footing with mathematical normalization, carry decomposition, and a strict five-gate hurdle. We use the exact same logic for alerts and backtesting, verified by 18 automated tests. Most importantly, we never look ahead: signals generated at close t fill strictly at close t+1.",
  4: "The system runs as an audit-ready, static pipeline with zero runtime server dependencies. Data is ingested from official MCX Bhavcopy, cleaned of exchange formatting quirks, and verified across 11,954 rows. Signals are computed strictly out-of-sample, and the entire platform deploys as static JSON to Vercel.",
  5: "This live example from September 30, 2026 demonstrates our discipline. The z-score of 2.14 exceeds the 2.0 hurdle, but the gap of 35.8 basis points is less than twice our round-trip transaction costs of 48.8 basis points. The gate fails, so the system stays quiet rather than generating unprofitable churn.",
  6: "This is our most crucial slide. While the fixed rule appears profitable on unseen data with plus 1.13 lakh rupees, deeper attribution reveals that all the profit came from just eight trades during the January 2026 crash, while the remaining twelve trades lost money. With a t-statistic of 1.89 and negative training performance, no persistent edge is proven after realistic costs.",
  7: "MCX gold futures trading has exploded more than threefold to over 28,000 crore rupees daily. The commercial opportunity spans retail traders, jewellery hedgers, and institutional prop desks. Our immediate roadmap focuses on forward-testing with live order books to measure actual execution slippage before expanding to silver contracts.",
  8: "Thank you judges for your time and thoughtful evaluation. We invite you to test the live terminal at gold-rv.vercel.app or inspect the complete, audited codebase on GitHub. We are now open for your questions.",
};

// 4 Contracts Data
const contractData = {
  GOLDM: {
    name: "GOLDM (100 g)",
    raw: "₹1,47,908 / 10 g (995 pure)",
    pure: "₹1,48,651",
    lot: 100,
    size: [2.5, 1.1, 1.2],
    posRaw: [-4.2, 0.4, 0],
    posNorm: [-4.2, 0, 0],
    scaleNorm: [1.4, 0.7, 0.8],
  },
  GOLDTEN: {
    name: "GOLDTEN (10 g)",
    raw: "₹1,48,322 / 10 g (999)",
    pure: "₹1,48,470",
    lot: 10,
    size: [1.6, 0.75, 0.85],
    posRaw: [-1.4, -0.2, 0.5],
    posNorm: [-1.4, 0, 0],
    scaleNorm: [1.4, 0.7, 0.8],
  },
  GOLDGUINEA: {
    name: "GOLDGUINEA (8 g)",
    raw: "₹1,19,207 / 8 g (999)",
    pure: "₹1,49,158",
    lot: 8,
    size: [1.4, 0.65, 0.75],
    posRaw: [1.4, 0.3, -0.3],
    posNorm: [1.4, 0, 0],
    scaleNorm: [1.4, 0.7, 0.8],
  },
  GOLDPETAL: {
    name: "GOLDPETAL (1 g)",
    raw: "₹14,893 / 1 g (999)",
    pure: "₹1,49,079",
    lot: 1,
    size: [0.85, 0.4, 0.45],
    posRaw: [4.0, -0.4, 0.2],
    posNorm: [4.0, 0, 0],
    scaleNorm: [1.4, 0.7, 0.8],
  },
};

// Helper: Indian numbering format (1,13,598)
function formatIndian(val) {
  const absVal = Math.abs(Math.round(val));
  const str = absVal.toString();
  const lastThree = str.substring(str.length - 3);
  const otherNumbers = str.substring(0, str.length - 3);
  const formatted = otherNumbers !== '' ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree;
  return (val < 0 ? '-' : '') + formatted;
}

// ============================================================
// VOICE CONTROLLER (WEB SPEECH API)
// ============================================================

class VoiceController {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voice = null;
    this.captionEl = document.getElementById('caption-bar');
    this.captionTimeout = null;
    this.initVoices();
  }

  initVoices() {
    if (!this.synth) return;
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;
      // Preference: en-IN -> en-GB -> en-US -> en
      this.voice = voices.find(v => v.lang === 'en-IN' || v.lang.startsWith('en-IN'))
        || voices.find(v => v.lang === 'en-GB' || v.lang.startsWith('en-GB'))
        || voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en-US'))
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];
    };
    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  speak(text) {
    if (this.captionTimeout) clearTimeout(this.captionTimeout);
    this.stop();

    if (!text) return;

    // Show subtitles in bottom caption bar
    if (this.captionEl) {
      this.captionEl.textContent = text;
      this.captionEl.classList.add('visible');
    }

    if (!state.voiceEnabled || !this.synth) {
      // Calculate estimated duration for reading
      const words = text.split(/\s+/).length;
      const readingDurationMs = Math.max(3000, words * 320);
      this.captionTimeout = setTimeout(() => {
        if (this.captionEl) this.captionEl.classList.remove('visible');
      }, readingDurationMs);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.15;

    utterance.onstart = () => {
      state.isSpeaking = true;
      if (goldieMascot) goldieMascot.setSpeaking(true);
    };

    utterance.onend = () => {
      state.isSpeaking = false;
      if (goldieMascot) goldieMascot.setSpeaking(false);
      this.captionTimeout = setTimeout(() => {
        if (this.captionEl) this.captionEl.classList.remove('visible');
      }, 1200);
    };

    utterance.onerror = () => {
      state.isSpeaking = false;
      if (goldieMascot) goldieMascot.setSpeaking(false);
      this.captionTimeout = setTimeout(() => {
        if (this.captionEl) this.captionEl.classList.remove('visible');
      }, 2000);
    };

    this.synth.speak(utterance);
  }

  stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
    state.isSpeaking = false;
    if (goldieMascot) goldieMascot.setSpeaking(false);
  }
}

const voiceController = new VoiceController();

// ============================================================
// 3D MASCOT "GOLDIE" (ROUNDEDBOX METALLIC 3D CHARACTER)
// ============================================================

class GoldieMascot {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.isSpeaking = false;
    this.blinkTimer = null;
    this.mouth = null;
    this.pupilL = null;
    this.pupilR = null;
    this.waveArm = null;
    this.bodyGroup = null;

    if (!this.canvas) return;
    this.initScene();
  }

  initScene() {
    const width = this.canvas.clientWidth || 140;
    const height = this.canvas.clientHeight || 140;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    this.camera.position.set(0, 0, 5.2);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Warm Key & Rim Lighting
    const keyLight = new THREE.DirectionalLight(0xFFF0BD, 2.2);
    keyLight.position.set(2, 3, 4);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xF2A93B, 1.8);
    rimLight.position.set(-3, -2, -2);
    this.scene.add(rimLight);

    const fillLight = new THREE.AmbientLight(0x2A1C0A, 1.2);
    this.scene.add(fillLight);

    this.buildCharacter();
    this.scheduleBlink();
    this.animate();
  }

  buildCharacter() {
    this.bodyGroup = new THREE.Group();
    this.scene.add(this.bodyGroup);

    // Gold Bar Metallic Material
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xF2A93B,
      metalness: 0.9,
      roughness: 0.25,
    });

    // 1. Bottom Bar (Shifted Right)
    const bottomGeom = new RoundedBoxGeometry(1.4, 0.65, 0.6, 4, 0.1);
    const bottomBar = new THREE.Mesh(bottomGeom, goldMat);
    bottomBar.position.set(0.3, -0.45, 0);
    this.bodyGroup.add(bottomBar);

    // 2. Top Bar
    const topGeom = new RoundedBoxGeometry(1.4, 0.72, 0.6, 4, 0.12);
    const topBar = new THREE.Mesh(topGeom, goldMat);
    topBar.position.set(0, 0.15, 0);
    this.bodyGroup.add(topBar);

    // 3. Eyes (White Spheres)
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.1,
      metalness: 0.1,
    });
    const eyeGeom = new THREE.SphereGeometry(0.16, 24, 24);

    this.eyeLGroup = new THREE.Group();
    this.eyeLGroup.position.set(-0.28, 0.22, 0.31);
    const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
    this.eyeLGroup.add(eyeL);

    this.eyeRGroup = new THREE.Group();
    this.eyeRGroup.position.set(0.28, 0.22, 0.31);
    const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
    this.eyeRGroup.add(eyeR);

    // 4. Pupils (Glossy Black Spheres)
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x05080C });
    const pupilGeom = new THREE.SphereGeometry(0.075, 16, 16);

    this.pupilL = new THREE.Mesh(pupilGeom, pupilMat);
    this.pupilL.position.set(0, 0, 0.13);
    this.eyeLGroup.add(this.pupilL);

    this.pupilR = new THREE.Mesh(pupilGeom, pupilMat);
    this.pupilR.position.set(0, 0, 0.13);
    this.eyeRGroup.add(this.pupilR);

    this.bodyGroup.add(this.eyeLGroup);
    this.bodyGroup.add(this.eyeRGroup);

    // 5. Mouth (Small Torus Smile)
    const mouthGeom = new THREE.TorusGeometry(0.08, 0.025, 8, 16, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x4A2C00 });
    this.mouth = new THREE.Mesh(mouthGeom, mouthMat);
    this.mouth.rotation.x = Math.PI;
    this.mouth.position.set(0, 0.02, 0.32);
    this.bodyGroup.add(this.mouth);

    // 6. Cheeks (Cute subtle pink)
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xFF8F85, transparent: true, opacity: 0.45 });
    const cheekGeom = new THREE.CircleGeometry(0.055, 16);
    const cheekL = new THREE.Mesh(cheekGeom, cheekMat);
    cheekL.position.set(-0.48, 0.08, 0.31);
    this.bodyGroup.add(cheekL);

    const cheekR = new THREE.Mesh(cheekGeom, cheekMat);
    cheekR.position.set(0.48, 0.08, 0.31);
    this.bodyGroup.add(cheekR);

    // 7. Waving Arm (for Slide 8)
    const armGeom = new RoundedBoxGeometry(0.35, 0.16, 0.16, 3, 0.05);
    this.waveArm = new THREE.Mesh(armGeom, goldMat);
    this.waveArm.position.set(0.85, 0.22, 0);
    this.waveArm.rotation.z = 0.4;
    this.waveArm.visible = false;
    this.bodyGroup.add(this.waveArm);
  }

  scheduleBlink() {
    const delay = 3000 + Math.random() * 3000;
    this.blinkTimer = setTimeout(() => {
      this.blink();
      this.scheduleBlink();
    }, delay);
  }

  blink() {
    if (!this.eyeLGroup || !this.eyeRGroup) return;
    gsap.to([this.eyeLGroup.scale, this.eyeRGroup.scale], {
      y: 0.08,
      duration: 0.09,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut',
    });
  }

  setSpeaking(speaking) {
    this.isSpeaking = speaking;
    if (!speaking && this.mouth) {
      gsap.to(this.mouth.scale, { x: 1, y: 1, duration: 0.2 });
    }
  }

  setWaving(waving) {
    if (!this.waveArm) return;
    this.waveArm.visible = waving;
  }

  update(time) {
    if (!this.bodyGroup) return;

    // Gentle floating idle bobbing
    const bob = Math.sin(time * 2.2) * 0.06;
    this.bodyGroup.position.y = bob;

    // Pupil Tracking in 3D: Convert screen coordinates to mascot angle
    const wrap = document.getElementById('goldie-canvas-wrap');
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = state.pointer.x - centerX;
      const dy = state.pointer.y - centerY;
      const dist = Math.hypot(dx, dy);

      // Max eye travel
      const maxTravel = 0.06;
      const travel = Math.min(dist * 0.0003, maxTravel);
      const angle = Math.atan2(dy, dx);

      const targetX = Math.cos(angle) * travel;
      const targetY = -Math.sin(angle) * travel;

      if (this.pupilL && this.pupilR) {
        this.pupilL.position.x += (targetX - this.pupilL.position.x) * 0.2;
        this.pupilL.position.y += (targetY - this.pupilL.position.y) * 0.2;
        this.pupilR.position.x += (targetX - this.pupilR.position.x) * 0.2;
        this.pupilR.position.y += (targetY - this.pupilR.position.y) * 0.2;
      }

      // Tilt slightly toward cursor when close
      const tiltX = (dy / window.innerHeight) * 0.25;
      const tiltY = (dx / window.innerWidth) * 0.35;
      this.bodyGroup.rotation.x += (tiltX - this.bodyGroup.rotation.x) * 0.1;
      this.bodyGroup.rotation.y += (tiltY - this.bodyGroup.rotation.y) * 0.1;
    }

    // Mouth animation while speaking
    if (this.isSpeaking && this.mouth) {
      const mouthScale = 1.0 + Math.sin(time * 16) * 0.65;
      this.mouth.scale.y = Math.max(0.4, mouthScale);
      this.bodyGroup.position.y += Math.sin(time * 14) * 0.02; // joyful talking bounce
    }

    // Arm waving on Slide 8
    if (this.waveArm && this.waveArm.visible) {
      this.waveArm.rotation.z = 0.5 + Math.sin(time * 8) * 0.45;
    }

    this.renderer.render(this.scene, this.camera);
  }

  animate() {
    const clock = new THREE.Clock();
    const renderLoop = () => {
      requestAnimationFrame(renderLoop);
      this.update(clock.getElapsedTime());
    };
    renderLoop();
  }
}

let goldieMascot = null;

// ============================================================
// MAIN WEBGL 3D WORLD (#bg-canvas)
// ============================================================

class Main3DWorld {
  constructor() {
    this.canvas = document.getElementById('bg-canvas');
    if (!this.canvas) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.particleSystem = null;
    this.contractBars = {};
    this.slide6Columns = null;
    this.slide8Logo = null;
    this.raycaster = new THREE.Raycaster();
    this.hoveredBar = null;

    this.init();
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.015);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 14);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Set up UnrealBloomPass post-processing
    try {
      this.composer = new EffectComposer(this.renderer);
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.55,  // bloom strength
        0.4,   // radius
        0.82   // threshold
      );
      this.composer.addPass(bloomPass);
    } catch (e) {
      console.warn("EffectComposer/Bloom disabled; falling back to direct render.", e);
      this.composer = null;
    }

    this.setupLighting();
    this.setupParticles();
    this.setupContractBars();
    this.setupSlide6Visuals();
    this.setupSlide8Visuals();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));

    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x18232F, 1.2);
    this.scene.add(ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xFFF4D0, 2.5);
    this.keyLight.position.set(6, 8, 8);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xF2A93B, 2.0);
    this.rimLight.position.set(-6, -4, -6);
    this.scene.add(this.rimLight);

    // Subtle moving warm pointlight
    this.pointLight = new THREE.PointLight(0xF2A93B, 1.5, 30);
    this.pointLight.position.set(0, 2, 6);
    this.scene.add(this.pointLight);
  }

  setupParticles() {
    // 1200 gold particles: Gather into logo in Opening stage, then drift
    const count = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Initial random floating distribution
      positions[i3] = (Math.random() - 0.5) * 28;
      positions[i3 + 1] = (Math.random() - 0.5) * 18;
      positions[i3 + 2] = (Math.random() - 0.5) * 20;

      // Half the particles form top bar, half form bottom bar (nudged right)
      if (i < count / 2) {
        // Top bar: center (0, 0.8, 0), width 4, height 1.4
        targetPositions[i3] = (Math.random() - 0.5) * 4.2;
        targetPositions[i3 + 1] = 0.8 + (Math.random() - 0.5) * 1.3;
        targetPositions[i3 + 2] = (Math.random() - 0.5) * 0.8;
      } else {
        // Bottom bar: center (0.9, -0.8, 0), width 4, height 1.4 (nudged right!)
        targetPositions[i3] = 0.9 + (Math.random() - 0.5) * 4.2;
        targetPositions[i3 + 1] = -0.8 + (Math.random() - 0.5) * 1.3;
        targetPositions[i3 + 2] = (Math.random() - 0.5) * 0.8;
      }

      speeds[i] = 0.5 + Math.random() * 0.8;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleTargets = targetPositions;
    this.particleSpeeds = speeds;

    const pMaterial = new THREE.PointsMaterial({
      color: 0xF2A93B,
      size: 0.08,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    this.particleSystem = new THREE.Points(geometry, pMaterial);
    this.scene.add(this.particleSystem);
  }

  setupContractBars() {
    this.barsGroup = new THREE.Group();
    this.scene.add(this.barsGroup);
    this.barsGroup.visible = false;

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xF2A93B,
      metalness: 0.92,
      roughness: 0.22,
    });

    Object.keys(contractData).forEach((key) => {
      const data = contractData[key];
      const geom = new RoundedBoxGeometry(data.size[0], data.size[1], data.size[2], 4, 0.08);
      const mesh = new THREE.Mesh(geom, goldMat.clone());
      mesh.position.set(...data.posRaw);
      mesh.userData = { key, data, basePos: [...data.posRaw] };

      this.barsGroup.add(mesh);
      this.contractBars[key] = mesh;
    });
  }

  setupSlide6Visuals() {
    this.slide6Columns = new THREE.Group();
    this.scene.add(this.slide6Columns);
    this.slide6Columns.visible = false;

    // Thin glowing reference floor at y = -1.2
    const floorGeom = new THREE.PlaneGeometry(16, 8);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x070D14,
      transparent: true,
      opacity: 0.7,
      wireframe: true,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    this.slide6Columns.add(floor);

    // Green/Gold Column: +₹1,37,985 (8 Crash Trades)
    const colCrashGeom = new RoundedBoxGeometry(1.6, 1.0, 1.2, 4, 0.08);
    const colCrashMat = new THREE.MeshStandardMaterial({
      color: 0x4FD1A1,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x1F5C45,
      emissiveIntensity: 0.4,
    });
    this.colCrash = new THREE.Mesh(colCrashGeom, colCrashMat);
    this.colCrash.position.set(-2.4, -1.2, 0);
    this.colCrash.scale.set(1, 0.01, 1);
    this.slide6Columns.add(this.colCrash);

    // Red/Gray Column: -₹24,387 (Other 12 Trades)
    const colOtherGeom = new RoundedBoxGeometry(1.6, 1.0, 1.2, 4, 0.08);
    const colOtherMat = new THREE.MeshStandardMaterial({
      color: 0xFF8F85,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x6B2D26,
      emissiveIntensity: 0.4,
    });
    this.colOther = new THREE.Mesh(colOtherGeom, colOtherMat);
    this.colOther.position.set(2.4, -1.2, 0);
    this.colOther.scale.set(1, 0.01, 1);
    this.slide6Columns.add(this.colOther);
  }

  setupSlide8Visuals() {
    this.slide8Logo = new THREE.Group();
    this.scene.add(this.slide8Logo);
    this.slide8Logo.visible = false;
    this.slide8Logo.position.set(0, 0.6, -3);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xF2A93B,
      metalness: 0.92,
      roughness: 0.22,
    });

    const barGeom = new RoundedBoxGeometry(3.2, 1.2, 0.9, 4, 0.14);
    const topBar = new THREE.Mesh(barGeom, goldMat);
    topBar.position.set(-0.35, 0.7, 0);
    this.slide8Logo.add(topBar);

    const bottomBar = new THREE.Mesh(barGeom, goldMat);
    bottomBar.position.set(0.45, -0.7, 0); // shifted right!
    this.slide8Logo.add(bottomBar);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) this.composer.setSize(width, height);
  }

  onPointerMove(e) {
    state.pointer.x = e.clientX;
    state.pointer.y = e.clientY;
    state.pointer.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    state.pointer.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;

    // Raycast on Stage 2 contract bars
    if (state.currentStage === '3d-bars' && this.barsGroup.visible) {
      this.raycaster.setFromCamera(
        new THREE.Vector2(state.pointer.ndcX, state.pointer.ndcY),
        this.camera
      );
      const intersects = this.raycaster.intersectObjects(this.barsGroup.children);
      const hoverCard = document.getElementById('hover-card-3d');

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (this.hoveredBar !== hit) {
          if (this.hoveredBar) this.hoveredBar.material.emissive.setHex(0x000000);
          this.hoveredBar = hit;
          hit.material.emissive.setHex(0x3B2808);

          if (hoverCard && hit.userData && hit.userData.data) {
            document.getElementById('hover-card-title').textContent = hit.userData.data.name;
            document.getElementById('hover-card-raw').textContent = hit.userData.data.raw;
            document.getElementById('hover-card-pure').textContent = hit.userData.data.pure;
            hoverCard.classList.add('visible');
          }
        }

        if (hoverCard) {
          hoverCard.style.left = `${e.clientX}px`;
          hoverCard.style.top = `${e.clientY}px`;
        }
      } else {
        if (this.hoveredBar) {
          this.hoveredBar.material.emissive.setHex(0x000000);
          this.hoveredBar = null;
        }
        if (hoverCard) hoverCard.classList.remove('visible');
      }
    }
  }

  normalizeContractBars() {
    state.isNormalized = true;
    Object.keys(this.contractBars).forEach((key) => {
      const bar = this.contractBars[key];
      const data = contractData[key];
      gsap.to(bar.position, {
        x: data.posNorm[0],
        y: data.posNorm[1],
        z: data.posNorm[2],
        duration: 1.2,
        ease: 'power3.inOut',
      });
      gsap.to(bar.scale, {
        x: data.scaleNorm[0] / data.size[0],
        y: data.scaleNorm[1] / data.size[1],
        z: data.scaleNorm[2] / data.size[2],
        duration: 1.2,
        ease: 'power3.inOut',
      });
    });

    const callout = document.getElementById('normalize-callout');
    if (callout) callout.classList.add('visible');
    voiceController.speak(spokenLines.stage2);
  }

  showStage(stage) {
    state.currentStage = stage;
    const hoverCard = document.getElementById('hover-card-3d');
    if (hoverCard) hoverCard.classList.remove('visible');

    if (stage === 'opening') {
      this.barsGroup.visible = false;
      this.slide6Columns.visible = false;
      this.slide8Logo.visible = false;
      gsap.to(this.camera.position, { x: 0, y: 0, z: 14, duration: 1.2 });
    } else if (stage === '3d-bars') {
      this.barsGroup.visible = true;
      this.slide6Columns.visible = false;
      this.slide8Logo.visible = false;
      gsap.to(this.camera.position, { x: 0, y: 0.5, z: 12, duration: 1.2, ease: 'power3.out' });
      voiceController.speak(spokenLines.stage2);
    } else if (stage === 'slides') {
      this.barsGroup.visible = false;
    }
  }

  animateSlideVisuals(slideNum) {
    if (this.slide6Columns) {
      if (slideNum === 6) {
        this.slide6Columns.visible = true;
        // Rising +1,37,985 green column
        this.colCrash.scale.set(1, 0.01, 1);
        this.colCrash.position.y = -1.2;
        gsap.to(this.colCrash.scale, {
          y: 3.4,
          duration: 1.2,
          ease: 'power2.out',
          onUpdate: () => {
            this.colCrash.position.y = -1.2 + (this.colCrash.scale.y * 0.5);
          }
        });

        // Dipping -24,387 red column below floor
        this.colOther.scale.set(1, 0.01, 1);
        this.colOther.position.y = -1.2;
        gsap.to(this.colOther.scale, {
          y: 0.8,
          duration: 1.2,
          ease: 'power2.out',
          onUpdate: () => {
            this.colOther.position.y = -1.2 - (this.colOther.scale.y * 0.5);
          }
        });
      } else {
        this.slide6Columns.visible = false;
      }
    }

    if (this.slide8Logo) {
      this.slide8Logo.visible = (slideNum === 8);
      if (goldieMascot) goldieMascot.setWaving(slideNum === 8);
    }
  }

  update(time) {
    // 1. Particle Motion & Logo Morphing
    if (this.particleSystem) {
      const positions = this.particleSystem.geometry.attributes.position.array;
      const count = positions.length / 3;

      if (state.currentStage === 'opening') {
        // Morph particles towards two-bar logo
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          positions[i3] += (this.particleTargets[i3] - positions[i3]) * 0.04;
          positions[i3 + 1] += (this.particleTargets[i3 + 1] - positions[i3 + 1]) * 0.04;
          positions[i3 + 2] += (this.particleTargets[i3 + 2] - positions[i3 + 2]) * 0.04;
        }
      } else {
        // Drifting ambient starfield
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          positions[i3 + 1] -= this.particleSpeeds[i] * 0.015;
          if (positions[i3 + 1] < -10) positions[i3 + 1] = 10;
        }
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    // 2. Parallax camera drift
    if (this.camera) {
      const targetCamX = state.pointer.ndcX * 0.8;
      const targetCamY = state.pointer.ndcY * 0.5;
      this.camera.position.x += (targetCamX - this.camera.position.x) * 0.05;
      this.camera.position.y += (targetCamY - this.camera.position.y) * 0.05;
      this.camera.lookAt(0, 0, 0);
    }

    // 3. Contract Bars rotation
    if (this.barsGroup && this.barsGroup.visible) {
      Object.keys(this.contractBars).forEach((key, idx) => {
        const bar = this.contractBars[key];
        bar.rotation.y = Math.sin(time * 0.8 + idx) * 0.18;
        bar.rotation.x = Math.cos(time * 0.6 + idx) * 0.12;
      });
    }

    // 4. Slide 8 Logo slow spin
    if (this.slide8Logo && this.slide8Logo.visible) {
      this.slide8Logo.rotation.y = Math.sin(time * 0.6) * 0.25;
    }

    // 5. Point light drift
    if (this.pointLight) {
      this.pointLight.position.x = Math.sin(time * 0.7) * 5;
      this.pointLight.position.y = Math.cos(time * 0.5) * 3;
    }

    // Render pass
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  animate() {
    const clock = new THREE.Clock();
    const renderLoop = () => {
      requestAnimationFrame(renderLoop);
      this.update(clock.getElapsedTime());
    };
    renderLoop();
  }
}

let main3DWorld = null;

// ============================================================
// PRESENTATION SLIDES MANAGER (KEYNOTE STYLE)
// ============================================================

class PitchDeckManager {
  constructor() {
    this.slidesContainer = document.getElementById('slides-container');
    this.stageOpening = document.getElementById('stage-opening');
    this.stage3dUi = document.getElementById('stage-3d-ui');
    this.progressBar = document.getElementById('top-progress-bar');
    this.slideBadge = document.getElementById('slide-counter-badge');
    this.notesPanel = document.getElementById('speaker-notes-panel');
    this.notesContent = document.getElementById('notes-content');
    this.goldieWrap = document.getElementById('goldie-canvas-wrap');

    this.bindEvents();
    this.updateNotes();
  }

  bindEvents() {
    // Stage 1 Button
    const btnBegin = document.getElementById('btn-begin');
    if (btnBegin) {
      btnBegin.addEventListener('click', () => {
        // User interaction unlocks audio/speech
        this.goTo3DScene();
      });
    }

    // Stage 2 Buttons
    const btnNormalize = document.getElementById('btn-normalize-bars');
    if (btnNormalize) {
      btnNormalize.addEventListener('click', () => {
        if (main3DWorld) main3DWorld.normalizeContractBars();
      });
    }

    const btnOpenPitch = document.getElementById('btn-open-pitch');
    if (btnOpenPitch) {
      btnOpenPitch.addEventListener('click', () => {
        this.goToPitch(1);
      });
    }

    // Header Controls
    const btnBack3D = document.getElementById('btn-back-3d');
    if (btnBack3D) {
      btnBack3D.addEventListener('click', () => this.goTo3DScene());
    }

    const btnToggleNotes = document.getElementById('btn-toggle-notes');
    if (btnToggleNotes) {
      btnToggleNotes.addEventListener('click', () => this.toggleNotes());
    }

    const btnCloseNotes = document.getElementById('btn-close-notes');
    if (btnCloseNotes) {
      btnCloseNotes.addEventListener('click', () => this.toggleNotes(false));
    }

    const btnToggleVoice = document.getElementById('btn-toggle-voice');
    if (btnToggleVoice) {
      btnToggleVoice.addEventListener('click', () => this.toggleVoice());
    }

    const btnToggleMascot = document.getElementById('btn-toggle-mascot');
    if (btnToggleMascot) {
      btnToggleMascot.addEventListener('click', () => this.toggleMascot());
    }

    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    }

    // Prev / Next Floating Arrows
    const btnPrev = document.getElementById('btn-prev-slide');
    if (btnPrev) btnPrev.addEventListener('click', () => this.prevSlide());

    const btnNext = document.getElementById('btn-next-slide');
    if (btnNext) btnNext.addEventListener('click', () => this.nextSlide());

    // Click on Mascot repeats the spoken line
    if (this.goldieWrap) {
      this.goldieWrap.addEventListener('click', () => {
        const text = state.currentStage === 'slides'
          ? spokenLines[state.currentSlide]
          : spokenLines[state.currentStage === 'opening' ? 'opening' : 'stage2'];
        voiceController.speak(text);
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case ' ':
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        if (state.currentStage === 'opening') {
          this.goTo3DScene();
        } else if (state.currentStage === '3d-bars') {
          this.goToPitch(1);
        } else {
          this.nextSlide();
        }
        break;

      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        if (state.currentStage === 'slides') {
          this.prevSlide();
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.goTo3DScene();
        break;

      case 'n':
      case 'N':
        e.preventDefault();
        this.toggleNotes();
        break;

      case 'v':
      case 'V':
        e.preventDefault();
        this.toggleVoice();
        break;

      case 'm':
      case 'M':
        e.preventDefault();
        this.toggleMascot();
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        this.toggleFullscreen();
        break;

      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
        e.preventDefault();
        const slideNum = parseInt(e.key, 10);
        this.goToPitch(slideNum);
        break;
    }
  }

  goTo3DScene() {
    state.currentStage = '3d-bars';
    voiceController.stop();

    if (this.stageOpening) this.stageOpening.classList.add('hidden');
    if (this.stage3dUi) this.stage3dUi.classList.add('active');
    if (this.slidesContainer) this.slidesContainer.classList.remove('active');

    if (main3DWorld) main3DWorld.showStage('3d-bars');
  }

  goToPitch(slideNum) {
    state.currentStage = 'slides';
    if (this.stageOpening) this.stageOpening.classList.add('hidden');
    if (this.stage3dUi) this.stage3dUi.classList.remove('active');
    if (this.slidesContainer) this.slidesContainer.classList.add('active');

    if (main3DWorld) main3DWorld.showStage('slides');
    this.goToSlide(slideNum);
  }

  goToSlide(slideNum) {
    if (slideNum < 1) slideNum = 1;
    if (slideNum > state.totalSlides) slideNum = state.totalSlides;
    state.currentSlide = slideNum;

    // 1. Update Progress Bar & Badge
    const pct = ((slideNum) / state.totalSlides) * 100;
    if (this.progressBar) this.progressBar.style.width = `${pct}%`;
    if (this.slideBadge) this.slideBadge.textContent = `${slideNum} / ${state.totalSlides}`;

    // 2. Hide old slide & show new slide with GSAP staggered entrance
    const allPanels = document.querySelectorAll('.slide-panel');
    allPanels.forEach((panel) => {
      const idx = parseInt(panel.dataset.slide, 10);
      if (idx === slideNum) {
        panel.classList.add('active');
        const animElements = panel.querySelectorAll('.keynote-h1, .keynote-lead, .roster-card, .price-tile, .direction-box, .stat-cell-cinematic, .market-box-cinematic, .check-hero-card, .thank-you-big, .links-row');
        gsap.fromTo(animElements, 
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, stagger: 0.08, duration: 0.6, ease: 'power2.out', clearProps: 'transform' }
        );
      } else {
        panel.classList.remove('active');
      }
    });

    // 3. Animate 3D World visuals for current slide
    if (main3DWorld) {
      main3DWorld.animateSlideVisuals(slideNum);
    }

    // 4. Slide-specific interactive animations
    this.runSlideSpecificAnimations(slideNum);

    // 5. Update Speaker Notes
    this.updateNotes();

    // 6. Speak slide line
    voiceController.speak(spokenLines[slideNum]);
  }

  nextSlide() {
    if (state.currentSlide < state.totalSlides) {
      this.goToSlide(state.currentSlide + 1);
    }
  }

  prevSlide() {
    if (state.currentSlide > 1) {
      this.goToSlide(state.currentSlide - 1);
    }
  }

  runSlideSpecificAnimations(slideNum) {
    // Slide 4: Data Flow Gold Pulse
    if (slideNum === 4) {
      const nodes = [
        document.getElementById('arch-node-1'),
        document.getElementById('arch-node-2'),
        document.getElementById('arch-node-3'),
        document.getElementById('arch-node-4'),
        document.getElementById('arch-node-5')
      ];
      nodes.forEach((node, i) => {
        if (!node) return;
        setTimeout(() => {
          node.classList.add('active-gold');
          setTimeout(() => node.classList.remove('active-gold'), 800);
        }, i * 350);
      });
    }

    // Slide 5: The 5 Checks sequential illumination
    if (slideNum === 5) {
      const checkRows = [
        document.getElementById('check-row-1'),
        document.getElementById('check-row-2'),
        document.getElementById('check-row-3'),
        document.getElementById('check-row-4'),
        document.getElementById('check-row-5'),
      ];
      checkRows.forEach((row, i) => {
        if (!row) return;
        row.classList.remove('lit');
        setTimeout(() => {
          row.classList.add('lit');
        }, (i + 1) * 220);
      });
    }

    // Slide 6: Number counters animation
    if (slideNum === 6) {
      const counters = document.querySelectorAll('.counter-stat');
      counters.forEach((el) => {
        const target = parseFloat(el.dataset.target);
        const prefix = el.dataset.prefix || '';
        const decimals = parseInt(el.dataset.decimals || '0', 10);
        const isIndian = el.dataset.indian === 'true';

        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 1.4,
          ease: 'power2.out',
          onUpdate: () => {
            let formatted;
            if (isIndian) {
              formatted = prefix + formatIndian(obj.val);
            } else if (decimals > 0) {
              formatted = prefix + obj.val.toFixed(decimals);
            } else {
              formatted = prefix + Math.round(obj.val);
            }
            el.textContent = formatted;
          }
        });
      });
    }
  }

  updateNotes() {
    if (!this.notesContent) return;
    const note = speakerNotes[state.currentSlide] || "No notes available for this slide.";
    this.notesContent.textContent = note;
  }

  toggleNotes(forceState) {
    state.notesVisible = typeof forceState === 'boolean' ? forceState : !state.notesVisible;
    if (this.notesPanel) {
      this.notesPanel.classList.toggle('visible', state.notesVisible);
    }
    const btn = document.getElementById('btn-toggle-notes');
    if (btn) btn.classList.toggle('active', state.notesVisible);
  }

  toggleVoice() {
    state.voiceEnabled = !state.voiceEnabled;
    const btn = document.getElementById('btn-toggle-voice');
    const icon = document.getElementById('voice-icon');
    if (btn) btn.classList.toggle('active', state.voiceEnabled);
    if (icon) icon.textContent = state.voiceEnabled ? '🔊' : '🔇';

    if (!state.voiceEnabled) {
      voiceController.stop();
    } else {
      const text = state.currentStage === 'slides'
        ? spokenLines[state.currentSlide]
        : spokenLines[state.currentStage === 'opening' ? 'opening' : 'stage2'];
      voiceController.speak(text);
    }
  }

  toggleMascot() {
    state.mascotVisible = !state.mascotVisible;
    if (this.goldieWrap) {
      this.goldieWrap.classList.toggle('hidden', !state.mascotVisible);
    }
    const btn = document.getElementById('btn-toggle-mascot');
    if (btn) btn.classList.toggle('active', state.mascotVisible);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }
}

// ============================================================
// 2D FALLBACK SYSTEM (IF WEBGL FAILS)
// ============================================================

function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

function initFallback2D() {
  console.warn("WebGL not available. Initializing high-fidelity 2D fallback.");
  const fallbackLayer = document.getElementById('fallback-2d-layer');
  if (fallbackLayer) {
    fallbackLayer.style.display = 'block';
  }
}

// ============================================================
// APP ENTRY POINT
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
  if (!checkWebGLSupport()) {
    initFallback2D();
    return;
  }

  try {
    goldieMascot = new GoldieMascot('goldie-canvas');
    main3DWorld = new Main3DWorld();
    window.pitchDeck = new PitchDeckManager();

    // Initial greeting in Stage 1
    voiceController.speak(spokenLines.opening);
  } catch (err) {
    console.error("Initialization error, falling back to 2D:", err);
    initFallback2D();
  }
});
