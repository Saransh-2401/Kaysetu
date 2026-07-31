import os
from PIL import Image
folder = 'D:/kaysetu-website/public/modules'
for f in os.listdir(folder):
    if f.endswith('.png'):
        img = Image.open(os.path.join(folder, f)).convert('RGBA')
        datas = img.getdata()
        trans = sum(1 for p in datas if p[3] == 0)
        print(f"{f}: {trans} transparent pixels")
