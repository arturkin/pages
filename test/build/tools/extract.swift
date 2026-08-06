import Foundation
import PDFKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// extract <pdf> <outDir>  -> dumps each page's largest embedded image, rotated per /Rotate
let a = Array(CommandLine.arguments.dropFirst())
guard a.count >= 2 else { fputs("usage: extract <pdf> <outDir>\n", stderr); exit(2) }
let url = URL(fileURLWithPath: a[0]), outDir = a[1]
guard let cg = CGPDFDocument(url as CFURL) else { fputs("cannot open\n", stderr); exit(1) }
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
let base = url.deletingPathExtension().lastPathComponent

func rotate(_ img: CGImage, degrees: Int) -> CGImage {
    let d = ((degrees % 360) + 360) % 360
    if d == 0 { return img }
    let swap = (d == 90 || d == 270)
    let w = swap ? img.height : img.width, h = swap ? img.width : img.height
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return img }
    ctx.translateBy(x: CGFloat(w)/2, y: CGFloat(h)/2)
    // PDF /Rotate is clockwise for display; CG rotation is counter-clockwise
    ctx.rotate(by: -CGFloat(d) * .pi / 180)
    ctx.interpolationQuality = .high
    ctx.draw(img, in: CGRect(x: -CGFloat(img.width)/2, y: -CGFloat(img.height)/2,
                             width: CGFloat(img.width), height: CGFloat(img.height)))
    return ctx.makeImage() ?? img
}

/// Best-effort CGImage from a PDF image XObject stream.
func imageFrom(stream: CGPDFStreamRef, dict: CGPDFDictionaryRef) -> CGImage? {
    var fmt = CGPDFDataFormat.raw
    guard let data = CGPDFStreamCopyData(stream, &fmt) as Data? else { return nil }
    switch fmt {
    case .jpegEncoded, .JPEG2000:
        return CGImage(jpegDataProviderSource: CGDataProvider(data: data as CFData)!,
                       decode: nil, shouldInterpolate: true, intent: .defaultIntent)
            ?? CGImageSourceCreateWithData(data as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) }
    default: break
    }
    var wI: CGPDFInteger = 0, hI: CGPDFInteger = 0, bpcI: CGPDFInteger = 8
    guard CGPDFDictionaryGetInteger(dict, "Width", &wI), CGPDFDictionaryGetInteger(dict, "Height", &hI) else { return nil }
    CGPDFDictionaryGetInteger(dict, "BitsPerComponent", &bpcI)
    let w = Int(wI), h = Int(hI), bpc = Int(bpcI)

    // Determine component count from the declared colour space.
    var comps = 0
    var csName: UnsafePointer<Int8>? = nil
    if CGPDFDictionaryGetName(dict, "ColorSpace", &csName), let n = csName {
        switch String(cString: n) {
        case "DeviceRGB", "CalRGB": comps = 3
        case "DeviceGray", "CalGray": comps = 1
        case "DeviceCMYK": comps = 4
        default: comps = 0
        }
    }
    if comps == 0 {
        // Fall back to inferring from the payload size.
        for c in [3, 1, 4] where data.count >= w * h * c * bpc / 8 && data.count < w * h * (c + 1) * bpc / 8 { comps = c; break }
    }
    if comps == 0 { comps = data.count / max(1, w * h) }
    guard comps >= 1, comps <= 4 else { return nil }

    let space: CGColorSpace = comps == 1 ? CGColorSpaceCreateDeviceGray()
                            : comps == 4 ? CGColorSpaceCreateDeviceCMYK()
                            : CGColorSpaceCreateDeviceRGB()
    let bytesPerRow = w * comps * bpc / 8
    guard data.count >= bytesPerRow * h, let provider = CGDataProvider(data: data as CFData) else { return nil }
    return CGImage(width: w, height: h, bitsPerComponent: bpc, bitsPerPixel: comps * bpc,
                   bytesPerRow: bytesPerRow, space: space, bitmapInfo: CGBitmapInfo(rawValue: 0),
                   provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
}

for pno in 1...cg.numberOfPages {
    guard let page = cg.page(at: pno), let dict = page.dictionary else { continue }
    var res: CGPDFDictionaryRef? = nil
    guard CGPDFDictionaryGetDictionary(dict, "Resources", &res), let res else { continue }
    var xo: CGPDFDictionaryRef? = nil
    guard CGPDFDictionaryGetDictionary(res, "XObject", &xo), let xo else { continue }

    final class Box { var best: CGImage? = nil; var bestPx = 0 }
    let box = Box()
    let ctxPtr = Unmanaged.passUnretained(box).toOpaque()
    CGPDFDictionaryApplyBlock(xo, { (_, value, info) -> Bool in
        let box = Unmanaged<Box>.fromOpaque(info!).takeUnretainedValue()
        var stream: CGPDFStreamRef? = nil
        guard CGPDFObjectGetValue(value, .stream, &stream), let stream,
              let sd = CGPDFStreamGetDictionary(stream) else { return true }
        var sub: UnsafePointer<Int8>? = nil
        guard CGPDFDictionaryGetName(sd, "Subtype", &sub), let sub,
              String(cString: sub) == "Image" else { return true }
        if let img = imageFrom(stream: stream, dict: sd) {
            let px = img.width * img.height
            if px > box.bestPx { box.bestPx = px; box.best = img }
        }
        return true
    }, ctxPtr)

    guard let img = box.best else { fputs("p\(pno): no image\n", stderr); continue }
    let rotated = rotate(img, degrees: Int(page.rotationAngle))
    let out = URL(fileURLWithPath: outDir).appendingPathComponent(String(format: "%@-p%03d.png", base, pno))
    guard let dst = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil) else { continue }
    CGImageDestinationAddImage(dst, rotated, nil)
    CGImageDestinationFinalize(dst)
    print("p\(pno): \(img.width)x\(img.height) rot=\(page.rotationAngle) -> \(rotated.width)x\(rotated.height)")
}
