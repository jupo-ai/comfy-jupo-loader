import { app } from "../../../../scripts/app.js";
import { mkName } from "../../utils.js";
import { LoraField } from "../../dom/lora-field.js";
import { ConfigDialog } from "../../dialog/config/config-dialog.js";

const PACKAGE_NAME = "Loader";
const CLASS_NAMES = [
    mkName(PACKAGE_NAME, "LoraStack"), 
    mkName(PACKAGE_NAME, "LoraLoader")
];
const COMMAND_OPEN_CONFIG = mkName(PACKAGE_NAME, "OpenLoraConfigDialog");

function isLoraNode(node) {
    return CLASS_NAMES.includes(node?.comfyClass) || CLASS_NAMES.includes(node?.type);
}

function nodePositionToClientPosition(node) {
    const canvas = app.canvas;
    const canvasElement = canvas?.canvas;
    const rect = canvasElement?.getBoundingClientRect?.();
    const ds = canvas?.ds;
    const scale = ds?.scale ?? 1;
    const offset = ds?.offset ?? [0, 0];
    const nodeSize = node.size ?? [0, 0];
    const graphX = node.pos[0] + (nodeSize[0] / 2);
    const graphY = node.pos[1];

    if (!rect) {
        return { x: graphX, y: graphY };
    }

    return {
        x: rect.left + ((graphX + offset[0]) * scale),
        y: rect.top + ((graphY + offset[1]) * scale),
    };
}

