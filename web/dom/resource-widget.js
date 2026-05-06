import { SelectorWidget } from "./selector-widget.js";
import { Path } from "../utils.js";
import { ResourceExplorer } from "../dialog/explorer/resource-explorer.js";
import { ResourceInfo } from "../dialog/model-info/resource-info.js";

// ==============================================
// Resource Widget
// ==============================================
export class ResourceWidget extends SelectorWidget {
    constructor({ parentField, valueOptions = {} }) {
        super({ parentField, valueOptions });

        this.value = {
            enabled: true,
            path: "",
            displayName: "",
        };

        this.valueUpdate(valueOptions);
        this.updateDisplayName();
    }

    // ------------------------------------------
    // ハンドラー
    // ------------------------------------------
    handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();

        const menuOptions = [
            {
                content: "ℹ️ 情報を開く",
                callback: () => {
                    const dialog = new ResourceInfo({
                        apiDir: this.parentField.apiDir,
                        modelPath: this.value.path,
                        onClosed: (infoData) => {
                            this.valueUpdate({
                                displayName: infoData?.user?.displayName ?? "",
                            });
                            this.updateDisplayName();
                        }
                    });
                    dialog.show();
                }
            },
            null,
            {
                content: `📝 表示切替: ${this.parentField.comfyNode.displayMode === "fullpath" ? "ファイル名" : "フルパス"}`,
                callback: () => {
                    const currentValue = this.parentField.comfyNode.displayMode;
                    const newValue = currentValue === "filename" ? "fullpath" : "filename";
                    this.parentField.comfyNode.displayMode = newValue;
                    this.parentField.applyDisplayMode();
                }
            },
        ];

        const filename = new Path(this.value.path).stem;
        new LiteGraph.ContextMenu(menuOptions, {
            event: e,
            title: filename,
            calssName: "custom-lora-menu",
            node: this.parentField.comfyNode,
            filter: false,
        }, window);
    }

    handleNameClick() {
        const explorer = new ResourceExplorer(file => {
            this.valueUpdate({
                path: file.path,
                displayName: file.info?.user?.displayName ?? "",
            });
            this.updateDisplayName();
        }, {
            apiDir: this.parentField.apiDir,
            title: this.parentField.title,
        });
        const dirPath = new Path(this.value.path).parent.toString();
        explorer.show(dirPath);
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    updateDisplayName() {
        const displayName = this.value.displayName;
        const filename = new Path(this.value.path).stem;
        const fullpath = this.value.path;

        const displayMode = this.parentField.comfyNode.displayMode;
        const name = displayMode === "fullpath" ? fullpath : displayName || filename;
        this.setDisplayName(name);
    }
}
