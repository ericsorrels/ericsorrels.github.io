// Builds the site's icon: the hand-painted G lifted out of the title
// artwork and set on a weathered paper ground.
//
// The G is found rather than guessed — the tool reads the artwork's
// pixels and takes the tight bounding box of the ink inside a search
// rect, so a re-export of the title only changes the search rect.
//
//   swiftc -swift-version 5 -O make-icon.swift -o make-icon
//   ./make-icon <title.png> <out.png> <size> [texture] [inset] [weight]

import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// ---- the site's palette, straight from style.css -------------------
let PAPER: (Double, Double, Double) = (0xED, 0xE8, 0xDD)
let PAPER_DIM: (Double, Double, Double) = (0xE2, 0xDC, 0xCA)
let PAPER_SHADOW: (Double, Double, Double) = (0xD3, 0xCC, 0xB8)
let INK: (Double, Double, Double) = (0x1B, 0x1A, 0x17)

// Where in the title artwork the G of GRAY lives — measured with the
// probe tool, which reads the lines of type and the letters in them.
// Top-origin, like the buffer: THE runs y 1202…1459, GRAY 1493…2037,
// MAN 2078…2658. The G itself is x 657…1125, y 1493…2037; this is that
// with room around it, stopping short of the R at x 1150. The exact
// edges are found from the ink inside, so only a re-export moves this.
let SEARCH = CGRect(x: 630, y: 1480, width: 500, height: 580)

// ---- arguments ------------------------------------------------------
let args = CommandLine.arguments
guard args.count >= 4 else {
    FileHandle.standardError.write("usage: make-icon <title.png> <out.png> <size> [texture] [inset] [weight]\n".data(using: .utf8)!)
    exit(2)
}
let sourcePath = args[1]
let outPath = args[2]
let size = Int(args[3]) ?? 512
let texture = args.count > 4 ? (Double(args[4]) ?? 1.0) : 1.0   // 0 = clean paper
let inset = args.count > 5 ? (Double(args[5]) ?? 0.14) : 0.14   // margin around the G
let weight = args.count > 6 ? (Double(args[6]) ?? 1.0) : 1.0    // >1 thickens the strokes

// ---- read the artwork ----------------------------------------------
guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: sourcePath) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    FileHandle.standardError.write("could not read \(sourcePath)\n".data(using: .utf8)!)
    exit(1)
}

let W = image.width, H = image.height
var pixels = [UInt8](repeating: 0, count: W * H * 4)
let rgb = CGColorSpaceCreateDeviceRGB()

// Drawn straight in, with no flip. A bitmap context's first row of
// memory is the TOP of the picture, so this buffer's y runs down the
// image — which is what the extraction below assumes, and what the
// bitmap context that builds the letter assumes when it reads it back.
// Flipping here once cost an afternoon: it inverted the y axis for the
// search rect and handed back an upside-down G.
do {
    guard let ctx = CGContext(data: &pixels, width: W, height: H, bitsPerComponent: 8,
                              bytesPerRow: W * 4, space: rgb,
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(1) }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: W, height: H))
}

// How much ink is on a pixel: dark and opaque counts, pale or clear
// does not. The artwork is a halftone, so this is a coverage figure
// rather than a yes or no — which is what keeps the distressed edge.
@inline(__always) func inkAt(_ x: Int, _ y: Int) -> Double {
    let i = (y * W + x) * 4
    let a = Double(pixels[i + 3]) / 255.0
    if a < 0.02 { return 0 }
    // premultiplied, so undo the alpha before judging the darkness
    let r = Double(pixels[i]) / 255.0 / a
    let g = Double(pixels[i + 1]) / 255.0 / a
    let b = Double(pixels[i + 2]) / 255.0 / a
    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return max(0, min(1, (1.0 - luma))) * a
}

// ---- find the G -----------------------------------------------------
let sx0 = max(0, Int(SEARCH.minX)), sx1 = min(W, Int(SEARCH.maxX))
let sy0 = max(0, Int(SEARCH.minY)), sy1 = min(H, Int(SEARCH.maxY))

var minX = sx1, maxX = sx0, minY = sy1, maxY = sy0
for y in sy0..<sy1 {
    for x in sx0..<sx1 where inkAt(x, y) > 0.45 {
        if x < minX { minX = x }; if x > maxX { maxX = x }
        if y < minY { minY = y }; if y > maxY { maxY = y }
    }
}
guard maxX > minX, maxY > minY else {
    FileHandle.standardError.write("no ink found in the search rect\n".data(using: .utf8)!)
    exit(1)
}
let gw = maxX - minX + 1, gh = maxY - minY + 1
FileHandle.standardError.write("G found at x \(minX)…\(maxX), y \(minY)…\(maxY)  (\(gw)×\(gh))\n".data(using: .utf8)!)

