from comfy_api.latest import io
from ...utils import mk_name
from .._common import PACKAGE_NAME, CATEGORY
from .utils import get_available_stack

import comfy.sd
import folder_paths
import nodes as comfy_nodes
import torch


WEIGHT_DTYPES = ["default", "fp8_e4m3fn", "fp8_e4m3fn_fast", "fp8_e5m2"]

CLIP_TYPES = [
    "stable_diffusion", "stable_cascade", "sd3", "stable_audio", "mochi",
    "ltxv", "pixart", "cosmos", "lumina2", "wan", "hidream", "chroma",
    "ace", "omnigen2", "qwen_image", "hunyuan_image", "flux2", "ovis",
    "longcat_image",
]

DUAL_CLIP_TYPES = [
    "sdxl", "sd3", "flux", "hunyuan_video", "hidream", "hunyuan_image",
    "hunyuan_video_15", "kandinsky5", "kandinsky5_image", "ltxv", "newbie",
    "ace",
]


def _values_input():
    return io.String.Input("values", socketless=True, extra_dict={"hidden": True})


def _selected_paths(values: str, dirname: str, count: int) -> list[str]:
    stack = get_available_stack(values, dirname)
    paths = [value.get("path") for value in stack if value.get("path")]

    if len(paths) < count:
        raise ValueError(f"有効な{dirname}が{count}件必要です")

    return paths[:count]


def _diffusion_model_options(weight_dtype: str) -> dict:
    model_options = {}
    if weight_dtype == "fp8_e4m3fn":
        model_options["dtype"] = torch.float8_e4m3fn
    elif weight_dtype == "fp8_e4m3fn_fast":
        model_options["dtype"] = torch.float8_e4m3fn
        model_options["fp8_optimizations"] = True
    elif weight_dtype == "fp8_e5m2":
        model_options["dtype"] = torch.float8_e5m2
    return model_options


def _load_diffusion_model(model_name: str, weight_dtype: str = "default"):
    model_path = folder_paths.get_full_path_or_raise("diffusion_models", model_name)
    model_options = _diffusion_model_options(weight_dtype)
    return comfy.sd.load_diffusion_model(model_path, model_options=model_options)


def _clip_model_options(device: str) -> dict:
    model_options = {}
    if device == "cpu":
        model_options["load_device"] = model_options["offload_device"] = torch.device("cpu")
    return model_options


def _load_clip(clip_names: list[str], clip_type_name: str = "stable_diffusion", device: str = "default"):
    clip_type = getattr(comfy.sd.CLIPType, clip_type_name.upper(), comfy.sd.CLIPType.STABLE_DIFFUSION)
    clip_paths = [
        folder_paths.get_full_path_or_raise("text_encoders", clip_name)
        for clip_name in clip_names
    ]
    return comfy.sd.load_clip(
        ckpt_paths=clip_paths,
        embedding_directory=folder_paths.get_folder_paths("embeddings"),
        clip_type=clip_type,
        model_options=_clip_model_options(device),
    )


def _load_vae(vae_name: str):
    return comfy_nodes.VAELoader().load_vae(vae_name)[0]


# ===============================================
# Diffusion Model
# ===============================================
class DiffusionModelSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "DiffusionModelSelector"),
            display_name="Diffusion Model Selector",
            category=CATEGORY,
            inputs=[
                _values_input(),
                io.Combo.Input("weight_dtype", options=WEIGHT_DTYPES, default="default", advanced=True),
            ],
            outputs=[
                io.Model.Output(),
            ],
        )

    @classmethod
    def execute(cls, values: str, weight_dtype: str = "default"):
        model_name = _selected_paths(values, "diffusion_models", 1)[0]
        return io.NodeOutput(_load_diffusion_model(model_name, weight_dtype))


class DiffusionModelLoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "DiffusionModelLoader"),
            display_name="Diffusion Model Loader",
            category=CATEGORY,
            inputs=[
                io.Combo.Input("model_name", options=folder_paths.get_filename_list("diffusion_models")),
                io.Combo.Input("weight_dtype", options=WEIGHT_DTYPES, default="default", advanced=True),
            ],
            outputs=[
                io.Model.Output(),
            ],
        )

    @classmethod
    def execute(cls, model_name: str, weight_dtype: str = "default"):
        return io.NodeOutput(_load_diffusion_model(model_name, weight_dtype))


# ===============================================
# VAE
# ===============================================
class VAESelector(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "VAESelector"),
            display_name="VAE Selector",
            category=CATEGORY,
            inputs=[
                _values_input(),
            ],
            outputs=[
                io.Vae.Output(),
            ],
        )

    @classmethod
    def execute(cls, values: str):
        vae_name = _selected_paths(values, "vae", 1)[0]
        return io.NodeOutput(_load_vae(vae_name))


class VAELoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "VAELoader"),
            display_name="VAE Loader",
            category=CATEGORY,
            inputs=[
                io.Combo.Input("vae_name", options=comfy_nodes.VAELoader.vae_list(comfy_nodes.VAELoader)),
            ],
            outputs=[
                io.Vae.Output(),
            ],
        )

    @classmethod
    def execute(cls, vae_name: str):
        return io.NodeOutput(_load_vae(vae_name))


