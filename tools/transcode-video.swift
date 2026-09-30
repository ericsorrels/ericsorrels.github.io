// Web transcode with explicit control avconvert's presets don't offer:
// H.264 High at a chosen size and average bitrate, keyframes every 2s
// (so scrubbing is snappy), BT.709 tags, fast-start (moov first).
//
// Audio: AAC is passed through untouched, because it is already what
// the web wants and re-encoding would only lose a little for nothing.
// ANYTHING ELSE IS ENCODED TO AAC at 128 kbps stereo. A camera or an
// editor will hand you uncompressed LPCM — a 106-second clip carried
// 30 MB of it, more than the whole video budget — and LPCM inside an
// .mp4 is not reliably playable in a browser at all. Passing that
// through produced a file that looked fine here and would have been
// silent for a good share of visitors.
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

// Is the source already AAC? If so it is left alone; if not it has to be
// decoded to LPCM here so the writer can encode it to AAC below.
var audioIsAAC = false
if let a = aTrack, let d = a.formatDescriptions.first {
    let sub = CMFormatDescriptionGetMediaSubType(d as! CMFormatDescription)
    audioIsAAC = (sub == kAudioFormatMPEG4AAC)
    let tag = String(bytes: [UInt8((sub >> 24) & 255), UInt8((sub >> 16) & 255),
                             UInt8((sub >> 8) & 255), UInt8(sub & 255)],
                     encoding: .ascii) ?? "?"
    print("source audio: \(tag) — \(audioIsAAC ? "passed through" : "re-encoded to AAC 128k")")
}

var aOut: AVAssetReaderTrackOutput?
if let a = aTrack {
    let o = AVAssetReaderTrackOutput(
        track: a,
        outputSettings: audioIsAAC ? nil : [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false,
        ])
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
    let i: AVAssetWriterInput
    if audioIsAAC {
        i = AVAssetWriterInput(mediaType: .audio, outputSettings: nil,
                               sourceFormatHint: (hint as! CMFormatDescription))
    } else {
        // Channel count is taken from the source rather than assumed: a
        // camera may hand over one channel or four, and asking the
        // encoder for two it hasn't got fails at startWriting.
        var channels = 2
        if let basic = CMAudioFormatDescriptionGetStreamBasicDescription(hint as! CMFormatDescription) {
            channels = min(2, max(1, Int(basic.pointee.mChannelsPerFrame)))
        }
        i = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 48000,
            AVNumberOfChannelsKey: channels,
            AVEncoderBitRateKey: channels > 1 ? 128000 : 96000,
        ])
    }
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
