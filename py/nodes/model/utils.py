import folder_paths
import json

# ===============================================
# Stack関連のヘルパー
# ===============================================
# valuesから有効なstackを抽出
def get_available_stack(values: str, dirname: str, verbose: bool=False) -> list[dict]:
    loaded_stack = json.loads(values) if values else []
    available_stacks = []

    for value in loaded_stack:
        is_separator = value.get("isSeparator")
        if is_separator:
            continue
        
        filename = value.get("path")
        fullpath = folder_paths.get_full_path(dirname, filename)
        if not fullpath:
            if verbose:
                print(f"❌ {filename} is not Found.")
            continue
        
        enabled = value.get("enabled")
        if not enabled:
            continue
        
        available_stacks.append(value)
    
    return available_stacks


# stackのリストからトリガーワードプロンプトを取得
def get_trigger_from_stack(stack: list[dict]) -> str:
    result = []

    for value in stack:
        enabled = value.get("enabledTrigger")
        trigger = value.get("trigger")

        if not enabled: continue
        if not trigger: continue
        
        result.append(trigger)
    
    return combine_with_comma(*result)


# 整形してカンマで結合
def combine_with_comma(*args):
    to_combine = []
    for text in args:
        cleaned = text.strip().rstrip(",")
        if cleaned:
            to_combine.append(cleaned)
        
    return ", ".join(to_combine) + ", " if to_combine else ""

