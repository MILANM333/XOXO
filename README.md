# 🕹️ AI ARCADE • Multi-Game AI Engine & Arcade Suite

A unified Cyberpunk AI game suite serving both the **NEURO-DIGIT MNIST Number Recognition Game** and the **Unbeatable Minimax Tic-Tac-Toe Game** side-by-side across dedicated web endpoints, REST APIs, and native Python desktop GUI launchers.

---

## 🌐 Live Endpoints

When running `python app.py`, the following endpoints are served locally:

| Endpoint | Experience | Technology Stack |
|---|---|---|
| **`/`** or **`/hub`** | **AI Arcade Portal** | Central Hub & Game Selector |
| **`/mnist`** | **Neuro-Digit Game** | Deep Neural Network (98% MNIST Test Acc), Mouse Canvas, Brain HUD |
| **`/tictactoe`** | **Tic-Tac-Toe Minimax** | Zero-Sum Minimax, Game Tree Introspection HUD, Board Heatmaps |
| **`/waterjug`** | **Water Jug Riddle** | 8L/5L/3L State Space Search, Fluid Animations, Multi-Target Goals |
| **`/api/predict`** | **Inference REST API** | JSON POST `{"image": [784 floats]}` → Returns predictions & probabilities |
| **`/api/status`** | **Health & Metadata** | System health, model readiness, and available endpoints |

---

## ⚡ Game 1: NEURO-DIGIT (MNIST Number Recognition)

- **Trained on Official MNIST**: 60,000 training digits with jitter augmentation for extreme robustness to mouse strokes.
- **Deep Neural Architecture**: `784 -> 128 (ReLU) -> 64 (ReLU) -> 10 (Softmax)`.
- **Center-of-Mass Preprocessing**: Bounding box extraction scaled to 20×20 and centered at $(14, 14)$ via Center of Mass $(\bar{x}, \bar{y})$.
- **Arcade Modes**:
  - ⚡ *Speed Draw Rush*: 12s countdown timer, score bonuses, combo streaks, and confetti.
  - 🧮 *Mental Math Blitz*: Arithmetic problems (`4 + 5 = ?`, `2 × 4 = ?`) where you draw the answer.
  - 🔬 *AI Sandbox Lab*: Freeform drawing with 28×28 CRT vision feed and layer activation heatmaps.
- **Drawing Controls**: Smooth mouse drawing, Fine/Medium/Bold brush sizes, Eraser, Undo (<kbd>Ctrl+Z</kbd>), Clear (<kbd>Space</kbd> or <kbd>C</kbd>).

---

## ✕○ Game 2: UNBEATABLE TIC-TAC-TOE (Minimax Engine)

- **Zero-Sum Equilibrium**: Game-theoretic Minimax algorithm with alpha-beta pruning.
- **Minimax Brain HUD**: Live thought stream, candidate move evaluations (`+10`, `0`, `-10`), and search tree branch visualization.
- **Dynamic Laser Animations**: Glowing SVG strikes across winning lines.

---

## 💧 Game 3: WATER JUG RIDDLE (State Space Search)

- **Classic 3-Jug Riddle**: Measure exact targets (2L, 6L, 1L, 4L, 7L) using 8L, 5L, and 3L jugs.
- **Fluid Mechanics**: Interactive tap filling, fluid level animations, and pouring transitions.
- **State-Space Exploration**: Classic AI state-space search benchmark.

---

## 🚀 How to Run

### 1. Unified Web Server (Both Games on Different Endpoints)
```bash
python app.py
```
*Starts the multi-endpoint server and automatically opens [http://localhost:8081/](http://localhost:8081/) in your browser.*

### 2. Direct Endpoints in Browser
- 🏠 **Arcade Hub**: [http://localhost:8081/](http://localhost:8081/)
- ⚡ **Neuro-Digit**: [http://localhost:8081/mnist](http://localhost:8081/mnist)
- ✕○ **Tic-Tac-Toe**: [http://localhost:8081/tictactoe](http://localhost:8081/tictactoe)

### 3. Native Desktop GUI (Tkinter)
- Launch the **Desktop Arcade Selector**:
  ```bash
  python app.py --desktop
  ```
- Or launch **Neuro-Digit Desktop** directly:
  ```bash
  python app.py --mnist
  ```
- Or launch **Tic-Tac-Toe Desktop** directly:
  ```bash
  python app.py --tictactoe
  ```

### 4. Retrain the MNIST Neural Network
```bash
python train_mnist.py
```
