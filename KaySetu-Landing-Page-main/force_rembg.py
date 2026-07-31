import os
from rembg import remove, new_session
from PIL import Image
import io

def process():
    folder = "D:/kaysetu-website/public/modules"
    session = new_session("u2net")
    for filename in os.listdir(folder):
        if filename.lower().endswith(".png"):
            filepath = os.path.join(folder, filename)
            try:
                print(f"Processing {filepath}")
                input_image = Image.open(filepath)
                # Ensure it's not already transparent
                if input_image.mode == 'RGBA':
                    top_left = input_image.getpixel((0, 0))
                    if top_left[3] == 0:
                        print(f"Skipping {filepath} (Already transparent)")
                        continue
                
                # Remove background aggressively
                output_image = remove(
                    input_image,
                    session=session,
                    post_process_mask=True,
                    alpha_matting=True,
                    alpha_matting_foreground_threshold=240,
                    alpha_matting_background_threshold=10,
                    alpha_matting_erode_size=10
                )
                
                # Further remove soft shadows (any pixel with alpha < 200 becomes 0, else 255)
                # Be careful not to destroy anti-aliased edges completely.
                # Actually, rembg is usually good enough. Let's just save it.
                output_image.save(filepath)
                print(f"Saved {filepath}")
            except Exception as e:
                print(f"Error processing {filepath}: {e}")

process()
