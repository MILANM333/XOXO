"""
Unbeatable Tic-Tac-Toe with Minimax Brain HUD
Pure Python Desktop GUI using Tkinter
"""

import tkinter as tk
from tkinter import ttk, messagebox
import time
import math
import random

WINNING_COMBOS = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6)
]

class MinimaxEngine:
    def __init__(self):
        self.nodes_evaluated = 0

    def check_winner(self, board):
        for a, b, c in WINNING_COMBOS:
            if board[a] and board[a] == board[b] == board[c]:
                return board[a], (a, b, c)
        if all(cell is not None for cell in board):
            return "TIE", None
        return None, None

    def get_available_moves(self, board):
        return [i for i, cell in enumerate(board) if cell is None]

    def minimax(self, board, depth, is_maximizing, ai_player, human_player, alpha=-float('inf'), beta=float('inf')):
        self.nodes_evaluated += 1
        winner, _ = self.check_winner(board)
        if winner == ai_player:
            return 10 - depth
        elif winner == human_player:
            return depth - 10
        elif winner == "TIE":
            return 0

        available = self.get_available_moves(board)

        if is_maximizing:
            max_eval = -float('inf')
            for m in available:
                board[m] = ai_player
                ev = self.minimax(board, depth + 1, False, ai_player, human_player, alpha, beta)
                board[m] = None
                max_eval = max(max_eval, ev)
                alpha = max(alpha, ev)
                if beta <= alpha:
                    break
            return max_eval
        else:
            min_eval = float('inf')
            for m in available:
                board[m] = human_player
                ev = self.minimax(board, depth + 1, True, ai_player, human_player, alpha, beta)
                board[m] = None
                min_eval = min(min_eval, ev)
                beta = min(beta, ev)
                if beta <= alpha:
                    break
            return min_eval

    def analyze_board(self, board, ai_player, human_player):
        self.nodes_evaluated = 0
        start_time = time.perf_counter()
        available = self.get_available_moves(board)
        if not available:
            return None

        evaluations = []
        for m in available:
            board[m] = ai_player
            score = self.minimax(board, 0, False, ai_player, human_player)
            board[m] = None

            explanation = "Draw guaranteed with optimal play"
            if score > 0:
                explanation = f"Forces win in {10 - score} moves!"
            elif score < 0:
                explanation = "Allows player counter-attack"

            evaluations.append({
                'move': m,
                'score': score,
                'explanation': explanation
            })

        evaluations.sort(key=lambda x: x['score'], reverse=True)
        max_score = evaluations[0]['score']
        best_moves = [e for e in evaluations if e['score'] == max_score]
        chosen = random.choice(best_moves)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return {
            'best_move': chosen['move'],
            'best_score': chosen['score'],
            'evaluations': evaluations,
            'nodes': self.nodes_evaluated,
            'time_ms': elapsed_ms
        }

class TicTacToeApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Unbeatable Tic-Tac-Toe • Minimax AI Engine")
        self.root.geometry("860x640")
        self.root.configure(bg="#0b0f19")
        self.root.minsize(800, 600)

        self.engine = MinimaxEngine()
        self.board = [None] * 9
        self.history = []
        self.human_player = 'X'
        self.ai_player = 'O'
        self.current_turn = 'X'
        self.game_over = False

        self.scores = {'human': 0, 'ai': 0, 'ties': 0}

        self.setup_ui()
        self.new_game()

    def setup_ui(self):
        # Header Frame
        header = tk.Frame(self.root, bg="#12182b", height=60, padx=20, pady=10)
        header.pack(fill=tk.X)

        title = tk.Label(header, text="✕○ Unbeatable Minimax AI", font=("Segoe UI", 16, "bold"), fg="#00f2fe", bg="#12182b")
        title.pack(side=tk.LEFT)

        subtitle = tk.Label(header, text=" [Pure Rule-Based / Zero-Sum Game Theory]", font=("Consolas", 10), fg="#94a3b8", bg="#12182b")
        subtitle.pack(side=tk.LEFT, padx=10)

        # Main Body Frame (2 Columns)
        body = tk.Frame(self.root, bg="#0b0f19", padx=20, pady=15)
        body.pack(fill=tk.BOTH, expand=True)

        # Left Column: Game Area
        left_frame = tk.Frame(body, bg="#12182b", bd=1, relief=tk.SOLID, padx=20, pady=15)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))

        # Scoreboard
        score_frame = tk.Frame(left_frame, bg="#12182b")
        score_frame.pack(fill=tk.X, pady=(0, 10))

        self.lbl_human_score = tk.Label(score_frame, text="Player: 0", font=("Segoe UI", 11, "bold"), fg="#00f2fe", bg="#12182b")
        self.lbl_human_score.pack(side=tk.LEFT, expand=True)

        self.lbl_tie_score = tk.Label(score_frame, text="Ties: 0", font=("Segoe UI", 11, "bold"), fg="#f59e0b", bg="#12182b")
        self.lbl_tie_score.pack(side=tk.LEFT, expand=True)

        self.lbl_ai_score = tk.Label(score_frame, text="AI: 0", font=("Segoe UI", 11, "bold"), fg="#ff007f", bg="#12182b")
        self.lbl_ai_score.pack(side=tk.LEFT, expand=True)

        # Status Banner
        self.lbl_status = tk.Label(left_frame, text="Your Turn (X)", font=("Segoe UI", 13, "bold"), fg="#ffffff", bg="#1c253d", pady=8)
        self.lbl_status.pack(fill=tk.X, pady=(0, 15))

        # 3x3 Grid
        grid_frame = tk.Frame(left_frame, bg="#0b0f19")
        grid_frame.pack(pady=5)

        self.buttons = []
        for i in range(9):
            btn = tk.Button(
                grid_frame, text="", font=("Segoe UI", 28, "bold"),
                width=4, height=2, bg="#1c253d", fg="#ffffff",
                activebackground="#2a375a", activeforeground="#ffffff",
                relief=tk.FLAT, bd=0,
                command=lambda idx=i: self.on_cell_click(idx)
            )
            r, c = divmod(i, 3)
            btn.grid(row=r, column=c, padx=5, pady=5)
            self.buttons.append(btn)

        # Action Buttons
        ctrl_frame = tk.Frame(left_frame, bg="#12182b")
        ctrl_frame.pack(fill=tk.X, pady=15)

        btn_new = tk.Button(ctrl_frame, text="🔄 Restart Game", font=("Segoe UI", 10, "bold"),
                            bg="#00f2fe", fg="#070913", activebackground="#4facfe",
                            relief=tk.FLAT, padx=14, pady=6, command=self.new_game)
        btn_new.pack(side=tk.LEFT, expand=True, padx=5)

        btn_undo = tk.Button(ctrl_frame, text="↩️ Undo Move", font=("Segoe UI", 10, "bold"),
                             bg="#2a375a", fg="#ffffff", activebackground="#384975",
                             relief=tk.FLAT, padx=14, pady=6, command=self.undo_move)
        btn_undo.pack(side=tk.LEFT, expand=True, padx=5)

        # Right Column: Minimax Brain HUD
        right_frame = tk.Frame(body, bg="#12182b", bd=1, relief=tk.SOLID, padx=15, pady=15, width=340)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(10, 0))

        tk.Label(right_frame, text="🧠 Minimax Brain HUD", font=("Segoe UI", 12, "bold"), fg="#ffffff", bg="#12182b").pack(anchor="w")

        # Stats Bar
        stats_frame = tk.Frame(right_frame, bg="#12182b", pady=6)
        stats_frame.pack(fill=tk.X)
        self.lbl_nodes = tk.Label(stats_frame, text="Nodes Evaluated: 0", font=("Consolas", 9), fg="#94a3b8", bg="#12182b")
        self.lbl_nodes.pack(side=tk.LEFT)
        self.lbl_time = tk.Label(stats_frame, text="Time: 0 ms", font=("Consolas", 9), fg="#94a3b8", bg="#12182b")
        self.lbl_time.pack(side=tk.RIGHT)

        # Live Thought Log
        tk.Label(right_frame, text="REASONING STREAM:", font=("Segoe UI", 9, "bold"), fg="#64748b", bg="#12182b").pack(anchor="w", pady=(8, 2))
        self.txt_thought = tk.Text(right_frame, height=4, bg="#070913", fg="#00f2fe", font=("Consolas", 9), bd=0, padx=8, pady=8, wrap=tk.WORD)
        self.txt_thought.pack(fill=tk.X, pady=(0, 10))

        # Candidate Moves Listbox
        tk.Label(right_frame, text="MOVE EVALUATIONS (MINIMAX SCORES):", font=("Segoe UI", 9, "bold"), fg="#64748b", bg="#12182b").pack(anchor="w", pady=(4, 2))
        self.txt_moves = tk.Text(right_frame, height=10, bg="#070913", fg="#ffffff", font=("Consolas", 9), bd=0, padx=8, pady=8)
        self.txt_moves.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        # Mathematical Proof note
        proof_lbl = tk.Label(
            right_frame,
            text="🛡️ Rule-Based Guarantee:\nMinimax evaluates all game-tree branches.\nPlayer cannot win. Draw or AI Win only.",
            font=("Segoe UI", 9), fg="#10b981", bg="#12182b", justify=tk.LEFT
        )
        proof_lbl.pack(anchor="w")

    def log_thought(self, msg):
        self.txt_thought.delete("1.0", tk.END)
        self.txt_thought.insert(tk.END, msg)

    def new_game(self):
        self.board = [None] * 9
        self.history = []
        self.current_turn = 'X'
        self.game_over = False

        for btn in self.buttons:
            btn.config(text="", bg="#1c253d", fg="#ffffff", state=tk.NORMAL)

        self.lbl_status.config(text="Your Turn (X)", fg="#00f2fe")
        self.log_thought("Game started. Minimax engine awaiting first player move.")
        self.refresh_evaluations()

    def on_cell_click(self, idx):
        if self.game_over or self.board[idx] is not None or self.current_turn != self.human_player:
            return

        self.history.append(list(self.board))
        self.board[idx] = self.human_player
        self.buttons[idx].config(text=self.human_player, fg="#00f2fe")

        winner, combo = self.engine.check_winner(self.board)
        if winner:
            self.handle_game_over(winner, combo)
            return

        self.current_turn = self.ai_player
        self.lbl_status.config(text="AI Calculating Minimax...", fg="#ff007f")
        self.root.update()

        # Slight delay to visualize AI thinking
        self.root.after(200, self.ai_turn)

    def ai_turn(self):
        analysis = self.engine.analyze_board(self.board, self.ai_player, self.human_player)
        if not analysis:
            return

        self.lbl_nodes.config(text=f"Nodes Evaluated: {analysis['nodes']:,}")
        self.lbl_time.config(text=f"Time: {analysis['time_ms']:.1f} ms")

        best_m = analysis['best_move']
        self.board[best_m] = self.ai_player
        self.buttons[best_m].config(text=self.ai_player, fg="#ff007f")

        self.log_thought(f"Chosen move: [{best_m // 3}, {best_m % 3}] with score {analysis['best_score']:+d}.\nEvaluated {analysis['nodes']} states in {analysis['time_ms']:.1f}ms.")

        winner, combo = self.engine.check_winner(self.board)
        if winner:
            self.handle_game_over(winner, combo)
            return

        self.current_turn = self.human_player
        self.lbl_status.config(text="Your Turn (X)", fg="#00f2fe")
        self.refresh_evaluations()

    def refresh_evaluations(self):
        if self.game_over:
            return
        analysis = self.engine.analyze_board(self.board, self.ai_player, self.human_player)
        self.txt_moves.delete("1.0", tk.END)
        if analysis:
            self.txt_moves.insert(tk.END, f"{'Pos':<7}{'Score':<8}{'Outcome / Tactic'}\n")
            self.txt_moves.insert(tk.END, "-" * 38 + "\n")
            for item in analysis['evaluations']:
                r, c = divmod(item['move'], 3)
                score_str = f"{item['score']:+d}"
                self.txt_moves.insert(tk.END, f"({r},{c})    {score_str:<8}{item['explanation']}\n")

    def handle_game_over(self, winner, combo):
        self.game_over = True
        if winner == "TIE":
            self.scores['ties'] += 1
            self.lbl_tie_score.config(text=f"Ties: {self.scores['ties']}")
            self.lbl_status.config(text="Equilibrium: Game Drawn!", fg="#f59e0b")
            self.log_thought("Game Over: Mathematical draw. Zero sum equilibrium preserved.")
            messagebox.showinfo("Game Over", "🤝 Game Drawn!\nTic-Tac-Toe is mathematically a tie under optimal Minimax play.")
        else:
            if combo:
                for idx in combo:
                    self.buttons[idx].config(bg="#3b1535")
            if winner == self.ai_player:
                self.scores['ai'] += 1
                self.lbl_ai_score.config(text=f"AI: {self.scores['ai']}")
                self.lbl_status.config(text="AI Wins!", fg="#ff007f")
                self.log_thought("Game Over: AI capitalized on non-optimal play to achieve win.")
                messagebox.showinfo("Game Over", "👑 AI Wins!\nUnbeatable Minimax algorithm achieved victory.")
            else:
                self.scores['human'] += 1
                self.lbl_human_score.config(text=f"Player: {self.scores['human']}")
                self.lbl_status.config(text="Player Wins!", fg="#00f2fe")

    def undo_move(self):
        if not self.history or self.game_over:
            return
        self.board = self.history.pop()
        self.game_over = False
        for i, val in enumerate(self.board):
            if val is None:
                self.buttons[i].config(text="", bg="#1c253d", state=tk.NORMAL)
            else:
                color = "#00f2fe" if val == 'X' else "#ff007f"
                self.buttons[i].config(text=val, fg=color, bg="#1c253d", state=tk.NORMAL)
        self.current_turn = self.human_player
        self.lbl_status.config(text="Your Turn (X)", fg="#00f2fe")
        self.refresh_evaluations()

if __name__ == "__main__":
    root = tk.Tk()
    app = TicTacToeApp(root)
    root.mainloop()
