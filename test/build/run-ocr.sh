#!/bin/bash
# Full OCR sweep over the top-level PDFs. Chapters and the appendix are
# photographed two-page spreads; the traffic-sign booklet is one clean page per
# PDF page.
set -u
cd "$(dirname "$0")/.."
OUT=build/work
mkdir -p "$OUT"
for f in "Ch. 1–2" "Ch. 3" "Ch. 4" "Ch. 5" "Ch. 6" "Ch. 7" "Ch. 8" "Appendix"; do
  echo "### $f"
  ./build/tools/bookocr "$f.pdf" --out "$OUT" --mode spread
done
echo "### umferdarmerki_enska"
./build/tools/bookocr "umferdarmerki_enska.pdf" --out "$OUT" --mode single --no-split --no-autorotate --dpi 300
echo "ALL DONE"
