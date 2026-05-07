from comfy_api.latest import io
from ...utils import mk_name
from ..common import PACKAGE_NAME, CATEGORY
from .utils import get_available_stack

import comfy.sd
import folder_paths


# ===============================================
# Checkpoint Selector
# ===============================================
class CheckpointSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "CheckpointSelector"), 
            display_name="Checkpoint Selector", 
            category=CATEGORY, 
            inputs=[
                io.String.Input("values", socketless=True, extra_dict={"hidden": True}), 
            ], 
            outputs=[
                io.Model.Output(), 
                io.Clip.Output(), 
                io.Vae.Output(), 
            ]
        )
    
    @classmethod
    def execute(cls, values: str):
        stack = get_available_stack(values, "checkpoints")
        
        if not stack:
            raise ValueError(f"有効なCheckpointが見つかりません")
        
        value = stack[0]

        filename = value.get("path")
        ckpt_path = folder_paths.get_full_path_or_raise("checkpoints", filename)

        out = comfy.sd.load_checkpoint_guess_config(ckpt_path, embedding_directory=folder_paths.get_folder_paths("embeddings"))
        model, clip, vae = out[:3]

        return io.NodeOutput(model, clip, vae)



# ===============================================
# Checkpoint Loader
# ===============================================
class CheckpointLoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "CheckpointLoader"), 
            display_name="Checkpoint Loader", 
            category=CATEGORY, 
            inputs=[
                io.Combo.Input("ckpt_name", options=folder_paths.get_filename_list("checkpoints")), 
            ], 
            outputs=[
                io.Model.Output(), 
                io.Clip.Output(), 
                io.Vae.Output(), 
            ], 
        )
    
    @classmethod
    def execute(cls, ckpt_name: str):
        ckpt_path = folder_paths.get_full_path_or_raise("checkpoints", ckpt_name)
        out = comfy.sd.load_checkpoint_guess_config(ckpt_path, embedding_directory=folder_paths.get_folder_paths("embeddings"))
        model, clip, vae = out[:3]

        return io.NodeOutput(model, clip, vae)

