"""
AI ARCADE • Desktop Master Launcher
Supports launching:
1. Neuro-Digit MNIST Number Recognition Game
2. Unbeatable Tic-Tac-Toe Minimax Game
"""

import sys
import tkinter as tk
from tkinter import ttk

def launch_mnist():
    import desktop_mnist
    root = tk.Tk()
    app = desktop_mnist.DesktopNeuroDigitApp(root)
    root.mainloop()

def launch_tictactoe():
    import desktop_tictactoe
    root = tk.Tk()
    app = desktop_tictactoe.TicTacToeApp(root)
    root.mainloop()

class DesktopHubApp:
    def __init__(self, root):
        self.root = root
        self.root.title("AI ARCADE • Multi-Game Desktop Launcher")
        self.root.geometry("620x460")
        self.root.configure(bg="#080a10")
        self.root.resizable(False, False)

        # Header
        hdr = tk.Frame(root, bg="#0e111a", height=80, bd=1, relief="solid")
        hdr.pack(fill="x")

        tk.Label(hdr, text="🕹️ AI ARCADE", font=("Segoe UI", 20, "bold"), fg="#00f0ff", bg="#0e111a").pack(pady=(15, 2))
        tk.Label(hdr, text="Select a game to launch native desktop GUI", font=("Segoe UI", 10), fg="#8a99ad", bg="#0e111a").pack(pady=(0, 12))

        # Body
        body = tk.Frame(root, bg="#080a10")
        body.pack(fill="both", expand=True, padx=30, pady=25)

        # Game 1: Neuro-Digit
        g1 = tk.Frame(body, bg="#101521", bd=1, relief="solid", padx=18, pady=16)
        g1.pack(fill="x", pady=8)

        g1_top = tk.Frame(g1, bg="#101521")
        g1_top.pack(fill="x")
        tk.Label(g1_top, text="⚡ NEURO-DIGIT", font=("Segoe UI", 14, "bold"), fg="#00f0ff", bg="#101521").pack(side="left")
        tk.Label(g1_top, text="MNIST Neural Net (98% Acc)", font=("Consolas", 9), fg="#00ff88", bg="#101521").pack(side="right")

        tk.Label(g1, text="Draw digits with mouse on canvas. Real-time AI prediction & probability spectrum meters.",
                 font=("Segoe UI", 9), fg="#8a99ad", bg="#101521", wraplength=400, justify="left").pack(anchor="w", pady=4)

        b1 = tk.Button(g1, text="Launch Neuro-Digit ➔", font=("Segoe UI", 10, "bold"), bg="#00f0ff", fg="#000",
                       relief="flat", padx=12, pady=4, cursor="hand2", command=self.open_mnist)
        b1.pack(anchor="e", pady=(4, 0))

        # Game 2: Tic-Tac-Toe
        g2 = tk.Frame(body, bg="#101521", bd=1, relief="solid", padx=18, pady=16)
        g2.pack(fill="x", pady=8)

        g2_top = tk.Frame(g2, bg="#101521")
        g2_top.pack(fill="x")
        tk.Label(g2_top, text="✕○ UNBEATABLE TIC-TAC-TOE", font=("Segoe UI", 14, "bold"), fg="#ff0055", bg="#101521").pack(side="left")
        tk.Label(g2_top, text="Zero-Sum Minimax", font=("Consolas", 9), fg="#ffbe00", bg="#101521").pack(side="right")

        tk.Label(g2, text="Pure game-theoretic Minimax AI with tree search inspection and step-by-step reasoning.",
                 font=("Segoe UI", 9), fg="#8a99ad", bg="#101521", wraplength=400, justify="left").pack(anchor="w", pady=4)

        b2 = tk.Button(g2, text="Launch Tic-Tac-Toe ➔", font=("Segoe UI", 10, "bold"), bg="#ff0055", fg="#fff",
                       relief="flat", padx=12, pady=4, cursor="hand2", command=self.open_tictactoe)
        b2.pack(anchor="e", pady=(4, 0))

    def open_mnist(self):
        self.root.destroy()
        launch_mnist()

    def open_tictactoe(self):
        self.root.destroy()
        launch_tictactoe()

def main():
    if "--mnist" in sys.argv:
        launch_mnist()
    elif "--tictactoe" in sys.argv:
        launch_tictactoe()
    else:
        root = tk.Tk()
        app = DesktopHubApp(root)
        root.mainloop()

if __name__ == "__main__":
    main()
