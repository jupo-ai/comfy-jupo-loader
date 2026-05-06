from aiohttp import web
from ..utils import Endpoint
import folder_paths

import json
from pathlib import Path
from blake3 import blake3
import hashlib
from tqdm import tqdm
import os
import aiohttp

PACKAGE_NAME = "ModelInfo"

# ===============================================
# エンドポイント
# ===============================================

# -----------------------------------------------
# InfoData取得
# -----------------------------------------------
@Endpoint.post(PACKAGE_NAME, "get_info_data")
async def get_info_data(req: web.Request):
    data = await req.json()
    dirname = data.get("dir")
    filename = data.get("file")
    force = data.get("force")

    fullpath = folder_paths.get_full_path(dirname, filename)
    json_path = Path(fullpath).with_suffix(".json")

    info = {}

    if json_path.exists():
        try:
            with open(json_path, mode="r", encoding="utf-8") as f:
                info = json.load(f)
        except:
            print(f"読み込みに失敗: {json_path}")
    
    if not json_path.exists() or force:
        # metadata
        is_checkpoint = dirname == "checkpoints"
        metadata = _get_metadata(fullpath, is_checkpoint)
        info["metadata"] = metadata

        # civitai
        civitai = await _get_civitai(fullpath)
        if civitai:
            info["civitai"] = civitai
        else:
            archive = await _get_archive(fullpath)
            if archive:
                info["archive"] = archive
    
    return web.json_response(info)


def _get_metadata(path, is_checkpoint=False):
    with open(path, "rb") as f:
        header_size = int.from_bytes(f.read(8), "little", signed=False)

        if header_size < 0:
            raise BufferError("Invalid header size")
        
        header = f.read(header_size)
        header_json = json.loads(header)

        metadata = header_json.get("__metadata__", {})
    
    # is_checkpointかつmetadataにmodelspec.predict_keyが無い場合
    # モデルのキーの中にvpredがあれば、metadata[modelspec.predict_key] = v とする
    predict_key = "modelspec.predict_key"
    ztsnr_key = "ztsnr"
    if is_checkpoint:
        if predict_key not in metadata:
            if "vpred" in header_json:
                metadata[predict_key] = "v"
            else:
                metadata[predict_key] = "epsilon"
        
        if ztsnr_key in header_json:
            metadata[ztsnr_key] = "True"
        else:
            metadata[ztsnr_key] = "False"
    
    return metadata


def _get_hash(path, use_blake):
    chunk_size = 8 * 1024 * 1024
    
    if use_blake:
        hasher = blake3()
    else:
        hasher = hashlib.sha256()
    
    file_size = os.path.getsize(path)
    with open(path, "rb") as f:
        with tqdm(total=file_size, unit="B", unit_scale=True, unit_divisor=1024, desc="Hashing") as pbar:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                hasher.update(chunk)
                pbar.update(len(chunk))
    
    file_hash = hasher.hexdigest()
    return file_hash


async def _get_civitai(path):
    print("Civitaiからデータを取得します...")

    file_hash = _get_hash(path, use_blake=True)
    url = f"https://civitai.com/api/v1/model-versions/by-hash/{file_hash}"

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200:
                info = await response.json()
            else:
                info = None
    
    if not info:
        print("❌ Civitaiにモデルが見つかりませんでした")
    
    return info


async def _get_archive(path):
    print("CivArchiveからデータを取得しています...")

    file_hash = _get_hash(path, use_blake=False)
    url = f"https://civarchive.com/api/sha256/{file_hash}"

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200:
                info = await response.json()
            else:
                info = None
    
    if not info:
        print("❌ CivArchiveにモデルが見つかりませんでした")
    
    return info


# -----------------------------------------------
# InfoDataの保存
# -----------------------------------------------
@Endpoint.post(PACKAGE_NAME, "save_info_data")
async def save_info_data(req: web.Request):
    data = await req.json()
    dirname = data.get("dir")
    filename = data.get("file")
    info_data = data.get("data")

    fullpath = folder_paths.get_full_path(dirname, filename)
    json_path = Path(fullpath).with_suffix(".json")

    with open(json_path, mode="w", encoding="utf-8") as f:
        json.dump(info_data, f, ensure_ascii=False, indent=4)
    
    return web.json_response("ok")


