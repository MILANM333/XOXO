/**
 * NEURO-DIGIT • MNIST AI Number Recognition Game
 * Complete game controller, mouse drawing engine, and HUD synchronizer.
 */

class NeuroDigitGame {
  constructor() {
    this.engine = new MNISTEngine();
    this.sound = new SoundFX();

    // Canvas & Drawing State
    this.canvas = document.getElementById('draw-canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.visionCanvas = document.getElementById('vision-canvas');
    this.visionCtx = this.visionCanvas ? this.visionCanvas.getContext('2d') : null;

    this.isDrawing = false;
    this.brushSize = 22;
    this.isEraser = false;
    this.strokesHistory = [];
    this.currentStroke = [];

    // Game Mode State: 'speed', 'math', 'sandbox'
    this.mode = 'speed';
    this.score = 0;
    this.streak = 0;
    this.highScore = parseInt(localStorage.getItem('neuro_digit_high_score') || '0', 10);
    this.lives = 3;
    this.maxLives = 3;
    this.targetDigit = 7;
    this.mathEquation = "3 + 4";
    this.mathAnswer = 7;

    // Timer
    this.roundTime = 12.0;
    this.maxRoundTime = 12.0;
    this.timerInterval = null;
    this.isGameOver = false;

    // Animation / Particle effects
    this.particles = [];
    this.lastPredictTime = 0;
    this.matchedCurrentTarget = false;

    // Sample data cache
    this.sampleDigits = [];
  }

  async init() {
    this.setupCanvas();
    this.setupUIListeners();
    this.setupKeyboard();

    // Load AI Model Weights
    const loaded = await this.engine.init();
    const statusEl = document.getElementById('model-status');
    if (loaded && statusEl) {
      statusEl.innerHTML = `<span class="badge-dot green"></span> Neural Net Online (MNIST Test Acc: <strong>${this.engine.weights.accuracy || '98'}%</strong>)`;
    } else if (statusEl) {
      statusEl.innerHTML = `<span class="badge-dot yellow"></span> Model Loaded`;
    }

    // Load Sample Test Digits for Sandbox inspector
    this.loadSampleMNIST();

    // Start in Speed Draw mode
    this.startMode('speed');
    this.startAnimationLoop();
  }

  setupCanvas() {
    // Enable crisp high-DPI rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const size = 320;

    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.clearCanvas(false);

    // Mouse Listeners
    this.canvas.addEventListener('mousedown', (e) => this.onDrawStart(e));
    this.canvas.addEventListener('mousemove', (e) => this.onDrawMove(e));
    window.addEventListener('mouseup', () => this.onDrawEnd());

    // Touch Listeners (Mobile & Tablet)
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.onDrawStart(touch);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.onDrawMove(touch);
    }, { passive: false });

    window.addEventListener('touchend', () => this.onDrawEnd());
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  onDrawStart(e) {
    if (this.isGameOver) return;
    this.isDrawing = true;
    const pos = this.getCanvasPos(e);
    this.currentStroke = [{ x: pos.x, y: pos.y, size: this.brushSize, isEraser: this.isEraser }];

    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, this.brushSize / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = this.isEraser ? '#0e111a' : '#00f0ff';
    this.ctx.fill();

    this.sound.playStroke();
    this.evaluateNow();
  }

  onDrawMove(e) {
    if (!this.isDrawing || this.isGameOver) return;
    const pos = this.getCanvasPos(e);
    const last = this.currentStroke[this.currentStroke.length - 1];

    if (!last) return;

    this.currentStroke.push({ x: pos.x, y: pos.y, size: this.brushSize, isEraser: this.isEraser });

    this.ctx.beginPath();
    this.ctx.moveTo(last.x, last.y);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.strokeStyle = this.isEraser ? '#0e111a' : '#00f0ff';
    this.ctx.lineWidth = this.brushSize;
    this.ctx.stroke();

    // Throttle inference slightly during fast mouse drag for buttery 60 FPS
    const now = performance.now();
    if (now - this.lastPredictTime > 30) {
      this.evaluateNow();
      this.lastPredictTime = now;
    }
  }

