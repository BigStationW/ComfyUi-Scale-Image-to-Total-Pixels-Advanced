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
    crop_methods = ["disabled", "center"] 
 
    @classmethod 
    def INPUT_TYPES(s): 
        return {"required": { "image": ("IMAGE",), 
                              "upscale_method": (s.upscale_methods, {"default": "lanczos"}), 
                              "megapixels": ("FLOAT", {"default": 1.0, "min": 0.01, "max": 16.0, "step": 0.01}),
                              "multiple_of": ("INT", {"default": 16, "min": 1, "max": 128, "step": 1}),
                            }} 
    RETURN_TYPES = ("IMAGE", "INT", "INT") 
    RETURN_NAMES = ("image", "width", "height")
    FUNCTION = "upscale" 
 
    CATEGORY = "image/upscaling" 
 
    def upscale(self, image, upscale_method, megapixels, multiple_of): 
        samples = image.movedim(-1,1) 
        total = int(megapixels * 1024 * 1024) 
 
        scale_by = math.sqrt(total / (samples.shape[3] * samples.shape[2])) 
        width = round(samples.shape[3] * scale_by) 
        height = round(samples.shape[2] * scale_by) 
        
        # Round to nearest multiple of the specified value
        width = round(width / multiple_of) * multiple_of
        height = round(height / multiple_of) * multiple_of
        
        # Ensure minimum size is at least the multiple_of value
        width = max(multiple_of, width)
        height = max(multiple_of, height)
 
        s = comfy.utils.common_upscale(samples, width, height, upscale_method, "disabled") 
        s = s.movedim(1,-1) 
        return (s, width, height) 
 
NODE_CLASS_MAPPINGS = { "ImageScaleToTotalPixelsX": ImageScaleToTotalPixelsX } 
NODE_DISPLAY_NAME_MAPPINGS = { "ImageScaleToTotalPixelsX": "Scale Image to Total Pixels Adv" }