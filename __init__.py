import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
import math
import comfy.utils
import comfy.model_management
import node_helpers

class ImageScaleToTotalPixelsX:
    upscale_methods = ["nearest-exact", "bilinear", "area", "bicubic", "lanczos"]
    resize_modes = ["stretch", "crop", "pad"]

    @classmethod
    def INPUT_TYPES(s):
        return {"required": { 
            "image": ("IMAGE",),
            "megapixels": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 16.0, "step": 0.01}),
            "multiple_of": ("INT", {"default": 16, "min": 1, "max": 128, "step": 1}),
            "resize_mode": (s.resize_modes, {"default": "crop"}),
            "upscale_method": (s.upscale_methods, {"default": "lanczos"}),
        }}

    RETURN_TYPES = ("IMAGE", "INT", "INT")
    RETURN_NAMES = ("image", "width", "height") 
    FUNCTION = "upscale"
    CATEGORY = "image/upscaling"

    def upscale(self, image, upscale_method, megapixels, multiple_of, resize_mode):
        _, oh, ow, _ = image.shape
        
        if megapixels == 0:
            # Skip megapixel scaling, just use original dimensions with multiple_of rounding
            target_width = ow
            target_height = oh
        else:
            # Calculate target dimensions based on megapixels
            total = int(megapixels * 1024 * 1024)
            scale_by = math.sqrt(total / (ow * oh))
            target_width = round(ow * scale_by)
            target_height = round(oh * scale_by)

        # Apply multiple_of rounding to target dimensions
        if multiple_of > 1:
            target_width = target_width - (target_width % multiple_of)
            target_height = target_height - (target_height % multiple_of)
        
        # Ensure minimum size
        target_width = max(multiple_of, target_width)
        target_height = max(multiple_of, target_height)

        width = target_width
        height = target_height
        x = y = x2 = y2 = 0
        pad_left = pad_right = pad_top = pad_bottom = 0

        if resize_mode == 'pad':
            # Calculate scaling ratio to fit within target dimensions
            ratio = min(target_width / ow, target_height / oh)
            new_width = round(ow * ratio)
            new_height = round(oh * ratio)

            # Calculate padding to center the image
            pad_left = (target_width - new_width) // 2
            pad_right = target_width - new_width - pad_left
            pad_top = (target_height - new_height) // 2
            pad_bottom = target_height - new_height - pad_top

            width = new_width
            height = new_height
            
        elif resize_mode == 'crop':
            # Scale to fill target dimensions, then crop excess
            ratio = max(target_width / ow, target_height / oh)
            new_width = round(ow * ratio)
            new_height = round(oh * ratio)
            
            # Calculate crop coordinates
            x = (new_width - target_width) // 2
            y = (new_height - target_height) // 2
            x2 = x + target_width
            y2 = y + target_height
            
            # Adjust if coordinates go out of bounds
            if x2 > new_width:
                x -= (x2 - new_width)
            if x < 0:
                x = 0
            if y2 > new_height:
                y -= (y2 - new_height)
            if y < 0:
                y = 0
                
            width = new_width
            height = new_height

        # Convert to tensor format for processing
        samples = image.permute(0, 3, 1, 2)

        # Resize the image
        if upscale_method == "lanczos":
            outputs = comfy.utils.lanczos(samples, width, height)
        else:
            outputs = F.interpolate(samples, size=(height, width), mode=upscale_method)

        # Apply padding if needed
        if resize_mode == 'pad':
            if pad_left > 0 or pad_right > 0 or pad_top > 0 or pad_bottom > 0:
                outputs = F.pad(outputs, (pad_left, pad_right, pad_top, pad_bottom), value=0)

        # Convert back to image format
        outputs = outputs.permute(0, 2, 3, 1)

        # Apply cropping if needed
        if resize_mode == 'crop':
            if x > 0 or y > 0 or x2 > 0 or y2 > 0:
                outputs = outputs[:, y:y2, x:x2, :]

        # Final multiple_of adjustment if needed
        if multiple_of > 1 and (outputs.shape[2] % multiple_of != 0 or outputs.shape[1] % multiple_of != 0):
            final_width = outputs.shape[2]
            final_height = outputs.shape[1]
            x = (final_width % multiple_of) // 2
            y = (final_height % multiple_of) // 2
            x2 = final_width - ((final_width % multiple_of) - x)
            y2 = final_height - ((final_height % multiple_of) - y)
            outputs = outputs[:, y:y2, x:x2, :]
        
        outputs = torch.clamp(outputs, 0, 1)
        
        return (outputs, outputs.shape[2], outputs.shape[1])

NODE_CLASS_MAPPINGS = { 
    "ImageScaleToTotalPixelsX": ImageScaleToTotalPixelsX
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ImageScaleToTotalPixelsX": "Scale Image to Total Pixels Adv"
}
