import Foundation
import PDFKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// render <pdf> <outDir> <dpi> [pageFrom] [pageTo]
let a = Array(CommandLine.arguments.dropFirst())
guard a.count >= 3 else { fputs("usage: render <pdf> <outDir> <dpi> [from] [to]\n", stderr); exit(2) }
let pdfPath = a[0], outDir = a[1]
let dpi = Double(a[2]) ?? 200.0
guard let doc = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else { fputs("cannot open\n", stderr); exit(1) }
let from = a.count > 3 ? (Int(a[3]) ?? 0) : 0
let to   = a.count > 4 ? (Int(a[4]) ?? doc.pageCount-1) : doc.pageCount-1
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
let base = URL(fileURLWithPath: pdfPath).deletingPathExtension().lastPathComponent
let scale = dpi / 72.0

for i in from...min(to, doc.pageCount-1) {
    guard let page = doc.page(at: i) else { continue }
    let r = page.bounds(for: .mediaBox)
    let w = Int((r.width * scale).rounded()), h = Int((r.height * scale).rounded())
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
        bytesPerRow: 0, space: cs,
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { continue }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: scale, y: scale)
    ctx.translateBy(x: -r.origin.x, y: -r.origin.y)
    ctx.interpolationQuality = .high
    page.draw(with: .mediaBox, to: ctx)
    guard let img = ctx.makeImage() else { continue }
    let out = URL(fileURLWithPath: outDir).appendingPathComponent(String(format: "%@-p%03d.png", base, i+1))
    guard let dst = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil) else { continue }
    CGImageDestinationAddImage(dst, img, nil)
    CGImageDestinationFinalize(dst)
    print(out.path)
}
