from comfy_api.latest import io
from ...utils import mk_name
from ..common import PACKAGE_NAME, CATEGORY

import folder_paths
from pathlib import Path
import hashlib
from nodes import LoadImage


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
        output_images, output_masks = LoadImage().load_image(image)
        return io.NodeOutput(output_images, output_masks)
    
    
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


