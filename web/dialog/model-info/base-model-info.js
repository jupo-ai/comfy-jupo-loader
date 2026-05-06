import { $el } from "../../../../scripts/ui.js";
import { loadCss, apiGet, apiPost, mkName } from "../../utils.js";
import { BaseModal } from "../base/base-dialog.js";
import { DataSection } from "./sections/data-section.js";
import { PreviewSection } from "./sections/preview-section.js";
import { GallerySection } from "./sections/gallery-section.js";
import { TriggerSection } from "./sections/trigger-section.js";

loadCss("dialog/model-info/base-model-info.css");

// ==============================================
// Base Model Info
// ==============================================
export class BaseModelInfo extends BaseModal {
    constructor({ modelPath, onClosed }) {
        super();

        this.modelPath = modelPath;
        this.onClosed = onClosed;
        
        this.isLoading = false;
        this.infoData = {};
        this.apiDir = null;

        this.setupSections();
        this.createUI();
    }

    // ------------------------------------------
    // セットアップ
    // ------------------------------------------
    setupSections() {
        this.userSection = new DataSection("ユーザーデータ");
        this.metadataSection = new DataSection("メタデータ");
        this.civitaiSection = new DataSection("Civitai");
        this.previewSection = new PreviewSection(this);
        this.gallerySection = new GallerySection(this);
        this.triggerSection = new TriggerSection(this);
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createToolButtons() {
        super.createToolButtons();

        this.addToolButton({
            icon: "refresh", 
            title: "更新", 
            onClick: () => this.refresh(true)
        });
    }

    createUI() {
        this.element.classList.add("jupo-model-info");
        this.content.classList.add("jupo-model-info-content");
        
        // ヘッダー
        const header = $el("div.jupo-model-info-header");
        const title = $el("span.jupo-model-info-header-title", {
            textContent: this.modelPath
        });
        this.headerStatus = $el("span.jupo-model-info-header-status");
        header.append(title, this.headerStatus);

        // ボディ
        const body = $el("div.jupo-model-info-body");

        // dataArea: user + metadata + civitai
        const dataArea = $el("div.jupo-model-info-data-area");
        dataArea.append(
            this.userSection.element, 
            this.metadataSection.element, 
            this.civitaiSection.element
        );

        // previewArea
        const previewArea = $el("div.jupo-model-info-preview-area");
        previewArea.append(this.previewSection.element);

        // galleryArea
        const galleryArea = $el("div.jupo-model-info-gallery-area");
        galleryArea.append(this.gallerySection.element);

        // triggerArea
        const triggerArea = $el("div.jupo-model-info-trigger-area");
        triggerArea.append(this.triggerSection.element);

        body.append(
            dataArea, previewArea, galleryArea, triggerArea
        );
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

            await this.refreshUserSection();
            await this.refreshMetadataSection();
            await this.refreshCivitaiSection();
            await this.previewSection.refresh();
            await this.gallerySection.refresh();
            await this.triggerSection.refresh();

            this.setHeaderStatus("完了");

        } catch(error) {
            this.setHeaderStatus(`エラーが発生しました: ${error}`, true);
            console.error(error);
        } finally {
            this.isLoading = false;
        }
    }

    // ------------------------------------------
    // DataSectionの更新
    //  : 継承クラスで実装
    // ------------------------------------------
    async refreshUserSection() {};
    async refreshMetadataSection() {};
    async refreshCivitaiSection() {};


    // ------------------------------------------
    // InfoDataの取得・保存
    // ------------------------------------------
    async getInfoData(force) {
        this.infoData = await apiPost("ModelInfo", "get_info_data", {
            dir: this.apiDir, 
            file: this.modelPath, 
            force: force
        });
    }

    async saveInfoData() {
        // ユーザーが編集可能箇所 -> userSection, triggerSection
        this.saveUserSection();
        this.saveTriggerSection();

        await apiPost("ModelInfo", "save_info_data", {
            dir: this.apiDir, 
            file: this.modelPath, 
            data: this.infoData
        });
    }

    saveUserSection() {}; // 継承クラスで実装

    saveTriggerSection() {
        this.infoData.user = this.infoData.user ?? {};
        this.infoData.user.triggerWord = this.triggerSection.getTextValue();
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