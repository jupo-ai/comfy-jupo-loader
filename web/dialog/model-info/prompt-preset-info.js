import { $el } from "../../../../scripts/ui.js";
import { apiPost } from "../../utils.js";
import { BaseModal } from "../base/base-dialog.js";
import { BaseModelInfo } from "./base-model-info.js"; // css読み込みのため
import { DataSection } from "./sections/data-section.js";
import { PreviewSection } from "./sections/preview-section.js";


// ==============================================
// Prompt Preset Info
// ==============================================
export class PromptPresetInfo extends BaseModal {
    constructor({ filePath, onClosed }) {
        super();

        this.filePath = filePath;
        this.onClosed = onClosed;

        this.isLoading = false;
        this.infoData = {};
        
        // PreviewSection用のプロパティ
        this.apiDir = "prompt_preset";
        this.modelPath = filePath;
        
        this.setupSections();
        this.createUI();
    }

    // ------------------------------------------
    // セットアップ
    // ------------------------------------------
    setupSections() {
        this.presetSection = new DataSection("プリセット");
        this.previewSection = new PreviewSection(this);
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createToolButtons() {
        super.createToolButtons();

        this.addToolButton({
            icon: "refresh", 
            title: "更新", 
            onClick: () => this.refresh(true), 
        });
    }

    createUI() {
        this.element.classList.add("jupo-model-info");
        this.content.classList.add("jupo-model-info-content");

        // ヘッダー
        const header = $el("div.jupo-model-info-header");
        const title = $el("div.jupo-model-info-header-title", {
            textContent: this.filePath
        });
        this.headerStatus = $el("span.jupo-model-info-header-status");
        header.append(title, this.headerStatus);

        // ボディ
        const body = $el("div.jupo-model-info-body");

        // dataArea: user
        const dataArea = $el("div.jupo-model-info-data-area");
        dataArea.append(this.presetSection.element);

        // previewArea
        const previewArea = $el("div.jupo-model-info-preview-area");
        previewArea.append(this.previewSection.element);

        body.append(dataArea, previewArea);
        this.content.append(header, body);
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    setHeaderStatus(status, isError = false) {
        this.headerStatus.textContent = status;
        this.headerStatus.classList.toggle("jupo-model-info-header-status--error", isError);
    }

    
    // ------------------------------------------
    // 更新
    // ------------------------------------------
    async refresh(force = false) {
        this.isLoading = true;

        try {
            this.setHeaderStatus("データ取得中...");
            await this.getInfoData(force);

            await this.refreshPresetSection();
            await this.previewSection.refresh();

            this.setHeaderStatus("完了");
        
        } catch (error) {
            this.setHeaderStatus(`エラーが発生しました: ${error}`, true);
            console.error(error);
        } finally {
            this.isLoading = false;
        }
    }

    // ------------------------------------------
    // DataSectionの更新
    // ------------------------------------------
    async refreshPresetSection() {
        this.presetSection.clear();
        this.presetSection.addButton(this.infoData);

        // displayName
        this.displayNameInput = $el("input", { type: "text" });
        this.displayNameInput.value = this.infoData.displayName || "";
        this.presetSection.addItem("表示名", this.displayNameInput);

        // desc
        this.descInput = $el("textarea", { spellcheck: false });
        this.descInput.value = this.infoData.desc || "";
        this.presetSection.addItem("説明", this.descInput);

        // prompt
        this.promptInput = $el("textarea", { spellcheck: false });
        this.promptInput.value = this.infoData.prompt || "";
        this.presetSection.addItem("プロンプト", this.promptInput);
    }


    // ------------------------------------------
    // presetSectionの保存
    // ------------------------------------------
    savePresetSection() {
        const displayName = this.displayNameInput.value;
        const desc = this.descInput.value;
        const prompt = this.promptInput.value;

        this.infoData = this.infoData ?? {};
        this.infoData.displayName = displayName;
        this.infoData.desc = desc;
        this.infoData.prompt = prompt;
    }


    // ------------------------------------------
    // InfoDataの取得・保存
    // ------------------------------------------
    async getInfoData(force) {
        this.infoData = await apiPost("String/PromptPreset", "get_preset_data", {
            file: this.filePath, 
            force: force, 
        });
    }

    async saveInfoData() {
        this.savePresetSection();

        await apiPost("String/PromptPreset", "save_preset_data", {
            file: this.filePath, 
            data: this.infoData, 
        });
    }


    // ------------------------------------------
    // 開く・閉じる
    // ------------------------------------------
    async show() {
        await super.show();
        await this.refresh();
    }

    async close() {
        if (!this.isLoading) {
            await this.saveInfoData();
            await this.onClosed?.(this.infoData);
            await super.close();
        }
    }
}