// ---- the G as ink-coloured artwork ----------------------------------
// Built at the source's own resolution and scaled down once, at the
// end, so the halftone edge survives rather than being resampled twice.
var letter = [UInt8](repeating: 0, count: gw * gh * 4)
for y in 0..<gh {
    for x in 0..<gw {
        var cover = inkAt(minX + x, minY + y)
        if weight != 1.0 { cover = min(1, cover * weight) }
        let i = (y * gw + x) * 4
        letter[i]     = UInt8(INK.0 * cover)      // premultiplied
        letter[i + 1] = UInt8(INK.1 * cover)
        letter[i + 2] = UInt8(INK.2 * cover)
        letter[i + 3] = UInt8(cover * 255)
    }
}
let letterImage: CGImage = letter.withUnsafeMutableBytes { raw -> CGImage in
    let ctx = CGContext(data: raw.baseAddress, width: gw, height: gh, bitsPerComponent: 8,
                        bytesPerRow: gw * 4, space: rgb,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    return ctx.makeImage()!
}

// ---- weathered paper ------------------------------------------------
@inline(__always) func hash2(_ x: Int, _ y: Int, _ seed: Int) -> Double {
    var h = UInt64(bitPattern: Int64(x &* 374761393 &+ y &* 668265263 &+ seed &* 1442695040))
    h ^= h >> 13; h = h &* 1274126177; h ^= h >> 16
    return Double(h & 0xFFFFFF) / Double(0xFFFFFF)
}

func valueNoise(_ x: Double, _ y: Double, _ seed: Int) -> Double {
    let xi = Int(floor(x)), yi = Int(floor(y))
    let xf = x - floor(x), yf = y - floor(y)
    let u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    let a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed)
    let c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

func fbm(_ x: Double, _ y: Double, _ seed: Int, _ octaves: Int) -> Double {
    var sum = 0.0, amp = 0.5, freq = 1.0, norm = 0.0
    for o in 0..<octaves {
        sum += amp * valueNoise(x * freq, y * freq, seed &+ o &* 977)
        norm += amp; amp *= 0.5; freq *= 2.06
    }
    return sum / norm
}

@inline(__always) func mix(_ a: (Double, Double, Double), _ b: (Double, Double, Double), _ t: Double) -> (Double, Double, Double) {
    (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t, a.2 + (b.2 - a.2) * t)
}

// Rendered at four times the finished size and brought down at the end,
// so the grain lands as grain rather than as visible dots.
let SS = size <= 64 ? 8 : 4
let big = size * SS
var paper = [UInt8](repeating: 0, count: big * big * 4)

for y in 0..<big {
    for x in 0..<big {
        let u = Double(x) / Double(big), v = Double(y) / Double(big)

        // Broad mottling: the uneven tone of a sheet that has been damp.
        let stain = fbm(u * 3.1, v * 3.1, 17, 4)
        var colour = mix(PAPER, PAPER_DIM, max(0, min(1, (stain - 0.42) * 2.1)) * texture)

        // A second, coarser pass for the darker patches at the edges.
        let deep = fbm(u * 1.7 + 11.3, v * 1.7 + 4.9, 43, 3)
        colour = mix(colour, PAPER_SHADOW, max(0, min(1, (deep - 0.58) * 1.7)) * 0.75 * texture)

        // Aged edges: a sheet darkens where it has been handled.
        let dx = u - 0.5, dy = v - 0.5
        let edge = max(0, min(1, (sqrt(dx * dx + dy * dy) - 0.30) / 0.42))
        colour = mix(colour, PAPER_SHADOW, edge * edge * 0.55 * texture)

        // And the fibre of the paper itself.
        let grain = (hash2(x, y, 7) - 0.5) * 9.0 * texture
        let i = (y * big + x) * 4
        paper[i]     = UInt8(max(0, min(255, colour.0 + grain)))
        paper[i + 1] = UInt8(max(0, min(255, colour.1 + grain)))
        paper[i + 2] = UInt8(max(0, min(255, colour.2 + grain)))
        paper[i + 3] = 255
    }
}

// ---- set the letter on it -------------------------------------------
let canvas = CGContext(data: nil, width: big, height: big, bitsPerComponent: 8,
                       bytesPerRow: 0, space: rgb,
                       bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
let paperImage: CGImage = paper.withUnsafeMutableBytes { raw -> CGImage in
    CGContext(data: raw.baseAddress, width: big, height: big, bitsPerComponent: 8,
              bytesPerRow: big * 4, space: rgb,
              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!.makeImage()!
}
canvas.draw(paperImage, in: CGRect(x: 0, y: 0, width: big, height: big))

// The G keeps its own proportions and sits on the optical centre —
// a shade above the true one, which is where an eye expects a letter.
let room = Double(big) * (1.0 - inset * 2.0)
let scale = min(room / Double(gw), room / Double(gh))
let dw = Double(gw) * scale, dh = Double(gh) * scale
let dx = (Double(big) - dw) / 2.0
let dy = (Double(big) - dh) / 2.0 - Double(big) * 0.012
canvas.interpolationQuality = .high
canvas.draw(letterImage, in: CGRect(x: dx, y: dy, width: dw, height: dh))

guard let full = canvas.makeImage() else { exit(1) }

// ---- down to the finished size --------------------------------------
let out = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                    bytesPerRow: 0, space: rgb,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
out.interpolationQuality = .high
out.draw(full, in: CGRect(x: 0, y: 0, width: size, height: size))
guard let finished = out.makeImage() else { exit(1) }

guard let dest = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: outPath) as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(1) }
CGImageDestinationAddImage(dest, finished, nil)
guard CGImageDestinationFinalize(dest) else { exit(1) }
FileHandle.standardError.write("wrote \(outPath) at \(size)×\(size)\n".data(using: .utf8)!)
