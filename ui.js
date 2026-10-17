/**
 * Interactive UI Controller & Visualizer for Unbeatable Minimax Tic-Tac-Toe
 */

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  click() {
    this.playTone(600, 'sine', 0.08, 0.12);
  }

  aiThink() {
    this.playTone(320, 'triangle', 0.06, 0.08);
  }

  aiMove() {
    this.playTone(440, 'sine', 0.15, 0.15);
    setTimeout(() => this.playTone(554.37, 'sine', 0.15, 0.12), 80);
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.35, 0.15), i * 110);
    });
  }

  draw() {
    [440, 415.3, 392, 349.2].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.25, 0.12), i * 120);
    });
  }
}

class TicTacToeApp {
  constructor() {
    this.engine = new MinimaxEngine();
    this.sound = new SoundEffects();

    this.board = Array(9).fill(null);
    this.history = []; // stack of board states for undo
    this.humanPlayer = 'X';
    this.aiPlayer = 'O';
    this.currentTurn = 'X';
    this.isGameOver = false;
    this.isAiThinking = false;

    // Stats
    this.scores = {
      human: 0,
      ai: 0,
      ties: 0
    };

    // Settings
    this.showHeatmap = true;
    this.stepByStep = true;
    this.simulationSpeed = 350; // ms per step
    this.currentTurnId = 0;

    this.initDOM();
    this.bindEvents();
    this.startNewGame();
  }

  initDOM() {
    this.boardElement = document.getElementById('boardGrid');
    this.cells = Array.from(document.querySelectorAll('.cell'));
    this.statusBanner = document.getElementById('statusBanner');
    this.statusText = document.getElementById('statusText');
    this.statusDot = document.querySelector('.status-dot');
    this.strikeLine = document.getElementById('strikeLine');

    this.scoreHuman = document.getElementById('scoreHuman');
    this.scoreAi = document.getElementById('scoreAi');
    this.scoreTies = document.getElementById('scoreTies');

    this.streamText = document.getElementById('streamText');
    this.statNodes = document.getElementById('statNodes');
    this.statTime = document.getElementById('statTime');
    this.movesList = document.getElementById('movesList');
    this.treeSvg = document.getElementById('decisionTreeSvg');

    this.btnRestart = document.getElementById('btnRestart');
    this.btnUndo = document.getElementById('btnUndo');
    this.btnSound = document.getElementById('btnSound');
    this.chkHeatmap = document.getElementById('chkHeatmap');
    this.chkStepByStep = document.getElementById('chkStepByStep');
    this.selectPlayer = document.getElementById('selectPlayer');

    this.modalOverlay = document.getElementById('modalOverlay');
    this.modalIcon = document.getElementById('modalIcon');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalSubtitle = document.getElementById('modalSubtitle');
    this.btnModalRestart = document.getElementById('btnModalRestart');
  }

