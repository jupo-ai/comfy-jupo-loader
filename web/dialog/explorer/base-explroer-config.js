import { app } from "../../../../scripts/app.js";
import { $el } from "../../../../scripts/ui.js";
import { loadCss, apiGet, apiPost, mkName } from "../../utils.js";
import { BaseModal } from "../base/base-dialog.js";
import { NumberInput } from "../../dom/number-input.js";
import { ToggleSwitch } from "../../dom/toggle-switch.js";

loadCss("dialog/explorer/base-explorer-config.css");

// ==============================================
// Base Explorer Config
// ==============================================
export class BaseExplorerConfig extends BaseModal {
    constructor(explorer) {
        super();
        this.explorer = explorer;
        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.overlay.classList.add("jupo-explorer-config-overlay");
        this.element.classList.add("jupo-explorer-config");
        this.content.classList.add("jupo-explorer-config-content");

        // アイテムコンテナ
        this.items = $el("div.jupo-explorer-config-items");
        this.content.append(this.items);

        // fileWidth
        this.fileWidth = new NumberInput({
            defaultValue: this.explorer.getConfig("fileWidth") ?? 150, 
            min: 50, 
            max: 500, 
            step: 10, 
            width: 120, 
            height: 24, 
            onChange: (newValue) => this._handleChangeFileWidth(newValue), 
            dialogTitle: "File Width", 
            dialogMessage: "ファイルアイテムの幅"
        });
        this.addItem("ファイルアイテムの幅", this.fileWidth.element);

        // fileHeight
        this.fileHeight = new NumberInput({
            defaultValue: this.explorer.getConfig("fileHeight") ?? 200, 
            min: 50, 
            max: 500, 
            step: 10, 
            width: 120, 
            height: 24, 
            onChange: (newValue) => this._handleChangeFileHeight(newValue), 
            dialogTitle: "File Height", 
            dialogMessage: "ファイルアイテムの高さ"
        });
        this.addItem("ファイルアイテムの高さ", this.fileHeight.element);

        // ツリー表示
        this.toggleTree = new ToggleSwitch({
            defaultValue: this.explorer.getConfig("visibleTree"), 
            height: 24, 
            onChange: (newValue) => this._handleChangeVisibleTree(newValue), 
        });
        this.addItem("ツリーを表示", this.toggleTree.element);

        // ディレクトリ表示
        this.toggleDirs = new ToggleSwitch({
            defaultValue: this.explorer.getConfig("visibleDirs"), 
            height: 24, 
            onChange: (newValue) => this._handleChangeVisibleDirs(newValue), 
        });
        this.addItem("ディレクトリを表示", this.toggleDirs.element);

        // 仮想スクロール
        this.toggleVirtualScroll = new ToggleSwitch({
            defaultValue: this.explorer.getConfig("useVirtualScroll"),
            height: 24,
            onChange: (newValue) => this._handleChangeUseVirtualScroll(newValue),
        });
        this.addItem("仮想スクロールを使用する (開発中)", this.toggleVirtualScroll.element);

        // プレビュー保存時のサムネイル化
        this.toggleSavePreviewAsThumbnail = new ToggleSwitch({
            defaultValue: this.explorer.getConfig("savePreviewAsThumbnail"),
            height: 24,
            onChange: (newValue) => this._handleChangeSavePreviewAsThumbnail(newValue),
        });
        this.addItem("縮小プレビュー保存 (開発中)", this.toggleSavePreviewAsThumbnail.element);
    }

    // ------------------------------------------
    // ハンドラー
    // ------------------------------------------
    async _handleChangeFileWidth(newValue) {
        await this.explorer.setConfig("fileWidth", newValue);
        this.explorer.filesManager.applyFileWidth(newValue);
    }

    async _handleChangeFileHeight(newValue) {
        await this.explorer.setConfig("fileHeight", newValue);
        this.explorer.filesManager.applyFileHeight(newValue);
    }

    async _handleChangeVisibleTree(newValue) {
        await this.explorer.setConfig("visibleTree", newValue);
        this.explorer.treeManager.applyVisible();
    }

    async _handleChangeVisibleDirs(newValue) {
        await this.explorer.setConfig("visibleDirs", newValue);
        this.explorer.dirsManager.applyVisible();
    }

    async _handleChangeUseVirtualScroll(newValue) {
        await this.explorer.setConfig("useVirtualScroll", newValue);
        await this.explorer.recreateFilesManager();
    }

    async _handleChangeSavePreviewAsThumbnail(newValue) {
        await this.explorer.setConfig("savePreviewAsThumbnail", newValue);
    }


    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    addItem(label, element) {
        const item = $el("div.jupo-explorer-config-item");
        const labelElement = $el("span.jupo-explorer-config-item-label", {
            textContent: label, 
        });
        item.append(labelElement, element);
        this.items.append(item);
    }

    updatePosition(position) {
        const mouseX = position?.x ?? 0;
        const mouseY = position?.y ?? 0;
        const margin = 10;

        // 要素のサイズを取得
        const dialogRect = this.element.getBoundingClientRect();
        const width = dialogRect.width;
        const height = dialogRect.height;

        // 画面(ビューポート)のサイズを取得
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // --- 初期位置 --- 
        let left = mouseX - (width / 2);
        let top = mouseY;
        
        // --- 横位置の計算 ---
        // 右端からはみ出る場合: 画面幅 - 要素幅 - margin
        if (left + width > viewportWidth) {
            left = viewportWidth - width - margin;
        }
        // 左端からはみ出る場合：margin
        if (left < margin) {
            left = margin;
        }

        // --- 縦位置の計算 --- 
        // 下端からはみ出る場合: 画面高さ - 要素高さ - margin
        if (top + height > viewportHeight) {
            top = viewportHeight - height - margin;
        }
        // 上端からはみ出る場合: margin
        if (top < margin) {
            top = margin;
        }

        // ※もし要素が position: absolute で、ページがスクロールされている場合
        // ここで window.scrollX / scrollY を足す必要がある
        // position: fixed ならこのままでOK
        // left += window.scrollX;
        // top += window.scrollY;

        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
    }


    // ------------------------------------------
    // 開く・閉じる
    // ------------------------------------------
    show(position) {
        super.show();
        this.updatePosition(position);
    }
}
