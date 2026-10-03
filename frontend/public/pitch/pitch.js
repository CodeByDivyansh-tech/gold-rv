/**
 * Gold RV Intelligence — Interactive Judge Pitch Deck
 * Team NEXORA (Divyansh, Ishant Bhaudhira, Noni Gopal Das)
 * Hack in Hills '26 · Problem Statement 03
 */

(function () {
  'use strict';

  // --- Utility: Indian Number Formatting (e.g. 1,13,598) ---
  function formatIndian(val) {
    var absVal = Math.abs(val);
    var str = absVal.toString();
    var lastThree = str.substring(str.length - 3);
    var otherNumbers = str.substring(0, str.length - 3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    var res = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    return (val < 0 ? '-' : '') + res;
  }

  // --- Check reduced motion preference ---
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  var state = {
    currentStage: 'intro', // 'intro' | '3d' | 'pitch'
    currentSlide: 1,
    totalSlides: 8,
    introLineIndex: 0,
    isTyping: false,
    typewriterTimer: null,
    notesOpen: false,
    mascotVisible: true,
    isNormalized3D: false,
    pointer: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  };

  // Intro Dialogues
  var introLines = [
    "Hi judges! I'm Goldie. MCX sells the same gold in four sizes.",
    "GOLDM, GOLDTEN, GOLDGUINEA and GOLDPETAL. Same metal, four different prices.",
    "Team NEXORA asked: is the gap between them real money, or a mirage?",
    "Let me show you. Ready?"
  ];

  // Mascot Tips Per Slide
  var mascotSlideTips = {
    1: "Meet the team that built me.",
    2: "Big raw gap, tiny real gap.",
    3: "I only speak when the evidence survives costs.",
    4: "No server, so nothing can crash while you watch.",
    5: "One failed check is enough to stay quiet.",
    6: "We tried to break our own result. Honesty is the feature.",
    7: "Next step: prove it live, with real fills.",
    8: "Questions? Try the live site while we talk!"
  };

  // Speaker Notes (2-3 plain English sentences per slide)
  var speakerNotes = {
    1: "Welcome judges. Team NEXORA built Gold RV Intelligence to investigate cross-contract commodity pricing on MCX. We mathematically normalized all four gold contracts to pure gold and tested whether cross-contract spreads survive real-world execution costs. Our headline finding is simple and honest: the gaps are real, but a proven edge after costs is not.",
    2: "Raw quotes look wildly dispersed—over 1.3 lakh rupees apart—because MCX quotes 1g, 8g, 10g, and 100g in different quote units and purities. Once normalized to pure gold, the actual gap is only 687 rupees, or 46 basis points. The problem is that once you account for real trading costs, carry, and liquidity, this apparent arbitrage completely evaporates.",
    3: "Our solution evaluates all contracts on equal footing with mathematical normalization, carry decomposition, and a strict five-gate hurdle. We use the exact same logic for alerts and backtesting, verified by 18 automated tests. Most importantly, we never look ahead: signals generated at close t fill strictly at close t+1.",
    4: "The system runs as an audit-ready, static pipeline with zero runtime server dependencies. Data is ingested from official MCX Bhavcopy, cleaned of exchange formatting quirks, and verified across 11,954 rows. Signals are computed strictly out-of-sample, and the entire platform deploys as static JSON to Vercel.",
    5: "This live example from September 30, 2026 demonstrates our discipline. The z-score of 2.14 exceeds the 2.0 hurdle, but the gap of 35.8 basis points is less than twice our round-trip transaction costs of 48.8 basis points. The gate fails, so the system stays quiet rather than generating unprofitable churn.",
    6: "This is our most crucial slide. While the fixed rule appears profitable on unseen data with plus 1.13 lakh rupees, deeper attribution reveals that all the profit came from just eight trades during the January 2026 crash, while the remaining twelve trades lost money. With a t-statistic of 1.89 and negative training performance, no persistent edge is proven after realistic costs.",
    7: "MCX gold futures trading has exploded more than threefold to over 28,000 crore rupees daily. The commercial opportunity spans retail traders, jewellery hedgers, and institutional prop desks. Our immediate roadmap focuses on forward-testing with live order books to measure actual execution slippage before expanding to silver contracts.",
    8: "Thank you judges for your time and thoughtful evaluation. We invite you to test the live terminal at gold-rv.vercel.app or inspect the complete, audited codebase on GitHub. We are now open for your questions."
  };

  // Contract Price Data for 3D Tooltip & Fallback
  var contractData = {
    GOLDM: {
      name: "GOLDM (100 g)",
      raw: "Rs 1,47,908 / 10 g (995 pure)",
      pure: "Rs 1,48,651",
      lot: 100
    },
    GOLDTEN: {
      name: "GOLDTEN (10 g)",
      raw: "Rs 1,48,322 / 10 g (999)",
      pure: "Rs 1,48,470",
      lot: 10
    },
    GOLDGUINEA: {
      name: "GOLDGUINEA (8 g)",
      raw: "Rs 1,19,207 / 8 g (999)",
      pure: "Rs 1,49,158",
      lot: 8
    },
    GOLDPETAL: {
      name: "GOLDPETAL (1 g)",
      raw: "Rs 14,893 / 1 g (999)",
      pure: "Rs 1,49,079",
      lot: 1
    }
  };

  // ============================================================
  // MASCOT "GOLDIE" PUPIL TRACKING & BLINKING
  // ============================================================
  function trackPointer(e) {
    if (e.touches && e.touches.length > 0) {
      state.pointer.x = e.touches[0].clientX;
      state.pointer.y = e.touches[0].clientY;
    } else {
      state.pointer.x = e.clientX;
      state.pointer.y = e.clientY;
    }
  }

  window.addEventListener('mousemove', trackPointer, { passive: true });
  window.addEventListener('pointermove', trackPointer, { passive: true });
  window.addEventListener('touchmove', trackPointer, { passive: true });

  var activePupils = [];

  function registerPupils() {
    activePupils = [];
    var pupilElements = document.querySelectorAll('.pupil');
    pupilElements.forEach(function (el) {
      activePupils.push({
        element: el,
        parentEye: el.closest('.eye-group'),
        curX: 0,
        curY: 0
      });
    });
  }

  function animatePupils() {
    activePupils.forEach(function (p) {
      if (!p.parentEye) return;
      var rect = p.parentEye.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      var eyeCenterX = rect.left + rect.width / 2;
      var eyeCenterY = rect.top + rect.height / 2;

      var dx = state.pointer.x - eyeCenterX;
      var dy = state.pointer.y - eyeCenterY;
      var dist = Math.hypot(dx, dy);

      // Max radius pupil can travel inside white
      var maxRadius = rect.width * 0.22;
      var travel = Math.min(dist * 0.1, maxRadius);
      var angle = Math.atan2(dy, dx);

      var targetX = Math.cos(angle) * travel;
      var targetY = Math.sin(angle) * travel;

      // Smooth lerp
      p.curX += (targetX - p.curX) * 0.25;
      p.curY += (targetY - p.curY) * 0.25;

      p.element.style.transform = 'translate(' + p.curX.toFixed(2) + 'px, ' + p.curY.toFixed(2) + 'px)';
    });

    requestAnimationFrame(animatePupils);
  }

  // Mascot Blinking Logic (every 3-6 seconds)
  function scheduleBlink() {
    var delay = 3000 + Math.random() * 3000;
    setTimeout(function () {
      var mascots = document.querySelectorAll('.mascot-container');
      mascots.forEach(function (m) {
        m.classList.add('blinking');
      });

      setTimeout(function () {
        mascots.forEach(function (m) {
          m.classList.remove('blinking');
        });
        scheduleBlink();
      }, 150);
    }, delay);
  }

  // ============================================================
  // STAGE SWITCHING
  // ============================================================
  function switchStage(stageName) {
    state.currentStage = stageName;

    var stages = document.querySelectorAll('.stage');
    stages.forEach(function (st) {
      st.classList.remove('active');
    });

    var target = document.getElementById('stage-' + stageName);
    if (target) {
      target.classList.add('active');
    }

    if (stageName === '3d') {
      initThreeScene();
    } else if (stageName === 'pitch') {
      goToSlide(state.currentSlide);
    }

    registerPupils();
  }

  // ============================================================
  // STAGE 1: INTRO LOGIC
  // ============================================================
  var introSpeechText = document.getElementById('intro-speech-text');
  var btnIntroNext = document.getElementById('btn-intro-next');
  var btnEnter3D = document.getElementById('btn-enter-3d');
  var btnSkipIntro = document.getElementById('btn-skip-intro');
  var introSpeechBubble = document.getElementById('intro-speech-bubble');
  var introDots = document.getElementById('intro-dots');

  function typeIntroLine(lineIndex) {
    if (lineIndex >= introLines.length) return;
    state.introLineIndex = lineIndex;
    state.isTyping = true;
    clearInterval(state.typewriterTimer);

    // Update dots
    var dots = introDots.querySelectorAll('.intro-dot');
    dots.forEach(function (d, idx) {
      d.classList.toggle('active', idx === lineIndex);
    });

    var fullText = introLines[lineIndex];
    var charIdx = 0;
    introSpeechText.textContent = '';

    state.typewriterTimer = setInterval(function () {
      if (charIdx < fullText.length) {
        introSpeechText.textContent += fullText.charAt(charIdx);
        charIdx++;
      } else {
        clearInterval(state.typewriterTimer);
        state.isTyping = false;

        if (lineIndex === introLines.length - 1) {
          btnIntroNext.style.display = 'none';
          btnEnter3D.style.display = 'inline-flex';
        }
      }
    }, prefersReducedMotion ? 1 : 22);
  }

  function handleIntroAdvance() {
    if (state.currentStage !== 'intro') return;

    if (state.isTyping) {
      // Complete line immediately on click
      clearInterval(state.typewriterTimer);
      introSpeechText.textContent = introLines[state.introLineIndex];
      state.isTyping = false;

      if (state.introLineIndex === introLines.length - 1) {
        btnIntroNext.style.display = 'none';
        btnEnter3D.style.display = 'inline-flex';
      }
    } else {
      if (state.introLineIndex < introLines.length - 1) {
        typeIntroLine(state.introLineIndex + 1);
      } else {
        btnIntroNext.style.display = 'none';
        btnEnter3D.style.display = 'inline-flex';
      }
    }
  }

  function handleNextButtonClick() {
    if (state.currentStage !== 'intro') return;
    if (state.introLineIndex < introLines.length - 1) {
      typeIntroLine(state.introLineIndex + 1);
    } else {
      clearInterval(state.typewriterTimer);
      introSpeechText.textContent = introLines[state.introLineIndex];
      state.isTyping = false;
      btnIntroNext.style.display = 'none';
      btnEnter3D.style.display = 'inline-flex';
    }
  }

  if (introSpeechBubble) introSpeechBubble.addEventListener('click', handleIntroAdvance);
  if (btnIntroNext) btnIntroNext.addEventListener('click', handleNextButtonClick);
  if (btnEnter3D) btnEnter3D.addEventListener('click', function () { switchStage('3d'); });
  if (btnSkipIntro) btnSkipIntro.addEventListener('click', function () { switchStage('3d'); });

  // ============================================================
  // STAGE 2: THREE.JS 3D SCENE & 2D FALLBACK
  // ============================================================
  var threeInitialized = false;
  var threeScene, threeCamera, threeRenderer;
  var goldBars = [];
  var particleField;
  var raycaster, mouseVec;
  var hoveredBar = null;

  var hoverCard3D = document.getElementById('hover-card-3d');
  var hoverCardTitle = document.getElementById('hover-card-title');
  var hoverCardRaw = document.getElementById('hover-card-raw');
  var hoverCardPure = document.getElementById('hover-card-pure');
  var normalizeBanner = document.getElementById('normalize-banner');
  var btnNormalizeBars = document.getElementById('btn-normalize-bars');
  var btnOpenPitch = document.getElementById('btn-open-pitch');

  function initThreeScene() {
    if (threeInitialized) return;

    // Check if Three.js is loaded and WebGL is available
    if (typeof window.THREE === 'undefined') {
      show2DFallback();
      return;
    }

    var canvas = document.getElementById('three-canvas');
    var container = document.getElementById('three-canvas-container');

    try {
      threeScene = new THREE.Scene();
      threeCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
      threeCamera.position.set(0, 1.8, 8.5);

      threeRenderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
      });
      threeRenderer.setSize(window.innerWidth, window.innerHeight);
      threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Lighting
      var ambient = new THREE.AmbientLight(0x18232F, 1.4);
      threeScene.add(ambient);

      var keyLight = new THREE.DirectionalLight(0xFFE5A3, 1.5);
      keyLight.position.set(5, 8, 5);
      threeScene.add(keyLight);

      var fillLight = new THREE.DirectionalLight(0x7090B0, 0.6);
      fillLight.position.set(-5, -2, -3);
      threeScene.add(fillLight);

      var pointLight = new THREE.PointLight(0xF2A93B, 2.0, 15);
      pointLight.position.set(0, 2, 3);
      threeScene.add(pointLight);

      // Gold Material
      function createGoldMaterial() {
        return new THREE.MeshStandardMaterial({
          color: 0xF2A93B,
          metalness: 0.88,
          roughness: 0.22,
          emissive: 0x241500,
          emissiveIntensity: 0.2
        });
      }

      // Bar Geometries based on lot sizes:
      // GOLDM (100g, largest), GOLDTEN (10g), GOLDGUINEA (8g), GOLDPETAL (1g, smallest)
      var barConfigs = [
        { key: 'GOLDM', size: [2.2, 0.65, 3.4], pos: [-3.4, 0.3, 0], rot: [0.35, -0.2, 0.1] },
        { key: 'GOLDTEN', size: [1.15, 0.38, 1.7], pos: [-1.15, -0.25, 0.3], rot: [0.3, 0.15, -0.05] },
        { key: 'GOLDGUINEA', size: [1.0, 0.34, 1.5], pos: [1.15, 0.25, 0.2], rot: [0.25, -0.15, 0.08] },
        { key: 'GOLDPETAL', size: [0.55, 0.22, 0.85], pos: [3.4, -0.35, 0.5], rot: [0.4, 0.25, -0.1] }
      ];

      barConfigs.forEach(function (cfg, idx) {
        var geom = new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]);
        var mat = createGoldMaterial();
        var mesh = new THREE.Mesh(geom, mat);

        mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        mesh.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);

        mesh.userData = {
          key: cfg.key,
          origPos: cfg.pos.slice(),
          origRot: cfg.rot.slice(),
          origSize: cfg.size.slice(),
          normPos: [-3.3 + idx * 2.2, 0, 0],
          normRot: [0.3, 0, 0],
          normScale: [
            1.2 / cfg.size[0],
            0.36 / cfg.size[1],
            1.8 / cfg.size[2]
          ],
          animProgress: 0
        };

        threeScene.add(mesh);
        goldBars.push(mesh);
      });

      // Subtle Particle Field (Golden Dust)
      var particleCount = 280;
      var pGeom = new THREE.BufferGeometry();
      var pPositions = new Float32Array(particleCount * 3);

      for (var i = 0; i < particleCount * 3; i += 3) {
        pPositions[i] = (Math.random() - 0.5) * 16;
        pPositions[i + 1] = (Math.random() - 0.5) * 10;
        pPositions[i + 2] = (Math.random() - 0.5) * 12;
      }

      pGeom.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
      var pMat = new THREE.PointsMaterial({
        color: 0xF2A93B,
        size: 0.04,
        transparent: true,
        opacity: 0.6
      });
      particleField = new THREE.Points(pGeom, pMat);
      threeScene.add(particleField);

      // Raycaster & Mouse setup
      raycaster = new THREE.Raycaster();
      mouseVec = new THREE.Vector2();

      function onPointerMove3D(e) {
        var x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        var y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        mouseVec.x = (x / window.innerWidth) * 2 - 1;
        mouseVec.y = -(y / window.innerHeight) * 2 + 1;
      }

      window.addEventListener('mousemove', onPointerMove3D, { passive: true });
      window.addEventListener('touchmove', onPointerMove3D, { passive: true });

      // Window resize
      window.addEventListener('resize', function () {
        if (!threeRenderer || !threeCamera) return;
        threeCamera.aspect = window.innerWidth / window.innerHeight;
        threeCamera.updateProjectionMatrix();
        threeRenderer.setSize(window.innerWidth, window.innerHeight);
      });

      threeInitialized = true;
      requestAnimationFrame(renderThree);

    } catch (err) {
      console.warn('Three.js / WebGL initialization error:', err);
      show2DFallback();
    }
  }

  function show2DFallback() {
    var fallback = document.getElementById('fallback-2d-view');
    var canvasWrap = document.getElementById('three-canvas-container');
    if (canvasWrap) canvasWrap.style.display = 'none';
    if (fallback) fallback.style.display = 'flex';
  }

  var clock = { prevTime: performance.now() };

  function renderThree(now) {
    if (state.currentStage !== '3d' && state.currentStage !== 'intro') {
      requestAnimationFrame(renderThree);
      return;
    }

    var delta = (now - clock.prevTime) / 1000;
    clock.prevTime = now;

    // Subtle Particle drift
    if (particleField && !prefersReducedMotion) {
      particleField.rotation.y += 0.0008;
      particleField.rotation.x += 0.0004;
    }

    // Camera parallax drift
    if (!prefersReducedMotion && threeCamera) {
      var targetCamX = mouseVec.x * 0.45;
      var targetCamY = 1.8 + mouseVec.y * 0.3;
      threeCamera.position.x += (targetCamX - threeCamera.position.x) * 0.05;
      threeCamera.position.y += (targetCamY - threeCamera.position.y) * 0.05;
      threeCamera.lookAt(0, 0, 0);
    }

    // Animate bars
    goldBars.forEach(function (bar, idx) {
      var ud = bar.userData;

      if (state.isNormalized3D) {
        // Interpolate to normalized state
        ud.animProgress = Math.min(1, ud.animProgress + delta * 1.5);
        var t = ud.animProgress;
        var ease = t * (2 - t); // easeOut

        bar.position.x = ud.origPos[0] + (ud.normPos[0] - ud.origPos[0]) * ease;
        bar.position.y = ud.origPos[1] + (ud.normPos[1] - ud.origPos[1]) * ease;
        bar.position.z = ud.origPos[2] + (ud.normPos[2] - ud.origPos[2]) * ease;

        bar.rotation.x = ud.origRot[0] + (ud.normRot[0] - ud.origRot[0]) * ease;
        bar.rotation.y = ud.origRot[1] + (ud.normRot[1] - ud.origRot[1]) * ease;
        bar.rotation.z = ud.origRot[2] + (ud.normRot[2] - ud.origRot[2]) * ease;

        bar.scale.x = 1 + (ud.normScale[0] - 1) * ease;
        bar.scale.y = 1 + (ud.normScale[1] - 1) * ease;
        bar.scale.z = 1 + (ud.normScale[2] - 1) * ease;
      } else if (!prefersReducedMotion) {
        // Idle gentle float and rotation
        bar.rotation.y += 0.004;
        bar.position.y = ud.origPos[1] + Math.sin(now * 0.0015 + idx) * 0.08;
      }
    });

    // Raycast hover check
    if (raycaster && threeCamera) {
      raycaster.setFromCamera(mouseVec, threeCamera);
      var intersects = raycaster.intersectObjects(goldBars);

      if (intersects.length > 0) {
        var hitBar = intersects[0].object;
        if (hoveredBar !== hitBar) {
          if (hoveredBar) hoveredBar.material.emissiveIntensity = 0.2;
          hoveredBar = hitBar;
          hoveredBar.material.emissiveIntensity = 0.55;

          var cData = contractData[hoveredBar.userData.key];
          if (cData) {
            hoverCardTitle.textContent = cData.name;
            hoverCardRaw.textContent = cData.raw;
            hoverCardPure.textContent = cData.pure;
            hoverCard3D.classList.add('visible');
          }
        }

        // Position card near pointer
        hoverCard3D.style.left = state.pointer.x + 'px';
        hoverCard3D.style.top = state.pointer.y + 'px';
      } else {
        if (hoveredBar) {
          hoveredBar.material.emissiveIntensity = 0.2;
          hoveredBar = null;
        }
        hoverCard3D.classList.remove('visible');
      }
    }

    threeRenderer.render(threeScene, threeCamera);
    requestAnimationFrame(renderThree);
  }

  // Button "Normalize"
  if (btnNormalizeBars) {
    btnNormalizeBars.addEventListener('click', function () {
      state.isNormalized3D = true;
      normalizeBanner.classList.add('visible');

      var fallbackGrid = document.getElementById('fallback-grid');
      if (fallbackGrid) fallbackGrid.classList.add('normalized');

      var stage2GoldieText = document.getElementById('stage2-goldie-text');
      if (stage2GoldieText) {
        stage2GoldieText.textContent = "Same gold. The gap is small. Does it survive costs?";
      }

      btnNormalizeBars.classList.add('active');
    });
  }

  // Button "Open the pitch"
  if (btnOpenPitch) {
    btnOpenPitch.addEventListener('click', function () {
      if (prefersReducedMotion || !threeCamera) {
        switchStage('pitch');
      } else {
        // Smooth camera fly-through into pitch
        var startZ = threeCamera.position.z;
        var startY = threeCamera.position.y;
        var startTime = performance.now();
        var duration = 650;

        function flyCamera(tNow) {
          var progress = Math.min(1, (tNow - startTime) / duration);
          var ease = progress * progress * progress; // easeInCubic
          threeCamera.position.z = startZ + (0.5 - startZ) * ease;
          threeCamera.position.y = startY + (0.2 - startY) * ease;

          if (progress < 1) {
            requestAnimationFrame(flyCamera);
          } else {
            switchStage('pitch');
            threeCamera.position.set(0, 1.8, 8.5);
          }
        }
        requestAnimationFrame(flyCamera);
      }
    });
  }

  // ============================================================
  // STAGE 3: THE PITCH DECK (8 SLIDES)
  // ============================================================
  var slideCounter = document.getElementById('slide-counter');
  var pitchProgress = document.getElementById('pitch-progress');
  var slideDotsWrap = document.getElementById('slide-dots');
  var mascotSlideTip = document.getElementById('mascot-slide-tip');
  var mascotWaveArm = document.getElementById('mascot-wave-arm');
  var speakerNotesPanel = document.getElementById('speaker-notes-panel');
  var notesContent = document.getElementById('notes-content');
  var pitchMascotCompanion = document.getElementById('pitch-mascot-companion');

  var btnPrevSlide = document.getElementById('btn-prev-slide');
  var btnNextSlide = document.getElementById('btn-next-slide');
  var btnBack3D = document.getElementById('btn-back-3d');
  var btnToggleNotes = document.getElementById('btn-toggle-notes');
  var btnCloseNotes = document.getElementById('btn-close-notes');
  var btnToggleMascot = document.getElementById('btn-toggle-mascot');
  var btnFullscreen = document.getElementById('btn-fullscreen');

  function goToSlide(slideNum) {
    if (slideNum < 1 || slideNum > state.totalSlides) return;
    var prevSlideNum = state.currentSlide;
    state.currentSlide = slideNum;

    // Update slides visibility & 3D classes
    for (var i = 1; i <= state.totalSlides; i++) {
      var slideEl = document.getElementById('slide-' + i);
      if (!slideEl) continue;
      slideEl.classList.remove('active', 'prev');
      if (i === slideNum) {
        slideEl.classList.add('active');
      } else if (i < slideNum) {
        slideEl.classList.add('prev');
      }
    }

    // Progress bar
    if (pitchProgress) {
      pitchProgress.style.width = ((slideNum / state.totalSlides) * 100) + '%';
    }

    // Counter
    if (slideCounter) {
      slideCounter.textContent = slideNum + ' / ' + state.totalSlides;
    }

    // Nav Dots
    if (slideDotsWrap) {
      var dots = slideDotsWrap.querySelectorAll('.slide-dot');
      dots.forEach(function (d, idx) {
        d.classList.toggle('active', idx + 1 === slideNum);
      });
    }

    // Goldie mascot tip
    if (mascotSlideTip && mascotSlideTips[slideNum]) {
      mascotSlideTip.textContent = mascotSlideTips[slideNum];
    }

    // Slide 8 mascot waving arm
    if (mascotWaveArm) {
      if (slideNum === 8) {
        mascotWaveArm.style.display = 'block';
        var mStage3 = document.getElementById('mascot-stage3');
        if (mStage3) mStage3.classList.add('goldie-waving');
      } else {
        mascotWaveArm.style.display = 'none';
        var mStage3 = document.getElementById('mascot-stage3');
        if (mStage3) mStage3.classList.remove('goldie-waving');
      }
    }

    // Update Speaker Notes Content
    if (notesContent && speakerNotes[slideNum]) {
      notesContent.textContent = speakerNotes[slideNum];
    }

    // Trigger Slide 6 number count-up animation
    if (slideNum === 6) {
      animateSlide6Counters();
    }

    registerPupils();
  }

  // Slide 6 Number Counter Animation
  function animateSlide6Counters() {
    var targets = document.querySelectorAll('#slide-6 .counter-target');
    targets.forEach(function (el) {
      var targetVal = parseFloat(el.getAttribute('data-value'));
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var isIndian = el.getAttribute('data-format') === 'in';

      var startTime = performance.now();
      var duration = prefersReducedMotion ? 1 : 1200;

      function updateCounter(now) {
        var elapsed = now - startTime;
        var progress = Math.min(1, elapsed / duration);
        var ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        var current = targetVal * ease;

        var formatted;
        if (isIndian) {
          formatted = formatIndian(Math.abs(Math.round(current)));
        } else if (decimals > 0) {
          formatted = current.toFixed(decimals);
        } else {
          formatted = Math.round(current).toString();
        }

        el.textContent = prefix + formatted + suffix;

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          if (isIndian) {
            el.textContent = prefix + formatIndian(Math.abs(targetVal)) + suffix;
          } else if (decimals > 0) {
            el.textContent = prefix + targetVal.toFixed(decimals) + suffix;
          } else {
            el.textContent = prefix + targetVal.toString() + suffix;
          }
        }
      }

      requestAnimationFrame(updateCounter);
    });
  }

  // Interactive Flip Cards in Slide 3 (Touch Support)
  var flipCards = document.querySelectorAll('.flip-card');
  flipCards.forEach(function (card) {
    card.addEventListener('click', function () {
      card.classList.toggle('flipped');
    });
  });

  // Slide dot click jump
  if (slideDotsWrap) {
    slideDotsWrap.addEventListener('click', function (e) {
      var dot = e.target.closest('.slide-dot');
      if (dot && dot.dataset.slide) {
        goToSlide(parseInt(dot.dataset.slide, 10));
      }
    });
  }

  // Prev / Next button listeners
  if (btnPrevSlide) {
    btnPrevSlide.addEventListener('click', function () {
      goToSlide(state.currentSlide - 1);
    });
  }

  if (btnNextSlide) {
    btnNextSlide.addEventListener('click', function () {
      goToSlide(state.currentSlide + 1);
    });
  }

  // Back to 3D View button
  if (btnBack3D) {
    btnBack3D.addEventListener('click', function () {
      switchStage('3d');
    });
  }

  // Speaker notes toggle
  function toggleNotes() {
    state.notesOpen = !state.notesOpen;
    if (speakerNotesPanel) {
      speakerNotesPanel.classList.toggle('visible', state.notesOpen);
    }
    if (btnToggleNotes) {
      btnToggleNotes.classList.toggle('active', state.notesOpen);
    }
  }

  if (btnToggleNotes) btnToggleNotes.addEventListener('click', toggleNotes);
  if (btnCloseNotes) btnCloseNotes.addEventListener('click', toggleNotes);

  // Mascot visibility toggle
  function toggleMascot() {
    state.mascotVisible = !state.mascotVisible;
    if (pitchMascotCompanion) {
      pitchMascotCompanion.classList.toggle('hidden-mascot', !state.mascotVisible);
    }
    if (btnToggleMascot) {
      btnToggleMascot.classList.toggle('active', !state.mascotVisible);
    }
  }

  if (btnToggleMascot) btnToggleMascot.addEventListener('click', toggleMascot);

  // Fullscreen toggle
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function (err) {
        console.warn('Fullscreen error:', err);
      });
      if (btnFullscreen) btnFullscreen.classList.add('active');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      if (btnFullscreen) btnFullscreen.classList.remove('active');
    }
  }

  if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

  document.addEventListener('fullscreenchange', function () {
    if (btnFullscreen) {
      btnFullscreen.classList.toggle('active', !!document.fullscreenElement);
    }
  });

  // ============================================================
  // GLOBAL KEYBOARD SHORTCUTS
  // ============================================================
  window.addEventListener('keydown', function (e) {
    // Ignore input events inside any form elements if present
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    var key = e.key;

    // Esc: Return to 3D view or close notes
    if (key === 'Escape') {
      if (state.notesOpen) {
        toggleNotes();
      } else if (state.currentStage === 'pitch') {
        switchStage('3d');
      }
      return;
    }

    // F: Fullscreen
    if (key === 'f' || key === 'F') {
      toggleFullscreen();
      return;
    }

    // N: Speaker notes
    if (key === 'n' || key === 'N') {
      toggleNotes();
      return;
    }

    // M: Toggle mascot
    if (key === 'm' || key === 'M') {
      toggleMascot();
      return;
    }

    // Number keys 1-8: jump directly to slide
    if (key >= '1' && key <= '8') {
      if (state.currentStage !== 'pitch') {
        switchStage('pitch');
      }
      goToSlide(parseInt(key, 10));
      return;
    }

    // Space / Arrow Right / Arrow Down: Advance
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      if (state.currentStage === 'intro') {
        handleIntroAdvance();
      } else if (state.currentStage === '3d') {
        switchStage('pitch');
      } else if (state.currentStage === 'pitch') {
        goToSlide(state.currentSlide + 1);
      }
      return;
    }

    // Arrow Left / Arrow Up: Previous
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      e.preventDefault();
      if (state.currentStage === 'pitch') {
        goToSlide(state.currentSlide - 1);
      }
      return;
    }
  });

  // ============================================================
  // INITIALIZATION ON DOM READY
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    registerPupils();
    animatePupils();
    scheduleBlink();
    typeIntroLine(0);
  });

})();
