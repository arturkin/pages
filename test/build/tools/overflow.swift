import Foundation
import PDFKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let a = Array(CommandLine.arguments.dropFirst())
guard let doc = PDFDocument(url: URL(fileURLWithPath: a[0])), let page = doc.page(at: Int(a[1])!) else { exit(1) }
let r = page.bounds(for: .mediaBox)
let scale = 60.0/72.0
// pad generously on all sides to reveal any content outside the mediaBox
let pad: CGFloat = 400
let w = Int(((r.width + 2*pad) * scale).rounded()), h = Int(((r.height + 2*pad) * scale).rounded())
let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.setFillColor(CGColor(red: 0.85, green: 0.3, blue: 0.3, alpha: 1)) // red = outside mediaBox
ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
ctx.scaleBy(x: scale, y: scale)
ctx.translateBy(x: pad, y: pad)
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
ctx.fill(r)
page.draw(with: .mediaBox, to: ctx)
let img = ctx.makeImage()!
let out = URL(fileURLWithPath: a[2])
let dst = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dst, img, nil); CGImageDestinationFinalize(dst)
print("wrote \(out.path) mediaBox=\(r)")
