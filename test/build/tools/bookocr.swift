import Foundation
import PDFKit
import Vision
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// ─────────────────────────────────────────────────────────────────────────────
// bookocr — native macOS PDF → deskewed page images + Vision OCR JSON
//
//   bookocr <pdf> --out <dir> [--mode spread|single] [--dpi 300]
//           [--pages 1-5] [--no-split] [--no-autorotate] [--debug]
//
// spread : each PDF page holds one large photographed two-page book spread;
//          the embedded image is pulled at native resolution and split at the
//          gutter. Renders via mediaBox are unusable here because the photo
//          content overflows the declared box.
// single : each PDF page is one clean page; rendered at --dpi.
// ─────────────────────────────────────────────────────────────────────────────

// MARK: - CLI

struct Opts {
    var pdf = ""
    var out = ""
    var mode = "spread"
    var dpi = 300.0
    var split = true
    var autorotate = true
    var debug = false
    var from = 1
    var to = Int.max
}

func parseArgs() -> Opts {
    var o = Opts()
    var a = Array(CommandLine.arguments.dropFirst())
    guard !a.isEmpty else { fputs("usage: bookocr <pdf> --out <dir> [--mode spread|single] [--dpi N] [--pages A-B] [--no-split] [--no-autorotate] [--debug]\n", stderr); exit(2) }
    o.pdf = a.removeFirst()
    var i = 0
    while i < a.count {
        switch a[i] {
        case "--out":   i += 1; o.out = a[i]
        case "--mode":  i += 1; o.mode = a[i]
        case "--dpi":   i += 1; o.dpi = Double(a[i]) ?? 300
        case "--no-split": o.split = false
        case "--no-autorotate": o.autorotate = false
        case "--debug": o.debug = true
        case "--pages":
            i += 1
            let parts = a[i].split(separator: "-").map { Int($0) ?? 0 }
            if parts.count == 2 { o.from = parts[0]; o.to = parts[1] }
            else if parts.count == 1 { o.from = parts[0]; o.to = parts[0] }
        default: fputs("unknown arg \(a[i])\n", stderr); exit(2)
        }
        i += 1
    }
    if o.out.isEmpty { fputs("--out required\n", stderr); exit(2) }
    return o
}

let opts = parseArgs()

// MARK: - Grayscale buffer helpers

/// 8-bit grayscale view of a CGImage, used for all page-geometry analysis.
struct Gray {
    var w: Int, h: Int
    var px: [UInt8]
    subscript(x: Int, y: Int) -> UInt8 { px[y * w + x] }
}

