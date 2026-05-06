import { SelectorField } from "./selector-field.js";
import { LoraWidget } from "./lora-widget.js";
import { LoraExplorer } from "../dialog/explorer/lora-explorer.js";

// ==============================================
// Lora Field
// ==============================================
export class LoraField extends SelectorField {
    constructor(comfyNode) {
        super(comfyNode);

        this.apiDir = "loras";
        this.WidgetClass = LoraWidget;
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        super.createUI();

        // header
        this.header.addArea({ key: "model", width: 64, title: "Model" });
        this.header.addArea({ key: "clip", width: 64, title: "Clip" });
        this.updateHeaderTitle();
    }

    onAddButtonClick() {
        const explorer = new LoraExplorer((file) => {
            const valueOptions = {
                path: file.path, 
                displayName: file.info.user?.displayName ?? "", 
                trigger: file.info.user?.trigger ?? "", 
            };
            const widget = new this.WidgetClass({ parentField: this, valueOptions: valueOptions });
            this.addWidget(widget);
        });
        explorer.show();
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    // displayModeの変更
    applyDisplayMode() {
        this.widgets.forEach(w => {
            if (w.value.isSeparator) return; // separatorはスキップ
            w.updateDisplayName();
        });
    }

    // clipModeの変更
    applyClipMode() {
        this.updateHeaderTitle();
        this.widgets.forEach(w => {
            if (w.value.isSeparator) return;
            w.updateClipMode();
        });
    }

    updateHeaderTitle() {
        const clipMode = this.comfyNode.clipMode;
        const modelTitle = clipMode ? "Model" : "Strength";
        this.header.setAreaTitle("model", modelTitle);
        this.header.toggleArea("clip", clipMode);
    }
}