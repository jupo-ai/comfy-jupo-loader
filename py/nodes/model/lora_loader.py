from comfy_api.latest import io
from ...utils import mk_name
from .._common import PACKAGE_NAME, CATEGORY
from .utils import get_available_stack, get_trigger_from_stack

from comfy.model_patcher import ModelPatcher
from comfy.sd import CLIP
import comfy.hooks
import json
from .lbw import LBWLoraLoader

# カスタムIO
IO_LORASTACK = io.Custom("LORASTACK")
IO_OPTIMIZER_STACK = io.Custom("LORA_STACK")


def _options_input():
    return io.String.Input("options", socketless=True, extra_dict={"hidden": True}, default="", optional=True)


def _get_trigger_position(options: str) -> str:
    try:
        options_dict = json.loads(options) if options else {}
    except Exception:
        options_dict = {}

    position = options_dict.get("triggerPosition", "after")
    return "before" if position == "before" else "after"


def _combine_trigger(prev_text: str, trigger: str, options: str) -> str:
    if _get_trigger_position(options) == "before":
        return trigger + prev_text
    return prev_text + trigger


# ===============================================
# Lora Stack
# ===============================================
class LoraStack(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "LoraStack"), 
            display_name="LoRA Stack", 
            category=CATEGORY, 
            inputs=[
                io.String.Input("values", socketless=True, extra_dict={"hidden": True}), 
                _options_input(),
                IO_LORASTACK.Input("prev_stack", optional=True), 
                io.String.Input("prev_text", force_input=True, optional=True), 
            ], 
            outputs=[
                IO_LORASTACK.Output(display_name="stack"), 
                io.String.Output(display_name="text"), 
            ]
        )
    
    @classmethod
    def execute(cls, values: str, options: str="", prev_stack: list[dict]=[], prev_text: str=""):
        stack = get_available_stack(values, "loras")
        trigger = get_trigger_from_stack(stack)

        new_stack = prev_stack + stack
        new_trigger = _combine_trigger(prev_text, trigger, options)
        

        return io.NodeOutput(new_stack, new_trigger)


# ===============================================
# Apply Lora Stack
# ===============================================
class ApplyLoraStack(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "ApplyLoraStack"), 
            display_name="Apply LoRA Stack", 
            category=CATEGORY, 
            inputs=[
                io.Model.Input("model"), 
                io.Clip.Input("clip", optional=True), 
                IO_LORASTACK.Input("stack", optional=True)
            ], 
            outputs=[
                io.Model.Output(), 
                io.Clip.Output(), 
            ], 
        )
    
    @classmethod
    def execute(cls, model: ModelPatcher, clip: CLIP=None, stack: list=[]):
        prev_hooks = None

        model = model.clone() if model else None
        clip = clip.clone() if clip else None
        
        for value in stack:
            enabled = value.get("enabled")
            if not enabled:
                continue
        
            filename = value.get("path")
            if not filename:
                continue
            
            strength_model = value.get("modelStrength", 1)
            strength_clip = value.get("clipStrength", 1)
            clip_mode = value.get("clipMode", False)
            if not clip_mode:
                strength_clip = strength_model
            if not clip:
                strength_clip = 0
            
            enabled_lbw = value.get("enabledLBW", False)
            lbw = value.get("lbw", {})
            if (not enabled_lbw) or (not lbw):
                lbw = {}
            
            enabled_schedule = value.get("enabledSchedule", False)

            def _clamp(_min, _value, _max):
                return max(_min, min(_value, _max))
            
            start = value.get("start", 1)
            end = value.get("end", 0)
            start = _clamp(0, start, 1)
            end = _clamp(0, end, 1)
            if not enabled_schedule:
                start = 0
                end = 1
            
            if start > 0 or end < 1:
                print(f"Loading with schedule: {filename}")
                prev_hooks = LBWLoraLoader().load_lora_with_schedule(
                    model, clip, filename, 
                    strength_model, strength_clip, lbw, 
                    start, end, prev_hooks
                )
            elif enabled_lbw:
                print(f"Loading with LBW: {filename}")
                model, clip = LBWLoraLoader().load_lora_with_lbw(
                    model, clip, filename, 
                    strength_model, strength_clip, lbw
                )
            else:
                print(f"Loading: {filename}")
                model, clip = LBWLoraLoader().load_lora(
                    model, clip, filename, 
                    strength_model, strength_clip
                )
        
        # Hookを適用
        hooks = prev_hooks
        if hooks is not None:
            if clip is not None:
                clip.apply_hooks_to_conds = hooks
                clip.patcher.forced_hooks = hooks.clone()
                clip.use_clip_schedule = True
                clip.patcher.register_all_hook_patches(hooks, comfy.hooks.create_target_dict(comfy.hooks.EnumWeightTarget.Clip))
        
        return io.NodeOutput(model, clip)



# ===============================================
# Lora Loader
# ===============================================
class LoraLoader(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "LoraLoader"), 
            display_name="LoRA Loader", 
            category=CATEGORY, 
            inputs=[
                io.String.Input("values", socketless=True, extra_dict={"hidden": True}), 
                _options_input(),
                io.Model.Input("model"), 
                io.Clip.Input("clip", optional=True), 
                io.String.Input("prev_text", force_input=True, optional=True), 
            ], 
            outputs=[
                io.Model.Output(), 
                io.Clip.Output(), 
                io.String.Output(display_name="text"), 
            ], 
        )
    
    @classmethod
    def execute(cls, values: str, options: str="", model: ModelPatcher=None, clip: CLIP=None, prev_text: str=""):
        stack, trigger = LoraStack().execute(values)
        model, clip = ApplyLoraStack().execute(model, clip, stack)
        new_text = _combine_trigger(prev_text, trigger, options)

        return io.NodeOutput(model, clip, new_text)
    