  bindEvents() {
    this.cells.forEach(cell => {
      const idx = parseInt(cell.dataset.index, 10);
      cell.addEventListener('click', () => this.handleCellClick(idx));
      cell.addEventListener('mouseenter', () => this.handleCellHover(idx));
      cell.addEventListener('mouseleave', () => this.handleCellLeave());
    });

    this.btnRestart.addEventListener('click', () => this.startNewGame());
    this.btnModalRestart.addEventListener('click', () => {
      this.closeModal();
      this.startNewGame();
    });

    this.btnUndo.addEventListener('click', () => this.undoMove());

    this.btnSound.addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      this.btnSound.innerHTML = this.sound.enabled ? '🔊 Sound On' : '🔇 Muted';
    });

    this.chkHeatmap.addEventListener('change', (e) => {
      this.showHeatmap = e.target.checked;
      this.updateHeatmapVisuals();
    });

    this.chkStepByStep.addEventListener('change', (e) => {
      this.stepByStep = e.target.checked;
    });

    this.selectPlayer.addEventListener('change', (e) => {
      this.humanPlayer = e.target.value;
      this.aiPlayer = this.humanPlayer === 'X' ? 'O' : 'X';
      document.getElementById('labelHumanSymbol').textContent = `(${this.humanPlayer})`;
      document.getElementById('labelAiSymbol').textContent = `(${this.aiPlayer})`;
      this.startNewGame();
    });
  }

  startNewGame() {
    this.currentTurnId++;
    this.board = Array(9).fill(null);
    this.history = [];
    this.currentTurn = 'X'; // X always moves first in standard rules
    this.isGameOver = false;
    this.isAiThinking = false;

    // Reset visual cells
    this.cells.forEach(cell => {
      cell.innerHTML = `
        <div class="cell-eval-badge"></div>
        <div class="best-badge">BEST</div>
      `;
      cell.className = 'cell';
    });

    this.hideStrikeLine();
    this.closeModal();
    this.updateControlsState();

    if (this.currentTurn === this.humanPlayer) {
      this.setStatus(`Your Turn (${this.humanPlayer})`, this.humanPlayer === 'X' ? '#00f2fe' : '#ff007f');
      this.logThought(`Waiting for player move... Minimax engine stands ready.`);
      this.refreshBoardEvaluations();
    } else {
      this.setStatus(`AI is calculating opening...`, '#ff007f');
      this.triggerAiTurn();
    }
  }

  setStatus(text, color = '#00f2fe') {
    this.statusText.textContent = text;
    this.statusDot.style.background = color;
    this.statusDot.style.boxShadow = `0 0 10px ${color}`;
  }

  logThought(text, typing = false) {
    this.streamText.textContent = text;
    if (typing) {
      this.streamText.classList.add('typing');
    } else {
      this.streamText.classList.remove('typing');
    }
  }

  async handleCellClick(index) {
    if (this.isGameOver || this.isAiThinking) return;
    if (this.currentTurn !== this.humanPlayer) return;
    if (this.board[index] !== null) return;

    this.sound.click();

    // Save history snapshot
    this.history.push([...this.board]);

    // Place Human mark
    this.placeMark(index, this.humanPlayer);

    const check = this.engine.checkWinner(this.board);
    if (check) {
      this.handleGameOver(check);
      return;
    }

    // Switch turn to AI
    this.currentTurn = this.aiPlayer;
    this.triggerAiTurn();
  }

  placeMark(index, player) {
    this.board[index] = player;
    const cell = this.cells[index];
    cell.classList.add('taken');

    // Create SVG mark
    const markDiv = document.createElement('div');
    markDiv.className = `cell-mark ${player === 'X' ? 'x-mark' : 'o-mark'}`;

    if (player === 'X') {
      markDiv.innerHTML = `
        <svg viewBox="0 0 100 100">
          <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" stroke-width="12" stroke-linecap="round" class="draw-path" />
          <line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" stroke-width="12" stroke-linecap="round" class="draw-path" style="animation-delay: 0.15s;" />
        </svg>
      `;
    } else {
      markDiv.innerHTML = `
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="35" stroke="currentColor" stroke-width="12" fill="none" class="draw-path" />
        </svg>
      `;
    }

    cell.appendChild(markDiv);
    this.updateControlsState();
  }

  async triggerAiTurn() {
    const turnId = ++this.currentTurnId;
    this.isAiThinking = true;
    this.setStatus(`AI (${this.aiPlayer}) evaluating game tree...`, '#ff007f');

    // Analyze board with Minimax
    const analysis = this.engine.analyzeBoard(this.board, this.aiPlayer, this.humanPlayer);

    if (!analysis || this.currentTurnId !== turnId) {
      this.isAiThinking = false;
      return;
    }

    // Update stats in UI
    this.statNodes.textContent = analysis.nodesEvaluated.toLocaleString();
    this.statTime.textContent = `${analysis.elapsedMs} ms`;

    // Render candidate moves matrix and decision tree
    this.renderMoveMatrix(analysis.allEvaluations, analysis.selected.move);
    this.renderDecisionTree(this.board);
    this.updateHeatmapVisuals(analysis.allEvaluations);

    if (this.stepByStep) {
      // Introspective Step-by-Step Visualization
      this.logThought(`Scanning ${analysis.allEvaluations.length} available branches...`, true);

      for (const evalItem of analysis.allEvaluations) {
        if (this.currentTurnId !== turnId) return;
        const cell = this.cells[evalItem.move];
        cell.classList.add('scanning');
        this.sound.aiThink();

        const [r, c] = [Math.floor(evalItem.move / 3), evalItem.move % 3];
        this.logThought(`Testing Pos (${r}, ${c}): Minimax score = ${evalItem.normalizedScore} | ${evalItem.outcomeLabel}`, true);

        await new Promise(r => setTimeout(r, this.simulationSpeed));
        cell.classList.remove('scanning');
      }

      if (this.currentTurnId !== turnId) return;

      // Highlight best choice
      const bestCell = this.cells[analysis.selected.move];
      bestCell.classList.add('best-choice-pulse');
      const [br, bc] = [Math.floor(analysis.selected.move / 3), analysis.selected.move % 3];
      this.logThought(`Chosen move: Pos (${br}, ${bc}) with score ${analysis.selected.normalizedScore} (${analysis.selected.outcomeLabel}).`, false);
      await new Promise(r => setTimeout(r, 200));
      bestCell.classList.remove('best-choice-pulse');
    } else {
      this.logThought(`Evaluated ${analysis.nodesEvaluated} states in ${analysis.elapsedMs}ms. Chosen move: ${analysis.selected.move} (Score: ${analysis.selected.normalizedScore})`, false);
    }

    if (this.currentTurnId !== turnId) return;

    // Place AI move
    this.sound.aiMove();
    this.placeMark(analysis.selected.move, this.aiPlayer);
    this.isAiThinking = false;

    // Check terminal
    const check = this.engine.checkWinner(this.board);
    if (check) {
      this.handleGameOver(check);
      return;
    }

    // Return to human turn
    this.currentTurn = this.humanPlayer;
    this.setStatus(`Your Turn (${this.humanPlayer})`, this.humanPlayer === 'X' ? '#00f2fe' : '#ff007f');
    this.refreshBoardEvaluations();
  }

  refreshBoardEvaluations() {
    if (this.isGameOver) return;
    const analysis = this.engine.analyzeBoard(this.board, this.aiPlayer, this.humanPlayer);
    if (analysis) {
      this.updateHeatmapVisuals(analysis.allEvaluations);
      this.renderMoveMatrix(analysis.allEvaluations, analysis.selected.move);
      this.renderDecisionTree(this.board);
    }
  }

  updateHeatmapVisuals(evals = null) {
    if (this.showHeatmap) {
      this.boardElement.classList.add('show-evals');
    } else {
      this.boardElement.classList.remove('show-evals');
    }

    if (!evals) {
      const analysis = this.engine.analyzeBoard(this.board, this.aiPlayer, this.humanPlayer);
      if (analysis) evals = analysis.allEvaluations;
    }

    if (!evals) return;

    const highestScore = Math.max(...evals.map(e => e.score));

    // Reset cell badges
    this.cells.forEach((cell, idx) => {
      const badge = cell.querySelector('.cell-eval-badge');
      if (!badge) return;

      const evalData = evals.find(e => e.move === idx);
      if (evalData && !this.board[idx]) {
        badge.textContent = evalData.normalizedScore;
        badge.className = 'cell-eval-badge ' + (
          evalData.score > 0 ? 'score-win' : evalData.score === 0 ? 'score-draw' : 'score-loss'
        );

        if (evalData.score === highestScore) {
          cell.classList.add('is-optimal');
        } else {
          cell.classList.remove('is-optimal');
        }
      } else {
        badge.textContent = '';
        cell.classList.remove('is-optimal');
      }
    });
  }

  renderMoveMatrix(evaluations, chosenMove) {
    this.movesList.innerHTML = '';

    evaluations.forEach(item => {
      const [row, col] = [Math.floor(item.move / 3), item.move % 3];
      const isChosen = item.move === chosenMove;

      const card = document.createElement('div');
      card.className = `move-card ${isChosen ? 'chosen' : ''}`;

      card.innerHTML = `
        <div class="move-card-left">
          <span class="move-coord">[${row}, ${col}]</span>
          <div class="move-desc">
            <span class="move-desc-title">${item.outcomeLabel}</span>
            <span class="move-desc-sub">${item.explanation}</span>
          </div>
        </div>
        <div class="move-card-right">
          <span class="score-pill ${item.outcomeType}">${item.normalizedScore}</span>
        </div>
      `;

      // Hover on card highlights that square on the board
      card.addEventListener('mouseenter', () => {
        this.cells[item.move].style.borderColor = 'var(--accent-cyan)';
        this.cells[item.move].style.boxShadow = '0 0 20px rgba(0, 242, 254, 0.4)';
      });
      card.addEventListener('mouseleave', () => {
        this.cells[item.move].style.borderColor = '';
        this.cells[item.move].style.boxShadow = '';
      });

      this.movesList.appendChild(card);
    });
  }

  renderDecisionTree(board) {
    const treeData = this.engine.generateDecisionTree(board, this.aiPlayer, this.humanPlayer, 2);
    if (!treeData || !treeData.children || treeData.children.length === 0) {
      this.treeSvg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="#64748b" font-size="12">Game Terminal</text>`;
      return;
    }

    const svgWidth = this.treeSvg.clientWidth || 380;
    const svgHeight = this.treeSvg.clientHeight || 180;

    let svgHtml = '';

    // Root Node (Current board)
    const rootX = svgWidth / 2;
    const rootY = 30;

    // Level 1 Nodes (AI candidate moves)
    const childCount = treeData.children.length;
    const spacing = svgWidth / (childCount + 1);

    treeData.children.forEach((child, i) => {
      const childX = spacing * (i + 1);
      const childY = 110;

      // Connecting line
      const strokeColor = child.score > 0 ? '#10b981' : child.score === 0 ? '#4facfe' : '#ef4444';
      svgHtml += `
        <path d="M ${rootX} ${rootY} Q ${(rootX + childX) / 2} ${(rootY + childY) / 2 - 10} ${childX} ${childY}"
              stroke="${strokeColor}" stroke-width="2" fill="none" opacity="0.6"/>
      `;

      // Child node circle
      const [r, c] = [Math.floor(child.move / 3), child.move % 3];
      svgHtml += `
        <g class="tree-node" transform="translate(${childX}, ${childY})">
          <circle r="14" fill="#12182b" stroke="${strokeColor}" stroke-width="2"/>
          <text text-anchor="middle" dy="4" fill="#f1f5f9" font-size="10" font-family="monospace">${child.move}</text>
          <text text-anchor="middle" dy="24" fill="${strokeColor}" font-size="9" font-weight="bold">${child.score > 0 ? '+' + child.score : child.score}</text>
        </g>
      `;

      // Draw top reply branch if available
      if (child.children && child.children.length > 0) {
        const reply = child.children[0];
        const replyX = childX;
        const replyY = 160;

        svgHtml += `
          <line x1="${childX}" y1="${childY + 14}" x2="${replyX}" y2="${replyY - 10}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="2,2"/>
          <circle cx="${replyX}" cy="${replyY}" r="6" fill="#1e293b" stroke="#94a3b8" stroke-width="1"/>
        `;
      }
    });

    // Draw Root
    svgHtml += `
      <g transform="translate(${rootX}, ${rootY})">
        <circle r="16" fill="#00f2fe" opacity="0.2"/>
        <circle r="12" fill="#070913" stroke="#00f2fe" stroke-width="2"/>
        <text text-anchor="middle" dy="4" fill="#00f2fe" font-size="10" font-weight="bold">AI</text>
      </g>
    `;

    this.treeSvg.innerHTML = svgHtml;
  }

  handleGameOver(result) {
    this.isGameOver = true;
    this.updateControlsState();

    if (result.winner === 'TIE') {
      this.scores.ties++;
      this.scoreTies.textContent = this.scores.ties;
      this.setStatus('Mathematical Equilibrium: Tie Game!', '#f59e0b');
      this.sound.draw();

      this.logThought('Game concluded with score 0: Optimal play by both sides produces an unavoidable tie.');

      setTimeout(() => {
        this.showModal('🤝', 'Mathematical Tie!', 'Neither player made a mistake. With pure Minimax reasoning, Tic-Tac-Toe is a proven draw.');
      }, 700);

    } else {
      const isAiWin = result.winner === this.aiPlayer;
      if (isAiWin) {
        this.scores.ai++;
        this.scoreAi.textContent = this.scores.ai;
        this.setStatus(`Game Over: AI Wins (${this.aiPlayer})!`, '#ff007f');
        this.sound.win();
        this.logThought(`Unbeatable Minimax achieved victory! Punished player deviation from optimal line.`);

        setTimeout(() => {
          this.showModal('👑', 'AI Wins!', 'The Minimax engine capitalized on a non-optimal move to guarantee victory.');
        }, 800);
      } else {
        // Human win (theoretically unreachable against optimal minimax)
        this.scores.human++;
        this.scoreHuman.textContent = this.scores.human;
        this.setStatus('Player Won!', '#00f2fe');
        this.showModal('🎉', 'Victory!', 'You somehow defeated the algorithm!');
      }

      this.drawStrikeLine(result.combo);
    }
  }

  drawStrikeLine(combo) {
    if (!combo) return;

    // Highlight winning cells
    combo.forEach(idx => this.cells[idx].classList.add('highlight-win'));

    // Compute coordinate positions of start and end cells
    const cellA = this.cells[combo[0]].getBoundingClientRect();
    const cellC = this.cells[combo[2]].getBoundingClientRect();
    const boardRect = this.boardElement.getBoundingClientRect();

    const startX = (cellA.left + cellA.width / 2) - boardRect.left;
    const startY = (cellA.top + cellA.height / 2) - boardRect.top;
    const endX = (cellC.left + cellC.width / 2) - boardRect.left;
    const endY = (cellC.top + cellC.height / 2) - boardRect.top;

    const length = Math.hypot(endX - startX, endY - startY);
    const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    this.strikeLine.style.width = `${length + 20}px`;
    this.strikeLine.style.height = `6px`;
    this.strikeLine.style.left = `${midX - (length + 20) / 2}px`;
    this.strikeLine.style.top = `${midY - 3}px`;
    this.strikeLine.style.transform = `rotate(${angle}deg)`;
    this.strikeLine.classList.add('visible');
  }

  hideStrikeLine() {
    this.strikeLine.classList.remove('visible');
    this.cells.forEach(c => c.classList.remove('highlight-win'));
  }

  showModal(icon, title, subtitle) {
    this.modalIcon.textContent = icon;
    this.modalTitle.textContent = title;
    this.modalSubtitle.textContent = subtitle;
    this.modalOverlay.classList.add('active');
  }

  closeModal() {
    this.modalOverlay.classList.remove('active');
  }

  undoMove() {
    if (this.history.length === 0 || this.isAiThinking) return;
    this.currentTurnId++;

    // Pop the previous state
    const previousState = this.history.pop();
    this.board = previousState;
    this.isGameOver = false;
    this.hideStrikeLine();
    this.closeModal();

    // Rebuild DOM
    this.cells.forEach((cell, i) => {
      cell.className = 'cell';
      cell.innerHTML = `
        <div class="cell-eval-badge"></div>
        <div class="best-badge">BEST</div>
      `;
      if (this.board[i]) {
        this.placeMark(i, this.board[i]);
      }
    });

    this.currentTurn = this.humanPlayer;
    this.setStatus(`Your Turn (${this.humanPlayer})`, this.humanPlayer === 'X' ? '#00f2fe' : '#ff007f');
    this.refreshBoardEvaluations();
    this.updateControlsState();
    this.logThought('Move undone. Restored prior board state.');
  }

  updateControlsState() {
    this.btnUndo.disabled = this.history.length === 0 || this.isAiThinking;
    this.btnUndo.style.opacity = this.history.length === 0 ? '0.5' : '1';
  }

  handleCellHover(index) {
    if (this.isGameOver || this.isAiThinking || this.board[index]) return;
    // Highlight projected score if available
  }

  handleCellLeave() {}
}

// Instantiate game on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TicTacToeApp();
});
