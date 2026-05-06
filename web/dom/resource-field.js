import { SelectorField } from "./selector-field.js";
import { ResourceWidget } from "./resource-widget.js";
import { ResourceExplorer } from "../dialog/explorer/resource-explorer.js";

// ==============================================
// Resource Field
// ==============================================
export class ResourceField extends SelectorField {
    constructor(comfyNode, config) {
        super(comfyNode);

        this.apiDir = config.apiDir;
        this.title = config.title;
        this.requiredCount = config.requiredCount ?? 1;
        this.WidgetClass = ResourceWidget;

        if (this.requiredCount === 1) {
            this.header.element.style.display = "none";
        }
    }

    onAddButtonClick() {
        const explorer = new ResourceExplorer((file) => {
            const valueOptions = {
                path: file.path,
                displayName: file.info?.user?.displayName ?? "",
            };
            const widget = new this.WidgetClass({ parentField: this, valueOptions: valueOptions });
            this.addWidget(widget);
        }, {
            apiDir: this.apiDir,
            title: this.title,
        });
        explorer.show();
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    applyDisplayMode() {
        this.widgets.forEach(w => {
            if (w.value.isSeparator) return;
            w.updateDisplayName();
        });
    }
}