// ----------------------------------------------
// 拡張機能
// ----------------------------------------------
const extension = {
    name: mkName(PACKAGE_NAME, "LoraSelector"), 
    commands: [
        {
            id: COMMAND_OPEN_CONFIG,
            label: "LoRA設定を開く",
            icon: "pi pi-cog",
            function: (selectedItem) => {
                const node = isLoraNode(selectedItem)
                    ? selectedItem
                    : Array.from(app.canvas?.selectedItems ?? []).find(isLoraNode);
                node?._openConfigDialog?.();
            },
        },
    ],

    beforeRegisterNodeDef: async function(nodeType, nodeData, app) {
        if (!CLASS_NAMES.includes(nodeType.comfyClass)) return;

        // --------------------------------------
        // onNodeCreated
        // --------------------------------------
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const res = onNodeCreated?.apply(this, arguments);

            this.selectMode = "default";
            this.displayMode = "filename"; // filename or fullpath
            this.clipMode = false;

            this.valuesWidget = this.widgets.find(w => w.name === "values");
            this.optionsWidget = this.widgets.find(w => w.name === "options");
            this.hideValuesWidget();
            this.hideOptionsWidget();
            this.initializeProperties();
            this.updateOptionsValue();
            this.setupField();

            return res;
        }

        // --------------------------------------
        // hideValuesWidget
        //  : valuesウィジェットを非表示にする
        // --------------------------------------
        nodeType.prototype.hideValuesWidget = function() {
            this.valuesWidget ??= this.widgets.find(w => w.name === "values");
            if (this.valuesWidget) {
                this.valuesWidget.options ??= {};
                this.valuesWidget.options.hidden = true;
                this.valuesWidget.hidden = true;
                this.valuesWidget.computeSize = () => [, 0];
            }

            let inputIndex = this.inputs?.findIndex(i => i.name === "values") ?? -1;
            while (inputIndex >= 0) {
                if (typeof this.removeInput === "function") {
                    this.removeInput(inputIndex);
                } else {
                    this.inputs.splice(inputIndex, 1);
                }
                inputIndex = this.inputs?.findIndex(i => i.name === "values") ?? -1;
            }
        }

        // --------------------------------------
        // hideOptionsWidget
        //  : optionsウィジェットを非表示にする
        // --------------------------------------
        nodeType.prototype.hideOptionsWidget = function() {
            this.optionsWidget ??= this.widgets.find(w => w.name === "options");
            if (this.optionsWidget) {
                this.optionsWidget.options ??= {};
                this.optionsWidget.options.hidden = true;
                this.optionsWidget.hidden = true;
                this.optionsWidget.computeSize = () => [, 0];
            }

            let inputIndex = this.inputs?.findIndex(i => i.name === "options") ?? -1;
            while (inputIndex >= 0) {
                if (typeof this.removeInput === "function") {
                    this.removeInput(inputIndex);
                } else {
                    this.inputs.splice(inputIndex, 1);
                }
                inputIndex = this.inputs?.findIndex(i => i.name === "options") ?? -1;
            }
        }

        // --------------------------------------
        // initializeProperties
        //  : 設定用プロパティを初期化する
        // --------------------------------------
        nodeType.prototype.initializeProperties = function() {
            this.addProperty("triggerPosition", "after", "combo", {
                values: ["after", "before"],
                callback: (_, value) => {
                    this.updateOptionsValue("triggerPosition", value);
                }
            });
        }

        // --------------------------------------
        // updateOptionsValue
        //  : optionsウィジェットのJSONを更新する
        // --------------------------------------
        nodeType.prototype.updateOptionsValue = function(key, value) {
            if (!this.optionsWidget) return;
            const options = {
                triggerPosition: this.properties?.triggerPosition || "after",
            };
            if (key) {
                options[key] = value;
            }
            this.optionsWidget.value = JSON.stringify(options);
        }

        // --------------------------------------
        // openConfigDialog
        //  : 設定ダイアログを開く
        // --------------------------------------
        nodeType.prototype._openConfigDialog = function() {
            const position = nodePositionToClientPosition(this);
            const dialog = new ConfigDialog();

            dialog.addItem({
                label: "トリガー挿入位置", 
                type: "dropdown", 
                defaultValue: this.properties?.triggerPosition || "after", 
                attrs: {
                    options: [
                        ["前に追加", "before"], 
                        ["後ろに追加", "after"], 
                    ], 
                    placeholder: "選択してください", 
                }, 
                onChange: (v) => {
                    this.properties.triggerPosition = v;
                    this.updateOptionsValue("triggerPosition", v);
                }
            });

            dialog.show(position);
        }

        // --------------------------------------
        // setupField
        //  : カスタムDOMウィジェット Field の設定
        // --------------------------------------
        nodeType.prototype.setupField = function() {
            this.field = new LoraField(this);
            const fieldWidget = this.addDOMWidget("field", "DOM", this.field.element);

            // レイアウト
            fieldWidget.computeLayoutSize = (node) => {
                const width = this.field.computeWidth();
                const height = this.field.computeHeight();
                return {
                    minHeight: height, 
                    minWidth: width, 
                };
            }

            // onClickの警告対策
            fieldWidget.onClick = () => {};
        }

        // --------------------------------------
        // serialize
        // --------------------------------------
        const serialize = nodeType.prototype.serialize;
        nodeType.prototype.serialize = function() {
            const data = serialize?.apply(this, arguments) || {};

            data.displayMode = this.displayMode;
            data.clipMode = this.clipMode;

            return data;
        }

        // --------------------------------------
        // configure
        // --------------------------------------
        const configure = nodeType.prototype.configure;
        nodeType.prototype.configure = function(data) {
            const res = configure?.apply(this, arguments);
            this.hideValuesWidget();
            this.hideOptionsWidget();

            // displayMode, clipModeを復元
            this.displayMode = data.displayMode;
            this.clipMode = data.clipMode;
            this.updateOptionsValue();

            // valuesウィジェットからDOMを復元
            this.field.load(this.valuesWidget.value);

            // displayMode, clipModeを適用
            this.field.applyDisplayMode();
            this.field.applyClipMode();

            return res;
        }

        // --------------------------------------
        // updateNodeSize
        //  : ノードのサイズを更新
        // --------------------------------------
        nodeType.prototype.updateNodeSize = function() {
            const computed = this.computeSize();
            this.size[0] = Math.max(this.size[0], computed[0]);
            this.size[1] = Math.max(this.size[1], computed[1]);
            this.setDirtyCanvas(true, true);
        }
    }, 

    getNodeMenuItems(node) {
        const items = [];

        if (!isLoraNode(node)) return items;

        items.push({
            content: "設定を開く", 
            callback: () => {
                node._openConfigDialog?.()
            }
        });

        return items;
    },

    getSelectionToolboxCommands(selectedItem) {
        return isLoraNode(selectedItem) ? [COMMAND_OPEN_CONFIG] : [];
    }
};

app.registerExtension(extension);
