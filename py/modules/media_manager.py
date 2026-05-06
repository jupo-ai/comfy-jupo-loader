"""
Media Manager
    : ローカルフォルダ内のメディアを token 経由でUIに表示するためのライブラリ
"""
import aiohttp
from aiohttp import web
import time
import os
import mimetypes
import uuid
from urllib.parse import urlparse
import aiofiles
import base64
from tqdm import tqdm
import glob

from ..utils import Endpoint
import folder_paths

PACKAGE_NAME = "MediaManager"

MEDIA_CACHE = {}
MEDIA_PATH_CACHE = {}
TOKEN_EXPIRE_TIME = 3600
SUPPORTED_EXTENSIONS = {
    "image": ["jpg", "jpeg", "bmp", "png", "webp", "gif"], 
    "video": ["mp4", "webm", "avi"], 
    "audio": ["mp3", "ogg", "wav"]
}

# ===============================================
# ユーティリティ
# ===============================================
def cleanup_media_cache():
    """
    期限切れのトークンやメディアファイルが存在しないキャッシュを削除
    """
    remove_tokens = set()
    current_time = time.time()

    for token, data in MEDIA_CACHE.items():
        if current_time - data.get("created_at") > TOKEN_EXPIRE_TIME:
            remove_tokens.add(token)
        
        if not os.path.isfile(data.get("path")):
            remove_tokens.add(token)
    
    for token in remove_tokens:
        del MEDIA_CACHE[token]


def clear_path_cache(dirname, model_file):
    """
    指定されたメディアパスキャッシュを削除
    """
    cache_key = (dirname, model_file)
    if cache_key in MEDIA_PATH_CACHE:
        del MEDIA_PATH_CACHE[cache_key]


def get_media_path(model_file: str, dirname: str=None):
    """
    モデルファイルと同名のメディアパスを返す
    dirnameが None の時は順に探査する
    """
    try:
        if not model_file:
            return None
        
        # キャッシュから確認
        cache_key = (dirname, model_file)
        if cache_key in MEDIA_PATH_CACHE:
            # キャッシュされたパスが存在するか再確認
            cached_path = MEDIA_PATH_CACHE[cache_key]
            if cached_path is None or os.path.isfile(cached_path):
                return cached_path
            else:
                # 存在しないパスがキャッシュされていた場合は削除
                del MEDIA_PATH_CACHE[cache_key]
        
        # キャッシュが無かった場合
        filename, _ = folder_paths.annotated_filepath(model_file)
        
        if dirname is not None:
            if dirname == "input":
                input_dir = folder_paths.get_input_directory()
                full_path = os.path.join(input_dir, filename)
            
            elif dirname == "output":
                output_dir = folder_paths.get_output_directory()
                full_path = os.path.join(output_dir, filename)
            
            elif dirname == "temp":
                temp_dir = folder_paths.get_temp_directory()
                full_path = os.path.join(temp_dir, filename)
            
            else:
                try:
                    full_path = folder_paths.get_full_path(dirname, filename)
                except (KeyError, AttributeError):
                    full_path = None
        else:
            full_path = search_full_path(filename)
        
        if not full_path:
            MEDIA_PATH_CACHE[cache_key] = None
            return None
        
        file_no_ext = os.path.splitext(full_path)[0]
        for path in glob.glob(f"{file_no_ext}.*"):
            ext = os.path.splitext(path)[1].lstrip(".").lower()
            for exts in SUPPORTED_EXTENSIONS.values():
                if ext in exts:
                    MEDIA_PATH_CACHE[cache_key] = path
                    return path
        
        MEDIA_PATH_CACHE[cache_key] = None
        return None
    except Exception as e:
        print(f"get_media_path エラー: {e}")
        return None


def search_full_path(filename):
    """
    各フォルダから順にフルパスを探査
    """
    for dirname in folder_paths.folder_names_and_paths.keys():
        full_path = folder_paths.get_full_path(dirname, filename)
        if full_path:
            return full_path
    
    input_dir = folder_paths.get_input_directory()
    full_path = os.path.join(input_dir, filename)
    if os.path.isfile(full_path):
        return full_path
    
    output_dir = folder_paths.get_output_directory()
    full_path = os.path.join(output_dir, filename)
    if os.path.isfile(full_path):
        return full_path
    
    temp_dir = folder_paths.get_temp_directory()
    full_path = os.path.join(temp_dir, filename)
    if os.path.isfile(full_path):
        return full_path
    
    return None


def get_media_category(media_path):
    if not media_path:
        return None
    
    ext = os.path.splitext(media_path)[1][1:]
    for cate, exts in SUPPORTED_EXTENSIONS.items():
        if ext in exts:
            return cate
    
    return None



