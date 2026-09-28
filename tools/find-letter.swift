// Reports where the lines of type and the individual letters sit in the
// title artwork, so the icon tool can be pointed at the G exactly.

import Foundation
import CoreGraphics
import ImageIO

let path = CommandLine.arguments[1]
guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else { exit(1) }

let W = image.width, H = image.height
var px = [UInt8](repeating: 0, count: W * H * 4)
let rgb = CGColorSpaceCreateDeviceRGB()
do {
    guard let ctx = CGContext(data: &px, width: W, height: H, bitsPerComponent: 8,
                              bytesPerRow: W * 4, space: rgb,
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(1) }
    // No flip. A bitmap context's first row of memory is the TOP of the
    // picture, so drawing straight in gives a buffer whose y runs down
    // the image — the same direction every reader here assumes.
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: W, height: H))
}

@inline(__always) func ink(_ x: Int, _ y: Int) -> Bool {
    let i = (y * W + x) * 4
    let a = Double(px[i + 3]) / 255.0
    if a < 0.5 { return false }
    let r = Double(px[i]) / 255.0 / a, g = Double(px[i + 1]) / 255.0 / a, b = Double(px[i + 2]) / 255.0 / a
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 0.5
}

// Rows carrying ink → the lines of type.
var rowHas = [Bool](repeating: false, count: H)
for y in 0..<H { for x in 0..<W where ink(x, y) { rowHas[y] = true; break } }

print("LINES (rows of type):")
var bands: [(Int, Int)] = []
var y = 0
while y < H {
    if rowHas[y] {
        let start = y
        while y < H && rowHas[y] { y += 1 }
        if y - start > 20 { bands.append((start, y - 1)) }
    } else { y += 1 }
}
for (i, b) in bands.enumerated() { print("  line \(i): y \(b.0)…\(b.1)  height \(b.1 - b.0 + 1)") }

// Within each line, columns carrying ink → the letters.
for (i, b) in bands.enumerated() {
    var colHas = [Bool](repeating: false, count: W)
    for x in 0..<W { for yy in b.0...b.1 where ink(x, yy) { colHas[x] = true; break } }
    var letters: [(Int, Int)] = []
    var x = 0
    while x < W {
        if colHas[x] {
            let start = x
            while x < W && colHas[x] { x += 1 }
            if x - start > 12 { letters.append((start, x - 1)) }
        } else { x += 1 }
    }
    print("LINE \(i) letters (x ranges):")
    for (j, l) in letters.enumerated() {
        // tight vertical extent of this letter alone
        var top = b.1, bot = b.0
        for yy in b.0...b.1 {
            for xx in l.0...l.1 where ink(xx, yy) {
                if yy < top { top = yy }; if yy > bot { bot = yy }; break
            }
        }
        print("  [\(j)] x \(l.0)…\(l.1) (w \(l.1 - l.0 + 1))  y \(top)…\(bot) (h \(bot - top + 1))")
    }
}
