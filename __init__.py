import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
import math
import comfy.utils
import comfy.model_management
import node_helpers

WEB_DIRECTORY = "./js"

class ImageScaleToTotalPixelsX:
    upscale_methods = ["nearest-exact", "bilinear", "area", "bicubic", "lanczos"]
    resize_modes = ["stretch", "crop", "pad"]

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { 
                "image": ("IMAGE",),
                "megapixels": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 16.0, "step": 0.01}),
                "multiple_of": ("INT", {"default": 16, "min": 1, "max": 128, "step": 1}),
                "resize_mode": (s.resize_modes, {"default": "crop"}),
                "upscale_method": (s.upscale_methods, {"default": "lanczos"}),
            },
            "hidden": {
                # Kept for compatibility; not used anymore
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("IMAGE", "INT", "INT")
    RETURN_NAMES = ("image", "width", "height")
    FUNCTION = "upscale"
    CATEGORY = "image/upscaling"

    def upscale(self, image, upscale_method, megapixels, multiple_of, resize_mode, unique_id=None):
        _, oh, ow, _ = image.shape

        if megapixels == 0:
            target_width = ow
            target_height = oh
        else:
            total = int(megapixels * 1024 * 1024)
            scale_by = math.sqrt(total / (ow * oh))
            target_width = round(ow * scale_by)
            target_height = round(oh * scale_by)

        if multiple_of > 1:
            target_width = target_width - (target_width % multiple_of)
            target_height = target_height - (target_height % multiple_of)

        target_width = max(multiple_of, target_width)
        target_height = max(multiple_of, target_height)

        width = target_width
        height = target_height
        x = y = x2 = y2 = 0
        pad_left = pad_right = pad_top = pad_bottom = 0

        if resize_mode == 'pad':
            ratio = min(target_width / ow, target_height / oh)
            new_width = round(ow * ratio)
            new_height = round(oh * ratio)
            pad_left = (target_width - new_width) // 2
            pad_right = target_width - new_width - pad_left
            pad_top = (target_height - new_height) // 2
            pad_bottom = target_height - new_height - pad_top
            width = new_width
            height = new_height

        elif resize_mode == 'crop':
            ratio = max(target_width / ow, target_height / oh)
            new_width = round(ow * ratio)
            new_height = round(oh * ratio)
            x = (new_width - target_width) // 2
            y = (new_height - target_height) // 2
            x2 = x + target_width
            y2 = y + target_height
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

        samples = image.permute(0, 3, 1, 2)

        if upscale_method == "lanczos":
            outputs = comfy.utils.lanczos(samples, width, height)
        else:
            outputs = F.interpolate(samples, size=(height, width), mode=upscale_method)

        if resize_mode == 'pad':
            if pad_left > 0 or pad_right > 0 or pad_top > 0 or pad_bottom > 0:
                outputs = F.pad(outputs, (pad_left, pad_right, pad_top, pad_bottom), value=0)

        outputs = outputs.permute(0, 2, 3, 1)

        if resize_mode == 'crop':
            if x > 0 or y > 0 or x2 > 0 or y2 > 0:
                outputs = outputs[:, y:y2, x:x2, :]

        if multiple_of > 1 and (outputs.shape[2] % multiple_of != 0 or outputs.shape[1] % multiple_of != 0):
            final_width = outputs.shape[2]
            final_height = outputs.shape[1]
            x = (final_width % multiple_of) // 2
            y = (final_height % multiple_of) // 2
            x2 = final_width - ((final_width % multiple_of) - x)
            y2 = final_height - ((final_height % multiple_of) - y)
            outputs = outputs[:, y:y2, x:x2, :]

        outputs = torch.clamp(outputs, 0, 1)

        final_width = outputs.shape[2]
        final_height = outputs.shape[1]

        # Prepare UI text (array form, like DisplayAny)
        ui_text = [f"{final_width}x{final_height}"]

        return {
            "ui": {"text": ui_text},
            "result": (outputs, final_width, final_height),
        }

NODE_CLASS_MAPPINGS = { 
    "ImageScaleToTotalPixelsX": ImageScaleToTotalPixelsX
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ImageScaleToTotalPixelsX": "Scale Image to Total Pixels Adv"
}
