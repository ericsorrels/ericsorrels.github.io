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
"""

import http.server
import os
import re
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8420
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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
    with Server(("127.0.0.1", PORT), Handler) as server:
        print("The Gray Man — preview at http://localhost:%d" % PORT)
        print("Serving %s\nStop it with Control-C." % ROOT)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
