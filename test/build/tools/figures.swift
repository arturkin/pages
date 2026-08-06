import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// ─────────────────────────────────────────────────────────────────────────────
// figures — locate illustrations on an already-cleaned page image.
//
//   figures <workDir>
//
// Reads workDir/ocr/*.json plus the matching workDir/pages/*.png, masks out
// every region Vision claimed as text, and treats the remaining ink as
// illustration. Connected components are merged and written to workDir/figures/,
// with their normalized rects recorded alongside for the HTML builder.
// ─────────────────────────────────────────────────────────────────────────────

struct Line: Codable { var text: String; var conf: Double; var x: Double; var y: Double; var w: Double; var h: Double; var alts: [String]? }
struct PageIn: Codable {
    var doc: String; var pdfPage: Int; var side: String; var seq: Int
    var imageFile: String; var imageW: Int; var imageH: Int
    var skewDeg: Double; var residualDeg: Double
    var lines: [Line]; var meanConf: Double; var lowConfCount: Int
}
struct FigureOut: Codable { var x: Double; var y: Double; var w: Double; var h: Double; var file: String }

guard CommandLine.arguments.count >= 2 else { fputs("usage: figures <workDir>\n", stderr); exit(2) }
let work = URL(fileURLWithPath: CommandLine.arguments[1])
let ocrDir = work.appendingPathComponent("ocr")
let figDir = work.appendingPathComponent("figures")
try? FileManager.default.createDirectory(at: figDir, withIntermediateDirectories: true)

let fm = FileManager.default
let jsons = ((try? fm.contentsOfDirectory(atPath: ocrDir.path)) ?? []).filter { $0.hasSuffix(".json") }.sorted()
let dec = JSONDecoder(), enc = JSONEncoder()
enc.outputFormatting = [.prettyPrinted, .sortedKeys]

func loadImage(_ url: URL) -> CGImage? {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(src, 0, nil)
}

