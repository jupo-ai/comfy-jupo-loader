from comfy_api.latest import io
from ...utils import mk_name
from .._common import PACKAGE_NAME, CATEGORY

import json


def _values_input():
    return io.String.Input("values", socketless=True, extra_dict={"hidden": True})


def get_enabled_values(values: str) -> list[dict]:
    loaded = json.loads(values) if values else []
    output = []

    for value in loaded:
        if value.get("isSeparator"):
            continue

        if value.get("enabled") and value.get("value") is not None:
            output.append(value)

    return output


# ===============================================
# Number Selector
# ===============================================
class NumberSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "NumberSelector"),
            display_name="Number Selector",
            category=CATEGORY,
            inputs=[
                _values_input(),
                io.Int.Input("decimal_places", default=2, min=0, max=8, step=1),
            ],
            outputs=[
                io.Int.Output(display_name="INT"),
                io.Float.Output(display_name="FLOAT"),
            ],
        )

    @classmethod
    def execute(cls, values: str, decimal_places: int = 2):
        enabled_values = get_enabled_values(values)
        if not enabled_values:
            raise ValueError("NumberSelector: 有効な値が見つかりません")

        value = round(float(enabled_values[0].get("value")), decimal_places)
        return io.NodeOutput(int(value), value)


# ===============================================
# String Selector
# ===============================================
class StringSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id=mk_name(PACKAGE_NAME, "StringSelector"),
            display_name="String Selector",
            category=CATEGORY,
            inputs=[
                _values_input(),
            ],
            outputs=[
                io.String.Output(display_name="STRING"),
            ],
        )

    @classmethod
    def execute(cls, values: str):
        enabled_values = get_enabled_values(values)
        if not enabled_values:
            raise ValueError("StringSelector: 有効な値が見つかりません")

        value = str(enabled_values[0].get("value", ""))
        return io.NodeOutput(value)