func grayscale(_ img: CGImage, maxDim: Int) -> Gray {
    let s = min(1.0, Double(maxDim) / Double(max(img.width, img.height)))
    let w = max(1, Int(Double(img.width) * s)), h = max(1, Int(Double(img.height) * s))
    var buf = [UInt8](repeating: 255, count: w * h)
    buf.withUnsafeMutableBytes { raw in
        guard let ctx = CGContext(data: raw.baseAddress, width: w, height: h,
                                  bitsPerComponent: 8, bytesPerRow: w,
                                  space: CGColorSpaceCreateDeviceGray(),
                                  bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return }
        ctx.setFillColor(CGColor(gray: 1, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        ctx.interpolationQuality = .high
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    }
    return Gray(w: w, h: h, px: buf)
}

/// Otsu's method — global threshold separating ink from paper.
func otsu(_ g: Gray) -> UInt8 {
    var hist = [Int](repeating: 0, count: 256)
    for v in g.px { hist[Int(v)] += 1 }
    let total = g.px.count
    var sum = 0.0
    for t in 0..<256 { sum += Double(t * hist[t]) }
    var sumB = 0.0, wB = 0, best = 0.0, bestT = 128
    for t in 0..<256 {
        wB += hist[t]; if wB == 0 { continue }
        let wF = total - wB; if wF == 0 { break }
        sumB += Double(t * hist[t])
        let mB = sumB / Double(wB), mF = (sum - sumB) / Double(wF)
        let between = Double(wB) * Double(wF) * (mB - mF) * (mB - mF)
        if between > best { best = between; bestT = t }
    }
    return UInt8(bestT)
}

// MARK: - Gutter detection

/// Locate the book gutter of a spread. Returns a normalized x in (0,1).
///
/// Neither "darkest column" nor "widest whitespace" works alone. The darkest
/// column can be the fold shadow's edge, which sits off-centre and slices glyphs
/// in the inner margin; the widest whitespace can be a table-of-contents leader
/// gap between entry text and its page-number column, which is wider than the
/// real gutter.
///
/// The fold is identified instead by a signature no text column has: darkness
/// that persists down almost every row (`cont`) while containing essentially no
/// glyph ink. The split is then placed at the centre of the text-free run holding
/// that ridge.
func findGutter(_ g: Gray) -> Double {
    let thr = otsu(g)
    let y0 = g.h / 10, y1 = g.h * 9 / 10
    let rows = Double(y1 - y0)

    // Per-row median gray: a robust local paper level, unaffected by text.
    var rowMed = [Int](repeating: 255, count: g.h)
    for y in y0..<y1 {
        var r = [UInt8](repeating: 0, count: g.w)
        for x in 0..<g.w { r[x] = g[x, y] }
        r.sort()
        rowMed[y] = Int(r[g.w / 2])
    }

    var ink = [Double](repeating: 0, count: g.w)   // glyph coverage
    var cont = [Double](repeating: 0, count: g.w)  // darker-than-paper coverage
    for x in 0..<g.w {
        var ni = 0, nc = 0
        for y in y0..<y1 {
            let v = Int(g[x, y])
            if v < Int(thr) { ni += 1 }
            if v < rowMed[y] - 30 { nc += 1 }
        }
        ink[x] = Double(ni) / rows
        cont[x] = Double(nc) / rows
    }

    // Mask of columns carrying text, with dust specks erased.
    var hasText = ink.map { $0 > 0.03 }
    let minRun = max(2, Int(Double(g.w) * 0.008))
    var i = 0
    while i < g.w {
        if hasText[i] {
            var j = i
            while j < g.w && hasText[j] { j += 1 }
            if j - i < minRun { for k in i..<j { hasText[k] = false } }
            i = j
        } else { i += 1 }
    }

    // Text-free runs inside the central band. A printed spread folds near the
    // middle, so the fold cannot be far from centre.
    let lo = Int(Double(g.w) * 0.40), hi = Int(Double(g.w) * 0.60)
    var runs: [(lo: Int, hi: Int)] = []
    var x = lo
    while x < hi {
        if !hasText[x] {
            var j = x
            while j < hi && !hasText[j] { j += 1 }
            runs.append((x, j))
            x = j
        } else { x += 1 }
    }
    guard !runs.isEmpty else { return 0.5 }

    let centre = Double(g.w) * 0.5
    func mid(_ r: (lo: Int, hi: Int)) -> Double { Double(r.lo + r.hi) / 2 }

    // Prefer the run containing the strongest fold ridge.
    var bestRidge = 0.0
    var chosen: (lo: Int, hi: Int)? = nil
    for r in runs {
        let ridge = (r.lo..<r.hi).map { cont[$0] }.max() ?? 0
        if ridge > bestRidge { bestRidge = ridge; chosen = r }
    }
    // Evenly-lit scans show no ridge; fall back to the gap nearest the centre.
    if bestRidge < 0.10 {
        chosen = runs.min { abs(mid($0) - centre) < abs(mid($1) - centre) }
    }
    guard let c = chosen else { return 0.5 }

    // Split on the fold ridge, not the run's midpoint. On a skewed spread an
    // inner-margin column (e.g. a table-of-contents page-number column) smears
    // horizontally by tan(skew)·height and stops registering as text, which
    // inflates the run; the shadow band stays narrow and correctly placed.
    var splitPx = mid(c)
    if bestRidge >= 0.10 {
        let peakX = (c.lo..<c.hi).max { cont[$0] < cont[$1] } ?? Int(mid(c))
        let floorV = cont[peakX] * 0.5
        var l = peakX, r = peakX
        while l > c.lo && cont[l - 1] >= floorV { l -= 1 }
        while r < c.hi - 1 && cont[r + 1] >= floorV { r += 1 }
        splitPx = Double(l + r) / 2
    }
    if ProcessInfo.processInfo.environment["GUTTER_DEBUG"] != nil {
        let desc = runs.map { r -> String in
            let ridge = (r.lo..<r.hi).map { cont[$0] }.max() ?? 0
            return String(format: "[%.3f-%.3f ridge=%.3f]", Double(r.lo)/Double(g.w), Double(r.hi)/Double(g.w), ridge)
        }.joined(separator: " ")
        fputs("  gutter: runs \(desc) bestRidge=\(String(format: "%.3f", bestRidge)) chose \(String(format: "%.4f", splitPx/Double(g.w)))\n", stderr)
    }
    return splitPx / Double(g.w)
}

// MARK: - Deskew

/// Estimate skew by maximizing the variance of the horizontal ink-projection
/// profile over candidate angles. Text lines align into sharp peaks when the
/// rotation is correct.
func estimateSkew(_ g: Gray) -> Double {
    let thr = otsu(g)
    // Collect ink pixel coordinates, subsampled for speed.
    var pts: [(Double, Double)] = []
    pts.reserveCapacity(60000)
    let step = max(1, (g.w * g.h) / 400_000)
    var idx = 0
    for y in stride(from: g.h / 20, to: g.h * 19 / 20, by: 1) {
        for x in stride(from: g.w / 20, to: g.w * 19 / 20, by: 1) {
            if g[x, y] < thr {
                idx += 1
                if idx % step == 0 { pts.append((Double(x), Double(y))) }
            }
        }
    }
    guard pts.count > 500 else { return 0 }

    func score(_ deg: Double) -> Double {
        let rad = deg * .pi / 180, s = sin(rad), c = cos(rad)
        let nBins = g.h
        var hist = [Double](repeating: 0, count: nBins + 1)
        for (x, y) in pts {
            let yr = y * c - x * s + Double(nBins) * 0.5 * (1 - c)
            let b = Int(yr)
            if b >= 0 && b <= nBins { hist[b] += 1 }
        }
        // Sum of squares rewards concentration of ink into few rows.
        var acc = 0.0
        for v in hist { acc += v * v }
        return acc
    }

    // Coarse sweep then refine.
    var bestDeg = 0.0, bestScore = -1.0
    for d in stride(from: -7.0, through: 7.0, by: 0.5) {
        let v = score(d); if v > bestScore { bestScore = v; bestDeg = d }
    }
    for d in stride(from: bestDeg - 0.5, through: bestDeg + 0.5, by: 0.1) {
        let v = score(d); if v > bestScore { bestScore = v; bestDeg = d }
    }
    return bestDeg
}

// MARK: - Border trim

/// Trim the dark photo background surrounding the paper.
///
/// Uses the per-row/column *median* gray, which text cannot drag down (text is a
/// minority of pixels in any row of a page), unlike a bright-pixel fraction. Trim
/// is capped so a dark scan can never eat into the text block.
func contentRect(_ g: Gray) -> CGRect {
    func median(_ vals: inout [UInt8]) -> Int {
        vals.sort(); return Int(vals[vals.count / 2])
    }
    var rowMed = [Int](repeating: 0, count: g.h)
    for y in 0..<g.h {
        var row = [UInt8](repeating: 0, count: g.w)
        for x in 0..<g.w { row[x] = g[x, y] }
        rowMed[y] = median(&row)
    }
    var colMed = [Int](repeating: 0, count: g.w)
    for x in 0..<g.w {
        var col = [UInt8](repeating: 0, count: g.h)
        for y in 0..<g.h { col[y] = g[x, y] }
        colMed[x] = median(&col)
    }
    // Paper brightness reference: the brightest medians seen.
    let paper = max(1, ((rowMed.max() ?? 255) + (colMed.max() ?? 255)) / 2)
    let cut = Int(Double(paper) * 0.55)
    let maxTrimY = Int(Double(g.h) * 0.15), maxTrimX = Int(Double(g.w) * 0.15)

    var top = 0, bottom = g.h - 1, left = 0, right = g.w - 1
    while top < maxTrimY && rowMed[top] < cut { top += 1 }
    while bottom > g.h - 1 - maxTrimY && rowMed[bottom] < cut { bottom -= 1 }
    while left < maxTrimX && colMed[left] < cut { left += 1 }
    while right > g.w - 1 - maxTrimX && colMed[right] < cut { right -= 1 }

    guard right > left, bottom > top else { return CGRect(x: 0, y: 0, width: 1, height: 1) }
    return CGRect(x: Double(left) / Double(g.w), y: Double(top) / Double(g.h),
                  width: Double(right - left + 1) / Double(g.w),
                  height: Double(bottom - top + 1) / Double(g.h))
}

// MARK: - Image ops

func crop(_ img: CGImage, normalized r: CGRect) -> CGImage? {
    let px = CGRect(x: (r.origin.x * Double(img.width)).rounded(),
                    y: (r.origin.y * Double(img.height)).rounded(),
                    width: (r.width * Double(img.width)).rounded(),
                    height: (r.height * Double(img.height)).rounded())
    return img.cropping(to: px)
}

func rotated(_ img: CGImage, degrees: Double) -> CGImage {
    if abs(degrees) < 0.05 { return img }
    let rad = degrees * .pi / 180
    let w = img.width, h = img.height
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return img }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.translateBy(x: Double(w) / 2, y: Double(h) / 2)
    // Screen-clockwise rotation is a negative angle here, since CG's y axis is up.
    ctx.rotate(by: -rad)
    ctx.interpolationQuality = .high
    ctx.draw(img, in: CGRect(x: -Double(w) / 2, y: -Double(h) / 2, width: Double(w), height: Double(h)))
    return ctx.makeImage() ?? img
}

func orient(_ img: CGImage, pdfRotate: Int) -> CGImage {
    let d = ((pdfRotate % 360) + 360) % 360
    if d == 0 { return img }
    let swap = (d == 90 || d == 270)
    let w = swap ? img.height : img.width, h = swap ? img.width : img.height
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return img }
    ctx.translateBy(x: Double(w) / 2, y: Double(h) / 2)
    ctx.rotate(by: -Double(d) * .pi / 180)
    ctx.interpolationQuality = .high
    ctx.draw(img, in: CGRect(x: -Double(img.width) / 2, y: -Double(img.height) / 2,
                             width: Double(img.width), height: Double(img.height)))
    return ctx.makeImage() ?? img
}

