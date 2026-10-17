# ✕○ Unbeatable Minimax Tic-Tac-Toe with Visual AI HUD

An interactive, visually stunning Tic-Tac-Toe game powered by a pure, rule-based **Minimax** algorithm with full game-tree introspection.

---

## 🌟 Key Features

1. **Mathematically Unbeatable AI**:
   - Zero-sum game-theoretic Minimax implementation with alpha-beta pruning.
   - Evaluates all possible terminal states and depth-penalizes delayed outcomes.
   - Under perfect play from both sides, every game ends in a **Tie**. Any non-optimal move by the player is immediately exploited by the AI to secure a **Win**.

2. **Minimax Brain HUD & Live Thought Stream**:
   - **Candidate Move Matrix**: Lists every legal square `[row, col]` with its backpropagated Minimax score (`+10` Win, `0` Draw, `-10` Loss) and tactical rationale.
   - **Minimax Search Tree**: Interactive SVG visualization of the decision tree showing candidate branches and projected counter-moves.
   - **Live Reasoning Stream**: Real-time console explaining the AI's step-by-step mathematical reasoning.
   - **Heatmap / "AI Vision"**: Real-time evaluation badges and optimal choice highlights directly on the 3×3 game board.
   - **Simulate Thinking (Step-by-Step)**: Watch the AI scan each branch before executing its decision.

3. **High-End Cyberpunk / Glassmorphic GUI**:
   - Dark neon aesthetic with glowing SVG-drawn X and O animations.
   - Dynamic laser strike-through line on winning combinations.
   - Synthesized sci-fi audio effects via the Web Audio API (zero external audio files).
   - Side selector (play as X or O), Undo Move functionality, and equilibrium statistics.

4. **Dual Platform Support**:
   - **Modern Web App** (`index.html`): Open in any web browser.
   - **Native Python Desktop App** (`desktop_app.py`): Pure Python Tkinter GUI.

---

## 🚀 How to Run

### Option 1: Web GUI (Recommended)

Simply run the launcher with Python:
```bash
python app.py
```
*This starts a local server and automatically opens `http://localhost:8080` in your default browser.*

Or simply double-click [index.html](file:///c:/Users/milan/Documents/antigravity/busy-babbage/index.html) to run it directly without any server!

### Option 2: Native Python Desktop GUI (Tkinter)

Run the desktop version using:
```bash
python app.py --desktop
```
or:
```bash
python desktop_app.py
```

---

## 🧠 How the Minimax Algorithm Works

Minimax is a recursive backtracking algorithm used in two-player, zero-sum, perfect-information games.

### 1. The Utility Function
Each terminal game state is scored relative to the AI:
- **AI Wins**: `+10 - depth` (maximizes speed of victory)
- **Player Wins**: `depth - 10` (maximizes resistance to defeat)
- **Draw**: `0`

### 2. Zero-Sum Equilibrium
- On **AI's turn (Maximizing)**, the algorithm selects the move that yields:
  $$\max_{m \in \text{Moves}} \text{Minimax}(m)$$
- On **Player's turn (Minimizing)**, the algorithm assumes the opponent plays optimally, selecting:
  $$\min_{m \in \text{Moves}} \text{Minimax}(m)$$

Because Tic-Tac-Toe has a finite state space ($\le 9! = 362,880$ total paths, with only 5,478 distinct valid game states), Minimax searches the complete game tree. Starting from an empty board, the minimax value is $0$. Therefore, **the AI can never lose**.
