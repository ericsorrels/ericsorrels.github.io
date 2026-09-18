// Web transcode with explicit control avconvert's presets don't offer:
// H.264 High at a chosen size and average bitrate, keyframes every 2s
// (so scrubbing is snappy), BT.709 tags, fast-start (moov first), and
// the source AAC audio passed through untouched.
//
// usage: transcode-video in out width height videoBitsPerSecond [start duration]

import AVFoundation
import Foundation

let args = CommandLine.arguments
guard args.count >= 6,
      let width = Int(args[3]), let height = Int(args[4]), let bitrate = Int(args[5]) else {
    print("usage: transcode-video in out width height videoBitsPerSecond [start duration]")
    exit(2)
}
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
try? FileManager.default.removeItem(at: outURL)

let asset = AVURLAsset(url: inURL)
guard let vTrack = asset.tracks(withMediaType: .video).first else { print("no video track"); exit(1) }
let aTrack = asset.tracks(withMediaType: .audio).first
let fps = vTrack.nominalFrameRate
print("source: \(Int(vTrack.naturalSize.width))x\(Int(vTrack.naturalSize.height)) @ \(fps) fps")

let reader = try! AVAssetReader(asset: asset)
if args.count >= 8, let s = Double(args[6]), let d = Double(args[7]) {
    reader.timeRange = CMTimeRange(start: CMTime(seconds: s, preferredTimescale: 600),
                                   duration: CMTime(seconds: d, preferredTimescale: 600))
}

let vOut = AVAssetReaderTrackOutput(track: vTrack, outputSettings: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
])
vOut.alwaysCopiesSampleData = false
reader.add(vOut)

var aOut: AVAssetReaderTrackOutput?
if let a = aTrack {
    let o = AVAssetReaderTrackOutput(track: a, outputSettings: nil)   // passthrough
    o.alwaysCopiesSampleData = false
    reader.add(o)
    aOut = o
}

let writer = try! AVAssetWriter(outputURL: outURL, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true

let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoScalingModeKey: AVVideoScalingModeResizeAspect,
    AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
    ],
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: bitrate,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
        AVVideoMaxKeyFrameIntervalDurationKey: 2.0,
        AVVideoExpectedSourceFrameRateKey: Int(fps.rounded()),
        AVVideoAllowFrameReorderingKey: true,
    ],
])
vIn.expectsMediaDataInRealTime = false
vIn.transform = vTrack.preferredTransform
writer.add(vIn)

var aIn: AVAssetWriterInput?
if let a = aTrack, let hint = a.formatDescriptions.first {
    let i = AVAssetWriterInput(mediaType: .audio, outputSettings: nil,
                               sourceFormatHint: (hint as! CMFormatDescription))
    i.expectsMediaDataInRealTime = false
    writer.add(i)
    aIn = i
}

guard reader.startReading() else { print("reader:", reader.error!); exit(1) }
guard writer.startWriting() else { print("writer:", writer.error!); exit(1) }
writer.startSession(atSourceTime: reader.timeRange.start)

let group = DispatchGroup()
func pump(_ input: AVAssetWriterInput, _ output: AVAssetReaderTrackOutput, _ label: String) {
    group.enter()
    var done = false
    input.requestMediaDataWhenReady(on: DispatchQueue(label: label)) {
        while !done && input.isReadyForMoreMediaData {
            guard let sample = output.copyNextSampleBuffer(), input.append(sample) else {
                done = true
                input.markAsFinished()
                group.leave()
                return
            }
        }
    }
}
pump(vIn, vOut, "video")
if let i = aIn, let o = aOut { pump(i, o, "audio") }
group.wait()

if reader.status == .failed { print("reader failed:", reader.error!); exit(1) }
let finished = DispatchSemaphore(value: 0)
writer.finishWriting { finished.signal() }
finished.wait()
guard writer.status == .completed else { print("writer failed:", writer.error ?? "unknown"); exit(1) }
print("ok")
