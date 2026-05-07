import { $el } from "../../../scripts/ui.js";
import { apiGet, apiPost, endpoint } from "../utils.js";

// ==============================================
// MediaManager
//  : ローカルにあるメディアファイルの管理
// ==============================================
export class MediaManager {
    constructor() {
        this.packageName = "MediaManager";
    }

    // ------------------------------------------
    // メディア要素を作成
    // ------------------------------------------
    async createMediaElement({ dirName, filePath, signal = null }) {
        const params = new URLSearchParams();
        if (dirName) {
            params.append("dir", dirName);
        }
        if (filePath) {
            params.append("file", filePath);
        }
        const queryString = params.toString();
        const apiPath = queryString
            ? `get_media_data?${queryString}`
            : "get_media_data";
        
        // デフォルトは空のメディア
        let mediaElement = $el("div", { textContent: "No Media "});

        const mediaData = await apiGet(this.packageName, apiPath, { signal });
        if (mediaData.token) {
            const src = endpoint(this.packageName, `serve_media/${mediaData.token}`);
            switch(mediaData.cate) {
                case "image":
                    mediaElement = $el("img", {
                        src: src, 
                        alt: filePath, 
                        loading: "lazy",
                        decoding: "async",
                        fetchPriority: "low",
                    });
                    break;
                case "video":
                    mediaElement = $el("video", {
                        src: src, 
                        volume: 0.5, 
                        muted: true, 
                        loop: true, 
                        loading: "lazy", 
                        preload: "metadata"
                    });
                    break;
                case "audio":
                    mediaElement = $el("audio", {
                        src: src, 
                        volume: 0.5, 
                        loop: true, 
                        preload: "metadata"
                    });
                    break;
                default:
                    break;
            }
        }

        return mediaElement;
    }


    // ------------------------------------------
    // メディアファイルを削除
    // ------------------------------------------
    async removeMediaFile({ dirName, filePath }) {
        await apiPost(this.packageName, "remove_media", {
            dir: dirName, 
            file: filePath
        });
    }

    
    // ------------------------------------------
    // メディアファイルをアップロード
    // ------------------------------------------
    async uploadMediaFile({ dirName, filePath }) {
        await apiPost(this.packageName, "upload_media", {
            dir: dirName, 
            file: filePath
        });
    }


    // ------------------------------------------
    // メディアファイルをダウンロード
    //  mediaType: image / video / audio
    // ------------------------------------------
    async downloadMediaFile({ dirName, filePath, url, mediaType, thumbnail = false, onProgress = null }) {
        const taskId = this.createTaskId();
        const progressPromise = this.watchDownloadProgress(taskId, onProgress);

        try {
            await apiPost(this.packageName, "download_media", {
                dir: dirName,
                file: filePath,
                url: url,
                type: mediaType,
                thumbnail: thumbnail,
                taskId: taskId,
            });
        } finally {
            await progressPromise;
        }
    }

    async watchDownloadProgress(taskId, onProgress) {
        if (!onProgress) return;

        let unknownCount = 0;
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 150));

            const progress = await apiGet(this.packageName, `download_progress?id=${encodeURIComponent(taskId)}`);
            onProgress(progress);

            if (["done", "error"].includes(progress.status)) {
                return;
            }
            if (progress.status === "unknown") {
                unknownCount++;
                if (unknownCount > 40) return;
            } else {
                unknownCount = 0;
            }
        }
    }

    createTaskId() {
        return globalThis.crypto?.randomUUID?.()
            ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}
