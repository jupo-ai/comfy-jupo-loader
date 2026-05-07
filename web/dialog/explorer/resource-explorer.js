import { BaseExplorer } from "./base-explorer.js";
import { Path } from "../../utils.js";
import { ResourceInfo } from "../model-info/resource-info.js";

// ==============================================
// Resource Explorer
//  : 汎用モデルファイル選択エクスプローラ
// ==============================================
export class ResourceExplorer extends BaseExplorer {
    constructor(onFileSelected, { apiDir, title } = {}) {
        super(onFileSelected);

        this.apiDir = apiDir;
        this.setHeaderTitle(title);
    }

    setFileTitle(node, item) {
        this.filesManager.addFileTitle(node.path, item);
    }

    setFileOverlay(node, item) {
        const path = new Path(node.path);
        this.filesManager.addFileOverlay(path.stem, item);

        const displayName = node.info?.user?.displayName;
        if (displayName) {
            this.filesManager.addFileOverlay(displayName, item);
        }

        const desc = node.info?.user?.desc;
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
                const dialog = new ResourceInfo({
                    apiDir: this.apiDir,
                    modelPath: node.path,
                    onClosed: (infoData) => this.updateFileInfo(node.path, infoData)
                });
                dialog.show();
            }
        });
    }
}
