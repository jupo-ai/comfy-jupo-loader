from comfy_api.latest import InputImpl, io
from ...utils import mk_name
from ...utils import Endpoint
from .._common import PACKAGE_NAME, CATEGORY

from aiohttp import web
from pathlib import Path
import hashlib
import os

import comfy.model_management
import node_helpers
import numpy as np
import torch
from PIL import Image, ImageOps, ImageSequence


# ===============================================
# Directory Image Loader
# ===============================================
class DirectoryImageLoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "DirectoryImageLoader"),
            display_name="Directory Image Loader",
            category=CATEGORY,
            description="Load one image at a time from a directory filtered by extension.",
            accept_all_inputs=True,
            inputs=[
                io.String.Input(
                    "directory",
                    default="",
                    placeholder="C:/path/to/images",
                ),
                io.String.Input(
                    "extensions",
                    default="png,jpg,jpeg,webp,bmp,gif,tiff",
                    placeholder="png,jpg,webp",
                ),
                io.Boolean.Input("include_subdirectories", default=False),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
                io.Mask.Output(display_name="mask"),
            ],
        )

    @classmethod
    def execute(
        cls,
        directory,
        extensions,
        include_subdirectories,
        index=0,
        **kwargs,
    ):
        del kwargs

        files = get_image_paths(directory, extensions, include_subdirectories)
        selected_index = index
        image_path = files[selected_index]
        output_image, output_mask = load_image_path(image_path)
        return io.NodeOutput(
            output_image,
            output_mask,
        )

    @classmethod
    def validate_inputs(
        cls,
        directory,
        extensions,
        include_subdirectories,
        index=0,
        **kwargs,
    ):
        del kwargs

        dir_path = normalize_directory(directory)
        if not dir_path.is_dir():
            return f"Invalid directory: {directory}"

        if not parse_extensions(extensions):
            return "Image extensions must not be empty."

        files = get_image_paths(directory, extensions, include_subdirectories)
        if not files:
            return f"No matching images in directory: {dir_path}"

        if index < 0:
            return f"Index {index} is out of range. Matching image count: {len(files)}"

        if index >= len(files):
            return f"Index {index} is out of range. Matching image count: {len(files)}"

        return True

    @classmethod
    def fingerprint_inputs(
        cls,
        directory,
        extensions,
        include_subdirectories,
        index=0,
        **kwargs,
    ):
        del kwargs

        files = get_image_paths(directory, extensions, include_subdirectories)
        if not files:
            return float("NaN")

        selected_index = index
        if selected_index < 0 or selected_index >= len(files):
            return float("NaN")

        image_path = files[selected_index]
        m = hashlib.sha256()
        m.update(str(image_path).encode("utf-8"))
        with open(image_path, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                m.update(chunk)
        return m.hexdigest()


# -----------------------------------------------
# ユーティリティ
# -----------------------------------------------
def normalize_directory(directory):
    expanded = os.path.expandvars(os.path.expanduser(directory.strip()))
    path = Path(expanded)
    if not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve()


def parse_extensions(extensions):
    values = extensions.replace(";", ",").replace(" ", ",").split(",")
    parsed = []
    for value in values:
        ext = value.strip().lower()
        if not ext:
            continue
        if ext == "*":
            return ["*"]
        if not ext.startswith("."):
            ext = f".{ext}"
        parsed.append(ext)
    return sorted(set(parsed))


def get_image_paths(directory, extensions, include_subdirectories=False):
    dir_path = normalize_directory(directory)
    parsed_extensions = parse_extensions(extensions)
    if not dir_path.is_dir() or not parsed_extensions:
        return []

    paths = dir_path.rglob("*") if include_subdirectories else dir_path.glob("*")
    files = [p for p in paths if p.is_file() and _matches_extension(p, parsed_extensions)]
    return sorted(files, key=lambda p: (p.name.lower(), p.as_posix().lower()))


def _matches_extension(path, extensions):
    return "*" in extensions or path.suffix.lower() in extensions


def load_image_path(image_path):
    dtype = comfy.model_management.intermediate_dtype()
    device = comfy.model_management.intermediate_device()

    components = InputImpl.VideoFromFile(str(image_path)).get_components()
    if components.images.shape[0] > 0:
        image = components.images.to(device=device, dtype=dtype)
        if components.alpha is not None:
            mask = (1.0 - components.alpha[..., -1]).to(device=device, dtype=dtype)
        else:
            mask = torch.zeros(
                (components.images.shape[0], 64, 64),
                dtype=dtype,
                device=device,
            )
        return image, mask

    img = node_helpers.pillow(Image.open, image_path)
    output_images = []
    output_masks = []
    width = None
    height = None

    for frame in ImageSequence.Iterator(img):
        frame = node_helpers.pillow(ImageOps.exif_transpose, frame)
        image = frame.convert("RGB")

        if not output_images:
            width, height = image.size
        if image.size != (width, height):
            continue

        image_np = np.array(image).astype(np.float32) / 255.0
        output_images.append(torch.from_numpy(image_np)[None,].to(dtype=dtype))

        if "A" in frame.getbands():
            mask_np = np.array(frame.getchannel("A")).astype(np.float32) / 255.0
            mask = 1.0 - torch.from_numpy(mask_np)
        else:
            mask = torch.zeros((64, 64), dtype=torch.float32, device="cpu")
        output_masks.append(mask.unsqueeze(0).to(dtype=dtype))

    output_image = torch.cat(output_images, dim=0)
    output_mask = torch.cat(output_masks, dim=0)
    return (
        output_image.to(device=device, dtype=dtype),
        output_mask.to(device=device, dtype=dtype),
    )


@Endpoint.post(PACKAGE_NAME, "directory_image_loader_files")
async def directory_image_loader_files(req: web.Request):
    data = await req.json()
    files = get_image_paths(
        data.get("directory", ""),
        data.get("extensions", ""),
        bool(data.get("include_subdirectories", False)),
    )
    return web.json_response(
        {
            "count": len(files),
        }
    )


@Endpoint.post(PACKAGE_NAME, "directory_image_loader_select_directory")
async def directory_image_loader_select_directory(req: web.Request):
    data = await req.json()
    initial_dir = data.get("directory", "")
    selected_dir = select_directory(initial_dir)
    return web.json_response({"directory": selected_dir})


def select_directory(initial_dir=""):
    import tkinter as tk
    from tkinter import filedialog

    initial_path = normalize_directory(initial_dir) if initial_dir else Path.cwd()
    if not initial_path.is_dir():
        initial_path = Path.cwd()

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        selected = filedialog.askdirectory(
            parent=root,
            initialdir=str(initial_path),
            title="Select image directory",
            mustexist=True,
        )
    finally:
        root.destroy()

    return selected