  onDrawEnd() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.currentStroke.length > 0) {
      this.saveCanvasState();
      this.currentStroke = [];
    }
    this.evaluateNow();
  }

  saveCanvasState() {
    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.strokesHistory.push(imgData);
    if (this.strokesHistory.length > 20) {
      this.strokesHistory.shift();
    }
  }

  undo() {
    if (this.strokesHistory.length > 1) {
      this.strokesHistory.pop(); // Remove current state
      const prevState = this.strokesHistory[this.strokesHistory.length - 1];
      this.ctx.putImageData(prevState, 0, 0);
      this.sound.playClick();
      this.evaluateNow();
    } else if (this.strokesHistory.length === 1) {
      this.strokesHistory.pop();
      this.clearCanvas(false);
      this.sound.playClick();
      this.evaluateNow();
    }
  }

  clearCanvas(playSound = true) {
    this.ctx.fillStyle = '#0e111a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Subtle grid guide dots in background
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const step = 32;
    for (let x = step; x < this.canvas.width; x += step) {
      for (let y = step; y < this.canvas.height; y += step) {
        this.ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }

    this.strokesHistory = [];
    this.saveCanvasState();

    if (playSound) this.sound.playClear();
    this.resetHUD();
  }

  evaluateNow() {
    const { raw28, isEmpty } = this.engine.preprocessCanvas(this.canvas);

    // Render the 28x28 Preprocessed Vision preview
    this.renderVisionFeed(raw28, isEmpty);

    if (isEmpty) {
      this.resetHUD();
      return;
    }

    const res = this.engine.predict(raw28);
    this.updateHUD(res);

    // Check game condition
    this.checkGameProgress(res);
  }

  renderVisionFeed(raw28, isEmpty) {
    if (!this.visionCtx) return;
    const vW = this.visionCanvas.width;
    const vH = this.visionCanvas.height;
    const cellW = vW / 28;
    const cellH = vH / 28;

    this.visionCtx.fillStyle = '#080a10';
    this.visionCtx.fillRect(0, 0, vW, vH);

    if (isEmpty) {
      // Empty CRT scan line
      this.visionCtx.fillStyle = 'rgba(0, 240, 255, 0.1)';
      this.visionCtx.font = '10px monospace';
      this.visionCtx.textAlign = 'center';
      this.visionCtx.fillText('WAITING FOR INPUT', vW / 2, vH / 2 + 4);
      return;
    }

    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < 28; x++) {
        const val = raw28[y * 28 + x];
        if (val > 0.01) {
          // Glow intensity
          const alpha = Math.min(1.0, val * 1.2);
          this.visionCtx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
          this.visionCtx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
    }

    // Center crosshairs (14, 14)
    this.visionCtx.strokeStyle = 'rgba(255, 0, 85, 0.35)';
    this.visionCtx.lineWidth = 1;
    this.visionCtx.beginPath();
    this.visionCtx.moveTo(14 * cellW, 0);
    this.visionCtx.lineTo(14 * cellW, vH);
    this.visionCtx.moveTo(0, 14 * cellH);
    this.visionCtx.lineTo(vW, 14 * cellH);
    this.visionCtx.stroke();
  }

  updateHUD(res) {
    const { prediction, confidence, probabilities, top3, entropy, h1, h2 } = res;

    // Top Prediction Display
    const predEl = document.getElementById('top-digit');
    const confEl = document.getElementById('top-confidence');
    const certaintyBadge = document.getElementById('certainty-badge');

    if (predEl) predEl.textContent = prediction;
    if (confEl) confEl.textContent = `${(confidence * 100).toFixed(1)}%`;

    if (certaintyBadge) {
      if (confidence > 0.85) {
        certaintyBadge.className = 'status-pill confident';
        certaintyBadge.textContent = 'HIGH CONFIDENCE';
      } else if (confidence > 0.5) {
        certaintyBadge.className = 'status-pill moderate';
        certaintyBadge.textContent = 'MODERATE';
      } else {
        certaintyBadge.className = 'status-pill uncertain';
        certaintyBadge.textContent = 'HESITANT';
      }
    }

    // Top-3 Contenders
    const contendersEl = document.getElementById('top-contenders');
    if (contendersEl && top3) {
      contendersEl.innerHTML = top3.map((item, idx) => `
        <div class="contender-row ${idx === 0 ? 'leader' : ''}">
          <span class="rank">#${idx + 1}</span>
          <span class="digit-badge">${item.digit}</span>
          <div class="contender-bar">
            <div class="fill" style="width: ${(item.prob * 100).toFixed(0)}%"></div>
          </div>
          <span class="pct">${(item.prob * 100).toFixed(1)}%</span>
        </div>
      `).join('');
    }

    // 10-Digit Probability Bars (0 to 9)
    for (let d = 0; d < 10; d++) {
      const p = probabilities[d];
      const barFill = document.getElementById(`prob-bar-${d}`);
      const valText = document.getElementById(`prob-val-${d}`);
      const rowEl = document.getElementById(`prob-row-${d}`);

      if (barFill) barFill.style.width = `${Math.min(100, Math.max(1, p * 100))}%`;
      if (valText) valText.textContent = `${(p * 100).toFixed(0)}%`;

      if (rowEl) {
        if (d === prediction && confidence > 0.4) {
          rowEl.classList.add('active-winner');
        } else {
          rowEl.classList.remove('active-winner');
        }
      }
    }

    // Hidden Layers Visualizer (Subtle neon dot matrix)
    this.renderLayerActivations(h1, h2);
  }

  renderLayerActivations(h1, h2) {
    const l1Canvas = document.getElementById('layer1-canvas');
    const l2Canvas = document.getElementById('layer2-canvas');

    if (l1Canvas && h1) {
      const ctx1 = l1Canvas.getContext('2d');
      const w = l1Canvas.width;
      const h = l1Canvas.height;
      ctx1.clearRect(0, 0, w, h);
      // 128 neurons: 16 cols x 8 rows
      const cols = 16, rows = 8;
      const cw = w / cols, ch = h / rows;
      for (let i = 0; i < 128; i++) {
        const val = Math.min(1.0, h1[i] / 2.0);
        const col = i % cols;
        const row = Math.floor(i / cols);
        if (val > 0.05) {
          ctx1.fillStyle = `rgba(0, 240, 255, ${val})`;
          ctx1.fillRect(col * cw + 1, row * ch + 1, cw - 2, ch - 2);
        }
      }
    }

    if (l2Canvas && h2) {
      const ctx2 = l2Canvas.getContext('2d');
      const w = l2Canvas.width;
      const h = l2Canvas.height;
      ctx2.clearRect(0, 0, w, h);
      // 64 neurons: 8 cols x 8 rows
      const cols = 8, rows = 8;
      const cw = w / cols, ch = h / rows;
      for (let i = 0; i < 64; i++) {
        const val = Math.min(1.0, h2[i] / 2.0);
        const col = i % cols;
        const row = Math.floor(i / cols);
        if (val > 0.05) {
          ctx2.fillStyle = `rgba(255, 0, 85, ${val})`;
          ctx2.fillRect(col * cw + 1, row * ch + 1, cw - 2, ch - 2);
        }
      }
    }
  }

  resetHUD() {
    const predEl = document.getElementById('top-digit');
    const confEl = document.getElementById('top-confidence');
    const certaintyBadge = document.getElementById('certainty-badge');
    const contendersEl = document.getElementById('top-contenders');

    if (predEl) predEl.textContent = '-';
    if (confEl) confEl.textContent = '0.0%';
    if (certaintyBadge) {
      certaintyBadge.className = 'status-pill';
      certaintyBadge.textContent = 'AWAITING STROKE';
    }
    if (contendersEl) {
      contendersEl.innerHTML = '<div class="hint-text">Draw a digit above to begin AI inference</div>';
    }

    for (let d = 0; d < 10; d++) {
      const barFill = document.getElementById(`prob-bar-${d}`);
      const valText = document.getElementById(`prob-val-${d}`);
      const rowEl = document.getElementById(`prob-row-${d}`);
      if (barFill) barFill.style.width = '2%';
      if (valText) valText.textContent = '0%';
      if (rowEl) rowEl.classList.remove('active-winner');
    }
  }

  /* ------------------- GAME MODE LOGIC ------------------- */

  startMode(newMode) {
    this.mode = newMode;
    this.score = 0;
    this.streak = 0;
    this.lives = this.maxLives;
    this.isGameOver = false;
    this.matchedCurrentTarget = false;

    // Update Tab styling
    document.querySelectorAll('.mode-tab').forEach(tab => {
      if (tab.dataset.mode === newMode) tab.classList.add('active');
      else tab.classList.remove('active');
    });

    const targetSection = document.getElementById('target-card');
    const mathSection = document.getElementById('math-card');
    const timerBar = document.getElementById('timer-container');

    if (newMode === 'speed') {
      if (targetSection) targetSection.style.display = 'flex';
      if (mathSection) mathSection.style.display = 'none';
      if (timerBar) timerBar.style.display = 'block';
      this.nextSpeedTarget();
      this.startTimer();
    } else if (newMode === 'math') {
      if (targetSection) targetSection.style.display = 'none';
      if (mathSection) mathSection.style.display = 'flex';
      if (timerBar) timerBar.style.display = 'block';
      this.nextMathTarget();
      this.startTimer();
    } else {
      // Sandbox mode
      if (targetSection) targetSection.style.display = 'none';
      if (mathSection) mathSection.style.display = 'none';
      if (timerBar) timerBar.style.display = 'none';
      this.stopTimer();
    }

    this.updateStatsUI();
    this.clearCanvas(false);
  }

  nextSpeedTarget() {
    // Generate next target digit (ensure different from previous)
    let next;
    do {
      next = Math.floor(Math.random() * 10);
    } while (next === this.targetDigit);

    this.targetDigit = next;
    this.matchedCurrentTarget = false;
    this.roundTime = this.maxRoundTime;

    const el = document.getElementById('target-digit-display');
    if (el) {
      el.textContent = this.targetDigit;
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 400);
    }
  }

  nextMathTarget() {
    // Generate single-digit answer math problem
    const operations = ['+', '-', '*'];
    const op = operations[Math.floor(Math.random() * operations.length)];
    let a, b, ans, eq;

    if (op === '+') {
      ans = Math.floor(Math.random() * 10);
      a = Math.floor(Math.random() * (ans + 1));
      b = ans - a;
      eq = `${a} + ${b}`;
    } else if (op === '-') {
      ans = Math.floor(Math.random() * 10);
      b = Math.floor(Math.random() * 10);
      a = ans + b;
      eq = `${a} - ${b}`;
    } else {
      // Multiplication resulting in single digit 0..9
      const validPairs = [
        [0, 5, 0], [1, 7, 7], [2, 3, 6], [2, 4, 8], [3, 3, 9],
        [4, 2, 8], [1, 9, 9], [2, 2, 4], [3, 2, 6], [1, 5, 5]
      ];
      const pick = validPairs[Math.floor(Math.random() * validPairs.length)];
      a = pick[0];
      b = pick[1];
      ans = pick[2];
      eq = `${a} × ${b}`;
    }

    this.mathEquation = eq;
    this.mathAnswer = ans;
    this.matchedCurrentTarget = false;
    this.roundTime = this.maxRoundTime;

    const eqEl = document.getElementById('math-equation-display');
    if (eqEl) {
      eqEl.textContent = `${eq} = ?`;
      eqEl.classList.add('pulse');
      setTimeout(() => eqEl.classList.remove('pulse'), 400);
    }
  }

  checkGameProgress(res) {
    if (this.isGameOver) return;
    const requiredTarget = (this.mode === 'speed') ? this.targetDigit : this.mathAnswer;

    if (this.mode === 'sandbox') return;

    // AI must recognize the target digit with confidence >= 72%
    if (!this.matchedCurrentTarget && res.prediction === requiredTarget && res.confidence >= 0.72) {
      this.matchedCurrentTarget = true;
      this.onTargetSuccess();
    }
  }

  onTargetSuccess() {
    this.streak++;
    const comboMultiplier = Math.min(5, Math.max(1, Math.floor(this.streak / 2) + 1));
    const timeBonus = Math.round(this.roundTime * 15);
    const addedScore = (100 * comboMultiplier) + timeBonus;
    this.score += addedScore;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('neuro_digit_high_score', this.highScore.toString());
    }

    // Audio & Visual celebratory fanfare
    this.sound.playSuccess(comboMultiplier);
    this.spawnConfetti();

    // Trigger Success Banner flash
    this.flashSuccessEffect(comboMultiplier, addedScore);
    this.updateStatsUI();

    // Brief delay then auto clear and load next challenge
    setTimeout(() => {
      if (!this.isGameOver) {
        this.clearCanvas(false);
        if (this.mode === 'speed') {
          this.nextSpeedTarget();
        } else if (this.mode === 'math') {
          this.nextMathTarget();
        }
      }
    }, 600);
  }

  startTimer() {
    this.stopTimer();
    const timerFill = document.getElementById('timer-fill');
    const timerText = document.getElementById('timer-text');

    this.timerInterval = setInterval(() => {
      if (this.isGameOver) return;

      this.roundTime -= 0.1;
      const pct = Math.max(0, (this.roundTime / this.maxRoundTime) * 100);

      if (timerFill) {
        timerFill.style.width = `${pct}%`;
        if (this.roundTime < 3.5) {
          timerFill.classList.add('urgent');
        } else {
          timerFill.classList.remove('urgent');
        }
      }

      if (timerText) timerText.textContent = `${Math.max(0, this.roundTime).toFixed(1)}s`;

      // Tick sound on last 3 seconds
      if (this.roundTime <= 3.0 && Math.abs((this.roundTime * 10) % 10) < 0.5) {
        this.sound.playTick(true);
      }

      if (this.roundTime <= 0) {
        this.onRoundTimeout();
      }
    }, 100);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  onRoundTimeout() {
    this.lives--;
    this.streak = 0;
    this.updateStatsUI();

    if (this.lives <= 0) {
      this.triggerGameOver();
    } else {
      // Lose life warning chime
      this.sound.playTick(true);
      this.clearCanvas(false);
      if (this.mode === 'speed') this.nextSpeedTarget();
      else if (this.mode === 'math') this.nextMathTarget();
    }
  }

  triggerGameOver() {
    this.isGameOver = true;
    this.stopTimer();
    this.sound.playGameOver();

    const modal = document.getElementById('game-over-modal');
    const finalScoreEl = document.getElementById('modal-final-score');
    const finalStreakEl = document.getElementById('modal-final-streak');

    if (finalScoreEl) finalScoreEl.textContent = this.score;
    if (finalStreakEl) finalStreakEl.textContent = this.streak;
    if (modal) modal.classList.add('active');
  }

  restartGame() {
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.remove('active');
    this.startMode(this.mode);
  }

  updateStatsUI() {
    const scoreEl = document.getElementById('score-value');
    const streakEl = document.getElementById('streak-value');
    const highEl = document.getElementById('high-score-value');
    const livesEl = document.getElementById('lives-container');

    if (scoreEl) scoreEl.textContent = this.score;
    if (streakEl) streakEl.textContent = `${this.streak}x`;
    if (highEl) highEl.textContent = this.highScore;

    if (livesEl) {
      livesEl.innerHTML = Array(this.maxLives).fill(0).map((_, i) => `
        <span class="heart ${i < this.lives ? 'active' : 'lost'}">❤</span>
      `).join('');
    }
  }

  flashSuccessEffect(combo, addedScore) {
    const banner = document.getElementById('match-banner');
    if (!banner) return;
    banner.innerHTML = `
      <div class="banner-content">
        <span class="combo-tag">${combo > 1 ? combo + 'X MULTIPLIER!' : 'TARGET HIT!'}</span>
        <span class="score-tag">+${addedScore}</span>
      </div>
    `;
    banner.classList.add('active');
    setTimeout(() => banner.classList.remove('active'), 500);
  }

  spawnConfetti() {
    for (let i = 0; i < 28; i++) {
      this.particles.push({
        x: this.canvas.width / 2 + (Math.random() - 0.5) * 80,
        y: this.canvas.height / 2 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12 - 3,
        color: ['#00f0ff', '#00ff88', '#ff0055', '#ffbe00'][Math.floor(Math.random() * 4)],
        size: Math.random() * 6 + 3,
        alpha: 1.0,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  }

  startAnimationLoop() {
    const loop = () => {
      if (this.particles.length > 0) {
        // Redraw canvas state to overlay particles
        this.ctx.save();
        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.25; // gravity
          p.alpha -= p.decay;

          if (p.alpha <= 0) {
            this.particles.splice(i, 1);
          } else {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
          }
        }
        this.ctx.restore();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ------------------- SAMPLE DIGITS (SANDBOX) ------------------- */

  loadSampleMNIST() {
    // Generate synthetic vector archetypes for digits 0-9
    // so user can click "Test 0", "Test 7" in sandbox!
    this.sampleTemplates = {
      0: [[160, 80], [100, 160], [160, 240], [220, 160], [160, 80]],
      1: [[140, 100], [160, 80], [160, 240], [120, 240], [200, 240]],
      2: [[110, 110], [160, 80], [210, 120], [110, 240], [210, 240]],
      3: [[110, 90], [210, 90], [160, 150], [210, 180], [120, 240]],
      4: [[180, 240], [180, 80], [100, 190], [220, 190]],
      5: [[200, 90], [120, 90], [115, 150], [200, 165], [180, 240], [110, 230]],
      6: [[200, 90], [120, 170], [120, 230], [200, 230], [200, 170], [120, 170]],
      7: [[100, 90], [220, 90], [140, 240]],
      8: [[160, 150], [120, 110], [160, 80], [200, 110], [160, 150], [110, 195], [160, 240], [210, 195], [160, 150]],
      9: [[160, 150], [200, 150], [200, 90], [120, 90], [120, 150], [200, 150], [180, 240]]
    };
  }

  drawTemplate(digit) {
    const pts = this.sampleTemplates[digit];
    if (!pts) return;

    this.clearCanvas(false);
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = this.brushSize;
    this.ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      this.ctx.lineTo(pts[i][0], pts[i][1]);
    }
    this.ctx.stroke();

    this.saveCanvasState();
    this.evaluateNow();
    this.sound.playClick();
  }

  /* ------------------- UI LISTENERS & KEYBOARD ------------------- */

  setupUIListeners() {
    // Mode switcher buttons
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.sound.playClick();
        this.startMode(tab.dataset.mode);
      });
    });

    // Clear Canvas button
    const clearBtn = document.getElementById('btn-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearCanvas(true);
      });
    }

    // Undo button
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        this.undo();
      });
    }

    // Brush Tool buttons
    const penBtn = document.getElementById('tool-pen');
    const eraserBtn = document.getElementById('tool-eraser');

    if (penBtn) {
      penBtn.addEventListener('click', () => {
        this.isEraser = false;
        penBtn.classList.add('active');
        if (eraserBtn) eraserBtn.classList.remove('active');
        this.sound.playClick();
      });
    }

    if (eraserBtn) {
      eraserBtn.addEventListener('click', () => {
        this.isEraser = true;
        eraserBtn.classList.add('active');
        if (penBtn) penBtn.classList.remove('active');
        this.sound.playClick();
      });
    }

    // Brush Size buttons
    document.querySelectorAll('.brush-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.brushSize = parseInt(btn.dataset.size, 10);
        this.sound.playClick();
      });
    });

    // Sound toggle
    const soundBtn = document.getElementById('btn-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = this.sound.toggleMute();
        soundBtn.innerHTML = isMuted ? '🔇 Audio Off' : '🔊 Audio On';
        soundBtn.classList.toggle('muted', isMuted);
      });
    }

    // Play Again button on game over modal
    const playAgainBtn = document.getElementById('btn-play-again');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        this.restartGame();
      });
    }

    // Sandbox sample preset buttons 0-9
    const sampleContainer = document.getElementById('sample-buttons');
    if (sampleContainer) {
      sampleContainer.innerHTML = Array(10).fill(0).map((_, d) => `
        <button class="sample-btn" data-digit="${d}">${d}</button>
      `).join('');

      sampleContainer.querySelectorAll('.sample-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const d = parseInt(btn.dataset.digit, 10);
          this.drawTemplate(d);
        });
      });
    }
  }

  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'c' || e.key === 'C' || e.key === ' ') {
        e.preventDefault();
        this.clearCanvas(true);
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        this.undo();
      } else if (e.key === 'e' || e.key === 'E') {
        const eraserBtn = document.getElementById('tool-eraser');
        const penBtn = document.getElementById('tool-pen');
        this.isEraser = !this.isEraser;
        if (this.isEraser) {
          if (eraserBtn) eraserBtn.classList.add('active');
          if (penBtn) penBtn.classList.remove('active');
        } else {
          if (penBtn) penBtn.classList.add('active');
          if (eraserBtn) eraserBtn.classList.remove('active');
        }
      } else if (e.key === 'm' || e.key === 'M') {
        const soundBtn = document.getElementById('btn-sound');
        if (soundBtn) soundBtn.click();
      } else if (e.key >= '0' && e.key <= '9') {
        if (this.mode === 'sandbox') {
          this.drawTemplate(parseInt(e.key, 10));
        }
      }
    });
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.game = new NeuroDigitGame();
  window.game.init();
});
