import { BaseExplorer } from "./base-explorer.js";
import { Path } from "../../utils.js";
import { LoraInfo } from "../model-info/lora-info.js";

// ==============================================
// Lora Explorer
// ==============================================
export class LoraExplorer extends BaseExplorer {
    constructor(onFileSelected) {
        super(onFileSelected);

        this.apiDir = "loras";
        this.setHeaderTitle("LoRA");
    }

    setFileTitle(node, item) {
        this.filesManager.addFileTitle(node.path, item);
    }

    setFileOverlay(node, item) {
        const path = new Path(node.path);
        const stem = path.stem;
        this.filesManager.addFileOverlay(stem, item);
        
        const displayName = node.info.user?.displayName;
        if (displayName) {
            this.filesManager.addFileOverlay(displayName, item);
        }

        const desc = node.info.user?.desc;
        if (desc) {
            this.filesManager.addFileOverlay(desc, item);
        }
    }

    setFileActions(node, item) {
        this.filesManager.addFileActionButton({
            item: item, 
            icon: "information-slab-circle", 
            title: "情報を開く", 
            onClick: () => {
                const dialog = new LoraInfo({
                    modelPath: node.path, 
                    onClosed: (infoData) => this.updateFileInfo(node.path, infoData)
                });
                dialog.show();
            }
        });
    }
}
