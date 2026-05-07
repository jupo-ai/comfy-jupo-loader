import { BaseExplorer } from "./base-explorer.js";
import { Path, apiGet, apiPost } from "../../utils.js";

// ==============================================
// Image Explorer
// ==============================================
export class ImageExplorer extends BaseExplorer {
    constructor(onFileSelected) {
        super(onFileSelected);

        this.apiDir = "input";
        this.setHeaderTitle("Input Image");
    }

    // ------------------------------------------
    // ファイルアイテム設定
    // ------------------------------------------
    setFileTitle(node, item) {
        this.filesManager.addFileTitle(node.path, item);
    }

    setFileOverlay(node, item) {
        const path = new Path(node.path);
        const stem = path.stem;
        this.filesManager.addFileOverlay(stem, item);
    }

    setFileActions(node, item) {
        // アクションボタンなし
    }


    // ------------------------------------------
    // ツールボタンハンドラー
    // ------------------------------------------
    handleOpenCurrentDir() {
        if (!this.apiDir) return;

        apiPost("CustomExplorer", "open_current_dir_for_input", {
            baseDir: this.apiDir, 
            currentDir: this.currentDir, 
        });
    }


    // ------------------------------------------
    // 更新
    // ------------------------------------------
    async refresh(dirPath) {
        if (!this.apiDir) return;

        const dataList = await apiGet("CustomExplorer", `get_data_list_for_input?contents=image`);
        this.dataManager.setupData(dataList);
        this.treeManager.buildTree(this.dataManager.data);

        dirPath = dirPath ?? this.currentDir;
        this.treeManager.openDir(dirPath);

        if (this.searchManager.isSearching) {
            await this.searchManager.refresh();
        }
    }



}
