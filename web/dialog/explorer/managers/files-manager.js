import { $el } from "../../../../../scripts/ui.js";
import { MediaManager } from "../../../modules/media-manager.js";

// ==============================================
// Files Manager
//  : 画面右側、ファイルビューの管理
// ==============================================
export class FilesManager {
    constructor(parent, useNewFile) {
        this.parent = parent;
        this.useNewFile = useNewFile ?? false;
        this.mediaManager = new MediaManager();

        // --- UI Elements ---
        this.element = null;
        this.labelText = null;
        this.items = null;

        // --- Async Control ---
        this.abortController = null;
        this.displayId = 0; // 最新の表示リクエストを識別するためのID

        // --- Lazy Loading ---
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.handleIntersection(entry.target);
                }
            });
        }, {
            root: this.items,
            rootMargin: "100px",
            threshold: 0
        });

        // --- Scroll Preservation ---
        this.lastDirPath = null;
        this.lastScrollTop = 0;

        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-explorer-files");

        this.labelText = $el("span", { textContent: "📄 ファイル" });
        const label = $el("div.jupo-explorer-files-label", [this.labelText]);

        this.items = $el("div.jupo-explorer-files-items");

        this.element.append(label, this.items);
    }

    // ------------------------------------------
    // 指定されたディレクトリのファイルを表示
    // ------------------------------------------
    async display(node) {
        // 既存の表示処理が進行中であれば中断シグナルを送る
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        // 新しい表示ごとにユニークなIDを発行
        const currentDisplayId = ++this.displayId;

        // --- Scroll Position Preservation Logic ---
        const currentScroll = this.items.scrollTop;
        const isSameDir = this.lastDirPath === node.path;

        // ディレクトリが変更された場合はスクロール位置をリセット
        // 同じディレクトリなら前回の維持 (refresh等の場合)
        if (!isSameDir) {
            this.lastScrollTop = 0;
        } else {
            // refresh前にスクロール位置を保存するのは呼び出し側ではなくここで行うのが確実
            // ただし display呼び出し前に itemsがクリアされるわけではないので
            // ここで currentScroll を取得してもよいが、
            // displayが呼ばれる＝中身が書き換わる直前 なのでここで保存する
            this.lastScrollTop = currentScroll;
        }

        this.items.replaceChildren(); // 即座にコンテナをクリアし、UIの応答性を保つ

        // オブザーバーの監視解除
        this.observer.disconnect();

        // 新規作成ボタンを最初に追加
        if (this.parent.newFileMode && this.parent.onNewFileSelected) {
            const newFileItem = this.createNewFileItem();
            this.items.append(newFileItem);
        }

        const files = node.children.filter(c => c.type === "file");

        try {
            for (const file of files) {
                // ループの各所で、処理が古くなっていないか or 中断されていないかを確認
                if (this.displayId !== currentDisplayId || signal.aborted) return;

                const item = this.createItem(file);

                // 遅延読み込みのためにデータを付与して監視開始
                item.__fileData = { file, signal };
                this.observer.observe(item);

                // 非同期処理の完了後、DOMに追加する直前に再度チェック（最重要）
                // これにより、古いdisplay呼び出しの結果が描画されるのを防ぐ
                if (this.displayId !== currentDisplayId || signal.aborted) return;

                this.items.append(item);
            }

            // アイテム追加完了後、スクロール位置を復元
            if (isSameDir) {
                requestAnimationFrame(() => {
                    this.items.scrollTop = this.lastScrollTop;
                });
            } else {
                this.items.scrollTop = 0;
            }

        } catch (error) {
            // ユーザー操作による中断は正常な動作なのでエラー表示しない
            if (error.name !== 'AbortError') {
                console.error("Failed to display files:", error);
            }
        }
        // Save current path
        this.lastDirPath = node.path;
    }

    // ------------------------------------------
    // 遅延読み込みハンドラ
    // ------------------------------------------
    async handleIntersection(item) {
        // 一度読み込みを開始したら監視対象から外す
        this.observer.unobserve(item);

        const data = item.__fileData;
        if (!data) return;

        await this.loadMedia(data.file, item, data.signal);
    }

    // ------------------------------------------
    // アイテム作成とメディア読み込み
    // ------------------------------------------
    createItem(file) {
        const width = this.parent.getConfig("fileWidth");
        const height = this.parent.getConfig("fileHeight");

        const item = $el("div.jupo-explorer-files-item", {
            title: "",
            style: {
                width: `${width}px`,
                height: `${height}px`
            }
        });
        item.addEventListener("click", (e) => {
            // アクションボタンのクリックは除外
            if (!e.target.closest(".jupo-explorer-files-item-action")) {
                this.parent.onFileSelectedCallback(file);
            }
        });

        // オーバーレイとアクションボタンのコンテナを先に追加
        const overlay = $el("div.jupo-explorer-files-item-overlay");
        const actions = $el("div.jupo-explorer-files-item-actions");
        item.append(overlay, actions);

        // ファイル情報に基づいたUI要素を設定
        this.parent.setFileTitle(file, item);
        this.parent.setFileOverlay(file, item);
        this.parent.setFileActions(file, item);
        return item;
    }

    // ------------------------------------------
    // 新規作成ボタンアイテム作成
    // ------------------------------------------
    createNewFileItem() {
        const width = this.parent.getConfig("fileWidth");
        const height = this.parent.getConfig("fileHeight");

        const item = $el("div.jupo-explorer-files-item.new-item", {
            title: "新規作成",
            style: {
                width: `${width}px`,
                height: `${height}px`
            }
        });

        item.addEventListener("click", () => {
            this.parent.onNewFileSelected?.();
        });

        const icon = $el("i.mdi.mdi-plus-circle");
        item.append(icon);

        return item;
    }

    async loadMedia(node, item, signal) {
        const mediaEl = await this.mediaManager.createMediaElement({
            dirName: this.parent.apiDir,
            filePath: node.path,
            signal: signal
        });

        // 処理中に中断された場合は何もしない
        if (signal?.aborted) return;

        mediaEl.classList.add("jupo-explorer-files-item-media");

        // メディアの種類に応じたイベントリスナーを設定
        this.setupMediaEventListeners(item, mediaEl);

        item.prepend(mediaEl);
    }

    setupMediaEventListeners(item, mediaEl) {
        const playMedia = () => mediaEl.play().catch(e => { });
        const pauseMedia = () => {
            mediaEl.pause();
            mediaEl.currentTime = 0;
        };

        switch (mediaEl.tagName) {
            case "VIDEO":
            case "AUDIO":
                item.addEventListener("mouseenter", playMedia);
                item.addEventListener("mouseleave", pauseMedia);
                break;
            case "DIV": // メディアがない場合のプレースホルダー
                mediaEl.classList.add("empty");
                break;
            case "IMG":
            default:
                // IMGタグやその他の要素には特別なイベントは不要
                break;
        }
    }

    // ------------------------------------------
    // 外部からアイテムの要素を追加するためのヘルパーメソッド
    // ------------------------------------------
    addFileTitle(text, item) {
        if (!text) return;
        item.title = [item.title, text].filter(Boolean).join("\n");
    }

    addFileOverlay(text, item) {
        if (!text) return;
        const overlay = item.querySelector(".jupo-explorer-files-item-overlay");
        if (overlay) {
            const overlayText = $el("p", { textContent: text });
            overlay.append(overlayText);
        }
    }

    addFileActionButton({ item, icon, title, onClick }) {
        const actions = item.querySelector(".jupo-explorer-files-item-actions");
        if (actions) {
            const button = $el("button.jupo-explorer-files-item-action", {
                title: title,
                onclick: (e) => {
                    e.stopPropagation();
                    onClick?.();
                }
            }, [
                $el(`i.mdi.mdi-${icon}`)
            ]);
            actions.prepend(button);
        }
    }


    // ------------------------------------------
    // 外部から表示中のアイテムの大きさを変えるヘルパーメソッド
    // ------------------------------------------
    applyFileWidth(newWidth) {
        const items = this.items.querySelectorAll(".jupo-explorer-files-item");
        items.forEach(item => {
            item.style.width = `${newWidth}px`;
        });
    }

    applyFileHeight(newHeight) {
        const items = this.items.querySelectorAll(".jupo-explorer-files-item");
        items.forEach(item => {
            item.style.height = `${newHeight}px`;
        });
    }

    // ------------------------------------------
    // 表示制御
    // ------------------------------------------
    forceShow() {
        this.element.style.display = "block";
    }

    forceHide() {
        this.element.style.display = "none";
    }
}