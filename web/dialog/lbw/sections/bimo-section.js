import { $el } from "../../../../../scripts/ui.js";

// ==============================================
// BIMO Section
// ==============================================
export class BimoSection {
    constructor(parent) {
        this.parent = parent;

        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-bimo-section");

        // ヘッダー
        const header = $el("div.jupo-lbw-section-header");
        const title = $el("span", { textContent: "BIMO構文" });
        header.append(title);

        // 入力欄
        this.input = $el("input.jupo-bimo-section-input");
        this.input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                this.handleApply();
            }
        });

        this.button = $el("button.jupo-bimo-section-button", {
            textContent: "適用", 
            onclick: () => this.handleApply()
        });
        const container = $el("div.jupo-bimo-section-container");
        container.append(this.input, this.button);

        this.element.append(header, container);
    }

    // ------------------------------------------
    // BIMO構文適用
    // ------------------------------------------
    handleApply() {
        const bimo = this.input.value;
        if (!this._validateBIMO(bimo)) {
            this.input.select();
            return;
        }

        const blockConfig = this.parent.getCurrentBlockConfig();
        const mapping = {};

        // 各文字他オプを処理する関数
        const blockSection = this.parent.blockSection;

        function processCharType(charPattern, configKey) {
            const chars = bimo.match(charPattern) || [];
            if (chars.length > 0 && blockConfig[configKey]) {
                const items = blockConfig[configKey];
                const baseItemsPerChar = Math.floor(items.length / chars.length);
                const remainder = items.length % chars.length;
                
                let currentIndex = 0;
                chars.forEach((char, index) => {
                    const value = char === char.toUpperCase() ? 1 : 0;
                    const itemsForThisChar = baseItemsPerChar + (index < remainder ? 1 : 0);
                    
                    for (let i = 0; i < itemsForThisChar; i++) {
                        if (currentIndex < items.length) {
                            const keys = blockSection.getSearchKeys(items[currentIndex]);
                            keys.forEach(key => {
                                mapping[key] = value;
                            });
                            currentIndex++;
                        }
                    }
                });
            }
        }

        // 各文字タイプを処理
        processCharType(/[bB]/g, "upper");
        processCharType(/[iI]/g, "left");
        processCharType(/[mM]/g, "bottom");
        processCharType(/[oO]/g, "right");

        // スライダーに値を適用
        for (const [key, value] of Object.entries(mapping)) {
            this.parent.blockSection.applyValue(key, value);
        }
    }

    _validateBIMO(text) {
        // text がBIMO構文か判定
        // b, i, m, o 以外の文字が含まれていないかチェック
        const allowedChars = /^[bimo]+$/i;
        if (!allowedChars.test(text)) {
            alert("BIMO構文エラー: B, I, M, O以外の文字が含まれています");
            return false;
        }

        return true;
    }
}
