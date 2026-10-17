"""
NEURO-DIGIT • MNIST AI Number Recognition Game
Native Python Desktop GUI using Tkinter & NumPy
Mouse Drawable with Real-Time AI Brain HUD
"""

import os
import sys
import math
import time
import random
import tkinter as tk
from tkinter import ttk, messagebox
import numpy as np

# Audio support on Windows
try:
    import winsound
    HAS_WINSOUND = True
except ImportError:
    HAS_WINSOUND = False

def play_sfx(kind="click"):
    if not HAS_WINSOUND:
        return
    try:
        if kind == "click":
            winsound.Beep(800, 30)
        elif kind == "draw":
            winsound.Beep(260, 20)
        elif kind == "success":
            winsound.Beep(587, 80)
            winsound.Beep(880, 120)
        elif kind == "urgent":
            winsound.Beep(1000, 50)
        elif kind == "gameover":
            winsound.Beep(300, 200)
            winsound.Beep(150, 300)
    except Exception:
        pass


class MNISTPythonEngine:
    """NumPy-based inference engine with Center-of-Mass preprocessing."""
    def __init__(self, weights_path="mnist_weights.npz"):
        self.ready = False
        if os.path.exists(weights_path):
            data = np.load(weights_path)
            self.w1 = data['w1']  # (128, 784)
            self.b1 = data['b1']  # (128,)
            self.w2 = data['w2']  # (64, 128)
            self.b2 = data['b2']  # (64,)
            self.w3 = data['w3']  # (10, 64)
            self.b3 = data['b3']  # (10,)
            self.ready = True
        else:
            print(f"[!] Warning: {weights_path} not found.")

    def preprocess_grid(self, grid_2d):
        """
        grid_2d: (H, W) float array with values in [0, 1]
        Standard MNIST pipeline:
        1. Bounding box
        2. Scale bounding box into 20x20
        3. Center inside 28x28 by Center of Mass
        """
        rows, cols = grid_2d.shape
        threshold = 0.08
        active = np.argwhere(grid_2d > threshold)
        if len(active) == 0:
            return np.zeros(784, dtype=np.float32), True, np.zeros((28, 28), dtype=np.float32)

        min_y, min_x = active.min(axis=0)
        max_y, max_x = active.max(axis=0)

        # Crop bounding box with 2px padding
        pad = 2
        min_y = max(0, min_y - pad)
        min_x = max(0, min_x - pad)
        max_y = min(rows - 1, max_y + pad)
        max_x = min(cols - 1, max_x + pad)

        crop = grid_2d[min_y:max_y+1, min_x:max_x+1]
        cH, cW = crop.shape
        max_dim = max(cH, cW)
        if max_dim == 0:
            return np.zeros(784, dtype=np.float32), True, np.zeros((28, 28), dtype=np.float32)

        scale = 20.0 / max_dim
        tH = max(1, int(round(cH * scale)))
        tW = max(1, int(round(cW * scale)))

        # Resample crop to (tH, tW) via nearest/bilinear
        y_indices = np.linspace(0, cH - 1, tH).astype(int)
        x_indices = np.linspace(0, cW - 1, tW).astype(int)
        scaled = crop[np.ix_(y_indices, x_indices)]

        # Place into initial 28x28
        init_28 = np.zeros((28, 28), dtype=np.float32)
        start_y = (28 - tH) // 2
        start_x = (28 - tW) // 2
        init_28[start_y:start_y+tH, start_x:start_x+tW] = scaled

        # Calculate Center of Mass
        total_mass = init_28.sum()
        if total_mass < 0.1:
            return np.zeros(784, dtype=np.float32), True, init_28

        y_coords, x_coords = np.indices((28, 28))
        cy = (y_coords * init_28).sum() / total_mass
        cx = (x_coords * init_28).sum() / total_mass

        shift_y = int(round(14.0 - cy))
        shift_x = int(round(14.0 - cx))

        final_28 = np.zeros((28, 28), dtype=np.float32)
        for y in range(28):
            for x in range(28):
                src_y = y - shift_y
                src_x = x - shift_x
                if 0 <= src_y < 28 and 0 <= src_x < 28:
                    final_28[y, x] = init_28[src_y, src_x]

        return final_28.flatten(), False, final_28

    def predict(self, input_784):
        if not self.ready:
            return 0, 0.0, [0.1]*10, []

        h1 = np.maximum(0, self.w1 @ input_784 + self.b1)
        h2 = np.maximum(0, self.w2 @ h1 + self.b2)
        logits = self.w3 @ h2 + self.b3

        exp_l = np.exp(logits - np.max(logits))
        probs = exp_l / np.sum(exp_l)

        best_digit = int(np.argmax(probs))
        confidence = float(probs[best_digit])

        top3_indices = np.argsort(probs)[::-1][:3]
        top3 = [(int(idx), float(probs[idx])) for idx in top3_indices]

        return best_digit, confidence, probs.tolist(), top3


