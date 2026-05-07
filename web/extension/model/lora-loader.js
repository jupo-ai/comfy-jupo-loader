import { app } from "../../../../scripts/app.js";
import { mkName } from "../../utils.js";
import { LoraField } from "../../dom/lora-field.js";

const PACKAGE_NAME = "Loader";
const CLASS_NAMES = [
    mkName(PACKAGE_NAME, "LoraStack"), 
    mkName(PACKAGE_NAME, "LoraLoader")
];

// ----------------------------------------------
// 拡張機能
// ----------------------------------------------
const extension = {
    name: mkName(PACKAGE_NAME, "LoraSelector"), 

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
            this.hideValuesWidget();
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

            // displayMode, clipModeを復元
            this.displayMode = data.displayMode;
            this.clipMode = data.clipMode;

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
};

app.registerExtension(extension);
