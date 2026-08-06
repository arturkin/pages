import Foundation
import PDFKit
let a = Array(CommandLine.arguments.dropFirst())
guard let doc = PDFDocument(url: URL(fileURLWithPath: a[0])) else { exit(1) }
for i in 0..<min(doc.pageCount, 4) {
    guard let p = doc.page(at: i) else { continue }
    func s(_ b: PDFDisplayBox) -> String { let r = p.bounds(for: b); return "(\(Int(r.origin.x)),\(Int(r.origin.y)) \(Int(r.width))x\(Int(r.height)))" }
    print("p\(i+1) rot=\(p.rotation) media=\(s(.mediaBox)) crop=\(s(.cropBox)) bleed=\(s(.bleedBox)) trim=\(s(.trimBox)) art=\(s(.artBox))")
}
