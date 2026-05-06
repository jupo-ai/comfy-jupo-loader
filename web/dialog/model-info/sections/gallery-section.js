import { $el } from "../../../../../scripts/ui.js";
import { MediaManager } from "../../../modules/media-manager.js";
import { BaseModal } from "../../base/base-dialog.js";

// ==============================================
// Gallery Section
// ==============================================
export class GallerySection {
    constructor(parent) {
        this.parent = parent;
        this.mediaManager = new MediaManager();
        this.modal = new GalleryModal();

        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-gallery-section");

        const header = $el("div.jupo-gallery-section-header");
        const title = $el("span.jupo-gallery-section-header-title", {
            textContent: "ギャラリー"
        });
        this.counter = $el("span.jupo-gallery-section-header-counter", {
            textContent: "0"
        });
        header.append(title, this.counter);

        this.items = $el("div.jupo-gallery-section-items");
        this.element.append(header, this.items);
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    addGalleryItem(image, index) {
        if (!image.url) return;

        const isVideo = image.type === "video" || this.isVideo(image.url);
        const item = $el("div.jupo-gallery-section-item");

        item.addEventListener('click', (e) => {
            if (!e.target.closest(".jupo-gallery-section-item-action")) {
                this.modal.show(image, index, isVideo);
            }
        });

        const saveButton = $el("button.jupo-gallery-section-item-action", {
            textContent: "📌", 
            title: "プレビューとして保存", 
            onclick: async (e) => {
                if (confirm("プレビューとして保存しますか？")) {
                    await this.mediaManager.downloadMediaFile({
                        dirName: this.parent.apiDir, 
                        filePath: this.parent.modelPath, 
                        url: image.url, 
                        mediaType: isVideo ? "video" : "image"
                    });
                    await this.parent.previewSection?.refresh();
                }
            }
        });

        const actions = $el("div.jupo-gallery-section-item-actions", [ saveButton ]);
        item.append(actions);

        if (isVideo) {
            let url = image.url;
            url = url.replace("original=true", "transcode=true,width=450,optimized=true");
            const video = $el("video.jupo-gallery-section-item-media", {
                src: url, 
                muted: true, 
                loop: true, 
                preload: "metadata"
            });
            item.addEventListener("mouseenter", () => {
                video.play().catch(e => {});
            });
            item.addEventListener("mouseleave", () => {
                video.pause();
                video.currentTime = 0;
            });
            item.append(video);
        } else {
            let url = image.url;
            url = url.replace("original=true", "anim=false,width=450,optimized=true");
            const img = $el("img.jupo-gallery-section-item-media", {
                src: url, 
                alt: image.meta?.prompt || `Gallery image ${index}`, 
                loading: "lazy"
            });
            item.append(img);
        }
        
        this.items.append(item);
    }

    isVideo(url) {
        const exts = [".mp4", ".webp", ".mov", ".avi"];
        return exts.some(ext => url.toLowerCase().includes(ext));
    }

    updateCount(count) {
        this.counter.textContent = count.toString();
    }

    // ------------------------------------------
    // クリア
    // ------------------------------------------
    clear() {
        this.items.replaceChildren();
        this.updateCount(0);
    }

    // ------------------------------------------
    // ギャラリー表示
    // ------------------------------------------
    displayGallery(images) {
        if (!images || !Array.isArray(images) || images.length === 0) {
            const empty = $el("div.jupo-gallery-section-item--empty", [
                $el("div", { textContent: "Empty" })
            ]);
            this.items.replaceChildren(empty);
            return;
        }

        images.forEach((image, index) => {
            this.addGalleryItem(image, index);
        });
        this.updateCount(images.length);
    }


    // ------------------------------------------
    // 更新
    // ------------------------------------------
    async refresh() {
        this.clear();

        const civitai = this.parent.infoData?.civitai;
        const archive = this.parent.infoData?.archive;
        let images;
        if (civitai) images = civitai.images;
        else if (archive) images = archive.model?.version?.images;

        this.displayGallery(images);
    }

}



// ==============================================
// Gallery Modal
// ==============================================
class GalleryModal extends BaseModal {
    constructor() {
        super();
        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element.classList.add("jupo-gallery-modal");
        this.content.classList.add("jupo-gallery-modal-content");
        
        this.mediaContainer = $el("div.jupo-gallery-modal-media-container");
        this.infoContainer = $el("div.jupo-gallery-modal-info-container");
        this.container = $el("div.jupo-gallery-modal-container", [
            this.mediaContainer, this.infoContainer
        ]);
        this.content.append(this.container);
    }

    createMedia(image, index, isVideo) {
        let media;
        if (isVideo) {
            media = $el("video.jupo-gallery-modal-media", {
                src: image.url, 
                muted: true, 
                loop: true, 
                controls: true, 
                autoplay: true, 
                preload: "metadata"
            });
        } else {
            media = $el("img.jupo-gallery-modal-media", {
                src: image.url, 
                alt: image.meta?.prompt || `Gallery image ${index}`, 
                loading: "lazy"
            });
        }
        this.mediaContainer.replaceChildren(media);
    }

    createInfo(image) {
        const link = $el("a", {
            href: image.url, 
            textContent: "LINK", 
            target: "_blank", 
        });

        this.addInfoItem("リンク", link);
        this.addInfoItem("ポジティブ", image.meta?.prompt);
        this.addInfoItem("ネガティブ", image.meta?.negativePrompt);
        this.addInfoItem("モデル", image.meta?.Model);
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    addInfoItem(label, value) {
        const displayValue = value ?? "";
        const valueElement = typeof displayValue === "string"
            ? $el("span.jupo-gallery-modal-info-value", { textContent: displayValue })
            : displayValue;
        const labelElement = $el("div.jupo-gallery-modal-info-label", { 
            textContent: label
        });

        const item = $el("div.jupo-gallery-modal-info-item", [
            labelElement, valueElement
        ]);
        this.infoContainer.append(item);
    }

    // ------------------------------------------
    // クリア
    // ------------------------------------------
    clear() {
        this.mediaContainer.replaceChildren();
        this.infoContainer.replaceChildren();
    }

    // ------------------------------------------
    // 開く
    // ------------------------------------------
    show(image, index, isVideo) {
        super.show();

        this.clear();
        this.createMedia(image, index, isVideo);
        this.createInfo(image);
    }
}