func writePNG(_ img: CGImage, _ url: URL) {
    guard let dst = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { return }
    CGImageDestinationAddImage(dst, img, nil)
    CGImageDestinationFinalize(dst)
}

// MARK: - PDF page → CGImage

func embeddedImage(_ page: CGPDFPage) -> CGImage? {
    guard let dict = page.dictionary else { return nil }
    var res: CGPDFDictionaryRef? = nil
    guard CGPDFDictionaryGetDictionary(dict, "Resources", &res), let res else { return nil }
    var xo: CGPDFDictionaryRef? = nil
    guard CGPDFDictionaryGetDictionary(res, "XObject", &xo), let xo else { return nil }

    final class Box { var best: CGImage?; var bestPx = 0 }
    let box = Box()
    CGPDFDictionaryApplyBlock(xo, { (_, value, info) -> Bool in
        let box = Unmanaged<Box>.fromOpaque(info!).takeUnretainedValue()
        var stream: CGPDFStreamRef? = nil
        guard CGPDFObjectGetValue(value, .stream, &stream), let stream,
              let sd = CGPDFStreamGetDictionary(stream) else { return true }
        var sub: UnsafePointer<Int8>? = nil
        guard CGPDFDictionaryGetName(sd, "Subtype", &sub), let sub,
              String(cString: sub) == "Image" else { return true }
        var fmt = CGPDFDataFormat.raw
        guard let data = CGPDFStreamCopyData(stream, &fmt) as Data? else { return true }

        var img: CGImage? = nil
        if fmt == .jpegEncoded || fmt == .JPEG2000 {
            img = CGImageSourceCreateWithData(data as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) }
        } else {
            var wI: CGPDFInteger = 0, hI: CGPDFInteger = 0, bpcI: CGPDFInteger = 8
            if CGPDFDictionaryGetInteger(sd, "Width", &wI), CGPDFDictionaryGetInteger(sd, "Height", &hI) {
                CGPDFDictionaryGetInteger(sd, "BitsPerComponent", &bpcI)
                let w = Int(wI), h = Int(hI), bpc = Int(bpcI)
                var comps = 0
                var csName: UnsafePointer<Int8>? = nil
                if CGPDFDictionaryGetName(sd, "ColorSpace", &csName), let n = csName {
                    switch String(cString: n) {
                    case "DeviceRGB", "CalRGB": comps = 3
                    case "DeviceGray", "CalGray": comps = 1
                    case "DeviceCMYK": comps = 4
                    default: comps = 0
                    }
                }
                if comps == 0, w > 0, h > 0, bpc == 8 { comps = data.count / (w * h) }
                if comps >= 1, comps <= 4, bpc == 8 {
                    let space: CGColorSpace = comps == 1 ? CGColorSpaceCreateDeviceGray()
                                            : comps == 4 ? CGColorSpaceCreateDeviceCMYK()
                                            : CGColorSpaceCreateDeviceRGB()
                    let bpr = w * comps
                    if data.count >= bpr * h, let p = CGDataProvider(data: data as CFData) {
                        img = CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: comps * 8,
                                      bytesPerRow: bpr, space: space, bitmapInfo: CGBitmapInfo(rawValue: 0),
                                      provider: p, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
                    }
                }
            }
        }
        if let img {
            let px = img.width * img.height
            if px > box.bestPx { box.bestPx = px; box.best = img }
        }
        return true
    }, Unmanaged.passUnretained(box).toOpaque())
    return box.best
}

