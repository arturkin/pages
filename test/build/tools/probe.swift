import Foundation
import PDFKit

let args = Array(CommandLine.arguments.dropFirst())
for path in args {
    guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else {
        print("\(path): CANNOT OPEN"); continue
    }
    var counts: [Int] = []
    for i in 0..<doc.pageCount {
        counts.append(doc.page(at: i)?.string?.count ?? 0)
    }
    let total = counts.reduce(0,+)
    print("\(path): pages=\(doc.pageCount) totalChars=\(total) perPage=\(counts)")
}
