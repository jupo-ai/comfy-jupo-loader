from comfy_api.latest import io
from ...utils import mk_name
from .common import PACKAGE_NAME, CATEGORY

import folder_paths
import node_helpers
from pathlib import Path
import torch
import numpy as np
from PIL import Image, ImageOps, ImageSequence
import hashlib


# ===============================================
# Image Loader
# ===============================================
class ImageLoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "ImageLoader"), 
            display_name="Image Loader", 
            category=CATEGORY, 
            inputs=[
                io.Combo.Input(
                    "image", 
                    options=get_image_filenames(), 
                    upload=io.UploadType.image, 
                    image_folder=io.FolderType.input, 
                ), 
            ], 
            outputs=[
                io.Image.Output(), 
                io.Mask.Output(), 
            ], 
        )
    
    @classmethod
    def execute(cls, image):
        image_path = folder_paths.get_annotated_filepath(image)
        img = node_helpers.pillow(Image.open, image_path)

        output_images = []
        output_masks = []
        w, h = None, None
        
        execluded_formats = ["MPO"]

        for i in ImageSequence.Iterator(img):
            i = node_helpers.pillow(ImageOps.exif_transpose, i)

            if i.mode == "I":
                i = i.point(lambda i: i * (1 / 255))
            image = i.convert("RGB")

            if len(output_images) == 0:
                w = image.size[0]
                h = image.size[1]
            
            if image.size[0] != w or image.size[1] != h:
                continue
            
            image = np.array(image).astype(np.float32) / 255.0
            image = torch.from_numpy(image)[None, ]
            if "A" in i.getbands():
                mask = np.array(i.getchannel("A")).astype(np.float32) / 255.0
                mask = 1. - torch.from_numpy(mask)
            elif i.mode == "P" and "transparency" in i.info:
                mask = np.array(i.convert("RGBA").getchannel("A")).astype(np.float32) / 255.0
                mask = 1. - torch.from_numpy(mask)
            else:
                mask = torch.zeros((64, 64), dtype=torch.float32, device="cpu")
            output_images.append(image)
            output_masks.append(mask)
        
        if len(output_images) > 1 and img.format not in execluded_formats:
            output_image = torch.cat(output_images, dim=0)
            output_mask = torch.cat(output_masks, dim=0)
        else:
            output_image = output_images[0]
            output_mask = output_masks[0]
        
        return io.NodeOutput(output_image, output_mask)
    
    
    @classmethod
    def validate_inputs(cls, image):
        if not folder_paths.exists_annotated_filepath(image):
            return f"Invalid image file: {image}"
        return True
    
    @classmethod
    def fingerprint_inputs(cls, image): 
        image_path = folder_paths.get_annotated_filepath(image)
        m = hashlib.sha256()
        with open(image_path, "rb") as f:
            m.update(f.read())
        
        return m.digest().hex()


# -----------------------------------------------
# ユーティリティ
# -----------------------------------------------
def get_image_filenames():
    """
    inputディレクトリの画像ファイル名一覧を取得
    """
    input_dir = folder_paths.get_input_directory()
    files = [str(p) for p in sorted(Path(input_dir).glob("**/*"))]
    image_files = folder_paths.filter_files_content_types(files, ["image"])
    image_filenames = [Path(file).relative_to(input_dir) for file in image_files]

    # clipspaceフォルダ -> xxx-masked-xxxのみ、かつ [input] を付与
    processed_filenames = []
    for p in image_filenames:
        if p.parts and p.parts[0] == "clipspace":
            if "-masked-" in p.name:
                processed_filenames.append(f"{p.as_posix()} [input]")
        else:
            processed_filenames.append(p.as_posix())
    
    return processed_filenames