/// Render a page, expanding the canvas so content drawn outside the mediaBox
/// (common in these scans) is preserved, then trim back to what was painted.
func renderPage(_ page: PDFPage, dpi: Double) -> CGImage? {
    let r = page.bounds(for: .mediaBox)
    let scale = dpi / 72.0
    let pad: CGFloat = 0
    let w = Int(((r.width + 2 * pad) * scale).rounded()), h = Int(((r.height + 2 * pad) * scale).rounded())
    guard w > 0, h > 0,
          let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: scale, y: scale)
    ctx.translateBy(x: pad - r.origin.x, y: pad - r.origin.y)
    ctx.interpolationQuality = .high
    page.draw(with: .mediaBox, to: ctx)
    return ctx.makeImage()
}

// MARK: - Vision OCR

let icelandicWords = [
    "Ökukennsla", "Æfingaakstur", "Ökunámsbók", "Umferðarstofa", "Vegagerðin",
    "Reykjavík", "Akureyri", "Ísland", "Íslandi", "Sýslumaður", "Ökuskírteini",
    "Frumherji", "Samgöngustofa", "Ökuskóli", "Ökunám", "Bifreiðaskoðun",
]

struct Line: Codable {
    var text: String
    var conf: Double
    var x: Double, y: Double, w: Double, h: Double   // normalized, origin top-left
    var alts: [String]?
}

struct PageOut: Codable {
    var doc: String
    var pdfPage: Int
    var side: String          // "a" (left/verso) | "b" (right/recto) | "full"
    var seq: Int              // reading order across the document
    var imageFile: String
    var imageW: Int
    var imageH: Int
    var skewDeg: Double
    var residualDeg: Double
    var lines: [Line]
    var meanConf: Double
    var lowConfCount: Int
}

/// Vision's text detector clips the first glyph of lines that start close to the
/// image edge, silently turning "course" into "ourse" at full confidence. Giving
/// the page a white quiet zone fixes it; boxes are mapped back afterwards.
///
/// A third framing (0.02) is folded in because Vision's line detector misses some
/// full-confidence, full-measure lines at *both* 0 and 0.04 but reads them at other
/// paddings — a detector artefact, not a legibility one (measured sweep:
/// build/qa/plan-ocr-omission.md §2.2 / §3.3; 0.02 is the value nearest the
/// existing pair among the several that work).
let OCR_PAD: [Double] = [0.04, 0, 0.02]

func padWhite(_ img: CGImage, frac: Double) -> CGImage {
    let p = Int(Double(img.width) * frac)
    let w = img.width + 2 * p, h = img.height + 2 * p
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return img }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.interpolationQuality = .high
    ctx.draw(img, in: CGRect(x: p, y: p, width: img.width, height: img.height))
    return ctx.makeImage() ?? img
}

func ocrPass(_ img: CGImage, pad: Double) -> [Line] {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = true
    req.recognitionLanguages = ["en-US"]
    req.customWords = icelandicWords
    // Body text on these scans is only ~1% of page height; the default floor
    // would drop it entirely.
    req.minimumTextHeight = 0.006
    if #available(macOS 13.0, *) { req.revision = VNRecognizeTextRequest.currentRevision }

    let target = pad > 0 ? padWhite(img, frac: pad) : img
    let handler = VNImageRequestHandler(cgImage: target, orientation: .up, options: [:])
    do { try handler.perform([req]) } catch {
        fputs("vision error: \(error)\n", stderr); return []
    }
    guard let obs = req.results else { return [] }

    // Undo the padding: absolute inset is padPx on every side.
    let padPx = Double(img.width) * pad
    let ow = Double(img.width), oh = Double(img.height)
    let pw = ow + 2 * padPx, ph = oh + 2 * padPx

    return obs.compactMap { o in
        let cands = o.topCandidates(3)
        guard let top = cands.first else { return nil }
        let b = o.boundingBox   // normalized in the padded image, origin bottom-left
        let xPx = b.origin.x * pw - padPx
        let yPx = (1 - b.origin.y - b.height) * ph - padPx
        return Line(text: top.string,
                    conf: Double(top.confidence),
                    x: xPx / ow, y: yPx / oh,
                    w: b.width * pw / ow, h: b.height * ph / oh,
                    alts: cands.count > 1 ? Array(cands.dropFirst().map { $0.string }) : nil)
    }
}

