#!/usr/bin/env python3
"""Local preview server for the site.

Python's own `http.server` can't send part of a file, so dragging the
seek bar on a track sends the song back to the beginning — which the
live site doesn't do. This serves ranges properly, so the album (and the
lyrics following it) behave here the way they will once published.

It also tells the browser not to keep copies, so an edited file shows up
on refresh without a fight.

    python3 tools/preview-server.py          # http://localhost:8420
    python3 tools/preview-server.py 9000     # another port
    python3 tools/preview-server.py --phone  # also reachable from a handset

Without --phone it answers only this machine, which is what a preview
should do. With it, it answers anything on the same Wi-Fi and prints the
address to type into a phone — the only way to try the touch gestures on
the album page, since a desktop browser fakes them badly. It is still a
preview: turn it off when you're done, and don't run it on Wi-Fi you
don't know.
"""

import http.server
import os
import re
import socket
import socketserver
import sys

ARGS = sys.argv[1:]
OPEN_TO_WIFI = "--phone" in ARGS
PORTS = [a for a in ARGS if not a.startswith("-")]
PORT = int(PORTS[0]) if PORTS else 8420
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def wifi_address():
    """This machine's address on the local network, as a phone sees it."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Nothing is sent: this only asks the routing table which of our
        # own addresses would be used to reach the wider network.
        probe.connect(("192.0.2.1", 9))
        return probe.getsockname()[0]
    except OSError:
        return None
    finally:
        probe.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        """Serve a byte range when one is asked for; otherwise as usual."""
        asked = self.headers.get("Range")
        if not asked:
            return super().send_head()

        match = re.match(r"bytes=(\d*)-(\d*)$", asked.strip())
        if not match:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        try:
            handle = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        size = os.fstat(handle.fileno()).st_size
        first, last = match.group(1), match.group(2)

        if first == "":                      # bytes=-500 — the tail
            length = min(int(last or 0), size)
            start, end = size - length, size - 1
        else:
            start = int(first)
            end = int(last) if last else size - 1

        end = min(end, size - 1)
        if start > end or start >= size:
            handle.close()
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return None

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()

        handle.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = handle.read(min(64 * 1024, remaining))
            if not chunk:
                break
            try:
                self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                break            # the browser moved on; normal while scrubbing
            remaining -= len(chunk)
        handle.close()
        return None

    def log_message(self, *args):
        pass                     # quiet; errors still come through stderr


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    host = "0.0.0.0" if OPEN_TO_WIFI else "127.0.0.1"
    with Server((host, PORT), Handler) as server:
        print("The Gray Man — preview at http://localhost:%d" % PORT)
        if OPEN_TO_WIFI:
            found = wifi_address()
            if found:
                print("\nOn a phone on the same Wi-Fi, open:")
                print("    http://%s:%d/access.html" % (found, PORT))
            else:
                print("\nOpen to the Wi-Fi, but this Mac's address could not be"
                      "\nfound. Look under System Settings > Wi-Fi > Details.")
        print("\nServing %s\nStop it with Control-C." % ROOT)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
