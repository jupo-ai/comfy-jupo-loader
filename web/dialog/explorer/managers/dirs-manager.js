import { $el } from "../../../../../scripts/ui.js";

// ==============================================
// Dirs Manager
//  : 画面右側、ディレクトリビューの管理
// ==============================================
export class DirsManager {
    constructor(parent) {
        this.parent = parent;
        
        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-explorer-dirs");

        this.labelText = $el("span", { textContent: "📁 フォルダー"});
        const label = $el("div.jupo-explorer-dirs-label", [this.labelText]);

        this.items = $el("div.jupo-explorer-dirs-items");

        this.element.append(label, this.items);
    }

    // ------------------------------------------
    // 表示
    // ------------------------------------------
    display(node) {
        this.items.replaceChildren();
        const dirs = node.children.filter(c => c.type === "dir");

        this.applyVisible();
        if (node.name === "." && dirs.length === 0) {
            this.element.style.display = "none";
        }

        // ラベル
        const dirPath = node.path || "(root)";
        this.labelText.textContent = `📁 ${dirPath}`;

        // 親階層
        if (node.name !== ".") {
            const currentPath = node.path;
            const lastSlash = currentPath.lastIndexOf("/");
            const parentPath = currentPath.substring(0, lastSlash);
            const parentItem = this.createItem("..", parentPath);
            this.items.append(parentItem);
        }

        // サブディレクトリ
        for (const dir of dirs) {
            const item = this.createItem(dir.name, dir.path);
            this.items.append(item);
        }
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    createItem(name, path) {
        const item = $el("div.jupo-explorer-dirs-item", {
            textContent: `📁 ${name}`, 
        });
        item.addEventListener("click", () => this.parent.treeManager.openDir(path));
        
        return item;
    }

    applyVisible() {
        const value = this.parent.getConfig("visibleDirs");
        const display = value ? "block" : "none";
        this.element.style.display = display;
    }
    forceShow() {
        this.element.style.display = "block";
    }
    forceHide() {
        this.element.style.display = "none";
    }
}