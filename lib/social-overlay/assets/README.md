# Interview overlay assets

Everything the overlay reads at runtime. Vercel cannot see the sibling
`cogent-base-theme` repo, so copies live here.

| File | Source | Licence |
|---|---|---|
| `face_detection_yunet_2023mar.onnx` | YuNet, [opencv/opencv_zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | MIT |
| `fonts/PermanentMarker-Regular.ttf` | [google/fonts](https://github.com/google/fonts/tree/main/apache/permanentmarker) | Apache 2.0 |
| `fonts/BebasNeue-Regular.ttf` | `cogent-base-theme/scripts/brand/fonts/` | SIL OFL 1.1 (`fonts/bebasneue-OFL.txt`) |
| `logos/<slug>/wordmark.svg`, `wordmark-reversed.svg` | `cogent-base-theme/scripts/brand/dist/<slug>/` | Ours |

The logos are copied byte for byte and must never be edited here. When a
title's logo changes, or a title is added, copy its two files from the brand
kit's `dist/` again and add its brand colour to `BRAND` in `../index.js`.
