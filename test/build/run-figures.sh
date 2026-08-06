#!/bin/bash
# Crop the pictures out of the pages, then grade every crop.
#
# Two detectors, because the sources differ: chapters carry photographs, which the
# generic finder handles, while the sign sheet and the appendix's sign tables need
# per-sign detection — merging fragments there fuses a whole row of signs into one
# sliced strip.
set -eu
cd "$(dirname "$0")/.."
./build/tools/figures build/work
./build/tools/signs build/work "umferdarmerki_enska" "Appendix"
./build/tools/checkcrops build/work
