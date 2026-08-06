import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// ─────────────────────────────────────────────────────────────────────────────
// signs — isolate individual traffic-sign graphics on the reference sheet.
//
//   signs <workDir> <pagePrefix> [pagePrefix ...]
//
// The generic figure finder is wrong for this sheet: it looks for ink outside
// text boxes and dilates, which fuses a whole row of signs into one blob. Here
// the signs are the only *saturated* colour on the page — captions are black
// text, so a chroma mask separates every sign cleanly and drops the text without
// needing to know where it is.
// ─────────────────────────────────────────────────────────────────────────────

struct SignOut: Codable {
    var x: Double; var y: Double; var w: Double; var h: Double; var file: String
    /// Share of the blob's height removed by the caption clip below, absent when
    /// no printed caption was found under this crop and `0` when the caption was
    /// reachable by the pad alone. Published so a check can assert the crop no
    /// longer contains its own label without re-measuring the pixels.
    var clip: Double?
}

let args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 2 else { fputs("usage: signs <workDir> <prefix> [prefix ...]\n", stderr); exit(2) }
let work = URL(fileURLWithPath: args[0])
let prefixes = Array(args.dropFirst())
let outDir = work.appendingPathComponent("figures")
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

let fm = FileManager.default
let pagesDir = work.appendingPathComponent("pages")
let names = ((try? fm.contentsOfDirectory(atPath: pagesDir.path)) ?? [])
    .filter { n in n.hasSuffix(".png") && prefixes.contains(where: { n.hasPrefix($0) }) }.sorted()

var manifest: [String: [SignOut]] = [:]
var total = 0