# ===============================================
# CLIP
# ===============================================
class CLIPSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "CLIPSelector"),
            display_name="CLIP Selector",
            category=CATEGORY,
            inputs=[
                _values_input(),
                io.Combo.Input("type", options=CLIP_TYPES, default="stable_diffusion"),
                io.Combo.Input("device", options=["default", "cpu"], default="default", advanced=True, optional=True),
            ],
            outputs=[
                io.Clip.Output(),
            ],
        )

    @classmethod
    def execute(cls, values: str, type: str = "stable_diffusion", device: str = "default"):
        clip_names = _selected_paths(values, "text_encoders", 1)
        return io.NodeOutput(_load_clip(clip_names, type, device))


class CLIPLoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "CLIPLoader"),
            display_name="CLIP Loader",
            category=CATEGORY,
            inputs=[
                io.Combo.Input("clip_name", options=folder_paths.get_filename_list("text_encoders")),
                io.Combo.Input("type", options=CLIP_TYPES, default="stable_diffusion"),
                io.Combo.Input("device", options=["default", "cpu"], default="default", advanced=True, optional=True),
            ],
            outputs=[
                io.Clip.Output(),
            ],
        )

    @classmethod
    def execute(cls, clip_name: str, type: str = "stable_diffusion", device: str = "default"):
        return io.NodeOutput(_load_clip([clip_name], type, device))


class DualCLIPSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "DualCLIPSelector"),
            display_name="Dual CLIP Selector",
            category=CATEGORY,
            inputs=[
                _values_input(),
                io.Combo.Input("type", options=DUAL_CLIP_TYPES, default="sdxl"),
                io.Combo.Input("device", options=["default", "cpu"], default="default", advanced=True, optional=True),
            ],
            outputs=[
                io.Clip.Output(),
            ],
        )

    @classmethod
    def execute(cls, values: str, type: str = "sdxl", device: str = "default"):
        clip_names = _selected_paths(values, "text_encoders", 2)
        return io.NodeOutput(_load_clip(clip_names, type, device))


class DualCLIPLoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "DualCLIPLoader"),
            display_name="Dual CLIP Loader",
            category=CATEGORY,
            inputs=[
                io.Combo.Input("clip_name1", options=folder_paths.get_filename_list("text_encoders")),
                io.Combo.Input("clip_name2", options=folder_paths.get_filename_list("text_encoders")),
                io.Combo.Input("type", options=DUAL_CLIP_TYPES, default="sdxl"),
                io.Combo.Input("device", options=["default", "cpu"], default="default", advanced=True, optional=True),
            ],
            outputs=[
                io.Clip.Output(),
            ],
        )

    @classmethod
    def execute(cls, clip_name1: str, clip_name2: str, type: str = "sdxl", device: str = "default"):
        return io.NodeOutput(_load_clip([clip_name1, clip_name2], type, device))


class TripleCLIPSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "TripleCLIPSelector"),
            display_name="Triple CLIP Selector",
            category=CATEGORY,
            inputs=[
                _values_input(),
            ],
            outputs=[
                io.Clip.Output(),
            ],
        )

    @classmethod
    def execute(cls, values: str):
        clip_names = _selected_paths(values, "text_encoders", 3)
        return io.NodeOutput(_load_clip(clip_names))


class TripleCLIPLoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "TripleCLIPLoader"),
            display_name="Triple CLIP Loader",
            category=CATEGORY,
            description="[Recipes]\n\nsd3: clip-l, clip-g, t5",
            inputs=[
                io.Combo.Input("clip_name1", options=folder_paths.get_filename_list("text_encoders")),
                io.Combo.Input("clip_name2", options=folder_paths.get_filename_list("text_encoders")),
                io.Combo.Input("clip_name3", options=folder_paths.get_filename_list("text_encoders")),
            ],
            outputs=[
                io.Clip.Output(),
            ],
        )

    @classmethod
    def execute(cls, clip_name1: str, clip_name2: str, clip_name3: str):
        return io.NodeOutput(_load_clip([clip_name1, clip_name2, clip_name3]))


class QuadrupleCLIPSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "QuadrupleCLIPSelector"),
            display_name="Quadruple CLIP Selector",
            category=CATEGORY,
            inputs=[
                _values_input(),
            ],
            outputs=[
                io.Clip.Output(),
            ],
        )

    @classmethod
    def execute(cls, values: str):
        clip_names = _selected_paths(values, "text_encoders", 4)
        return io.NodeOutput(_load_clip(clip_names))


class QuadrupleCLIPLoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "QuadrupleCLIPLoader"),
            display_name="Quadruple CLIP Loader",
            category=CATEGORY,
            description="[Recipes]\n\nhidream: long clip-l, long clip-g, t5xxl, llama_8b_3.1_instruct",
            inputs=[
                io.Combo.Input("clip_name1", options=folder_paths.get_filename_list("text_encoders")),
                io.Combo.Input("clip_name2", options=folder_paths.get_filename_list("text_encoders")),
                io.Combo.Input("clip_name3", options=folder_paths.get_filename_list("text_encoders")),
                io.Combo.Input("clip_name4", options=folder_paths.get_filename_list("text_encoders")),
            ],
            outputs=[
                io.Clip.Output(),
            ],
        )

    @classmethod
    def execute(cls, clip_name1: str, clip_name2: str, clip_name3: str, clip_name4: str):
        return io.NodeOutput(_load_clip([clip_name1, clip_name2, clip_name3, clip_name4]))
