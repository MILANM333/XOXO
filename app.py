"""
Unbeatable Tic-Tac-Toe • Minimax AI Engine Launcher
Run `python app.py` to start the interactive web GUI.
Run `python app.py --desktop` to launch the native Python Tkinter GUI.
"""

import sys
import os
import webbrowser
import http.server
import socketserver
import threading
import time

PORT = 8080

def start_web_app():
    directory = os.path.dirname(os.path.abspath(__file__))
    os.chdir(directory)

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            pass # Keep terminal clean

    # Configure UTF-8 stdout if supported
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    # Find free port if 8080 is taken
    port = PORT
    httpd = None
    for p in range(PORT, PORT + 20):
        try:
            httpd = socketserver.TCPServer(("", p), QuietHandler)
            port = p
            break
        except OSError:
            continue

    if not httpd:
        print("[!] Could not bind to port. Opening index.html directly...")
        webbrowser.open(f"file://{os.path.join(directory, 'index.html')}")
        return

    url = f"http://localhost:{port}/index.html"
    print("=" * 60)
    print("   UNBEATABLE TIC-TAC-TOE - MINIMAX AI ENGINE")
    print("=" * 60)
    print(f"[*] Serving web GUI at: {url}")
    print("[*] Opening your default web browser...")
    print("[*] Press Ctrl+C in this terminal to stop the server.")
    print("=" * 60)

    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    time.sleep(0.5)
    webbrowser.open(url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Shutting down server. Goodbye!")
        httpd.shutdown()

def start_desktop_app():
    print("[*] Launching native Tkinter Desktop GUI...")
    import desktop_app
    import tkinter as tk
    root = tk.Tk()
    app = desktop_app.TicTacToeApp(root)
    root.mainloop()

if __name__ == "__main__":
    if "--desktop" in sys.argv:
        start_desktop_app()
    else:
        start_web_app()
