import struct, zlib, os

def make_png(path, size, bg, fg):
    w = h = size
    pixels = bytearray()

    cx, cy = w / 2, h / 2
    bar_w = w * 0.12
    bars = [
        (0.30, 0.55),
        (0.44, 0.70),
        (0.58, 0.40),
        (0.72, 0.60),
    ]
    base_y = h * 0.72

    for y in range(h):
        row = bytearray([0])  # filter type 0
        for x in range(w):
            color = bg
            for i, (bx, bh) in enumerate(bars):
                left = w * bx
                right = left + bar_w
                top = base_y - h * bh
                if left <= x < right and top <= y <= base_y:
                    color = fg
            row += bytes(color)
        pixels += row

    raw = bytes(pixels)
    compressed = zlib.compress(raw, 9)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")

    with open(path, "wb") as f:
        f.write(png)

bg = (15, 23, 42)     # matches --bg
fg = (79, 140, 255)   # matches --accent

os.makedirs("icons", exist_ok=True)
make_png("icons/icon-192.png", 192, bg, fg)
make_png("icons/icon-512.png", 512, bg, fg)
print("done")