for name in names {
    let url = pagesDir.appendingPathComponent(name)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }

    // Work at a fixed analysis width; signs are ~4% of page width.
    let maxDim = 1400
    let s = min(1.0, Double(maxDim) / Double(max(img.width, img.height)))
    let W = max(1, Int(Double(img.width) * s)), H = max(1, Int(Double(img.height) * s))
    var rgba = [UInt8](repeating: 0, count: W * H * 4)
    rgba.withUnsafeMutableBytes { raw in
        guard let ctx = CGContext(data: raw.baseAddress, width: W, height: H, bitsPerComponent: 8,
                                  bytesPerRow: W * 4, space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
        ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
        ctx.interpolationQuality = .high
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: W, height: H))
    }

    // Text-line boxes, so caption ink can be excluded from the graphics mask.
    // `y0raw` is the line's own top edge, before the padding below: the caption
    // clip has to cut above the glyphs but must not spend the paper gap that keeps
    // the sign's bottom edge out of `checkcrops`' border ring.
    struct Box { var x0: Int; var y0: Int; var x1: Int; var y1: Int; var y0raw: Int }
    var textBoxes: [Box] = []
    let ocrURL = work.appendingPathComponent("ocr").appendingPathComponent(
        name.replacingOccurrences(of: ".png", with: ".json"))
    if let d = try? Data(contentsOf: ocrURL),
       let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
       let lines = obj["lines"] as? [[String: Any]] {
        for l in lines {
            guard let x = l["x"] as? Double, let y = l["y"] as? Double,
                  let w = l["w"] as? Double, let h = l["h"] as? Double else { continue }
            // Pad: an unpadded box leaves ascender/descender ink behind, which
            // survives as a caption-shaped ghost blob.
            let px = 0.002, py = 0.002
            textBoxes.append(Box(x0: max(0, Int((x - px) * Double(W))),
                                 y0: max(0, Int((y - py) * Double(H))),
                                 x1: min(W - 1, Int((x + w + px) * Double(W))),
                                 y1: min(H - 1, Int((y + h + py) * Double(H))),
                                 y0raw: max(0, Int(y * Double(H)))))
        }
    }
    var isText = [Bool](repeating: false, count: W * H)
    for t in textBoxes where t.x0 <= t.x1 && t.y0 <= t.y1 {
        for y in t.y0...t.y1 { for x in t.x0...t.x1 { isText[y * W + x] = true } }
    }

    // Graphics mask. Colour alone is not enough: this sheet also carries
    // monochrome signs (road numbers, street-name plates) whose chroma is zero,
    // so dark ink counts too — minus anything inside a recognized text line, which
    // keeps captions out.
    var mask = [Bool](repeating: false, count: W * H)
    for i in 0..<(W * H) {
        let r = Int(rgba[i * 4]), g = Int(rgba[i * 4 + 1]), b = Int(rgba[i * 4 + 2])
        let mx = max(r, max(g, b)), mn = min(r, min(g, b))
        let coloured = (mx - mn) > 45 && mx > 60
        let ink = mx < 150 && !isText[i]
        mask[i] = coloured || ink
    }

    // Fill enclosed holes so a hollow plate (a rectangle outline around a name)
    // becomes a solid blob and survives the density filter below.
    var outside = [Bool](repeating: false, count: W * H)
    var q: [Int] = []
    for x in 0..<W {
        for y in [0, H - 1] where !mask[y * W + x] && !outside[y * W + x] {
            outside[y * W + x] = true; q.append(y * W + x)
        }
    }
    for y in 0..<H {
        for x in [0, W - 1] where !mask[y * W + x] && !outside[y * W + x] {
            outside[y * W + x] = true; q.append(y * W + x)
        }
    }
    while let p = q.popLast() {
        let x = p % W, y = p / W
        for (nx, ny) in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] {
            guard nx >= 0, nx < W, ny >= 0, ny < H else { continue }
            let n = ny * W + nx
            if !mask[n] && !outside[n] { outside[n] = true; q.append(n) }
        }
    }
    for i in 0..<(W * H) where !mask[i] && !outside[i] { mask[i] = true }

    // Small dilation: close a sign's internal gaps (pictogram vs border) without
    // bridging the spacing between neighbouring signs.
    let r = max(1, W / 340)
    var tmp = [Bool](repeating: false, count: W * H)
    var dil = [Bool](repeating: false, count: W * H)
    for y in 0..<H {
        var c = 0
        for x in 0..<min(r, W) where mask[y * W + x] { c += 1 }
        for x in 0..<W {
            let add = x + r, rem = x - r - 1
            if add < W && mask[y * W + add] { c += 1 }
            if rem >= 0 && mask[y * W + rem] { c -= 1 }
            tmp[y * W + x] = c > 0
        }
    }
    for x in 0..<W {
        var c = 0
        for y in 0..<min(r, H) where tmp[y * W + x] { c += 1 }
        for y in 0..<H {
            let add = y + r, rem = y - r - 1
            if add < H && tmp[add * W + x] { c += 1 }
            if rem >= 0 && tmp[rem * W + x] { c -= 1 }
            dil[y * W + x] = c > 0
        }
    }

    var seen = [Bool](repeating: false, count: W * H)
    var comps: [(x0: Int, y0: Int, x1: Int, y1: Int, area: Int)] = []
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
        comps.append((minX, minY, maxX, maxY, area))
    }

    /// Shrink a blob to its solid-colour core.
    ///
    /// Scanned captions carry faint colour fringing, so a sign's blob reaches
    /// down into the words beneath it and the crop shows the label twice. Rows
    /// and columns holding only fringe are dropped, which also collapses
    /// text-fringe blobs far enough to fail the size filter below.
    func trimToCore(_ c: (x0: Int, y0: Int, x1: Int, y1: Int, area: Int))
        -> (x0: Int, y0: Int, x1: Int, y1: Int, area: Int) {
        let w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1
        guard w > 2, h > 2 else { return c }
        var rowN = [Int](repeating: 0, count: h), colN = [Int](repeating: 0, count: w)
        for y in c.y0...c.y1 {
            for x in c.x0...c.x1 where mask[y * W + x] {
                rowN[y - c.y0] += 1; colN[x - c.x0] += 1
            }
        }
        let rowMax = rowN.max() ?? 0, colMax = colN.max() ?? 0
        guard rowMax > 0, colMax > 0 else { return c }
        let rowCut = max(1, Int(Double(rowMax) * 0.12)), colCut = max(1, Int(Double(colMax) * 0.12))
        var t = 0, b = h - 1, l = 0, r = w - 1
        while t < b && rowN[t] < rowCut { t += 1 }
        while b > t && rowN[b] < rowCut { b -= 1 }
        while l < r && colN[l] < colCut { l += 1 }
        while r > l && colN[r] < colCut { r -= 1 }
        var area = 0
        for y in (c.y0 + t)...(c.y0 + b) {
            for x in (c.x0 + l)...(c.x0 + r) where mask[y * W + x] { area += 1 }
        }
        return (c.x0 + l, c.y0 + t, c.x0 + r, c.y0 + b, area)
    }
    comps = comps.map(trimToCore)

    /// Share of a box's pixels that are saturated colour, using the same test as
    /// the graphics mask. On paper a caption contributes only the scan's chroma
    /// fringing around black glyphs; on a sign face the board itself is coloured.
    func colourCoverage(_ x0: Int, _ y0: Int, _ x1: Int, _ y1: Int) -> Double {
        guard x0 <= x1, y0 <= y1 else { return 1 }
        var hit = 0, n = 0
        for y in y0...y1 {
            for x in x0...x1 {
                let i = (y * W + x) * 4
                let r = Int(rgba[i]), g = Int(rgba[i + 1]), b = Int(rgba[i + 2])
                let mx = max(r, max(g, b)), mn = min(r, min(g, b))
                if (mx - mn) > 45 && mx > 60 { hit += 1 }
                n += 1
            }
        }
        return n == 0 ? 1 : Double(hit) / Double(n)
    }

    /// Clip a blob's bottom at the printed caption underneath it.
    ///
    /// `!isText` is applied only to the *dark* term of the mask, so the chroma
    /// fringing scanned caption text leaves behind still enters through
    /// `coloured`, bridges the paper gap under the dilation above and joins the
    /// caption to the sign. `trimToCore` then keeps those rows because fringe
    /// clears its 12%-of-rowMax cut. Measured consequence before this clip: 32 of
    /// the 243 crops in the card deck printed their own answer inside the image.
    ///
    /// Text *on the sign face* — STOP, EFTIRLIT, BLINDHÆÐ, WC, place names — is
    /// part of the graphic and must survive, so the separator is the coloured
    /// coverage of the text line's own box within the blob's horizontal span.
    /// Measured over all 357 signs on this sheet the two populations do not
    /// overlap: printed page captions 0.217–0.469 (n=45, median 0.247), legends
    /// on a sign face 0.798–0.950 (n=5: SNÚNINGSRÝMI ×2, 5,2 km, Borgarnes,
    /// Mosfellsbær). The cut sits in the empty gap, at 0.50.
    ///
    /// Only lines whose centre falls below the *crop's* core count, which is not a
    /// new number: `layout.ts:547` already defines a sign's core as
    /// `cy < s.y + s.h*0.82` on exactly this box. It is measured on the emitted
    /// crop rather than the blob, so the pad below is included — on the marginal
    /// cases (`p004full-s032` "Bus-" at 0.872, `p005full-s028` "Abandoned farm" at
    /// 0.877) the blob-relative form misses the caption by a hair. Across the 47
    /// affected crops the caption occupies the bottom 12.2–22.8% of crop height
    /// (median 16.0%) and the sign's coloured graphic never continues below the
    /// caption's top edge, so this removes paper and text only. It is also
    /// self-limiting — the size and density filters below run on the clipped box,
    /// so a mistaken clip drops the crop rather than publishing a sliced sign.
    ///
    /// A line only shortens the blob when at least half its glyph height is inside
    /// the crop. Measured on this sheet the two populations barely meet: the
    /// sub-threshold hits run 0.00–0.42 and all 52 above sit at exactly 1.00.
    /// Without this gate the clip fires on those slivers, where the sign's own edge
    /// and the caption's top coincide, so there is no gap to pad into and
    /// `checkcrops` grades the result `cut`: 49 of 80 clipped crops, measured, most
    /// of them signs that had no legible caption to begin with.
    ///
    /// It does *not* gate the pad. The pad exists to save the sign's anti-aliased
    /// edge, and everything below the blob is paper by construction, so stopping it
    /// at a caption's top edge can never cost a sign pixel — while leaving it
    /// unbounded keeps a readable sliver: `p005full-s018` printed the whole of
    /// "Lane direction sign" in the top 42% of its glyphs, legible on the crop and
    /// the report's one classifier miss. Hence two cuts: `cut` shortens the blob,
    /// `padCut` only limits how far the crop may pad past it.
    ///
    /// Returns the caption's top edge together with the sign's own last content row
    /// above it. The gap between the two is the only room the emitted crop may pad
    /// into: pad further and the caption comes back (measured on `p006full-s017`,
    /// "Waste tank": a full pad re-admits 45% of the glyph height), pad not at all
    /// and the sign's own edge lands in `checkcrops`' 2 px border ring. `cut` may
    /// land below the blob entirely, which is the case where the caption is admitted
    /// by the pad alone — then the blob is left alone and only the pad is bounded.
    ///
    /// Do NOT instead extend `isText` to the coloured term of the mask; see the
    /// note on `meanChroma` for why that is a trap.
    func captionCut(_ c: (x0: Int, y0: Int, x1: Int, y1: Int, area: Int)) -> (cut: Int, padCut: Int, bottom: Int)? {
        let h = c.y1 - c.y0 + 1
        guard h > 2 else { return nil }
        // The box the caption would be judged in is the padded crop, not the blob.
        let pad = max(1, (c.y1 - c.y0) / 12)
        let core = (c.y0 - pad) + Int(Double(h + 2 * pad) * 0.82)
        let cropBottom = c.y1 + pad
        var cut = cropBottom + 1, padCut = cropBottom + 1
        for t in textBoxes {
            let cx = (t.x0 + t.x1) / 2
            guard cx >= c.x0, cx <= c.x1, (t.y0 + t.y1) / 2 > core, t.y0 <= cropBottom else { continue }
            let hfrac = Double(min(t.y1, cropBottom) - t.y0 + 1) / Double(t.y1 - t.y0 + 1)
            let cov = colourCoverage(max(t.x0, c.x0), t.y0, min(t.x1, c.x1), min(t.y1, cropBottom))
            if ProcessInfo.processInfo.environment["SIGN_DEBUG"] != nil {
                fputs(String(format: "  clip? %4dx%-4d rely=%.3f hfrac=%.2f cov=%.3f %@\n",
                             c.x1 - c.x0 + 1, h, Double(t.y0 - c.y0) / Double(h), hfrac, cov,
                             cov > 0.50 ? "keep (on face)" : hfrac < 0.50 ? "pad only" : "CLIP"), stderr)
            }
            if cov > 0.50 { continue }
            padCut = min(padCut, t.y0raw)
            if hfrac < 0.50 { continue }
            cut = min(cut, t.y0raw)
        }
        guard padCut <= cropBottom, padCut - 1 > c.y0 else { return nil }
        // The sign's own last row, found with the same permissive content test
        // `checkcrops` grades the border ring by. `trimToCore`'s 12%-of-rowMax rule
        // cannot be reused here: applied to a clipped box it eats the tapering
        // bottom of a round or shield-shaped sign and slices it.
        var bottom = c.y0
        for y in c.y0...max(c.y0, min(cut - 1, c.y1)) {
            var n = 0
            for x in c.x0...c.x1 {
                let i = (y * W + x) * 4
                let r = Int(rgba[i]), g = Int(rgba[i + 1]), b = Int(rgba[i + 2])
                let mx = max(r, max(g, b)), mn = min(r, min(g, b))
                if (mx - mn) > 40 || mx < 165 { n += 1 }
            }
            if n >= 3 { bottom = y }
        }
        if cut > c.y1 { bottom = c.y1 }
        if ProcessInfo.processInfo.environment["SIGN_DEBUG"] != nil {
            fputs(String(format: "  cut %4dx%-4d gap=%d padgap=%d\n",
                         c.x1 - c.x0 + 1, c.y1 - c.y0 + 1, cut - 1 - bottom, padCut - 1 - bottom), stderr)
        }
        return (cut, padCut, bottom)
    }
    // The size filter and the reading-order sort below drop and reorder blobs, so
    // how much each one lost, and how far it may still be padded downwards, are
    // remembered by its clipped box.
    var clipShare: [String: Double] = [:]
    var clipRoom: [String: Int] = [:]
    // Scoped to the sign sheet, whose every sign carries a printed caption
    // immediately beneath it. The appendix's sign tables are prose with pictures:
    // none of their crops can reach a card (`dataset.ts` sources the whole deck
    // from the sheet), the caption measurements above were never taken there, and
    // clipping there moves appendix figure captions — which re-points the chunk
    // ids of the prose the captions stop swallowing, and orphaned an authored
    // citation for no gain.
    let sheet = name.hasPrefix("umferdarmerki")
    comps = comps.map { c in
        guard sheet else { return c }
        // Once per caption line. A wrapped caption ("Rubbish / bin", "Waste tank /
        // discharge") only puts its *last* line below the 82% core of the original
        // box, so a single pass leaves the first line inside the crop — which is
        // the report's whole "partial leak" class. Re-running on the shortened box
        // brings the line above it into the band. Capped at four because the
        // longest caption on the sheet is three lines, and each pass still has to
        // clear the colour-coverage and hfrac gates.
        var cur = c, room = 0, passes = 0
        while passes < 4, let k = captionCut(cur) {
            room = max(0, k.padCut - 1 - k.bottom)
            passes += 1
            if k.bottom >= cur.y1 { break }
            cur = (cur.x0, cur.y0, cur.x1, k.bottom, 0)
        }
        guard passes > 0 else { return c }
        var area = 0
        for y in cur.y0...cur.y1 {
            for x in cur.x0...cur.x1 where mask[y * W + x] { area += 1 }
        }
        let key = "\(cur.x0),\(cur.y0),\(cur.x1),\(cur.y1)"
        clipShare[key] = Double(c.y1 - cur.y1) / Double(c.y1 - c.y0 + 1)
        clipRoom[key] = room
        return (cur.x0, cur.y0, cur.x1, cur.y1, area)
    }

    /// Mean colour strength of a blob's masked pixels.
    ///
    /// Scanned black text leaves weak chroma fringing that survives the mask;
    /// printed sign faces are strongly saturated. Measured on this sheet the two
    /// populations are cleanly separated — fringe 75–88, signs 126–133 — so a
    /// threshold between them discards caption ghosts without touching signs.
    ///
    /// Overlap with recognized text cannot be used for this: the white arrows on
    /// a blue lane-marking sign are themselves read as text, so real signs reach
    /// 0.91 text coverage.
    func meanChroma(_ c: (x0: Int, y0: Int, x1: Int, y1: Int, area: Int)) -> Double {
        var sum = 0.0, n = 0
        for y in c.y0...c.y1 {
            for x in c.x0...c.x1 where mask[y * W + x] {
                let i = (y * W + x) * 4
                let r = Int(rgba[i]), g = Int(rgba[i + 1]), b = Int(rgba[i + 2])
                sum += Double(max(r, max(g, b)) - min(r, min(g, b))); n += 1
            }
        }
        return n == 0 ? 0 : sum / Double(n)
    }
    if ProcessInfo.processInfo.environment["SIGN_DEBUG"] != nil {
        for c in comps {
            fputs(String(format: "  cand %4dx%-4d chroma=%6.1f\n",
                         c.x1 - c.x0 + 1, c.y1 - c.y0 + 1, meanChroma(c)), stderr)
        }
    }


    // A sign is roughly square and a consistent size; drop colour specks and the
    // wide tinted section-heading bars.
    let cands = comps.filter { c in
        let w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1
        let ar = Double(w) / Double(h)
        // Caption ghosts measure 8–22px tall here; the smallest real sign is
        // ~50px, so height is the reliable separator — and unlike colour it also
        // keeps the monochrome plates. Direction signs run wide, hence the
        // generous aspect range.
        return w >= Int(Double(W) * 0.016) && w <= Int(Double(W) * 0.22)
            && h >= Int(Double(H) * 0.013)
            && ar > 0.25 && ar < 6.5
            && Double(c.area) / Double(w * h) > 0.18
    }
    // Reading order: row by row.
    let rowTol = Int(Double(H) * 0.012)
    let ordered = cands.sorted {
        abs($0.y0 - $1.y0) <= rowTol ? $0.x0 < $1.x0 : $0.y0 < $1.y0
    }

    var outs: [SignOut] = []
    for (i, c) in ordered.enumerated() {
        // Pad slightly so anti-aliased edges are not shaved off.
        let padX = max(1, (c.x1 - c.x0) / 12), padY = max(1, (c.y1 - c.y0) / 12)
        // Below a clipped edge the pad has to stay inside the gap the clip found
        // between the sign and the caption, or it hands the caption back — but
        // never below 2 px, or the sign's own bottom edge lands in `checkcrops`'
        // 2 px border ring, which grades an otherwise perfect crop `cut` and drops
        // it from the deck (measured on `p006full-s079` Supermarket and
        // `p006full-s082`, where the caption's top edge touches the sign's). Those
        // 2 px hold the tips of the caption's ascenders, the class this report
        // eyeballed on eight crops and found illegible.
        let key = "\(c.x0),\(c.y0),\(c.x1),\(c.y1)"
        let clip = clipShare[key]
        let padB = min(padY, max(clipRoom[key] ?? padY, 2))
        let nx = max(0.0, Double(c.x0 - padX) / Double(W))
        let ny = max(0.0, Double(c.y0 - padY) / Double(H))
        let nw = min(1.0 - nx, Double(c.x1 - c.x0 + 1 + 2 * padX) / Double(W))
        let nh = min(1.0 - ny, Double(c.y1 - c.y0 + 1 + padY + padB) / Double(H))
        let rect = CGRect(x: (nx * Double(img.width)).rounded(), y: (ny * Double(img.height)).rounded(),
                          width: (nw * Double(img.width)).rounded(), height: (nh * Double(img.height)).rounded())
        guard let sub = img.cropping(to: rect) else { continue }
        let fname = name.replacingOccurrences(of: ".png", with: "") + String(format: "-s%03d.png", i + 1)
        guard let dst = CGImageDestinationCreateWithURL(outDir.appendingPathComponent(fname) as CFURL,
                                                        UTType.png.identifier as CFString, 1, nil) else { continue }
        CGImageDestinationAddImage(dst, sub, nil)
        CGImageDestinationFinalize(dst)
        outs.append(SignOut(x: nx, y: ny, w: nw, h: nh, file: "figures/" + fname, clip: clip))
    }
    manifest[name.replacingOccurrences(of: ".png", with: "")] = outs
    total += outs.count
    print("\(name): \(outs.count) signs")
}

let enc = JSONEncoder()
enc.outputFormatting = [.prettyPrinted, .sortedKeys]
if let d = try? enc.encode(manifest) {
    try? d.write(to: work.appendingPathComponent("signs.json"))
}
print("== \(total) signs")
