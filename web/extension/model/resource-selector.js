import { app } from "../../../../scripts/app.js";
import { mkName } from "../../utils.js";
import { ResourceField } from "../../dom/resource-field.js";

const PACKAGE_NAME = "Loader";
const SELECTOR_CONFIGS = {
    [mkName(PACKAGE_NAME, "CheckpointSelector")]: {
        apiDir: "checkpoints",
        title: "Checkpoint",
        requiredCount: 1,
    },
    [mkName(PACKAGE_NAME, "DiffusionModelSelector")]: {
        apiDir: "diffusion_models",
        title: "Diffusion Model",
        requiredCount: 1,
    },
    [mkName(PACKAGE_NAME, "VAESelector")]: {
        apiDir: "vae",
        title: "VAE",
        requiredCount: 1,
    },
    [mkName(PACKAGE_NAME, "CLIPSelector")]: {
        apiDir: "text_encoders",
        title: "CLIP",
        requiredCount: 1,
    },
    [mkName(PACKAGE_NAME, "DualCLIPSelector")]: {
        apiDir: "text_encoders",
        title: "Dual CLIP",
        requiredCount: 2,
    },
    [mkName(PACKAGE_NAME, "TripleCLIPSelector")]: {
        apiDir: "text_encoders",
        title: "Triple CLIP",
        requiredCount: 3,
    },
    [mkName(PACKAGE_NAME, "QuadrupleCLIPSelector")]: {
        apiDir: "text_encoders",
        title: "Quadruple CLIP",
        requiredCount: 4,
    },
};

const CLASS_NAMES = Object.keys(SELECTOR_CONFIGS);

// ----------------------------------------------
// 拡張機能
// ----------------------------------------------
const extension = {
    name: mkName(PACKAGE_NAME, "ResourceSelector"),

    beforeRegisterNodeDef: async function(nodeType, nodeData, app) {
        if (!CLASS_NAMES.includes(nodeType.comfyClass)) return;

        const config = SELECTOR_CONFIGS[nodeType.comfyClass];

        // --------------------------------------
        // onNodeCreated
        // --------------------------------------
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const res = onNodeCreated?.apply(this, arguments);

            this.displayMode = "filename"; // filename or fullpath
            this.selectMode = config.requiredCount === 1 ? "alwaysOne" : "default";

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
            this.field = new ResourceField(this, config);
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
            data.selectMode = this.selectMode;

            return data;
        }

        // --------------------------------------
        // configure
        // --------------------------------------
        const configure = nodeType.prototype.configure;
        nodeType.prototype.configure = function(data) {
            const res = configure?.apply(this, arguments);
            this.hideValuesWidget();

            // 復元
            this.displayMode = data.displayMode ?? "filename";
            this.selectMode = data.selectMode ?? (config.requiredCount === 1 ? "alwaysOne" : "default");

            this.field.load(this.valuesWidget?.value);
            this.field.applyDisplayMode();

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
