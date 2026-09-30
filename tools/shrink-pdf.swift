// Shrink a PDF by re-compressing its IMAGES ONLY. Text and vectors are
// replayed into the new document untouched, so lyrics stay selectable,
// searchable and sharp at any zoom.
//
// usage: shrink-pdf in out quality [maxDPI]
//        quality  0…1, JPEG quality for the images
//        maxDPI   images above this are downsampled to it (default 2400,
//                 i.e. effectively never — pass a real number only if a
//                 master is genuinely over-resolution)
//
// WHY THIS AND NOT A RENDER. The obvious way to shrink a PDF is to draw
// each page into a bitmap and build a new PDF of those. Do not: this
// booklet has real text on 33 of its 38 pages, and rendering turns all
// of it into fuzzy, unselectable pixels. A Quartz filter — the machinery
// behind Preview's "Reduce File Size" — touches images and nothing else.
//
// WHY IT IS USUALLY A HUGE WIN. Design tools export artwork as lossless
// Flate, which for painted or photographic art is enormously wasteful.
// The lyric booklet arrived at 101.8 MB holding 42 images whose pixels
// were already only ~130 dpi — so there was nothing to gain by
// downsampling and everything to gain by re-compressing. At quality 0.92
// it came out at 9.9 MB, under a tenth, with every image at its original
// pixel dimensions. Checked at 3x zoom on painted texture: no visible
// difference.
//
// KNOWN AND ACCEPTED: a page whose text sits over artwork with
// transparency gets flattened, and loses its selectability while looking
// identical. On the booklet that was 2 pages of 38 — the title and the
// last — and both are display type nobody selects. Putting the original
// pages back costs 4.3 MB and does NOT restore the text, because
// PDFDocument.write re-flattens them; that was measured, so don't try it
// again.

import Foundation
import Quartz

let a = CommandLine.arguments
guard a.count >= 4, let quality = Double(a[3]) else {
    print("usage: shrink-pdf in out quality [maxDPI]")
    exit(2)
}
let maxDPI = a.count >= 5 ? (Int(a[4]) ?? 2400) : 2400
let inURL = URL(fileURLWithPath: a[1])
let outURL = URL(fileURLWithPath: a[2])

let plist: [String: Any] = [
    "Name": "tgm-shrink",
    "FilterType": 1,
    "Domains": ["Applications": true, "Printing": true],
    "FilterData": [
        "ColorSettings": [
            "ImageSettings": [
                "ImageCompression": "ImageJPEGCompress",
                "Compression Quality": quality,
                "ImageScaleSettings": [
                    "ImageResolution": maxDPI,
                    "ImageScaleInterpolate": true,
                    "ImageSizeMax": 20000,
                    "ImageSizeMin": 0,
                ],
            ]
        ]
    ],
]

let fURL = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent("tgm-shrink.qfilter")
try! (plist as NSDictionary).write(to: fURL)

guard let filter = QuartzFilter(url: fURL) else { print("filter failed to load"); exit(1) }
guard let doc = CGPDFDocument(inURL as CFURL) else { print("cannot open input"); exit(1) }
guard let first = doc.page(at: 1) else { print("no pages"); exit(1) }

var box = first.getBoxRect(.mediaBox)
try? FileManager.default.removeItem(at: outURL)
guard let ctx = CGContext(outURL as CFURL, mediaBox: &box, nil) else { print("cannot write"); exit(1) }
guard filter.apply(to: ctx) else { print("filter did not apply"); exit(1) }

// Each page keeps its own box, so a booklet that mixes page sizes
// survives; the context's box is only the default.
for i in 1...doc.numberOfPages {
    guard let page = doc.page(at: i) else { continue }
    var pbox = page.getBoxRect(.mediaBox)
    ctx.beginPage(mediaBox: &pbox)
    ctx.drawPDFPage(page)
    ctx.endPage()
}
ctx.closePDF()

let before = (try? FileManager.default.attributesOfItem(atPath: a[1])[.size] as? NSNumber)??.intValue ?? 0
let after = (try? FileManager.default.attributesOfItem(atPath: a[2])[.size] as? NSNumber)??.intValue ?? 0
print(String(format: "%.1f MB -> %.1f MB (%.0f%% of the original), %d pages",
             Double(before) / 1_000_000, Double(after) / 1_000_000,
             before > 0 ? Double(after) * 100 / Double(before) : 0,
             doc.numberOfPages))
