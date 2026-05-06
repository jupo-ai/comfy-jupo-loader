import { $el } from "../../../../scripts/ui.js";
import { BaseModelInfo } from "./base-model-info.js";

// ==============================================
// Lora Info
// ==============================================
export class LoraInfo extends BaseModelInfo {
    constructor({ modelPath, onClosed }) {
        super({ modelPath, onClosed });

        this.apiDir = "loras";
    }

    // ------------------------------------------
    // DataSectionの更新
    // ------------------------------------------
    refreshUserSection() {
        this.userSection.clear();
        this.userSection.addButton(this.infoData.user);

        // displayName
        this.displayNameInput = $el("input", { type: "text" });
        this.displayNameInput.value = this.infoData.user?.displayName || "";
        this.userSection.addItem("表示名", this.displayNameInput);

        // desc
        this.descInput = $el("textarea", { spellcheck: false });
        this.descInput.value = this.infoData.user?.desc || "";
        this.userSection.addItem("説明", this.descInput);
    }

    refreshMetadataSection() {
        this.metadataSection.clear();
        this.metadataSection.addButton(this.infoData.metadata);
        this.metadataSection.addItem(
            "モジュール", 
            this.infoData.metadata?.ss_network_module
        );
        this.metadataSection.addItem(
            "推論", 
            this.infoData.metadata?.["modelspec.prediction_type"]
        );
    }

    refreshCivitaiSection() {
        this.civitaiSection.clear();
        const civitai = this.infoData.civitai;
        const archive = this.infoData.archive;

        if (civitai) {
            this.civitaiSection.addButton(civitai);

            const url = `https://civitai.com/models/${civitai.modelId}?modelVersionId=${civitai.id}`;
            const link = $el("a", {
                href: url, 
                textContent: "Civitai", 
                target: "_blank", 
            });
            this.civitaiSection.addItem("リンク", link);
            this.civitaiSection.addItem("ベースモデル", civitai.baseModel);

        } else if (archive) {
            this.civitaiSection.addButton(archive);

            const url = archive.model?.meta?.canonical;
            const link = url ? $el("a", {
                href: url, 
                textContent: "Cvi Archive", 
                target: "_blank", 
            }) : null;
            this.civitaiSection.addItem("リンク", link);
            this.civitaiSection.addItem("ベースモデル", archive.model?.version?.baseModel);

        } else {
            this.civitaiSection.addItem("リンク", null);
            this.civitaiSection.addItem("ベースモデル", null);
        }
    }


    // ------------------------------------------
    // UserSectionの保存
    // ------------------------------------------
    saveUserSection() {
        const displayName = this.displayNameInput.value;
        const desc = this.descInput.value;

        this.infoData.user = this.infoData.user ?? {};
        this.infoData.user.displayName = displayName;
        this.infoData.user.desc = desc;
    }
}