/// Decide which quarter-turn leaves the page upright.
///
/// The PDF /Rotate entry cannot be trusted across these files: the chapters
/// declare 270 and need it, the appendix declares 0 yet its photographs are
/// stored on their side. Getting this wrong is not a cosmetic problem — the
/// gutter would be searched across the wrong axis and the split would cut a page
/// in half. So try all four turns on a thumbnail and keep whichever Vision reads
/// best. Vision does recognize sideways text, hence scoring by total confident
/// characters rather than mere success.
func detectOrientation(_ img: CGImage, isSpread: Bool) -> Int {
    // Geometry settles most of it: an upright two-page spread is always wider
    // than it is tall. A portrait spread is therefore certainly on its side, and
    // recognition only has to choose which way up — far more reliable than
    // scoring all four turns, which left one appendix spread sideways because the
    // wrong orientation happened to score within the margin.
    let candidates: [Int]
    if isSpread {
        candidates = img.width < img.height ? [90, 270] : [0, 180]
    } else {
        candidates = [0, 90, 180, 270]
    }
    if candidates.count == 1 { return candidates[0] }

    let thumbMax = 1000
    let s = min(1.0, Double(thumbMax) / Double(max(img.width, img.height)))
    let tw = max(1, Int(Double(img.width) * s)), th = max(1, Int(Double(img.height) * s))
    guard let tctx = CGContext(data: nil, width: tw, height: th, bitsPerComponent: 8, bytesPerRow: 0,
                               space: CGColorSpaceCreateDeviceRGB(),
                               bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return 0 }
    tctx.interpolationQuality = .high
    tctx.draw(img, in: CGRect(x: 0, y: 0, width: tw, height: th))
    guard let thumb = tctx.makeImage() else { return 0 }

    /// How strongly a set of line boxes looks left-aligned.
    ///
    /// Recognition cannot tell a page from the same page upside down: Vision
    /// rotates each line internally and returns clean words either way, so the
    /// character score is nearly identical while the line *boxes* — and therefore
    /// the reading order — are inverted. Typography settles it. Short lines (a
    /// paragraph's last line, a heading) sit flush with the column's left edge and
    /// ragged on the right; upside down, that flips. Positive means left-aligned,
    /// i.e. the right way up.
    func leftAlignment(_ boxes: [CGRect]) -> Double {
        guard boxes.count >= 4 else { return 0 }
        let maxW = boxes.map { $0.width }.max() ?? 1
        let short = boxes.filter { $0.width < maxW * 0.85 }
        guard short.count >= 3 else { return 0 }
        func stdev(_ xs: [Double]) -> Double {
            let m = xs.reduce(0, +) / Double(xs.count)
            return (xs.map { ($0 - m) * ($0 - m) }.reduce(0, +) / Double(xs.count)).squareRoot()
        }
        return stdev(short.map { $0.maxX }) - stdev(short.map { $0.minX })
    }

    var scores: [Int: Double] = [:]
    var alignment: [Int: Double] = [:]
    for turn in candidates {
        let cand = orient(thumb, pdfRotate: turn)
        let req = VNRecognizeTextRequest()
        req.recognitionLevel = .fast
        req.usesLanguageCorrection = false
        req.recognitionLanguages = ["en-US"]
        req.minimumTextHeight = 0.01
        guard (try? VNImageRequestHandler(cgImage: cand, orientation: .up, options: [:]).perform([req])) != nil,
              let obs = req.results else { continue }
        var score = 0.0
        var boxes: [CGRect] = []
        for o in obs {
            guard let t = o.topCandidates(1).first else { continue }
            score += Double(t.string.count) * Double(t.confidence)
            boxes.append(o.boundingBox)
        }
        scores[turn] = score
        alignment[turn] = leftAlignment(boxes)
    }
    guard let best = scores.max(by: { $0.value < $1.value }) else { return 0 }
    var chosen = best.key
    // When leaving the page alone is a candidate, prefer it unless clearly beaten:
    // a sheet of graphics with terse labels scores almost the same either way, and
    // a coin flip there would wreck an already-upright page.
    if let asIs = scores[0], best.value <= asIs * 1.25 { chosen = 0 }

    // Recognition fixed the axis; alignment decides which way up — but only for a
    // page we already know is sideways. The chapters' justified body text has both
    // edges flush, so the alignment signal is unreliable there and would flip
    // pages that were already correct; leaving an upright page alone is safe.
    if chosen != 0 {
        let flipped = (chosen + 180) % 360
        if candidates.contains(flipped),
           let a = alignment[chosen], let b = alignment[flipped], b > a {
            chosen = flipped
        }
    }
    return chosen
}

