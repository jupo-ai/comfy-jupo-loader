import folder_paths
import comfy.utils
import comfy.lora
import comfy.lora_convert
import comfy.hooks
import comfy.sd

# 型用
from comfy.model_patcher import ModelPatcher
from comfy.sd import CLIP

# -----------------------------------------------
# LBW用 Hookクラス
# -----------------------------------------------
class LBWWeightHook(comfy.hooks.WeightHook):
    def __init__(self, strength_model=1, strength_clip=1, loaded: dict={}, lbw_map: dict={}):
        super().__init__(strength_model, strength_clip)
        self.loaded = loaded
        self.lbw_map = lbw_map
    
    def add_hook_patches(self, model, model_options, target_dict, registered):
        if not self.should_register(model, model_options, target_dict, registered):
            return False
        
        target = target_dict.get("target")
        if target == comfy.hooks.EnumWeightTarget.Clip:
            strength = self._strength_clip
        else:
            strength = self._strength_model
        
        for key, value in self.loaded.items():
            patch = {key: value}
            strength_patch = strength * self.lbw_map.get(key, 1)
            model.add_hook_patches(self, patch, strength_patch)
        
        registered.add(self)
        return True
    
    def clone(self):
        c: LBWWeightHook = super().clone()
        c.loaded = self.loaded
        c.lbw_map = self.lbw_map
        return c
    


