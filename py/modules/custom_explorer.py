from aiohttp import web
from ..utils import Endpoint
import folder_paths
import os
import json
from pathlib import Path
import subprocess
import platform

PACKAGE_NAME = "CustomExplorer"

# ===============================================
# エンドポイント
# ===============================================

# -----------------------------------------------
# 現在のフォルダを開く (ツールバーボタン)
# -----------------------------------------------
@Endpoint.post(PACKAGE_NAME, "open_current_dir")
async def open_current_dir(req: web.Request):
    data = await req.json()
    base_dirname = data.get("baseDir")
    current_dir = data.get("currentDir")
    
    base_dir = folder_paths.get_folder_paths(base_dirname)[0]
    if (current_dir):
        dirpath = os.path.join(base_dir, current_dir)
    else:
        dirpath = base_dir
    
    if os.path.isdir(dirpath):
        system = platform.system()
        if system == "Windows":
            os.startfile(dirpath)
        elif system == "Darwin":
            subprocess.run(["open", dirpath])
        else:
            subprocess.run(["xdg-open", dirpath])
    
    return web.json_response("ok")


# inputディレクトリ専用
@Endpoint.post(PACKAGE_NAME, "open_current_dir_for_input")
async def open_current_dir_for_input(req: web.Request):
    data = await req.json()
    current_dir = data.get("currentDir")

    base_dir = folder_paths.get_input_directory()
    if current_dir:
        dirpath = os.path.join(base_dir, current_dir)
    else:
        dirpath = base_dir
    
    if os.path.isdir(dirpath):
        system = platform.system()
        if system == "Windows":
            os.startfile(dirpath)
        elif system == "Darwin":
            subprocess.run(["open", dirpath])
        else:
            subprocess.run(["xdg-open", dirpath])
    
    return web.json_response("ok")


# -----------------------------------------------
# DataListを取得
# -----------------------------------------------
@Endpoint.get(PACKAGE_NAME, "get_data_list")
async def get_data_list(req: web.Request):
    dirname = req.query.get("dir")

    file_list = folder_paths.get_filename_list(dirname)
    data_list = []

    for filename in file_list:
        info = {}
        full_path = folder_paths.get_full_path(dirname, filename)
        json_path = Path(full_path).with_suffix(".json")
        if json_path.exists():
            try:
                with open(json_path, mode="r", encoding="utf-8") as f:
                    info = json.load(f)
            except Exception as e:
                print(f"❌ JSON読み込み失敗: {json_path}: {e}")
        
        data = {
            "filename": filename, 
            "info": info
        }
        data_list.append(data)
    
    return web.json_response(data_list)


# inputディレクトリ専用
@Endpoint.get(PACKAGE_NAME, "get_data_list_for_input")
async def get_data_list_for_input(req: web.Request):
    content_types = req.query.get("contents")
    content_types = [c.strip() for c in content_types.split(",")]

    input_dir = folder_paths.get_input_directory()
    files = [str(p) for p in sorted(Path(input_dir).glob("**/*"))]
    
    content_files = folder_paths.filter_files_content_types(files, content_types)
    content_filenames = [Path(file).relative_to(input_dir) for file in content_files]

    # clipscapeフォルダ -> xxx-masked-xxxのみ
    processed_filenames = []
    for p in content_filenames:
        if p.parts and p.parts[0] == "clipspace":
            if "-masked-" in p.name:
                processed_filenames.append(f"{str(p)}")
        else:
            processed_filenames.append(str(p))
    
    
    data_list = []
    for filename in processed_filenames:
        data = {
            "filename": filename, 
            "info": {}
        }
        data_list.append(data)
    
    return web.json_response(data_list)

