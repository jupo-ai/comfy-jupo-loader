import { $el } from "../../../../../scripts/ui.js";
import { MediaManager } from "../../../modules/media-manager.js";

// ==============================================
// Preview Section
// ==============================================
export class PreviewSection {
    constructor(parent) {
        this.parent = parent;
        this.mediaManager = new MediaManager();

        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-preview-section");

        this.mediaContainer = $el("div.jupo-preview-section-media-container");
        const actionContainer = $el("div.jupo-preview-section-actions");

        this.uploadButton = $el("button.jupo-preview-section-upload-button", {
            textContent: "Upload", 
            onclick: () => this.fileInput.click()
        });
        this.fileInput = $el("input", {
            type: "file", 
            accept: "image/*, video/*, audio/*", 
            style: { display: "none" }, 
            onchange: (e) => this.handleFileUpload(e)
        });
        this.deleteButton = $el("button.jupo-preview-section-delete-button", {
            textContent: "Delete", 
            onclick: () => this.handleFileDelete()
        });
        actionContainer.append(this.uploadButton, this.fileInput, this.deleteButton);

        this.element.append(this.mediaContainer, actionContainer);
    }

    // ------------------------------------------
    // ハンドラー
    // ------------------------------------------
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const payload = {
                name: file.name, 
                data: e.target.result
            };
            await this.mediaManager.uploadMediaFile({
                dirName: this.parent.apiDir, 
                filePath: this.parent.modelPath, 
                payload: payload
            });
            await this.refresh();
        };
        reader.onerror = (error) => {
            console.error("ファイルの読み込みに失敗しました:", error);
        }
        reader.readAsDataURL(file);
        
        event.target.value = "";
    }

    async handleFileDelete() {
        if (confirm("メディアファイルを削除しますか？")) {
            await this.mediaManager.removeMediaFile({
                dirName: this.parent.apiDir, 
                filePath: this.parent.modelPath
            });
            await this.refresh();
        }
    }

    // ------------------------------------------
    // クリア
    // ------------------------------------------
    clear() {
        this.mediaContainer.replaceChildren();
    }

    // ------------------------------------------
    // 更新
    // ------------------------------------------
    async refresh() {
        this.clear();

        const media = await this.mediaManager.createMediaElement({
            dirName: this.parent.apiDir, 
            filePath: this.parent.modelPath
        });

        media.classList.add("jupo-preview-section-media");
        const tag = media.tagName;

        switch(tag) {
            case "VIDEO":
                media.classList.add("jupo-preview-section-media--video");
                media.controls = true;
                media.autoplay = true;
                break;
            
            case "AUDIO":
                media.classList.add("jupo-preview-section-media--audio");
                media.controls = true;
                break;
            
            case "DIV":
                media.classList.add("jupo-preview-section-media--empty");
        }
        this.mediaContainer.replaceChildren(media);
    }
}