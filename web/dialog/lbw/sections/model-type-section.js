import { $el } from "../../../../../scripts/ui.js";
import { Dropdown } from "../../../dom/dropdown.js";

// ==============================================
// ModelType Section
// ==============================================
export class ModelTypeSection {
    constructor(parent) {
        this.parent = parent;

        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-modeltype-section");

        // ヘッダー
        const header = $el("div.jupo-lbw-section-header");
        const title = $el("span", { textContent: "モデルタイプ" });
        header.append(title);

        // ドロップダウン
        const options = this.parent.getModelTypeOptions();
        this.dropdown = new Dropdown({
            options: options, 
            selectName: "modelType", 
            onChange: (v) => this.handleOnChange(v), 
        });
        this.dropdown.element.classList.add("jupo-modeltype-section-dropdown");

        this.element.append(header, this.dropdown.element);
    }

    // ------------------------------------------
    // ハンドラー
    // ------------------------------------------
    handleOnChange() {
        this.parent.blockSection.createSliders();
    }


    getValue() {
        return this.dropdown.value;
    }

    setValue(v) {
        this.dropdown.select(v);
    }
}