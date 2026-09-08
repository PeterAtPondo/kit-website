// Film one window, by name, at a real frame rate, even when something covers it.
//
// The walkthrough films a single window on purpose: the driver's own window is
// never in frame, and a viewer sees the product rather than somebody's desktop.
// Two earlier attempts did not hold (Taz, 8 September 2026, on the first take
// of Henrik's journey):
//
//   screencapture -v -R <rect>   films the pixels in front of that rectangle,
//                                not the window. An agent driving the app can
//                                leave another app covering it, and the film is
//                                of the wrong thing. It did: a browser window
//                                landed over the rectangle in a probe.
//   screencapture -l <id>        takes a still of the right window whatever is
//                                over it, but one at a time: 472 frames in 90
//                                seconds, about five a second, padded out to
//                                thirty by repeating them. Fine for a slide,
//                                wrong for anything that moves.
//
// ScreenCaptureKit films the window itself, off-screen content included, at the
// rate it is asked for. That is the whole reason this file exists.
//
// Usage:
//   swiftc -O window_record.swift -o window_record
//   ./window_record --app "Code" --seconds 120 --out take.mov [--fps 30]
//                   [--title-contains "Society Papers"] [--width 1280]
//
// --app matches the owning application's name, --title-contains narrows to one
// of its windows when several are open (the recording profile and a stale
// instance look alike, which cost the first take a retake). --width scales the
// output, so a 1280 point window on a Retina display is filmed at 2560 and
// written at 1280, which is the series' size.
//
// Needs macOS 13 or newer and Screen Recording permission for the calling
// process. It prints the window it chose before it starts, so a take is never
// of a window nobody looked at.

import AppKit
import AVFoundation
import CoreGraphics
import Foundation
import ScreenCaptureKit

struct Options {
    var app = ""
    var titleContains: String?
    var seconds: Double = 60
    var fps: Int32 = 30
    var out = "take.mov"
    var width: Int?
}

func parseArguments() -> Options {
    var o = Options()
    var i = 1
    let args = CommandLine.arguments
    while i < args.count {
        let key = args[i]
        let value = i + 1 < args.count ? args[i + 1] : ""
        switch key {
        case "--app": o.app = value; i += 2
        case "--title-contains": o.titleContains = value; i += 2
        case "--seconds": o.seconds = Double(value) ?? 60; i += 2
        case "--fps": o.fps = Int32(value) ?? 30; i += 2
        case "--out": o.out = value; i += 2
        case "--width": o.width = Int(value); i += 2
        default:
            FileHandle.standardError.write("unknown argument \(key)\n".data(using: .utf8)!)
            exit(2)
        }
    }
    if o.app.isEmpty {
        FileHandle.standardError.write("--app is required\n".data(using: .utf8)!)
        exit(2)
    }
    return o
}

/// The window to film, chosen out loud rather than guessed at.
func pickWindow(_ o: Options) async throws -> SCWindow {
    let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: false)
    var candidates = content.windows.filter { window in
        guard let owner = window.owningApplication?.applicationName else { return false }
        return owner.localizedCaseInsensitiveContains(o.app) && window.frame.width > 200 && window.frame.height > 200
    }
    if let needle = o.titleContains {
        let narrowed = candidates.filter { ($0.title ?? "").localizedCaseInsensitiveContains(needle) }
        if !narrowed.isEmpty { candidates = narrowed }
    }
    // Largest first: an app's real window over its stray panels and pickers.
    candidates.sort { $0.frame.width * $0.frame.height > $1.frame.width * $1.frame.height }
    guard let chosen = candidates.first else {
        FileHandle.standardError.write("no window of \(o.app) matched\n".data(using: .utf8)!)
        exit(1)
    }
    if candidates.count > 1 {
        let others = candidates.dropFirst().map { "\"\($0.title ?? "")\"" }.joined(separator: ", ")
        print("note: \(candidates.count) windows matched; filming the largest. Others: \(others)")
    }
    return chosen
}

final class Recorder: NSObject, SCStreamOutput {
    private let writer: AVAssetWriter
    private let input: AVAssetWriterInput
    private var started = false
    private var frames = 0
    private(set) var dropped = 0