/// Merge two framings' line sets: take the union, and the better reading where
/// both saw the same line.
///
/// The two framings do not fail the same way: padding recovers first glyphs that
/// the detector otherwise clips ("course" → "ourse"), but it also causes some
/// small isolated text — a contents page-number column — to be missed. Taking
/// the union, and the better reading where both saw a line, is strictly ahead of
/// either pass alone. Generic in which framing is `padded` vs `plain` — both
/// roles are handled symmetrically below — so a third (or further) framing can
/// be folded in by calling this again with the running merge as one side.
func mergeTwo(_ padded: [Line], _ plain: [Line]) -> [Line] {
    /// A candidate pairing between a padded line and a plain line: dominance is
    /// measured on y and x separately (not on shared area) so a line box cannot
    /// pair with its vertical neighbour — see build/qa/plan-ocr-omission.md §3.2:
    /// 8,348 certainly-same-line pairings all clear yFrac >= 0.664 while all 14
    /// wrong pairings in the shipped merge fall at yFrac <= 0.585, an empty gap.
    struct Pairing { let m: Int; let p: Int; let score: Double }
    let Y_MIN = 0.60
    let X_MIN = 0.50

    /// A tail is dropped glyphs only if it holds a letter or digit; a bare
    /// punctuation tail is a dot-leader glyph, not a truncation (measured:
    /// build/qa/plan-ocr-omission.md §3.1 — 52/75 prefix-superset tails carry an
    /// alnum, and gating on it is what keeps the contents page's dot leaders and
    /// three sign labels from being read as restored text).
    func hasAlnum(_ s: Substring) -> Bool {
        s.contains { $0.isLetter || $0.isNumber }
    }

    /// Prefer the reading that is a superset of the other (a restored leading or
    /// trailing glyph run), otherwise the more confident one.
    func better(_ a: Line, _ b: Line) -> Line {
        let ta = a.text.trimmingCharacters(in: .whitespaces)
        let tb = b.text.trimmingCharacters(in: .whitespaces)
        if ta != tb {
            if ta.hasSuffix(tb) && ta.count > tb.count { return a }
            if tb.hasSuffix(ta) && tb.count > ta.count { return b }
            // A prefix superset is the same evidence read from the other end: one
            // framing truncated the tail instead of the head.
            if ta.hasPrefix(tb) && ta.count > tb.count && hasAlnum(ta.dropFirst(tb.count)) { return a }
            if tb.hasPrefix(ta) && tb.count > ta.count && hasAlnum(tb.dropFirst(ta.count)) { return b }
        }
        return a.conf >= b.conf ? a : b
    }

    // Best-first pairing on vertical (then horizontal) dominance, not greedy
    // first-fit: first-fit let a line claim whichever unclaimed padded line it
    // met first, so a plain line could pair with the padded line *below* it
    // (half a line's worth of y-overlap clears the old area-ratio test) and the
    // real match was then skipped as already claimed — deleting it at the tie
    // in `better()`. Ranking every candidate pairing by yFrac*xFrac and taking
    // them best-first fixes that; unpaired lines from either pass are still
    // kept, as before.
    var candidates: [Pairing] = []
    for (mi, m) in padded.enumerated() {
        for (pi, p) in plain.enumerated() {
            let ix = min(m.x + m.w, p.x + p.w) - max(m.x, p.x)
            let iy = min(m.y + m.h, p.y + p.h) - max(m.y, p.y)
            guard ix > 0, iy > 0 else { continue }
            let yFrac = iy / min(m.h, p.h)
            let xFrac = ix / min(m.w, p.w)
            guard yFrac >= Y_MIN, xFrac >= X_MIN else { continue }
            candidates.append(Pairing(m: mi, p: pi, score: yFrac * xFrac))
        }
    }

    // One-to-many collisions: a single box in one pass can clear the gate
    // against several boxes in the other (one pass reads a typeset line whole,
    // the other splits it — a running head + folio, a hyphen-wrapped word run,
    // a list marker). 1:1 best-first pairing claims only the highest-scoring
    // fragment and hands the rest to `better()`, which has no supersede rule
    // for "several disjoint fragments vs. one whole reading" — the middle
    // fragment can win the confidence tie and destroy the complete line while
    // the other fragments, now unclaimed, are appended as duplicates.
    //
    // Fires only when the fan-out fragments, joined in x-order with a single
    // space, reproduce the single box's text exactly modulo whitespace — never
    // synthesised, never a substitution. Measured corpus-wide (build/qa/
    // plan-ocr-omission.md §3.4): 662 fan-out collisions (fanout 2 x548, 3
    // x110, 4+ x4), of which exactly 51 pass this check, and all 51 are
    // genuine same-line splits (verified by eye — running heads, hyphenated
    // wraps, numbered markers); the other 611 never coincide even loosely
    // (partial containment or disjoint), so an exact-join gate cannot fuse
    // unrelated content by chance. The remaining 611 fall through unchanged
    // to the 1:1 pairing below.
    func collapseWS(_ s: String) -> String {
        let trimmed = s.trimmingCharacters(in: .whitespaces)
        var out = ""
        var lastWasSpace = false
        for ch in trimmed {
            if ch.isWhitespace {
                if !lastWasSpace { out.append(" ") }
                lastWasSpace = true
            } else {
                out.append(ch)
                lastWasSpace = false
            }
        }
        return out
    }

    var merged = padded
    var claimedM = [Bool](repeating: false, count: padded.count)
    var claimedP = [Bool](repeating: false, count: plain.count)
    var droppedM = Set<Int>()

    var byM: [Int: [Int]] = [:]
    var byP: [Int: [Int]] = [:]
    for c in candidates {
        byM[c.m, default: []].append(c.p)
        byP[c.p, default: []].append(c.m)
    }

    // padded[mi] is the whole reading; plain fragments split it.
    for mi in byM.keys.sorted() {
        let pis = byM[mi]!
        guard pis.count >= 2, !claimedM[mi], pis.allSatisfy({ !claimedP[$0] }) else { continue }
        let frags = pis.sorted { plain[$0].x < plain[$1].x }
        let joined = frags.map { plain[$0].text.trimmingCharacters(in: .whitespaces) }.joined(separator: " ")
        guard collapseWS(joined) == collapseWS(padded[mi].text) else { continue }
        claimedM[mi] = true
        for p in frags { claimedP[p] = true }
        // merged[mi] already holds padded[mi], the complete reading — untouched.
    }
    // plain[pi] is the whole reading; padded fragments split it. One fragment
    // slot becomes the carrier (keeps the plain reading + its geometry); the
    // rest are dropped, not left behind as partial duplicates.
    for pi in byP.keys.sorted() {
        let mis = byP[pi]!
        guard mis.count >= 2, !claimedP[pi], mis.allSatisfy({ !claimedM[$0] }) else { continue }
        let frags = mis.sorted { padded[$0].x < padded[$1].x }
        let joined = frags.map { padded[$0].text.trimmingCharacters(in: .whitespaces) }.joined(separator: " ")
        guard collapseWS(joined) == collapseWS(plain[pi].text) else { continue }
        claimedP[pi] = true
        let carrier = frags[0]
        claimedM[carrier] = true
        merged[carrier] = plain[pi]
        for p in frags.dropFirst() { claimedM[p] = true; droppedM.insert(p) }
    }

    candidates.sort { $0.score > $1.score }
    for c in candidates {
        guard !claimedM[c.m], !claimedP[c.p] else { continue }
        claimedM[c.m] = true
        claimedP[c.p] = true
        merged[c.m] = better(padded[c.m], plain[c.p])
    }
    for (pi, p) in plain.enumerated() where !claimedP[pi] {
        merged.append(p)
    }
    return merged.enumerated()
        .filter { !droppedM.contains($0.offset) }
        .map { $0.element }
        .sorted { $0.y < $1.y }
}

