import { app } from "../../../../scripts/app.js";
import { $el } from "../../../../scripts/ui.js";
import { loadCss, apiGet, apiPost, mkName } from "../../utils.js";
import { BaseModal } from "../base/base-dialog.js";

import { DataManager } from "./managers/data-manager.js";
import { SearchManager } from "./managers/search-manager.js";
import { TreeManager } from "./managers/tree-manager.js";
import { DirsManager } from "./managers/dirs-manager.js";
import { FilesManager } from "./managers/files-manager.js";
import { BaseExplorerConfig } from "./base-explroer-config.js";

loadCss("dialog/explorer/base-explorer.css");

// ==============================================
// Base Explorer
// ==============================================
export class BaseExplorer extends BaseModal {
    constructor(onFileSelected) {
        super();
        this.currentDir = null;
        this.apiDir = null;
        this.configDialogClass = BaseExplorerConfig;

        this.onFileSelected = onFileSelected;
        this.newFileMode = false;
        this.onNewFileSelected = null;

        this.setupManagers();
        this.createUI();
    }

    // ------------------------------------------
    // セットアップ
    // ------------------------------------------
    setupManagers() {
        this.dataManager = new DataManager(this);
        this.searchManager = new SearchManager(this);
        this.treeManager = new TreeManager(this);
        this.dirsManager = new DirsManager(this);
        this.filesManager = new FilesManager(this);
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createToolButtons() {
        super.createToolButtons();

        this.addToolButton({
            icon: "refresh", 
            title: "更新", 
            onClick: () => this.refresh()
        });

        this.addToolButton({
            icon: "folder", 
            title: "フォルダを開く", 
            onClick: () => this.handleOpenCurrentDir(), 
        });

        this.addToolButton({
            icon: "cog", 
            title: "設定", 
            onClick: (e) => this.handleOpenConfigDialog(e), 
        });
    }

    createUI() {
        this.element.classList.add("jupo-explorer-dialog");
        this.content.classList.add("jupo-explorer-dialog-content");

        // ヘッダー
        const header = $el("div.jupo-explorer-header");
        this.headerTitle = $el("span.jupo-explorer-header-title");
        header.append(this.headerTitle, this.searchManager.element);
        this.content.append(header);

        // Main Area
        const mainArea = $el("div.jupo-explorer-main-area");
        const viewContainer = $el("div.jupo-explorer-view", [
            this.dirsManager.element, 
            this.filesManager.element, 
            this.searchManager.resultsContainer, 
        ]);
        mainArea.append(this.treeManager.element, viewContainer);
        
        this.content.append(mainArea);
    }

    // ------------------------------------------
    // ファイルアイテム設定 (継承クラスで実装)
    // ------------------------------------------
    setFileTitle(node, item) {
        // itemにtitleを設定する
        // 例: this.filesManager.addFileTitle(node.path, item);
    }
    setFileOverlay(node, item) {
        // itemにoverlayを設定する
        // 例: this.filesManager.addFileOverlay(node.info.displayName, item);
    }
    setFileActions(node, item) {
        // itemにアクションボタンを追加する
        /**
         * 例: 
         * this.filesManager.addAFileActionButton({
         *      item: item, 
         *      icon: 'information-slab-circle', 
         *      title: '情報を開く', 
         *      onClick: () => {
         *          const infoDialog = new LoraModelInfo();
         *          infoDialog.show();
         *      }, 
         * });
         */
    }


    // ------------------------------------------
    // ファイルアイテム選択時コールバック
    //  : filesManager.createItemでitemに設定
    // ------------------------------------------
    onFileSelectedCallback(file) {
        this.onFileSelected?.(file);
        this.close();
    }

    
    // ------------------------------------------
    // ツールボタンハンドラー
    // ------------------------------------------
    handleOpenCurrentDir() {
        if (!this.apiDir) return;

        apiPost("CustomExplorer", "open_current_dir", {
            baseDir: this.apiDir, 
            currentDir: this.currentDir, 
        });
    }

    handleOpenConfigDialog(e) {
        const x = e.clientX;
        const y = e.clientY;
        const position = { x, y };

        const dialog = new this.configDialogClass(this);
        dialog.show(position);
    }


    // ------------------------------------------
    // 更新
    // ------------------------------------------
    async refresh(dirPath) {
        if (!this.apiDir) return;

        const dataList = await apiGet("CustomExplorer", `get_data_list?dir=${this.apiDir}`);
        this.dataManager.setupData(dataList);
        this.treeManager.buildTree(this.dataManager.data);

        dirPath = dirPath ?? this.currentDir;
        this.treeManager.openDir(dirPath);

        if (this.searchManager.isSearching) {
            await this.searchManager.refresh();
        }
    }

    async updateFileInfo(filePath, infoData) {
        const updated = this.dataManager.updateFileInfo(filePath, infoData);
        if (!updated) {
            await this.refresh(this.currentDir);
            return;
        }

        if (this.searchManager.isSearching) {
            await this.searchManager.refresh();
            return;
        }

        const currentNode = this.dataManager.findDir(this.currentDir);
        if (currentNode) {
            await this.filesManager.display(currentNode);
        }
    }


    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    getConfig(key) {
        const id = mkName("CustomExplorer", this.constructor.name, key);
        const value = app.extensionManager.setting.get(id);

        if (value === undefined) {
            throw new Error("keyが存在しません", key);
        }
        return value;
    }

    async setConfig(key, value) {
        const id = mkName("CustomExplorer", this.constructor.name, key);

        try {
            await app.extensionManager.setting.set(id, value);
        } catch(error) {
            console.warn(`Error changing setting: ${error}`);
        }
    }

    setHeaderTitle(title) {
        if (!this.headerTitle) return;
        this.headerTitle.textContent = title;
    }


    // ------------------------------------------
    // 開く・閉じる
    // ------------------------------------------
    async show(dirPath) {
        super.show();
        await this.refresh(dirPath);
    }
}



