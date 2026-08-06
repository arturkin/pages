import Foundation
import CoreGraphics
import ImageIO

// ─────────────────────────────────────────────────────────────────────────────
// checkcrops — grade every cropped picture, so a bad crop is caught rather than
// published as if it were a sign.
//
//   checkcrops <workDir> [namePrefix]
//
// Two failure modes matter, both invisible to the code that produced the crop:
//
//   cut       content runs off an edge, so the sign is sliced through. Detected
//             from the border ring: a correctly framed sign is surrounded by
//             paper, so its outermost pixels are blank.
//   text-only  the crop caught a caption instead of a graphic. Detected from
//             component structure: a sign is one dominant shape, whereas text is
//             many small blobs sitting side by side.
//
// Writes <workDir>/crop-qa.json and prints a summary.
// ─────────────────────────────────────────────────────────────────────────────

struct Verdict: Codable {
    var file: String
    var w: Int
    var h: Int
    var borderContent: Double   // share of the border ring holding content
    var contentFrac: Double     // share of the crop holding content
    var largestCompFrac: Double // biggest component, relative to crop area
    var compCount: Int          // components big enough to matter
    var meanChroma: Double
    var verdict: String         // ok | cut | text-only | blank
}

let args = Array(CommandLine.arguments.dropFirst())
guard !args.isEmpty else { fputs("usage: checkcrops <workDir> [prefix]\n", stderr); exit(2) }
let work = URL(fileURLWithPath: args[0])
let prefix = args.count > 1 ? args[1] : ""
let figDir = work.appendingPathComponent("figures")

let fm = FileManager.default
let names = ((try? fm.contentsOfDirectory(atPath: figDir.path)) ?? [])
    .filter { $0.hasSuffix(".png") && $0.hasPrefix(prefix) }.sorted()

var out: [Verdict] = []

for name in names {
    guard let src = CGImageSourceCreateWithURL(figDir.appendingPathComponent(name) as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }

    // Analyse at modest size; structure survives downscaling, and this keeps a
    // 477-crop sweep fast.
    let maxDim = 260
    let s = min(1.0, Double(maxDim) / Double(max(img.width, img.height)))
    let W = max(4, Int(Double(img.width) * s)), H = max(4, Int(Double(img.height) * s))
    var rgba = [UInt8](repeating: 255, count: W * H * 4)
    rgba.withUnsafeMutableBytes { raw in
        guard let ctx = CGContext(data: raw.baseAddress, width: W, height: H, bitsPerComponent: 8,
                                  bytesPerRow: W * 4, space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
        ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
        ctx.interpolationQuality = .high
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: W, height: H))
    }

    // Content = coloured or dark. Paper is neither.
    var content = [Bool](repeating: false, count: W * H)
    var chromaSum = 0.0
    var contentN = 0
    for i in 0..<(W * H) {
        let r = Int(rgba[i * 4]), g = Int(rgba[i * 4 + 1]), b = Int(rgba[i * 4 + 2])
        let mx = max(r, max(g, b)), mn = min(r, min(g, b))
        let c = (mx - mn) > 40 || mx < 165
        content[i] = c
        if c { chromaSum += Double(mx - mn); contentN += 1 }
    }
    let contentFrac = Double(contentN) / Double(W * H)
    let meanChroma = contentN == 0 ? 0 : chromaSum / Double(contentN)

    // Border ring, two pixels deep: a well-framed sign has paper all round it.
    var ringN = 0, ringContent = 0
    let d = 2
    for y in 0..<H {
        for x in 0..<W where x < d || x >= W - d || y < d || y >= H - d {
            ringN += 1
            if content[y * W + x] { ringContent += 1 }
        }
    }
    let borderContent = ringN == 0 ? 0 : Double(ringContent) / Double(ringN)

    // Connected components of content.
    var seen = [Bool](repeating: false, count: W * H)
    var comps: [Int] = []
    var stack: [Int] = []
    for start in 0..<(W * H) {
        if !content[start] || seen[start] { continue }
        var area = 0
        stack.removeAll(keepingCapacity: true)
        stack.append(start); seen[start] = true
        while let p = stack.popLast() {
            let x = p % W, y = p / W
            area += 1
            if x > 0 { let q = p - 1; if content[q] && !seen[q] { seen[q] = true; stack.append(q) } }
            if x < W - 1 { let q = p + 1; if content[q] && !seen[q] { seen[q] = true; stack.append(q) } }
            if y > 0 { let q = p - W; if content[q] && !seen[q] { seen[q] = true; stack.append(q) } }
            if y < H - 1 { let q = p + W; if content[q] && !seen[q] { seen[q] = true; stack.append(q) } }
        }
        comps.append(area)
    }
    let total = Double(W * H)
    let largest = Double(comps.max() ?? 0) / total
    // Components worth counting: ignore speckle.
    let compCount = comps.filter { Double($0) / total > 0.004 }.count

    var verdict = "ok"
    if contentFrac < 0.02 {
        verdict = "blank"
    } else if largest < 0.055 && compCount >= 4 && meanChroma < 90 {
        // Many small dark blobs, no dominant shape, no colour → a line of words.
        verdict = "text-only"
    } else if borderContent > 0.14 {
        verdict = "cut"
    }

    out.append(Verdict(file: "figures/" + name, w: img.width, h: img.height,
                       borderContent: (borderContent * 1000).rounded() / 1000,
                       contentFrac: (contentFrac * 1000).rounded() / 1000,
                       largestCompFrac: (largest * 1000).rounded() / 1000,
                       compCount: compCount,
                       meanChroma: (meanChroma * 10).rounded() / 10,
                       verdict: verdict))
}

let enc = JSONEncoder()
enc.outputFormatting = [.prettyPrinted, .sortedKeys]
if let d = try? enc.encode(out) {
    try? d.write(to: work.appendingPathComponent("crop-qa.json"))
}
var tally: [String: Int] = [:]
for v in out { tally[v.verdict, default: 0] += 1 }
let order = ["ok", "cut", "text-only", "blank"]
print("crops graded: \(out.count)")
for k in order where tally[k] != nil { print("  \(k.padding(toLength: 10, withPad: " ", startingAt: 0)) \(tally[k]!)") }