/// A third (or later) framing's partial reading can survive `mergeTwo`'s pairing
/// gate — it is short enough, or offset enough in y, that it never clears
/// `Y_MIN`/`X_MIN` against the line that actually contains it — and then rides
/// along as a redundant duplicate. Drop an observation whose (whitespace-
/// collapsed) text is contained in a longer observation that overlaps it
/// vertically by >= 0.5 of the shorter box, including the equal-text case.
/// Never edits text; only removes a redundant partial or an exact duplicate.
/// Measured necessity and residuals: build/qa/plan-ocr-omission.md §3.3/§7.4 —
/// without this, a three-way union re-introduces a tail omission (ratio 4.19,
/// "Comprehensive motor" as an orphan short line); with it, checked individually,
/// every dropped line's complete counterpart survives on the same page.
///
/// Also requires x-overlap >= X_MIN (0.50, mergeTwo's own value for "same
/// textual position" — not a new guessed constant). The plan's y-only wording
/// was measured on prose columns, where two boxes at the same y are always the
/// same line. Sign contact sheets break that assumption: a whole row of icons
/// sits at one y-band, so "Dangerous bend" (four different signs) and "to
/// right"/"to left" (two different signs' second caption line, sitting under
/// "first to right"/"first to left") collided and one of each pair was deleted
/// — a real loss, caught by re-auditing umferdarmerki-enska p002 by hand. The
/// x gate restores the rule to "same line", which is what it was meant to mean.
func dedupContained(_ lines: [Line]) -> [Line] {
    let X_MIN = 0.50
    func collapseWS(_ s: String) -> String {
        let trimmed = s.trimmingCharacters(in: .whitespaces)
        var out = ""
        var lastWasSpace = false
        for ch in trimmed {
            if ch.isWhitespace {
                if !lastWasSpace { out.append(" ") }
                lastWasSpace = true
            } else {
                out.append(ch)
                lastWasSpace = false
            }
        }
        return out
    }
    let texts = lines.map(\.text).map(collapseWS)
    var drop = Set<Int>()
    for i in 0..<lines.count {
        guard !drop.contains(i), !texts[i].isEmpty else { continue }
        for j in 0..<lines.count where j != i {
            guard !texts[j].isEmpty else { continue }
            let a = lines[i], b = lines[j]
            let iy = min(a.y + a.h, b.y + b.h) - max(a.y, b.y)
            guard iy > 0 else { continue }
            let yFrac = iy / min(a.h, b.h)
            guard yFrac >= 0.5 else { continue }
            let ix = min(a.x + a.w, b.x + b.w) - max(a.x, b.x)
            guard ix > 0 else { continue }
            let xFrac = ix / min(a.w, b.w)
            guard xFrac >= X_MIN else { continue }
            if texts[i].count < texts[j].count, texts[j].contains(texts[i]) {
                drop.insert(i)
                break
            } else if texts[i].count == texts[j].count, texts[i] == texts[j], i < j {
                drop.insert(j)
            }
        }
    }
    return lines.enumerated().filter { !drop.contains($0.offset) }.map { $0.element }
}

/// Recognize under every framing in `OCR_PAD`, folding each additional pass into
/// the running merge with `mergeTwo`, then dedup the union's redundant partials.
func ocr(_ img: CGImage) -> [Line] {
    let passes = OCR_PAD.map { ocrPass(img, pad: $0) }
    var merged = passes[0]
    for i in 1..<passes.count {
        merged = mergeTwo(merged, passes[i])
    }
    return dedupContained(merged).sorted { $0.y < $1.y }
}

// MARK: - Main

let pdfURL = URL(fileURLWithPath: opts.pdf)
let base = pdfURL.deletingPathExtension().lastPathComponent
guard let pdfKitDoc = PDFDocument(url: pdfURL), let cgDoc = CGPDFDocument(pdfURL as CFURL) else {
    fputs("cannot open \(opts.pdf)\n", stderr); exit(1)
}
let pagesDir = URL(fileURLWithPath: opts.out).appendingPathComponent("pages")
let ocrDir = URL(fileURLWithPath: opts.out).appendingPathComponent("ocr")
for d in [pagesDir, ocrDir] { try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true) }

