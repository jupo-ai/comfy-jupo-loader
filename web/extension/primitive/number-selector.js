import { app } from "../../../../scripts/app.js";
import { mkName } from "../../utils.js";
import { NumberPrimitiveField } from "../../dom/primitive-field.js";

const PACKAGE_NAME = "Primitive";
const CLASS_NAMES = [
    mkName(PACKAGE_NAME, "NumberSelector"),
];

// ----------------------------------------------
// 拡張機能
// ----------------------------------------------
const extension = {
    name: mkName(PACKAGE_NAME, "NumberSelector"),

    beforeRegisterNodeDef: async function(nodeType, nodeData, app) {
        if (!CLASS_NAMES.includes(nodeType.comfyClass)) return;

        // --------------------------------------
        // onNodeCreated
        // --------------------------------------
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const res = onNodeCreated?.apply(this, arguments);

            this.selectMode = "alwaysOne";
            this.valuesWidget = this.widgets.find(w => w.name === "values");
            this.decimalPlacesWidget = this.widgets.find(w => w.name === "decimal_places");
            this.hideValuesWidget();
            this.hookDecimalPlacesWidget();
            this.setupField();

            return res;
        }

        // --------------------------------------
        // hookDecimalPlacesWidget
        // --------------------------------------
        nodeType.prototype.hookDecimalPlacesWidget = function() {
            this.decimalPlacesWidget ??= this.widgets.find(w => w.name === "decimal_places");
            if (!this.decimalPlacesWidget) return;

            const callback = this.decimalPlacesWidget.callback;
            this.decimalPlacesWidget.callback = (...args) => {
                const result = callback?.apply(this.decimalPlacesWidget, args);
                this.field?.applyDecimalPlaces();
                return result;
            };
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
            this.field = new NumberPrimitiveField(this);
            const fieldWidget = this.addDOMWidget("field", "DOM", this.field.element);

            fieldWidget.computeLayoutSize = (node) => {
                const width = this.field.computeWidth();
                const height = this.field.computeHeight();
                return {
                    minHeight: height,
                    minWidth: width,
                };
            }

            fieldWidget.onClick = () => {};
        }

        // --------------------------------------
        // serialize
        // --------------------------------------
        const serialize = nodeType.prototype.serialize;
        nodeType.prototype.serialize = function() {
            const data = serialize?.apply(this, arguments) || {};
            data.selectMode = this.selectMode;
            return data;
        }

        // --------------------------------------
        // configure
        // --------------------------------------
        const configure = nodeType.prototype.configure;
        nodeType.prototype.configure = function(data) {
            const res = configure?.apply(this, arguments);
            this.decimalPlacesWidget = this.widgets.find(w => w.name === "decimal_places");
            this.hideValuesWidget();
            this.hookDecimalPlacesWidget();

            this.selectMode = data.selectMode ?? "alwaysOne";
            this.field.load(this.valuesWidget?.value);
            this.field.applyDecimalPlaces();

            return res;
        }

        // --------------------------------------
        // updateNodeSize
        //  : ノードサイズを更新
        // --------------------------------------
        nodeType.prototype.updateNodeSize = function() {
            const computed = this.computeSize();
            this.size[0] = Math.max(this.size[0], computed[0]);
            this.size[1] = Math.max(this.size[1], computed[1]);
            this.setDirtyCanvas(true, true);
        }
    }
};

app.registerExtension(extension);
