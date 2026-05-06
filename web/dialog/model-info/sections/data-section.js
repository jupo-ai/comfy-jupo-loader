import { $el } from "../../../../../scripts/ui.js";
import { IconButton } from "../../../dom/icon.js";
import { BaseModal } from "../../base/base-dialog.js";

// ==============================================
// Data Section
// ==============================================
export class DataSection {
    constructor(title) {
        this.title = title;
        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-data-section");

        // ヘッダー
        const header = $el("div.jupo-data-section-header");
        const title = $el("span", { textContent: this.title });
        this.buttons = $el("div.jupo-data-section-header-buttons");
        header.append(title, this.buttons);
        this.element.append(header);

        // アイテムコンテナ
        this.items = $el("div.jupo-data-section-items");
        this.element.append(this.items);
    }

    // ------------------------------------------
    // アイテム追加
    //  : valueは文字列 or Element
    // ------------------------------------------
    addItem(label, value) {
        const displayValue = value ?? "";
        const valueElement = typeof displayValue === "string"
            ? $el("span.jupo-data-section-item-value", { textContent: displayValue })
            : displayValue;
        
        const labelElement = $el("div.jupo-data-section-item-label", { textContent: label });

        const item = $el("div.jupo-data-section-item", [
            labelElement, valueElement
        ]);
        this.items.append(item);
    }

    addButton(data) {
        const button = new IconButton({
            icon: "file", 
            title: "データを表示", 
            onClick: () => this.displayRawData(data)
        });
        this.buttons.append(button.element);
    }

    // ------------------------------------------
    // 生データを表示
    // ------------------------------------------
    displayRawData(data) {
        const dialog = new RawDataDialog(data);
        dialog.show();
    }

    // ------------------------------------------
    // クリア
    // ------------------------------------------
    clear() {
        this.items.replaceChildren();
        this.buttons.replaceChildren();
    }
}



// ==============================================
// RawData Dialog
// ==============================================
class RawDataDialog extends BaseModal {
    constructor(data) {
        super();
        this.data = data;
        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element.classList.add("jupo-data-dialog");
        this.content.classList.add("jupo-data-dialog-content");

        const formattedData = this.formatData(this.data);
        this.dataContainer = $el("pre.jupo-data-dialog-data", {
            textContent: formattedData
        });
        this.content.append(this.dataContainer);
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    formatData(data) {
        if (data === undefined || data === null) {
            return "";
        }

        if (typeof data === "string") {
            const trimmed = data.trim();
            if (!trimmed) return "";

            try {
                return JSON.stringify(JSON.parse(trimmed), null, 2);
            } catch {
                return data;
            }
        }
        
        if (typeof data === "object") {
            try {
                return JSON.stringify(data, null, 2);
            } catch {
                return String(data);
            }
        }

        return String(data);
    }
}