# -----------------------------------------------
# LBW対応 LoraLoaderクラス
# -----------------------------------------------
class LBWLoraLoader:
    def __init__(self):
        self.loaded_lora = None
        
    # -------------------------------------------
    # メインメソッド 通常版
    # -------------------------------------------
    def load_lora(self, model: ModelPatcher, clip: CLIP, lora_name: str, strength_model: float, strength_clip: float):
        if strength_model == 0 and strength_clip == 0:
            return (model, clip)
        
        lora = self.prepare_lora(lora_name)
        model, clip = comfy.sd.load_lora_for_models(model, clip, lora, strength_model, strength_clip)
        return (model, clip)
    
    
    # -------------------------------------------
    # メインメソッド LBW版
    # -------------------------------------------
    def load_lora_with_lbw(self, model: ModelPatcher, clip: CLIP, lora_name: str, strength_model: float, strength_clip: float, lbw: dict[str, dict]):
        if strength_model == 0 and strength_clip == 0:
            return (model, clip)
        
        lora = self.prepare_lora(lora_name)
        loaded, model_mapped, clip_mapped = self.prepare_lbw_info(model, clip, lora, lbw)
        pbar = comfy.utils.ProgressBar(total=len(loaded))

        for key, value in loaded.items():
            patch = {key: value}
            strength_patch_model = strength_model * model_mapped.get(key, 1)
            strength_patch_clip = strength_clip * clip_mapped.get(key, 1)

            if model:
                model.add_patches(patch, strength_patch_model)
            if clip:
                clip.patcher.add_patches(patch, strength_patch_clip)
            pbar.update(1)
        
        return (model, clip)
    
    
    # -------------------------------------------
    # メインメソッド Schedule版
    # -------------------------------------------
    def load_lora_with_schedule(self, model: ModelPatcher, clip: CLIP, lora_name: str, strength_model: float, strength_clip: float, lbw: dict[str, dict], start: float, end: float, prev_hooks: comfy.hooks.HookGroup):
        if prev_hooks is None:
            prev_hooks = comfy.hooks.HookGroup()
        prev_hooks = prev_hooks.clone()

        if strength_model == 0 and strength_clip == 0:
            return prev_hooks
        
        lora = self.prepare_lora(lora_name)

        # LBW
        hooks_lbw = self._create_lbw_hook(model, clip, lora, strength_model, strength_clip, lbw)

        # Schedule
        hook_kf = self._create_schedule_hook(start, end)
        hooks_lbw = hooks_lbw.clone()
        hooks_lbw.set_keyframes_on_hooks(hook_kf=hook_kf)

        hooks = prev_hooks.clone_and_combine((hooks_lbw), )
        return hooks
    
    def _create_lbw_hook(self, model: ModelPatcher, clip: CLIP, lora: dict, strength_model: float, strength_clip: float, lbw: dict[str, dict]):
        loaded, model_mapped, clip_mapped = self.prepare_lbw_info(model, clip, lora, lbw)
        lbw_map = model_mapped | clip_mapped

        hook_group = comfy.hooks.HookGroup()
        if len(lbw_map) > 0:
            hook = LBWWeightHook(strength_model, strength_clip, loaded, lbw_map)
        else:
            hook = comfy.hooks.WeightHook(strength_model, strength_clip)
            hook.weights = lora
        
        hook_group.add(hook)
        return hook_group
    
    def _create_schedule_hook(self, start: float, end: float):
        keyframe_group = comfy.hooks.HookKeyframeGroup()
        keyframe_group = keyframe_group.clone()

        # startよりも前は強度0
        if start > 0:
            keyframe = comfy.hooks.HookKeyframe(strength=0, start_percent=0)
            keyframe_group.add(keyframe)
        
        # startから強度1
        keyframe = comfy.hooks.HookKeyframe(strength=1, start_percent=start)
        keyframe_group.add(keyframe)

        # endから強度0
        keyframe = comfy.hooks.HookKeyframe(strength=0, start_percent=end)
        keyframe_group.add(keyframe)

        return keyframe_group
    
    
    # -------------------------------------------
    # ユーティリティ
    # -------------------------------------------
    def prepare_lora(self, lora_name: str):
        lora_path = folder_paths.get_full_path_or_raise("loras", lora_name)
        lora = None
        if self.loaded_lora is not None:
            if self.loaded_lora[0] == lora_path:
                lora = self.loaded_lora[1]
            else:
                temp = self.loaded_lora
                self.loaded_lora = None
                del temp
        
        if lora is None:
            lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
            self.loaded_lora = (lora_path, lora)
        
        return lora
    
    
    def prepare_lbw_info(self, model: ModelPatcher, clip: CLIP, lora: dict, lbw: dict[str, dict]):
        model_key_map = {}
        clip_key_map = {}

        model_mapped = {}
        clip_mapped = {}

        if model is not None:
            model_key_map = comfy.lora.model_lora_keys_unet(model.model)
            model_block_info = lbw.get("model", {})
            model_mapped = self._mapping_block_info(model_block_info, model_key_map)
        
        if clip is not None:
            clip_key_map = comfy.lora.model_lora_keys_clip(clip.cond_stage_model)
            clip_block_info = lbw.get("clip", {})
            clip_mapped = self._mapping_block_info(clip_block_info, clip_key_map)
        
        key_map = model_key_map | clip_key_map
        lora = comfy.lora_convert.convert_lora(lora)
        loaded = comfy.lora.load_lora(lora, key_map)

        return (loaded, model_mapped, clip_mapped)
    
    
    def _mapping_block_info(self, block_info: dict, lora_key_map: dict):
        normalized = {}

        internal_keys = list(lora_key_map.values())

        for search_key, weight in block_info.items():
            for internal_key in internal_keys:
                if self._matches_block_key(search_key, internal_key):
                    normalized[internal_key] = weight
        
        return normalized

    def _matches_block_key(self, search_key: str, internal_key):
        if isinstance(internal_key, tuple):
            internal_key = internal_key[0]

        if not isinstance(internal_key, str):
            return False

        start = internal_key.find(search_key)
        if start < 0:
            return False

        end = start + len(search_key)
        before = internal_key[start - 1] if start > 0 else "."
        if search_key.endswith("."):
            return before == "."

        after = internal_key[end] if end < len(internal_key) else "."

        return before == "." and after == "."
    
    
