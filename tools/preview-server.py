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
import json
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


# The album's files are not part of the website any more. They live in
# private storage at Cloudflare and are handed out by a small program
# there — see cloudflare/vault-worker.js — at addresses beginning
# /vault-api/. None of that exists on this machine, so a local preview
# would show an album of silent tracks with no words.
#
# So, for the preview only, /vault-api/audio/01.mp3 is answered from
# assets/audio/01.mp3 on disk, and the same for lyrics, notes and
# downloads. There is no password here and none is asked for: this
# server listens on localhost, the files are already sitting on Eric's
# own computer, and a lock between him and his own folder would protect
# nothing. Nothing in this file is published — it is a tool, not part
# of the site.
VAULT_PREFIX = "/vault-api/"
VAULT_FOLDERS = ("audio/", "lyrics/", "notes/", "downloads/")

# Two switches for testing the gate, which a preview would otherwise
# never show, since it lets everyone straight through.
#
#   TGM_PREVIEW=locked   the relay says "not signed in", so the gate
#                        appears and can be worked through end to end.
#                        No email is sent and nothing is on any list:
#                        any address is accepted, and the code is always
#                        PREVIEW_CODE, which is printed at startup.
#   TGM_PREVIEW=offline  the relay refuses to answer at all, which is
#                        what a dropped connection looks like
#
# Unset, everything is open — which is what a preview should be.
#
# Both can be given as plain flags too — --locked and --offline — which
# is the same switch by another route. The environment variable came
# first; the flags were added because some ways of starting this server
# can pass arguments but not environment, and a test that cannot be run
# from the tooling to hand tends not to get run.
#
# To try the error lines, type something that isn't an address (the
# mistyped-address line), or a wrong six digits (the wrong-code line).
PREVIEW_MODE = os.environ.get("TGM_PREVIEW", "").strip().lower()
if "--locked" in ARGS:
    PREVIEW_MODE = "locked"
elif "--offline" in ARGS:
    PREVIEW_MODE = "offline"
PREVIEW_CODE = "123456"


class Handler(http.server.SimpleHTTPRequestHandler):
    # Python labels an .m4a file "audio/mp4a-latm", which is a different
    # thing altogether — LATM is a streaming wrapper, not a file — and
    # Safari refuses it. Cloudflare gets this right on the live site, so
    # without these two lines the album would play everywhere except in
    # Eric's own preview, which is the worst way round. Named here
    # rather than left to the system's guess.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def translate_path(self, path):
        """Map the relay's addresses onto the folders under assets/."""
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith(VAULT_PREFIX):
            rest = clean[len(VAULT_PREFIX):]
            if any(rest.startswith(folder) for folder in VAULT_FOLDERS):
                path = "/assets/" + rest
        return super().translate_path(path)

    def do_POST(self):
        """Signing in, answered locally so the gate works in a preview."""
        route = self.path.split("?", 1)[0]
        if route not in (VAULT_PREFIX + "request-code",
                         VAULT_PREFIX + "verify-code"):
            return self.send_error(404)

        if PREVIEW_MODE == "offline":
            return self.hang_up()

        if PREVIEW_MODE != "locked":
            # Wide open, so the gate never appears and nothing has to be
            # typed to reach Eric's own files on Eric's own computer.
            return self.answer(200, b'{"ok":true}')

        sent = self.read_json()
        address = str(sent.get("email") or "").strip().lower()

        # The same rough look the relay takes, so the mistyped-address
        # line can be seen here. Nothing is checked against any list:
        # there is no list locally, and any address is let through.
        looks_like_email = (
            "@" in address[1:] and "." in address.split("@")[-1]
            and " " not in address
        )

        if route.endswith("request-code"):
            if not looks_like_email:
                return self.answer(400, b'{"ok":false,"reason":"bad-email"}')
            print("  preview: the code is %s" % PREVIEW_CODE)
            return self.answer(200, b'{"ok":true}')

        digits = "".join(c for c in str(sent.get("code") or "") if c.isdigit())
        if digits != PREVIEW_CODE:
            return self.answer(401, b'{"ok":false,"reason":"wrong"}')
        return self.answer(200, b'{"ok":true}')

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return {}

    def do_GET(self):
        if self.path.split("?", 1)[0] == VAULT_PREFIX + "session":
            if PREVIEW_MODE == "offline":
                return self.hang_up()
            if PREVIEW_MODE == "locked":
                return self.answer(401, b'{"ok":false}')
            return self.answer(200, b'{"ok":true}')
        super().do_GET()

    def answer(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def hang_up(self):
        """Close without answering — what an unreachable relay looks like."""
        try:
            self.close_connection = True
            self.connection.close()
        except OSError:
            pass

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
        if PREVIEW_MODE == "locked":
            print("\nThe gate is showing. Any email address is accepted here,"
                  "\nnothing is posted, and the code is always %s." % PREVIEW_CODE)
        elif PREVIEW_MODE == "offline":
            print("\nThe relay is playing dead, so the gate shows its"
                  "\n'out of reach' line.")
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