# ===============================================
# エンドポイント
# ===============================================
@Endpoint.get(PACKAGE_NAME, "get_media_data")
async def get_media_data(req: web.Request):
    """
    メディアデータを取得
    """
    res = {"path": None, "cate": None, "token": None}
    
    try:
        cleanup_media_cache()

        dirname = req.query.get("dir")
        filename = req.query.get("file")

        if not filename:
            return web.json_response(res)

        media_path = get_media_path(filename, dirname)
        if not media_path:
            return web.json_response(res)
        
        cate = get_media_category(media_path)
        token = str(uuid.uuid4())
        MEDIA_CACHE[token] = {
            "path": media_path, 
            "cate": cate, 
            "created_at": time.time()
        }
        
        res["path"] = media_path
        res["cate"] = cate
        res["token"] = token

        return web.json_response(res)
    except Exception as e:
        print(f"get_media_data エラー: {e}")
        return web.json_response(res)


@Endpoint.get(PACKAGE_NAME, "serve_media/{token}")
async def serve_media(req: web.Request):
    """
    token を経由してメディアファイルを取得
    """
    token = req.match_info["token"]
    media_data = MEDIA_CACHE.get(token)

    if not media_data:
        return web.json_response({"message": "Token not found or expired"}, status=404)
    
    media_path = media_data.get("path")
    cate = media_data.get("cate")

    mime_type, encoding = mimetypes.guess_type(media_path)
    if not mime_type:
        if cate == "image": 
            mime_type = "image/jpeg"
        elif cate == "video":
            mime_type = "video/mp4"
        elif cate == "audio":
            mime_type = "audio/mp3"
        else:
            mime_type = "application/actet-stream"
    
    headers = {"Content-Type": mime_type}
    if encoding:
        headers["Content-Encoding"] = encoding
    
    return web.FileResponse(media_path, headers=headers)


@Endpoint.post(PACKAGE_NAME, "remove_media")
async def remove_media(req: web.Request):
    """
    メディアファイルを削除する
    """
    data = await req.json()
    dirname = data.get("dir")
    filename = data.get("file")

    clear_path_cache(dirname, filename)

    media_path = get_media_path(filename, dirname)
    if media_path:
        os.remove(media_path)
        print(f"削除: {media_path}")
    
    cleanup_media_cache()
    return web.json_response("ok")


@Endpoint.post(PACKAGE_NAME, "upload_media")
async def upload_media(req: web.Request):
    """
    ローカルのメディアファイルを保存
    """
    data = await req.json()
    dirname = data.get("dir")
    filename = data.get("file")
    media = data.get("media")

    clear_path_cache(dirname, filename)

    media_name = media.get("name")
    ext = os.path.splitext(media_name)[1]

    full_path = folder_paths.get_full_path(dirname, filename)
    file_no_ext = os.path.splitext(full_path)[0]
    save_path = f"{file_no_ext}{ext}"

    media_data = media.get("data")
    _, encoded_data = media_data.split(",", 1)
    decoded_data = base64.b64decode(encoded_data)

    async with aiofiles.open(save_path, "wb") as f:
        await f.write(decoded_data)
    
    print(f"アップロード: {save_path}")
    return web.json_response("ok")


@Endpoint.post(PACKAGE_NAME, "download_media")
async def download_media(req: web.Request):
    """
    URL からメディアファイルをダウンロード
    """
    data = await req.json()
    dirname = data.get("dir")
    filename = data.get("file")
    url = data.get("url")
    media_type = data.get("type", "").lower()

    clear_path_cache(dirname, filename)

    full_path = folder_paths.get_full_path(dirname, filename)
    file_no_ext = os.path.splitext(full_path)[0]

    ext = os.path.splitext(urlparse(url).path)[1]
    if not ext:
        if media_type in SUPPORTED_EXTENSIONS:
            ext = f".{SUPPORTED_EXTENSIONS.get(media_type)[0]}"
    
    if not ext:
        print("拡張子の取得に失敗しました")
        return web.json_response("failed")
    
    save_path = f"{file_no_ext}{ext}"

    print(f"ダウンロード: {url}")
    CHUNK_SIZE = 8192
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            response.raise_for_status()
            total_size= int(response.headers.get("content-length") or 0)
            pbar = tqdm(total=total_size, unit="B", unit_scale=True)
            async with aiofiles.open(save_path, "wb") as f:
                with pbar:
                    async for chunk in response.content.iter_chunked(CHUNK_SIZE):
                        await f.write(chunk)
                        pbar.update(len(chunk))
    
    return web.json_response("ok")


