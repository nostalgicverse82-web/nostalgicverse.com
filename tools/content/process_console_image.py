import sys
from PIL import Image, ImageDraw, ImageFilter
from collections import deque

def remove_background(img, tolerance=32):
    w, h = img.size
    pixels = img.load()
    
    # Sample border background colors
    bg_samples = []
    for x in range(0, w, 20):
        bg_samples.append(pixels[x, 0][:3])
        bg_samples.append(pixels[x, h - 1][:3])
    for y in range(0, h, 20):
        bg_samples.append(pixels[0, y][:3])
        bg_samples.append(pixels[w - 1, y][:3])
        
    avg_r = sum(s[0] for s in bg_samples) / len(bg_samples)
    avg_g = sum(s[1] for s in bg_samples) / len(bg_samples)
    avg_b = sum(s[2] for s in bg_samples) / len(bg_samples)
    
    def is_bg(x, y):
        r, g, b, _ = pixels[x, y]
        dist = ((r - avg_r)**2 + (g - avg_g)**2 + (b - avg_b)**2)**0.5
        return dist <= tolerance

    # Flood fill mask from borders
    mask = Image.new('L', (w, h), 255)
    mask_pixels = mask.load()
    
    visited = bytearray(w * h)
    queue = deque()
    
    # Enqueue borders
    for x in range(w):
        if is_bg(x, 0):
            queue.append((x, 0))
            visited[0 * w + x] = 1
        if is_bg(x, h - 1):
            queue.append((x, h - 1))
            visited[(h - 1) * w + x] = 1
    for y in range(h):
        if is_bg(0, y) and not visited[y * w + 0]:
            queue.append((0, y))
            visited[y * w + 0] = 1
        if is_bg(w - 1, y) and not visited[y * w + (w - 1)]:
            queue.append((w - 1, y))
            visited[y * w + (w - 1)] = 1
            
    while queue:
        cx, cy = queue.popleft()
        mask_pixels[cx, cy] = 0
        
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not visited[idx]:
                    visited[idx] = 1
                    if is_bg(nx, ny):
                        queue.append((nx, ny))

    # Clean anti-aliased edge
    mask = mask.filter(ImageFilter.GaussianBlur(1.0))
    img.putalpha(mask)
    return img

def fit_to_canvas(img, target_w=1600, target_h=900, occupancy=0.82):
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    cw, ch = img.size
    avail_w = target_w * occupancy
    avail_h = target_h * occupancy
    
    scale = min(avail_w / cw, avail_h / ch)
    new_w = int(cw * scale)
    new_h = int(ch * scale)
    
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    offset_x = (target_w - new_w) // 2
    offset_y = (target_h - new_h) // 2
    canvas.paste(resized, (offset_x, offset_y), resized)
    return canvas

def process(src_path, dest_path):
    orig = Image.open(src_path).convert('RGBA')
    transparent = remove_background(orig)
    final = fit_to_canvas(transparent)
    final.save(dest_path, 'WEBP', quality=95, method=6)
    print(f"Saved: {dest_path} ({final.size})")

if __name__ == '__main__':
    src = sys.argv[1]
    dest = sys.argv[2]
    process(src, dest)

