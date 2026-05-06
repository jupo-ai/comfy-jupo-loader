import { app } from "../../../../../scripts/app.js";
import { $el } from "../../../../../scripts/ui.js";
import { TextareaCaretManager } from "../../../modules/caret-manager.js";

// ==============================================
// Trigger Section
// ==============================================
export class TriggerSection {
    constructor(parent) {
        this.parent = parent;
        this.createUI();
        this.caretManager = new TextareaCaretManager(this.textArea, () => app.canvas.ds.scale);
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-trigger-section");

        const header = $el("div.jupo-trigger-section-header");
        const title = $el("span", { textContent: "トリガーワード" });
        const clearButton = $el("button", {
            textContent: "クリア", 
            onclick: () => this.textArea.value = "", 
        });
        header.append(title, clearButton);

        this.buttons = $el("div.jupo-trigger-section-buttons");
        
        this.textArea = $el("textarea.jupo-trigger-section-textarea", {
            placeholder: "トリガーワードをここに入力...", 
            spellcheck: false, 
        });

        this.element.append(header, this.buttons, this.textArea);
    }

    // ------------------------------------------
    // 更新
    // ------------------------------------------
    async refresh() {
        this.clear();

        // buttons
        const civitai = this.parent.infoData?.civitai;
        const archive = this.parent.infoData?.archive;

        let words = [];
        if (civitai) words = civitai.trainedWords;
        else if (archive) words = archive.model?.version?.trigger;

        if (!words || !Array.isArray(words) || words.length === 0) {
            this.showEmpty();
        } else {
            words.forEach(word => this.addTriggerButton(word));
        }

        // textarea
        this.textArea.value = this.parent.infoData?.user?.triggerWord || "";
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    clear() {
        this.buttons.replaceChildren();
        this.textArea.value = "";
    }

    addTriggerButton(word) {
        const parsedWord = word.trim().replace(/,+$/, "");

        const button = $el("button.jupo-trigger-section-button", {
            textContent: parsedWord, 
            onclick: () => this.insertWord(parsedWord)
        });
        this.buttons.append(button);
    }

    showEmpty() {
        const empty = $el("div.jupo-trigger-section-empty", {
            textContent: "トリガーワードが登録されていません"
        });
        this.buttons.replaceChildren(empty);
    }

    insertWord(word) {
        this.textArea.focus();

        let insertValue = word.trim();
        if (!insertValue.endsWith(",")) insertValue += ",";
        insertValue += " ";

        const replaceLength = 0;

        this.caretManager.insertAtCursor(insertValue, replaceLength);
    }

    getTextValue() {
        return this.textArea.value;
    }
}
