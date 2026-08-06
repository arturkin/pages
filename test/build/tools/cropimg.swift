import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
// cropimg <in> <out> <x> <y> <w> <h> [scale]   — normalized rect, for visual QA
let a = Array(CommandLine.arguments.dropFirst())
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[0]) as CFURL, nil)!
let img = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let x = Double(a[2])!, y = Double(a[3])!, w = Double(a[4])!, h = Double(a[5])!
let scale = a.count > 6 ? Double(a[6])! : 1.0
let r = CGRect(x: (x*Double(img.width)).rounded(), y: (y*Double(img.height)).rounded(),
               width: (w*Double(img.width)).rounded(), height: (h*Double(img.height)).rounded())
let sub = img.cropping(to: r)!
let ow = Int(Double(sub.width)*scale), oh = Int(Double(sub.height)*scale)
let ctx = CGContext(data: nil, width: ow, height: oh, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.interpolationQuality = .high
ctx.draw(sub, in: CGRect(x: 0, y: 0, width: ow, height: oh))
let dst = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dst, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dst)
print("\(sub.width)x\(sub.height) -> \(ow)x\(oh)")
