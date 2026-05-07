import { $el } from "../../../../../scripts/ui.js";
import { FilesManager } from "./files-manager.js";

// ==============================================
// Files Manager Virtual
//  : 開発中の仮想スクロール版ファイルビュー
// ==============================================
export class FilesManagerVirtual extends FilesManager {
    constructor(parent, useNewFile) {
        super(parent, useNewFile);

        this.files = [];
        this.renderedItems = new Map();
        this.scrollRoot = null;
        this.resizeObserver = null;
        this.rafId = null;
        this.layout = null;
        this.virtualDisplayId = 0;

        this.handleScroll = () => this.scheduleRender();
        this.handleResize = () => {
            this.layout = null;
            this.observer.disconnect();
            this.renderedItems.clear();
            this.items.replaceChildren();
            this.scheduleRender();
        };
    }

    createUI() {
        this.element = $el("div.jupo-explorer-files");

        this.labelText = $el("span", { textContent: "📄 ファイル" });
        const label = $el("div.jupo-explorer-files-label", [this.labelText]);

        this.items = $el("div.jupo-explorer-files-items.jupo-explorer-files-items--virtual");

        this.element.append(label, this.items);
    }

    getScrollRoot() {
        return this.parent.viewContainer ?? this.element.closest(".jupo-explorer-view");
    }

    setupScrollListeners() {
        const scrollRoot = this.getScrollRoot();
        if (this.scrollRoot === scrollRoot) return;

        this.scrollRoot?.removeEventListener("scroll", this.handleScroll);
        this.resizeObserver?.disconnect();

        this.scrollRoot = scrollRoot;
        this.scrollRoot?.addEventListener("scroll", this.handleScroll, { passive: true });

        if (this.scrollRoot) {
            this.resizeObserver = new ResizeObserver(this.handleResize);
            this.resizeObserver.observe(this.scrollRoot);
            this.resizeObserver.observe(this.items);
        }
    }

    async display(node) {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        this.virtualDisplayId++;
        this.displayId++;
        this.observer.disconnect();
        this.renderedItems.clear();
        this.items.replaceChildren();

        this.files = node.children.filter(c => c.type === "file");
        if (this.parent.newFileMode && this.parent.onNewFileSelected) {
            this.files = [{ type: "new-file" }, ...this.files];
        }

        const currentScroll = this.scrollRoot?.scrollTop ?? 0;
        const isSameDir = this.lastDirPath === node.path;
        this.lastScrollTop = isSameDir ? currentScroll : 0;
        this.lastDirPath = node.path;
        this.layout = null;

        this.setupScrollListeners();
        this.updateLayout();

        if (this.scrollRoot) {
            this.scrollRoot.scrollTop = this.lastScrollTop;
        }

        this.renderVisibleItems();
    }

    updateLayout() {
        const width = this.parent.getConfig("fileWidth");
        const height = this.parent.getConfig("fileHeight");
        const gap = 20;
        const paddingLeft = 16;
        const paddingTop = 10;
        const availableWidth = Math.max(1, this.items.clientWidth - paddingLeft);
        const columns = Math.max(1, Math.floor((availableWidth + gap) / (width + gap)));
        const rowHeight = height + gap;
        const rows = Math.ceil(this.files.length / columns);
        const contentHeight = paddingTop + Math.max(0, rows * rowHeight - gap);

        this.layout = {
            width,
            height,
            gap,
            paddingLeft,
            paddingTop,
            columns,
            rowHeight,
            contentHeight,
        };
        this.items.style.height = `${contentHeight}px`;
    }

    scheduleRender() {
        if (this.rafId) return;

        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.renderVisibleItems();
        });
    }

    renderVisibleItems() {
        if (!this.scrollRoot) return;
        if (!this.layout) this.updateLayout();

        const signal = this.abortController?.signal;
        const displayId = this.displayId;
        const { columns, rowHeight } = this.layout;
        const bufferRows = 2;
        const scrollTop = this.getItemsScrollTop();
        const viewportHeight = this.scrollRoot.clientHeight;
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
        const endRow = Math.ceil((scrollTop + viewportHeight) / rowHeight) + bufferRows;
        const startIndex = startRow * columns;
        const endIndex = Math.min(this.files.length, endRow * columns);
        const visibleIndexes = new Set();

        for (let index = startIndex; index < endIndex; index++) {
            visibleIndexes.add(index);
            if (!this.renderedItems.has(index)) {
                const item = this.createVirtualItem(index, signal, displayId);
                this.renderedItems.set(index, item);
                this.items.append(item);
            }
        }

        for (const [index, item] of this.renderedItems.entries()) {
            if (!visibleIndexes.has(index)) {
                this.observer.unobserve(item);
                item.remove();
                this.renderedItems.delete(index);
            }
        }
    }

    getItemsScrollTop() {
        const rootRect = this.scrollRoot.getBoundingClientRect();
        const itemsRect = this.items.getBoundingClientRect();
        const itemsTop = itemsRect.top - rootRect.top + this.scrollRoot.scrollTop;
        return Math.max(0, this.scrollRoot.scrollTop - itemsTop);
    }

    createVirtualItem(index, signal, displayId) {
        const file = this.files[index];
        const item = file?.type === "new-file"
            ? this.createNewFileItem()
            : this.createItem(file);

        this.positionItem(item, index);

        if (file?.type !== "new-file") {
            item.__fileData = { file, signal };
            item.__displayId = displayId;
            this.observer.observe(item);
        }

        return item;
    }

    positionItem(item, index) {
        const { width, height, gap, paddingLeft, paddingTop, columns } = this.layout;
        const row = Math.floor(index / columns);
        const column = index % columns;

        item.style.position = "absolute";
        item.style.width = `${width}px`;
        item.style.height = `${height}px`;
        item.style.left = `${paddingLeft + column * (width + gap)}px`;
        item.style.top = `${paddingTop + row * (height + gap)}px`;
    }

    applyFileWidth(newWidth) {
        this.layout = null;
        this.updateLayout();
        this.renderedItems.forEach((item, index) => this.positionItem(item, index));
        this.scheduleRender();
    }

    applyFileHeight(newHeight) {
        this.layout = null;
        this.updateLayout();
        this.renderedItems.forEach((item, index) => this.positionItem(item, index));
        this.scheduleRender();
    }

    destroy() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.observer.disconnect();
        this.scrollRoot?.removeEventListener("scroll", this.handleScroll);
        this.resizeObserver?.disconnect();
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
}
