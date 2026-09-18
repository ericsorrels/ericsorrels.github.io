// Grab exact frames from a video as JPEGs (no ffmpeg here).
// usage: grab-frame in outPrefix quality maxWidth t1 [t2 ...]
//   writes outPrefix_<t>.jpg for each time t (seconds)

import AVFoundation
import Foundation
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count >= 6, let quality = Double(a[3]), let maxWidth = Double(a[4]) else {
    print("usage: grab-frame in outPrefix quality maxWidth t1 [t2 ...]"); exit(2)
}
let gen = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: a[1])))
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
if maxWidth > 0 { gen.maximumSize = CGSize(width: maxWidth, height: 0) }

for t in a[5...] {
    guard let s = Double(t) else { continue }
    do {
        let img = try gen.copyCGImage(at: CMTime(seconds: s, preferredTimescale: 600), actualTime: nil)
        let out = URL(fileURLWithPath: "\(a[2])_\(t).jpg")
        let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
        CGImageDestinationAddImage(dest, img, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        CGImageDestinationFinalize(dest)
        print("\(out.lastPathComponent) \(img.width)x\(img.height)")
    } catch {
        print("t=\(t) failed: \(error)")
    }
}