class DesktopNeuroDigitApp:
    def __init__(self, root):
        self.root = root
        self.root.title("NEURO-DIGIT • MNIST AI Number Recognition Game")
        self.root.geometry("1100x720")
        self.root.minsize(980, 680)
        self.root.configure(bg="#080a10")

        self.engine = MNISTPythonEngine()

        # Canvas grid resolution (e.g. 56x56 internal pixels for smooth anti-aliased drawing)
        self.grid_size = 56
        self.pixel_data = np.zeros((self.grid_size, self.grid_size), dtype=np.float32)
        self.canvas_size = 360
        self.brush_radius = 2.5
        self.is_drawing = False
        self.last_x = None
        self.last_y = None

        # Game State
        self.mode = "speed"  # 'speed', 'math', 'sandbox'
        self.target_digit = 7
        self.math_eq = "3 + 4"
        self.math_ans = 7
        self.score = 0
        self.combo = 0
        self.high_score = 0
        self.lives = 3
        self.round_time = 12.0
        self.max_round_time = 12.0
        self.timer_id = None
        self.is_game_over = False

        self.setup_ui()
        self.start_mode("speed")

    def setup_ui(self):
        # Header Bar
        header = tk.Frame(self.root, bg="#0e111a", height=60, bd=1, relief="solid")
        header.pack(fill="x", side="top")

        title_lbl = tk.Label(header, text="⚡ NEURO-DIGIT", font=("Segoe UI", 16, "bold"), fg="#00f0ff", bg="#0e111a")
        title_lbl.pack(side="left", padx=20, pady=12)

        subtitle_lbl = tk.Label(header, text="MNIST AI Number Recognition Engine (98% Acc)", font=("Segoe UI", 10), fg="#8a99ad", bg="#0e111a")
        subtitle_lbl.pack(side="left", pady=16)

        # Mode Selector Buttons
        mode_frame = tk.Frame(header, bg="#0e111a")
        mode_frame.pack(side="right", padx=20)

        self.speed_btn = tk.Button(mode_frame, text="⚡ Speed Draw", font=("Segoe UI", 9, "bold"), bg="#00f0ff", fg="#000",
                                   command=lambda: self.start_mode("speed"), relief="flat", padx=10, pady=4)
        self.speed_btn.pack(side="left", padx=4)

        self.math_btn = tk.Button(mode_frame, text="🧮 Math Blitz", font=("Segoe UI", 9, "bold"), bg="#171e30", fg="#8a99ad",
                                  command=lambda: self.start_mode("math"), relief="flat", padx=10, pady=4)
        self.math_btn.pack(side="left", padx=4)

        self.sandbox_btn = tk.Button(mode_frame, text="🔬 Sandbox Lab", font=("Segoe UI", 9, "bold"), bg="#171e30", fg="#8a99ad",
                                     command=lambda: self.start_mode("sandbox"), relief="flat", padx=10, pady=4)
        self.sandbox_btn.pack(side="left", padx=4)

        # Main Workspace Container
        main_frame = tk.Frame(self.root, bg="#080a10")
        main_frame.pack(fill="both", expand=True, padx=20, pady=15)

        # Left Column: Challenge & Drawing Canvas
        left_col = tk.Frame(main_frame, bg="#101521", bd=1, relief="solid")
        left_col.pack(side="left", fill="both", expand=True, padx=(0, 10))

        # Target Challenge Banner
        self.banner_frame = tk.Frame(left_col, bg="#141a29", height=65)
        self.banner_frame.pack(fill="x", padx=15, pady=12)

        self.challenge_lbl = tk.Label(self.banner_frame, text="DRAW DIGIT:", font=("Segoe UI", 11, "bold"), fg="#8a99ad", bg="#141a29")
        self.challenge_lbl.pack(side="left", padx=15)

        self.target_val_lbl = tk.Label(self.banner_frame, text="7", font=("Segoe UI", 26, "bold"), fg="#00f0ff", bg="#141a29")
        self.target_val_lbl.pack(side="left", padx=5)

        # Stats Deck
        stats_frame = tk.Frame(self.banner_frame, bg="#141a29")
        stats_frame.pack(side="right", padx=15)

        self.score_lbl = tk.Label(stats_frame, text="SCORE: 0", font=("Consolas", 12, "bold"), fg="#ffbe00", bg="#141a29")
        self.score_lbl.pack(side="left", padx=10)

        self.combo_lbl = tk.Label(stats_frame, text="COMBO: 0x", font=("Consolas", 12, "bold"), fg="#00ff88", bg="#141a29")
        self.combo_lbl.pack(side="left", padx=10)

        self.lives_lbl = tk.Label(stats_frame, text="❤❤❤", font=("Segoe UI", 14), fg="#ff0055", bg="#141a29")
        self.lives_lbl.pack(side="left", padx=10)

        # Timer bar
        self.timer_canvas = tk.Canvas(left_col, height=8, bg="#1a2030", highlightthickness=0)
        self.timer_canvas.pack(fill="x", padx=15, pady=(0, 10))

        # Drawing Canvas
        canvas_container = tk.Frame(left_col, bg="#0e111a")
        canvas_container.pack(pady=5)

        self.draw_canvas = tk.Canvas(canvas_container, width=self.canvas_size, height=self.canvas_size,
                                     bg="#0e111a", highlightthickness=2, highlightbackground="#00f0ff", cursor="crosshair")
        self.draw_canvas.pack()

        # Canvas Bindings
        self.draw_canvas.bind("<Button-1>", self.on_press)
        self.draw_canvas.bind("<B1-Motion>", self.on_drag)
        self.draw_canvas.bind("<ButtonRelease-1>", self.on_release)
        self.draw_canvas.bind("<Button-3>", lambda e: self.clear_canvas())

        # Canvas Controls Toolbar
        toolbar = tk.Frame(left_col, bg="#101521")
        toolbar.pack(fill="x", padx=15, pady=12)

        clear_btn = tk.Button(toolbar, text="✕ Clear (Space)", font=("Segoe UI", 10, "bold"), bg="#ff0055", fg="#fff",
                              command=self.clear_canvas, relief="flat", padx=14, pady=5)
        clear_btn.pack(side="left", padx=6)

        brush_lbl = tk.Label(toolbar, text="Brush Size:", font=("Segoe UI", 10), fg="#8a99ad", bg="#101521")
        brush_lbl.pack(side="left", padx=(15, 5))

        fine_btn = tk.Button(toolbar, text="Fine", font=("Segoe UI", 9), bg="#171e30", fg="#fff",
                             command=lambda: self.set_brush(1.8), relief="flat", padx=8)
        fine_btn.pack(side="left", padx=3)

        med_btn = tk.Button(toolbar, text="Medium", font=("Segoe UI", 9, "bold"), bg="#00f0ff", fg="#000",
                            command=lambda: self.set_brush(2.6), relief="flat", padx=8)
                            
        def select_brush(radius, active_btn):
            self.set_brush(radius)
            for b in [fine_btn, med_btn, bold_btn]:
                b.configure(bg="#171e30", fg="#fff")
            active_btn.configure(bg="#00f0ff", fg="#000")

        fine_btn.configure(command=lambda: select_brush(1.8, fine_btn))
        med_btn.configure(command=lambda: select_brush(2.6, med_btn))
        med_btn.pack(side="left", padx=3)

        bold_btn = tk.Button(toolbar, text="Bold", font=("Segoe UI", 9), bg="#171e30", fg="#fff",
                             command=lambda: select_brush(3.6, bold_btn), relief="flat", padx=8)
        bold_btn.pack(side="left", padx=3)

        # Right Column: AI Brain HUD
        right_col = tk.Frame(main_frame, bg="#101521", bd=1, relief="solid", width=420)
        right_col.pack(side="right", fill="both", expand=True, padx=(10, 0))
        right_col.pack_propagate(False)

        hud_title = tk.Label(right_col, text="◈ NEURAL NETWORK BRAIN HUD", font=("Segoe UI", 12, "bold"), fg="#fff", bg="#101521")
        hud_title.pack(anchor="w", padx=16, pady=12)

        # Top Prediction Card
        pred_card = tk.Frame(right_col, bg="#141a29", bd=1, relief="solid")
        pred_card.pack(fill="x", padx=15, pady=6)

        self.pred_digit_lbl = tk.Label(pred_card, text="-", font=("Segoe UI", 48, "bold"), fg="#00f0ff", bg="#141a29", width=3)
        self.pred_digit_lbl.pack(side="left", padx=15, pady=8)

        meta_frame = tk.Frame(pred_card, bg="#141a29")
        meta_frame.pack(side="left", fill="both", expand=True, pady=8)

        tk.Label(meta_frame, text="TOP PREDICTION & CONFIDENCE", font=("Segoe UI", 9), fg="#8a99ad", bg="#141a29").pack(anchor="w")
        self.conf_lbl = tk.Label(meta_frame, text="0.0%", font=("Consolas", 22, "bold"), fg="#fff", bg="#141a29")
        self.conf_lbl.pack(anchor="w")

        self.certainty_badge = tk.Label(meta_frame, text="AWAITING STROKE", font=("Consolas", 8, "bold"), fg="#8a99ad", bg="#1a2236", padx=6, pady=2)
        self.certainty_badge.pack(anchor="w", pady=2)

        # 28x28 AI Vision & Contenders Preview
        vision_row = tk.Frame(right_col, bg="#101521")
        vision_row.pack(fill="x", padx=15, pady=10)

        v_box = tk.Frame(vision_row, bg="#101521")
        v_box.pack(side="left", padx=(0, 15))
        tk.Label(v_box, text="28×28 AI VISION", font=("Segoe UI", 9, "bold"), fg="#8a99ad", bg="#101521").pack(anchor="w", pady=(0, 4))
        self.vision_canvas = tk.Canvas(v_box, width=90, height=90, bg="#080a10", highlightthickness=1, highlightbackground="#00f0ff")
        self.vision_canvas.pack()

        contenders_box = tk.Frame(vision_row, bg="#101521")
        contenders_box.pack(side="left", fill="both", expand=True)
        tk.Label(contenders_box, text="TOP CONTENDERS", font=("Segoe UI", 9, "bold"), fg="#8a99ad", bg="#101521").pack(anchor="w", pady=(0, 4))
        self.contenders_lbl = tk.Label(contenders_box, text="#1: - (0%)\n#2: - (0%)\n#3: - (0%)",
                                       font=("Consolas", 10), fg="#00f0ff", bg="#141a29", justify="left", padx=10, pady=8)
        self.contenders_lbl.pack(fill="both", expand=True)

        # 10-Digit Probabilities Meters Canvas
        tk.Label(right_col, text="PROBABILITY SPECTRUM (0 - 9)", font=("Segoe UI", 9, "bold"), fg="#8a99ad", bg="#101521").pack(anchor="w", padx=16, pady=(8, 2))
        self.spectrum_canvas = tk.Canvas(right_col, height=180, bg="#101521", highlightthickness=0)
        self.spectrum_canvas.pack(fill="x", padx=15, pady=4)

        # Keyboard shortcuts
        self.root.bind("<space>", lambda e: self.clear_canvas())
        self.root.bind("c", lambda e: self.clear_canvas())
        self.root.bind("C", lambda e: self.clear_canvas())

        self.clear_canvas()

    def set_brush(self, radius):
        self.brush_radius = radius

    def on_press(self, event):
        if self.is_game_over:
            return
        self.is_drawing = True
        self.last_x = event.x
        self.last_y = event.y
        self.draw_stroke_at(event.x, event.y)
        self.evaluate_grid()

    def on_drag(self, event):
        if not self.is_drawing or self.is_game_over:
            return
        # Interpolate between last and current pos for smooth continuous line
        x0, y0 = self.last_x, self.last_y
        x1, y1 = event.x, event.y
        dist = max(1, int(math.hypot(x1 - x0, y1 - y0)))

        for i in range(dist + 1):
            t = i / dist
            xi = x0 + t * (x1 - x0)
            yi = y0 + t * (y1 - y0)
            self.draw_stroke_at(xi, yi)

        self.last_x = x1
        self.last_y = y1
        self.evaluate_grid()

    def on_release(self, event):
        self.is_drawing = False
        self.last_x = None
        self.last_y = None
        self.evaluate_grid()

    def draw_stroke_at(self, cx, cy):
        # Draw on visible canvas
        r = self.brush_radius * (self.canvas_size / self.grid_size)
        self.draw_canvas.create_oval(cx - r, cy - r, cx + r, cy + r, fill="#00f0ff", outline="#00f0ff")

        # Map to internal grid
        gx = (cx / self.canvas_size) * self.grid_size
        gy = (cy / self.canvas_size) * self.grid_size
        rad = self.brush_radius

        x_min = max(0, int(gx - rad - 1))
        x_max = min(self.grid_size - 1, int(gx + rad + 1))
        y_min = max(0, int(gy - rad - 1))
        y_max = min(self.grid_size - 1, int(gy + rad + 1))

        for y in range(y_min, y_max + 1):
            for x in range(x_min, x_max + 1):
                d = math.hypot(x - gx, y - gy)
                if d <= rad:
                    val = max(0.0, 1.0 - (d / rad) * 0.4)
                    self.pixel_data[y, x] = max(self.pixel_data[y, x], val)

    def clear_canvas(self):
        self.draw_canvas.delete("all")
        self.pixel_data.fill(0.0)

        # Draw subtle grid dots on canvas
        step = 32
        for x in range(step, self.canvas_size, step):
            for y in range(step, self.canvas_size, step):
                self.draw_canvas.create_rectangle(x - 1, y - 1, x + 1, y + 1, fill="#171e30", outline="")

        self.reset_hud()

    def evaluate_grid(self):
        raw_784, is_empty, grid_28 = self.engine.preprocess_grid(self.pixel_data)
        self.render_vision(grid_28, is_empty)

        if is_empty:
            self.reset_hud()
            return

        pred, conf, probs, top3 = self.engine.predict(raw_784)
        self.update_hud(pred, conf, probs, top3)
        self.check_game(pred, conf)

    def render_vision(self, grid_28, is_empty):
        self.vision_canvas.delete("all")
        if is_empty:
            self.vision_canvas.create_text(45, 45, text="WAITING", fill="#4d5b6e", font=("Segoe UI", 8))
            return

        cell = 90 / 28.0
        for y in range(28):
            for x in range(28):
                val = grid_28[y, x]
                if val > 0.05:
                    alpha_hex = int(val * 255)
                    color = f"#{0:02x}{min(255, int(val * 240)):02x}{255:02x}"
                    self.vision_canvas.create_rectangle(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell,
                                                        fill=color, outline="")

        # Crosshairs
        self.vision_canvas.create_line(14 * cell, 0, 14 * cell, 90, fill="#ff0055")
        self.vision_canvas.create_line(0, 14 * cell, 90, 14 * cell, fill="#ff0055")

    def update_hud(self, pred, conf, probs, top3):
        self.pred_digit_lbl.configure(text=str(pred))
        self.conf_lbl.configure(text=f"{conf * 100:.1f}%")

        if conf > 0.85:
            self.certainty_badge.configure(text="HIGH CONFIDENCE", fg="#00ff88", bg="#0a2a1a")
        elif conf > 0.5:
            self.certainty_badge.configure(text="MODERATE", fg="#ffbe00", bg="#2a220a")
        else:
            self.certainty_badge.configure(text="HESITANT", fg="#ff0055", bg="#2a0a14")

        # Top 3
        if top3:
            t_str = "\n".join([f"#{i+1}: {d} ({p*100:.1f}%)" for i, (d, p) in enumerate(top3)])
            self.contenders_lbl.configure(text=t_str)

        # 10 Digit spectrum bars
        self.spectrum_canvas.delete("all")
        w = self.spectrum_canvas.winfo_width()
        if w < 100:
            w = 380

        row_h = 16
        for d in range(10):
            p = probs[d]
            y = d * row_h + 8

            # Digit label
            col = "#00f0ff" if d == pred and conf > 0.4 else "#8a99ad"
            self.spectrum_canvas.create_text(15, y, text=str(d), fill=col, font=("Consolas", 10, "bold"))

            # Track & Fill
            bar_start = 32
            bar_max = w - 80
            bar_len = max(2, int((bar_max - bar_start) * p))

            self.spectrum_canvas.create_rectangle(bar_start, y - 4, bar_max, y + 4, fill="#171e30", outline="")
            bar_color = "#00f0ff" if d == pred and conf > 0.4 else "#243b55"
            self.spectrum_canvas.create_rectangle(bar_start, y - 4, bar_start + bar_len, y + 4, fill=bar_color, outline="")

            # Pct
            pct_str = f"{p * 100:.0f}%"
            self.spectrum_canvas.create_text(bar_max + 22, y, text=pct_str, fill=col, font=("Consolas", 9))

    def reset_hud(self):
        self.pred_digit_lbl.configure(text="-")
        self.conf_lbl.configure(text="0.0%")
        self.certainty_badge.configure(text="AWAITING STROKE", fg="#8a99ad", bg="#1a2236")
        self.contenders_lbl.configure(text="#1: - (0%)\n#2: - (0%)\n#3: - (0%)")
        self.spectrum_canvas.delete("all")

    # ------------------ GAME MODES & LOGIC ------------------

    def start_mode(self, mode):
        self.mode = mode
        self.score = 0
        self.combo = 0
        self.lives = 3
        self.is_game_over = False

        self.speed_btn.configure(bg="#171e30", fg="#8a99ad")
        self.math_btn.configure(bg="#171e30", fg="#8a99ad")
        self.sandbox_btn.configure(bg="#171e30", fg="#8a99ad")

        if mode == "speed":
            self.speed_btn.configure(bg="#00f0ff", fg="#000")
            self.challenge_lbl.configure(text="DRAW DIGIT:")
            self.next_speed_target()
            self.start_timer()
        elif mode == "math":
            self.math_btn.configure(bg="#00f0ff", fg="#000")
            self.challenge_lbl.configure(text="SOLVE & DRAW:")
            self.next_math_target()
            self.start_timer()
        else:
            self.sandbox_btn.configure(bg="#00f0ff", fg="#000")
            self.challenge_lbl.configure(text="FREE DRAW LAB")
            self.target_val_lbl.configure(text="∞")
            self.stop_timer()

        self.update_stats()
        self.clear_canvas()

    def next_speed_target(self):
        nxt = random.randint(0, 9)
        while nxt == self.target_digit:
            nxt = random.randint(0, 9)
        self.target_digit = nxt
        self.target_val_lbl.configure(text=str(self.target_digit), fg="#00f0ff")
        self.round_time = self.max_round_time

    def next_math_target(self):
        op = random.choice(["+", "-", "*"])
        if op == "+":
            ans = random.randint(0, 9)
            a = random.randint(0, ans)
            b = ans - a
            eq = f"{a} + {b}"
        elif op == "-":
            ans = random.randint(0, 9)
            b = random.randint(0, 9)
            a = ans + b
            eq = f"{a} - {b}"
        else:
            pairs = [(0, 5, 0), (1, 7, 7), (2, 3, 6), (2, 4, 8), (3, 3, 9), (4, 2, 8), (1, 9, 9), (2, 2, 4)]
            a, b, ans = random.choice(pairs)
            eq = f"{a} × {b}"

        self.math_eq = eq
        self.math_ans = ans
        self.target_val_lbl.configure(text=f"{eq} = ?", fg="#ffbe00")
        self.round_time = self.max_round_time

    def check_game(self, pred, conf):
        if self.is_game_over or self.mode == "sandbox":
            return

        target = self.target_digit if self.mode == "speed" else self.math_ans
        if pred == target and conf >= 0.72:
            # Matched!
            self.combo += 1
            multiplier = min(5, (self.combo // 2) + 1)
            added = 100 * multiplier + int(self.round_time * 15)
            self.score += added
            play_sfx("success")
            self.update_stats()

            self.root.after(400, self.on_round_success)

    def on_round_success(self):
        self.clear_canvas()
        if self.mode == "speed":
            self.next_speed_target()
        elif self.mode == "math":
            self.next_math_target()

    def start_timer(self):
        self.stop_timer()
        self.tick_timer()

    def tick_timer(self):
        if self.is_game_over or self.mode == "sandbox":
            return

        self.round_time -= 0.1
        w = self.timer_canvas.winfo_width()
        pct = max(0.0, self.round_time / self.max_round_time)

        self.timer_canvas.delete("all")
        fill_col = "#ff0055" if self.round_time < 3.5 else "#00f0ff"
        self.timer_canvas.create_rectangle(0, 0, int(w * pct), 8, fill=fill_col, outline="")

        if self.round_time <= 0:
            self.on_timeout()
        else:
            self.timer_id = self.root.after(100, self.tick_timer)

    def stop_timer(self):
        if self.timer_id:
            self.root.after_cancel(self.timer_id)
            self.timer_id = None
        self.timer_canvas.delete("all")

    def on_timeout(self):
        self.lives -= 1
        self.combo = 0
        self.update_stats()
        play_sfx("urgent")

        if self.lives <= 0:
            self.is_game_over = True
            self.stop_timer()
            play_sfx("gameover")
            messagebox.showinfo("GAME OVER", f"Time's Up!\n\nFinal Score: {self.score}\nBest Combo: {self.combo}x")
            self.start_mode(self.mode)
        else:
            self.clear_canvas()
            if self.mode == "speed":
                self.next_speed_target()
            elif self.mode == "math":
                self.next_math_target()
            self.start_timer()

    def update_stats(self):
        self.score_lbl.configure(text=f"SCORE: {self.score}")
        self.combo_lbl.configure(text=f"COMBO: {self.combo}x")
        self.lives_lbl.configure(text="❤" * max(0, self.lives))


def main():
    root = tk.Tk()
    app = DesktopNeuroDigitApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
