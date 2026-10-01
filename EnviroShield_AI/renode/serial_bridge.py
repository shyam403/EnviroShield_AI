import json
import socket
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

RENODE_HOST = "127.0.0.1"
RENODE_PORT = 12345
COMMAND_PORT = 3002
TELEMETRY_BACKEND = "http://127.0.0.1:3001/api/telemetry"

sock = None
sock_lock = threading.Lock()


def connect_to_renode():
    global sock

    while True:
        try:
            if sock is not None:
                try:
                    sock.close()
                except OSError:
                    pass
                sock = None

            print(f"Attempting to connect to Renode on {RENODE_HOST}:{RENODE_PORT}")
            new_sock = socket.create_connection((RENODE_HOST, RENODE_PORT), timeout=2)
            new_sock.settimeout(1)
            sock = new_sock
            print(f"Connected to Renode on {RENODE_HOST}:{RENODE_PORT}")
            return
        except OSError:
            print("Connection refused. Make sure Renode is running the enviroshield.resc script. Retrying in 2 seconds...")
            time.sleep(2)


def send_to_renode(payload: bytes):
    global sock

    with sock_lock:
        if sock is None:
            return False
        try:
            sock.sendall(payload)
            return True
        except OSError:
            print("Renode socket closed. Reconnecting...")
            sock = None
            connect_to_renode()
            try:
                sock.sendall(payload)
                return True
            except OSError:
                return False


class CommandHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        post_data = self.rfile.read(content_length)

        try:
            cmd = json.loads(post_data.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"status":"error","message":"invalid json"}')
            return

        action = cmd.get("action")
        success = False

        if action == "mode":
            mode_val = str(cmd.get("mode", "auto")).lower()
            success = send_to_renode(f"CMD:MODE:{mode_val}\n".encode("utf-8"))
        elif action == "set":
            water = cmd.get("water_distance_cm", 28)
            earth = cmd.get("earthquake_level", 12)
            air = cmd.get("air_quality", 74)
            waterq = cmd.get("water_quality", 88)
            success = send_to_renode(f"CMD:SET:{water}:{earth}:{air}:{waterq}\n".encode("utf-8"))
        elif action == "scenario":
            scenario = cmd.get("scenario")
            if scenario == "high_flood_risk":
                success = send_to_renode(b"CMD:SCENARIO:FLOOD\n")
            elif scenario == "normal":
                success = send_to_renode(b"CMD:SCENARIO:NORMAL\n")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok" if success else "deferred", "connected": sock is not None}).encode("utf-8"))

    def log_message(self, format, *args):
        print(f"[HTTP {self.address_string()}] {format % args}")


def run_http_server():
    server = HTTPServer(("127.0.0.1", COMMAND_PORT), CommandHandler)
    print(f"Command server running on port {COMMAND_PORT}")
    server.serve_forever()


def forward_telemetry(line: str):
    try:
        telemetry = json.loads(line)
        if not telemetry.get("device_id"):
            return
        req = urllib.request.Request(
            TELEMETRY_BACKEND,
            json.dumps(telemetry).encode("utf-8"),
            {"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            print(f"RX: {line}")
            print(f"Forwarded telemetry to backend: HTTP {resp.status}")
    except Exception as exc:
        print(f"Telemetry forward error: {exc}")


def read_from_renode():
    global sock
    buffer = ""

    while True:
        try:
            if sock is None:
                connect_to_renode()

            data = sock.recv(4096)
            if not data:
                print("Renode closed the socket. Reconnecting...")
                sock = None
                continue

            buffer += data.decode("utf-8", errors="ignore")
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line:
                    continue
                if line.startswith("{") and line.endswith("}"):
                    forward_telemetry(line)
                else:
                    print(f"RX: {line}")
        except socket.timeout:
            continue
        except OSError as exc:
            print(f"UART Bridge Error: {exc}")
            sock = None
            time.sleep(2)


if __name__ == "__main__":
    print("Starting EnviroShield serial bridge...")
    threading.Thread(target=run_http_server, daemon=True).start()
    read_from_renode()