    init(url: URL, width: Int, height: Int) throws {
        try? FileManager.default.removeItem(at: url)
        writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: width * height * 5,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
            ],
        ])
        input.expectsMediaDataInRealTime = true
        writer.add(input)
        super.init()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, buffer.isValid else { return }
        // A frame the compositor had nothing new for carries no image, and one
        // marked idle or blank is the window unchanged rather than the window
        // gone; neither belongs in the file.
        guard CMSampleBufferGetImageBuffer(buffer) != nil else { return }
        if let attachments = CMSampleBufferGetSampleAttachmentsArray(buffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
           let raw = attachments.first?[.status] as? Int,
           let status = SCFrameStatus(rawValue: raw), status != .complete {
            return
        }
        // The writer must be started before it will ever say it is ready, so
        // an isReadyForMoreMediaData guard placed above this line rejects every
        // frame for ever and writes an empty file. It did (8 September 2026).
        if !started {
            guard writer.startWriting() else {
                FileHandle.standardError.write("writer refused to start: \(writer.error.map { "\($0)" } ?? "no reason given")\n".data(using: .utf8)!)
                return
            }
            writer.startSession(atSourceTime: CMSampleBufferGetPresentationTimeStamp(buffer))
            started = true
        }
        guard input.isReadyForMoreMediaData else {
            dropped += 1
            return
        }
        input.append(buffer)
        frames += 1
    }

    func finish() async -> Int {
        guard started else { return 0 }
        input.markAsFinished()
        await writer.finishWriting()
        return frames
    }
}

let options = parseArguments()

let task = Task.detached { () -> Void in
    let window = try await pickWindow(options)
    let owner = window.owningApplication?.applicationName ?? "?"
    let points = window.frame
    print("filming \(owner) window \"\(window.title ?? "")\" at \(Int(points.width))x\(Int(points.height)) points")

    let configuration = SCStreamConfiguration()
    // Ask for the size the film is written at rather than the window's own
    // pixels: a wide window on a Retina display asks for a buffer nothing will
    // allocate, and the frames never come. ScreenCaptureKit downsamples from
    // native, so asking small costs sharpness only where the window is bigger
    // than the film, which is the point of --width.
    let outWidth = ((options.width ?? Int(points.width)) / 2) * 2
    let outHeight = (Int((Double(outWidth) / points.width) * points.height) / 2) * 2
    configuration.width = outWidth
    configuration.height = outHeight
    configuration.scalesToFit = true
    configuration.minimumFrameInterval = CMTime(value: 1, timescale: options.fps)
    configuration.queueDepth = 8
    configuration.showsCursor = true
    configuration.capturesAudio = false

    let filter = SCContentFilter(desktopIndependentWindow: window)
    let url = URL(fileURLWithPath: options.out)
    let recorder = try Recorder(url: url, width: outWidth, height: outHeight)
    let stream = SCStream(filter: filter, configuration: configuration, delegate: nil)
    try stream.addStreamOutput(recorder, type: .screen, sampleHandlerQueue: DispatchQueue(label: "kit.window.record"))
    try await stream.startCapture()
    print("recording \(options.seconds)s to \(options.out) at \(outWidth)x\(outHeight), \(options.fps)fps")
    try await Task.sleep(nanoseconds: UInt64(options.seconds * 1_000_000_000))
    try await stream.stopCapture()
    let frames = await recorder.finish()
    print("wrote \(frames) frames" + (recorder.dropped > 0 ? ", dropped \(recorder.dropped) the writer could not take" : ""))
    if frames < Int(options.seconds) * Int(options.fps) / 2 {
        print("warning: fewer than half the frames asked for arrived; a still window sends few, which is fine, but check the film")
    }
}

// A command line tool that films the screen still needs to be an application:
// CoreGraphics refuses to initialise without a connection to the window server
// and a running main loop, and blocking the main thread on a semaphore instead
// aborts with CGS_REQUIRE_INIT (8 September 2026). So: an app with no dock icon
// and no menu, whose run loop exists only to keep the capture alive.
let application = NSApplication.shared
application.setActivationPolicy(.prohibited)
Task {
    do {
        try await task.value
        exit(0)
    } catch {
        FileHandle.standardError.write("failed: \(error)\n".data(using: .utf8)!)
        exit(1)
    }
}
application.run()