func grayBuf(_ img: CGImage, maxDim: Int) -> (w: Int, h: Int, px: [UInt8]) {
    let s = min(1.0, Double(maxDim) / Double(max(img.width, img.height)))
    let w = max(1, Int(Double(img.width) * s)), h = max(1, Int(Double(img.height) * s))
    var buf = [UInt8](repeating: 255, count: w * h)
    buf.withUnsafeMutableBytes { raw in
        guard let ctx = CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(),
                                  bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return }
        ctx.setFillColor(CGColor(gray: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        ctx.interpolationQuality = .high
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    }
    return (w, h, buf)
}

func otsu(_ px: [UInt8]) -> UInt8 {
    var hist = [Int](repeating: 0, count: 256)
    for v in px { hist[Int(v)] += 1 }
    let total = px.count
    var sum = 0.0; for t in 0..<256 { sum += Double(t * hist[t]) }
    var sumB = 0.0, wB = 0, best = 0.0, bestT = 128
    for t in 0..<256 {
        wB += hist[t]; if wB == 0 { continue }
        let wF = total - wB; if wF == 0 { break }
        sumB += Double(t * hist[t])
        let mB = sumB / Double(wB), mF = (sum - sumB) / Double(wF)
        let b = Double(wB) * Double(wF) * (mB - mF) * (mB - mF)
        if b > best { best = b; bestT = t }
    }
    return UInt8(bestT)
}

var manifest: [String: [FigureOut]] = [:]
var totalFigures = 0

for name in jsons {
    guard let data = try? Data(contentsOf: ocrDir.appendingPathComponent(name)),
          let page = try? dec.decode(PageIn.self, from: data) else { continue }
    let imgURL = work.appendingPathComponent(page.imageFile)
    guard let img = loadImage(imgURL) else { continue }

    let (W, H, px) = grayBuf(img, maxDim: 900)
    let thr = otsu(px)

    // Ink mask, with every OCR text box (padded) removed.
    var ink = [Bool](repeating: false, count: W * H)
    for i in 0..<(W * H) { ink[i] = px[i] < thr }

    for l in page.lines {
        let padX = 0.012, padY = 0.010
        let x0 = max(0, Int((l.x - padX) * Double(W))), x1 = min(W - 1, Int((l.x + l.w + padX) * Double(W)))
        let y0 = max(0, Int((l.y - padY) * Double(H))), y1 = min(H - 1, Int((l.y + l.h + padY) * Double(H)))
        if x0 > x1 || y0 > y1 { continue }
        for y in y0...y1 { for x in x0...x1 { ink[y * W + x] = false } }
    }

    // Drop a border frame: page edges and fold shadow are not illustrations.
    let bx = Int(Double(W) * 0.02), by = Int(Double(H) * 0.02)
    for y in 0..<H { for x in 0..<W where x < bx || x >= W - bx || y < by || y >= H - by { ink[y * W + x] = false } }

    // Dilate so a figure's strokes and its internal gaps fuse into one blob.
    let r = max(2, W / 90)
    var dil = [Bool](repeating: false, count: W * H)
    // Separable box dilation.
    var tmp = [Bool](repeating: false, count: W * H)
    for y in 0..<H {
        var count = 0
        for x in 0..<min(r, W) where ink[y * W + x] { count += 1 }
        for x in 0..<W {
            let add = x + r, rem = x - r - 1
            if add < W && ink[y * W + add] { count += 1 }
            if rem >= 0 && ink[y * W + rem] { count -= 1 }
            tmp[y * W + x] = count > 0
        }
    }
    for x in 0..<W {
        var count = 0
        for y in 0..<min(r, H) where tmp[y * W + x] { count += 1 }
        for y in 0..<H {
            let add = y + r, rem = y - r - 1
            if add < H && tmp[add * W + x] { count += 1 }
            if rem >= 0 && tmp[rem * W + x] { count -= 1 }
            dil[y * W + x] = count > 0
        }
    }

    // Label connected components (4-way flood fill).
    var seen = [Bool](repeating: false, count: W * H)
    var regions: [(x0: Int, y0: Int, x1: Int, y1: Int, area: Int)] = []
    var stack: [Int] = []
    for start in 0..<(W * H) {
        if !dil[start] || seen[start] { continue }
        var minX = W, maxX = 0, minY = H, maxY = 0, area = 0
        stack.removeAll(keepingCapacity: true)
        stack.append(start); seen[start] = true
        while let p = stack.popLast() {
            let x = p % W, y = p / W
            area += 1
            if x < minX { minX = x }; if x > maxX { maxX = x }
            if y < minY { minY = y }; if y > maxY { maxY = y }
            if x > 0 { let q = p - 1; if dil[q] && !seen[q] { seen[q] = true; stack.append(q) } }
            if x < W - 1 { let q = p + 1; if dil[q] && !seen[q] { seen[q] = true; stack.append(q) } }
            if y > 0 { let q = p - W; if dil[q] && !seen[q] { seen[q] = true; stack.append(q) } }
            if y < H - 1 { let q = p + W; if dil[q] && !seen[q] { seen[q] = true; stack.append(q) } }
        }
        regions.append((minX, minY, maxX, maxY, area))
    }

    // Merge blobs that belong to one illustration. A photograph with light
    // regions breaks into several components, which would otherwise be published
    // as separate captionless fragments of the same picture.
    let mergeGap = Int(Double(W) * 0.025)
    var merged = regions
    var didMerge = true
    while didMerge {
        didMerge = false
        outer: for i in 0..<merged.count {
            for j in (i + 1)..<merged.count {
                let a = merged[i], b = merged[j]
                let gapX = max(a.x0, b.x0) - min(a.x1, b.x1)
                let gapY = max(a.y0, b.y0) - min(a.y1, b.y1)
                // Near or overlapping on both axes → same picture.
                if gapX <= mergeGap && gapY <= mergeGap {
                    merged[i] = (min(a.x0, b.x0), min(a.y0, b.y0),
                                 max(a.x1, b.x1), max(a.y1, b.y1), a.area + b.area)
                    merged.remove(at: j)
                    didMerge = true
                    break outer
                }
            }
        }
    }
    regions = merged

    // Keep blobs big enough to be a real illustration, and with enough actual
    // ink inside to rule out smudges and scanning artefacts.
    let pageArea = Double(W * H)
    var figs: [FigureOut] = []
    var idx = 0
    for rg in regions {
        let w = rg.x1 - rg.x0 + 1, h = rg.y1 - rg.y0 + 1
        let areaFrac = Double(w * h) / pageArea
        if areaFrac < 0.006 { continue }
        if w < Int(Double(W) * 0.05) || h < Int(Double(H) * 0.02) { continue }
        var inkCount = 0
        for y in rg.y0...rg.y1 { for x in rg.x0...rg.x1 where ink[y * W + x] { inkCount += 1 } }
        let density = Double(inkCount) / Double(w * h)
        if density < 0.02 { continue }

        // Trim the dilation padding back off before cropping.
        let nx = max(0.0, Double(rg.x0 - r) / Double(W)), ny = max(0.0, Double(rg.y0 - r) / Double(H))
        let nw = min(1.0 - nx, Double(w + 2 * r) / Double(W)), nh = min(1.0 - ny, Double(h + 2 * r) / Double(H))

        let cropRect = CGRect(x: (nx * Double(img.width)).rounded(), y: (ny * Double(img.height)).rounded(),
                              width: (nw * Double(img.width)).rounded(), height: (nh * Double(img.height)).rounded())
        guard let sub = img.cropping(to: cropRect) else { continue }
        idx += 1
        let fname = name.replacingOccurrences(of: ".json", with: "") + String(format: "-f%02d.png", idx)
        guard let dst = CGImageDestinationCreateWithURL(figDir.appendingPathComponent(fname) as CFURL,
                                                        UTType.png.identifier as CFString, 1, nil) else { continue }
        CGImageDestinationAddImage(dst, sub, nil)
        CGImageDestinationFinalize(dst)
        figs.append(FigureOut(x: nx, y: ny, w: nw, h: nh, file: "figures/" + fname))
    }
    figs.sort { $0.y < $1.y }
    manifest[name.replacingOccurrences(of: ".json", with: "")] = figs
    totalFigures += figs.count
    if !figs.isEmpty { print("\(name): \(figs.count) figure(s)") }
}

if let d = try? enc.encode(manifest) {
    try? d.write(to: work.appendingPathComponent("figures.json"))
}
print("== \(totalFigures) figures from \(jsons.count) pages")