let enc = JSONEncoder()
enc.outputFormatting = [.prettyPrinted, .sortedKeys]

var seq = 0
var results: [PageOut] = []
let last = min(opts.to, cgDoc.numberOfPages)
let pageRange = Array(opts.from...max(opts.from, last)).filter { $0 <= cgDoc.numberOfPages }

/// Load a page at full resolution, before orientation is applied.
func loadPage(_ pno: Int) -> CGImage? {
    if opts.mode == "spread", let cgPage = cgDoc.page(at: pno), let raw = embeddedImage(cgPage) {
        return orient(raw, pdfRotate: Int(cgPage.rotationAngle))
    }
    if let p = pdfKitDoc.page(at: pno - 1) { return renderPage(p, dpi: opts.dpi) }
    return nil
}

// Decide the turn once for the whole document, by majority.
//
// A book is photographed in one sitting, so every spread in a file needs the same
// correction. Deciding per page let a handful of appendix spreads disagree with
// their neighbours and come out upside down, which silently reverses their reading
// order. A majority vote makes the confident pages carry the ambiguous ones.
var docTurn = 0
if opts.autorotate {
    var votes: [Int: Int] = [:]
    for pno in pageRange {
        guard let img = loadPage(pno) else { continue }
        votes[detectOrientation(img, isSpread: opts.mode == "spread"), default: 0] += 1
    }
    docTurn = votes.max { a, b in a.value < b.value }?.key ?? 0
    let detail = votes.sorted { $0.key < $1.key }.map { "\($0.key)°×\($0.value)" }.joined(separator: " ")
    print("orientation: \(detail) → applying \(docTurn)°")
}

for pno in pageRange {
    guard var pageImg = loadPage(pno) else { fputs("p\(pno): no image\n", stderr); continue }

    // Straighten the page before any geometry work depends on its axes. Only
    // photographed spreads need this; a clean single-page PDF is already upright.
    let turn = docTurn
    if turn != 0 { pageImg = orient(pageImg, pdfRotate: turn) }

    // Trim the photo background around the whole spread first. Trimming after the
    // split would attack each half's inner edge, where the dark fold shadow lives,
    // and eat text sitting in the inner margin.
    let bg = grayscale(pageImg, maxDim: 1400)
    let spread = crop(pageImg, normalized: contentRect(bg)) ?? pageImg

    let analysis = grayscale(spread, maxDim: 1400)
    var halves: [(String, CGRect)] = []
    if opts.split && opts.mode == "spread" {
        let gx = findGutter(analysis)
        // Overlap slightly into the fold whitespace so a small misdetection can
        // never clip a glyph at the inner margin.
        let pad = 0.008
        let aEnd = min(1.0, gx + pad), bStart = max(0.0, gx - pad)
        halves = [("a", CGRect(x: 0, y: 0, width: aEnd, height: 1)),
                  ("b", CGRect(x: bStart, y: 0, width: 1 - bStart, height: 1))]
    } else {
        halves = [("full", CGRect(x: 0, y: 0, width: 1, height: 1))]
    }

    for (side, rect) in halves {
        guard let half1 = crop(spread, normalized: rect) else { continue }
        let g2 = grayscale(half1, maxDim: 1200)
        let skew = estimateSkew(g2)
        let clean = rotated(half1, degrees: -skew)
        // Verify the correction actually levelled the text rather than doubling
        // the tilt; surfaced per page so a regression cannot pass silently.
        let residual = estimateSkew(grayscale(clean, maxDim: 1200))

        seq += 1
        let name = String(format: "%@-p%03d%@.png", base, pno, side)
        writePNG(clean, pagesDir.appendingPathComponent(name))

        let lines = ocr(clean)
        let confs = lines.map { $0.conf }
        let out = PageOut(doc: base, pdfPage: pno, side: side, seq: seq,
                          imageFile: "pages/" + name, imageW: clean.width, imageH: clean.height,
                          skewDeg: skew, residualDeg: residual, lines: lines,
                          meanConf: confs.isEmpty ? 0 : confs.reduce(0,+) / Double(confs.count),
                          lowConfCount: confs.filter { $0 < 0.5 }.count)
        results.append(out)
        if let d = try? enc.encode(out) {
            try? d.write(to: ocrDir.appendingPathComponent(name.replacingOccurrences(of: ".png", with: ".json")))
        }
        let chars = lines.reduce(0) { $0 + $1.text.count }
        print(String(format: "p%03d%@  %5dx%-5d turn=%3d skew=%+.2f°→%+.2f°  lines=%3d chars=%5d conf=%.3f low=%d",
                     pno, side, clean.width, clean.height, turn, skew, residual, lines.count, chars, out.meanConf, out.lowConfCount))
        fflush(stdout)
    }
}

// Document-level manifest.
if let d = try? enc.encode(results) {
    try? d.write(to: URL(fileURLWithPath: opts.out).appendingPathComponent("\(base).ocr.json"))
}
let totalChars = results.reduce(0) { $0 + $1.lines.reduce(0) { $0 + $1.text.count } }
let mc = results.isEmpty ? 0 : results.map { $0.meanConf }.reduce(0,+) / Double(results.count)
print(String(format: "== %@: %d page-sides, %d chars, meanConf=%.3f", base, results.count, totalChars, mc))
