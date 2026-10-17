"""
AI ARCADE • Unified Multi-Endpoint Server & Launcher
Serves:
  - /          -> Unified AI Arcade Hub
  - /mnist     -> Neuro-Digit MNIST Number Recognition Game
  - /tictactoe -> Unbeatable Minimax Tic-Tac-Toe Engine
  - /api/predict   -> REST API for MNIST Deep Neural Net Inference
  - /api/tictactoe -> REST API for Minimax Decision Engine

Run `python app.py` to start the web server.
Run `python app.py --desktop` to launch the native Python Desktop GUI.
"""

import sys
import os
import json
import webbrowser
import http.server
import socketserver
import threading
import time
import urllib.parse
import numpy as np

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Load weights for backend REST API if available
MNIST_ENGINE = None
try:
    import desktop_mnist
    MNIST_ENGINE = desktop_mnist.MNISTPythonEngine(os.path.join(DIRECTORY, "mnist_weights.npz"))
except Exception as e:
    print(f"[!] Warning: Could not initialize backend MNIST engine: {e}", flush=True)

class ArcadeRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Keep terminal log concise
        pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        # Endpoint Routing
        if path == "" or path == "/index.html" or path == "/hub":
            self.path = "/index.html"
            return super().do_GET()

        elif path == "/mnist" or path == "/digit" or path == "/mnist.html":
            self.path = "/mnist.html"
            return super().do_GET()

        elif path == "/tictactoe" or path == "/minimax" or path == "/tictactoe.html":
            self.path = "/tictactoe.html"
            return super().do_GET()

        elif path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            status = {
                "status": "online",
                "endpoints": {
                    "hub": "/",
                    "neuro_digit": "/mnist",
                    "tictactoe": "/tictactoe",
                    "api_predict": "/api/predict"
                },
                "mnist_engine_ready": MNIST_ENGINE.ready if MNIST_ENGINE else False
            }
            self.wfile.write(json.dumps(status).encode("utf-8"))
            return

        # Serve static assets normally
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == "/api/predict":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                payload = json.loads(body)
                img = payload.get("image") or payload.get("grid")

                if img and MNIST_ENGINE and MNIST_ENGINE.ready:
                    arr = np.array(img, dtype=np.float32)
                    if arr.ndim == 2 and arr.shape == (28, 28):
                        raw_784 = arr.flatten()
                    elif arr.ndim == 1 and len(arr) == 784:
                        raw_784 = arr
                    else:
                        raise ValueError("Expected 784-element float array or 28x28 matrix")

                    pred, conf, probs, top3 = MNIST_ENGINE.predict(raw_784)
                    resp = {
                        "success": True,
                        "prediction": pred,
                        "confidence": conf,
                        "probabilities": probs,
                        "top3": top3
                    }
                else:
                    resp = {"success": False, "error": "Invalid image payload or model unready"}

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(resp).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

def start_web_app():
    os.chdir(DIRECTORY)

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
            httpd = socketserver.TCPServer(("", p), ArcadeRequestHandler)
            port = p
            break
        except OSError:
            continue

    if not httpd:
        print("[!] Could not bind to port. Opening index.html directly...", flush=True)
        webbrowser.open(f"file://{os.path.join(DIRECTORY, 'index.html')}")
        return

    hub_url = f"http://localhost:{port}/"
    mnist_url = f"http://localhost:{port}/mnist"
    tictactoe_url = f"http://localhost:{port}/tictactoe"

    print("=" * 70, flush=True)
    print("   🕹️  AI ARCADE • UNIFIED MULTI-ENDPOINT SERVER", flush=True)
    print("=" * 70, flush=True)
    print(f"[*] 🏠 Arcade Portal:      {hub_url}", flush=True)
    print(f"[*] ⚡ Neuro-Digit (MNIST): {mnist_url}", flush=True)
    print(f"[*] ✕○ Tic-Tac-Toe Minimax: {tictactoe_url}", flush=True)
    print(f"[*] 🔌 REST API Predict:    http://localhost:{port}/api/predict", flush=True)
    print("=" * 70, flush=True)
    print("[*] Opening your default web browser to the Arcade Portal...", flush=True)
    print("[*] Launch native desktop GUI anytime: python app.py --desktop", flush=True)
    print("[*] Press Ctrl+C in this terminal to stop the server.", flush=True)
    print("=" * 70, flush=True)

    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    time.sleep(0.5)
    webbrowser.open(hub_url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Shutting down server. Goodbye!", flush=True)
        httpd.shutdown()

def start_desktop_app():
    import desktop_app
    desktop_app.main()

if __name__ == "__main__":
    if "--desktop" in sys.argv or "--mnist" in sys.argv or "--tictactoe" in sys.argv:
        start_desktop_app()
    else:
        start_web_app()
