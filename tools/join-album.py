#!/usr/bin/env python3
"""Join the album's twenty songs into one continuous recording.

    python3 tools/join-album.py "/Users/ericsorrels/Desktop/Gray Man Continuous"

Reads 01.wav, 02.wav … from that folder, in order, and writes ONE wav
with them end to end and nothing whatever added between. Then it prints
where each song starts, which is what goes into content.js.

WHY THE ALBUM IS ONE FILE NOW
-----------------------------
The songs run straight into each other, and twenty separate files
cannot be joined without a gap — something has to be fetched and
decoded at every join. Scheduling the next song on the exact sample the
last one ends is possible, but only through the browser's Web Audio
machinery, and an iPhone SUSPENDS that the moment the screen locks. So
the album stopped when Eric locked his phone. Gaplessness and playing
behind a locked screen were the same machinery, and we could not have
both.

One continuous recording has no joins to be gapless across. It plays
through an ordinary audio element, which an iPhone is perfectly happy
to go on playing with the screen off, and the track list becomes
twenty positions inside it.

NOTHING IS ALTERED. No trimming, no fading, no normalising, no silence
inserted or removed. Eric bounced each wav exactly as he wants it heard
— including the silences, which are deliberate — and this copies the
samples across untouched. The boundaries it prints are therefore the
truth about the file, measured rather than typed, which is what keeps
the track list, the clocks and the lyrics in step with the sound.

It streams rather than loading the album into memory: 60 minutes of
16-bit stereo is about 640 MB.
"""

import os
import sys
import wave

CHUNK = 1 << 20          # frames per read, so memory stays flat


def fail(message):
    sys.stderr.write('\n' + message + '\n')
    raise SystemExit(1)


def main():
    if len(sys.argv) < 2:
        fail('Say which folder the wavs are in:\n'
             '    python3 tools/join-album.py "/path/to/folder"')

    folder = sys.argv[1]
    if not os.path.isdir(folder):
        fail('There is no folder at:\n    %s' % folder)

    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(folder, 'album.wav')

    names = sorted(f for f in os.listdir(folder)
                   if f.lower().endswith('.wav') and f[0].isdigit())
    if not names:
        fail('No numbered .wav files in:\n    %s' % folder)

    # Every file has to agree about its shape, or the join is nonsense:
    # one song at a different sample rate plays at the wrong speed, and
    # a mono file among stereo ones swaps the channels of everything
    # after it. Checked before a single sample is written.
    shapes = {}
    for name in names:
        with wave.open(os.path.join(folder, name), 'rb') as w:
            shapes[name] = (w.getnchannels(), w.getsampwidth(), w.getframerate())

    distinct = set(shapes.values())
    if len(distinct) != 1:
        lines = ['The files do not all share one format, so they cannot be',
                 'joined as they are. What each one is:', '']
        for name in names:
            ch, width, rate = shapes[name]
            lines.append('    %s   %d channel(s)  %d-bit  %d Hz' % (name, ch, width * 8, rate))
        lines += ['', 'Export them all the same and run this again.']
        fail('\n'.join(lines))

    channels, width, rate = distinct.pop()

    print('Joining %d songs — %d ch, %d-bit, %d Hz' % (len(names), channels, width * 8, rate))
    print()

    starts = []
    at = 0                                    # frames written so far

    with wave.open(out_path, 'wb') as out:
        out.setnchannels(channels)
        out.setsampwidth(width)
        out.setframerate(rate)

        for name in names:
            with wave.open(os.path.join(folder, name), 'rb') as w:
                frames = w.getnframes()
                starts.append((name, at, frames))
                print('  %-10s starts at %9.3f s   runs %8.3f s'
                      % (name, at / rate, frames / rate))
                left = frames
                while left > 0:
                    data = w.readframes(min(CHUNK, left))
                    if not data:
                        break                 # a truncated file; counted below
                    out.writeframes(data)
                    left -= len(data) // (channels * width)
                at += frames - left

    # Read the finished file back rather than trusting the arithmetic
    # above. A short write here would put every song after it in the
    # wrong place, silently.
    with wave.open(out_path, 'rb') as check:
        written = check.getnframes()

    print()
    if written != at:
        fail('The joined file holds %d frames where %d were written.\n'
             'Something went wrong; do not use it.' % (written, at))

    print('Wrote %s' % out_path)
    print('  %d frames = %.3f s = %d min %05.2f s, %.2f GB'
          % (written, written / rate, written // rate // 60,
             (written / rate) % 60, (written * channels * width + 44) / 1e9))
    print('  every song accounted for, and the length adds up exactly')

    print()
    print('For content.js → access.track_starts (seconds):')
    print()
    print('    track_starts: [')
    for i, (name, start, frames) in enumerate(starts):
        print('      %-12s // %02d  %s'
              % ('%.6f,' % (start / rate), i + 1, name))
    print('    ],')
    print('    album_length: %.6f,' % (written / rate))


if __name__ == '__main__':
    main()
