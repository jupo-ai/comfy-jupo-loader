import { $el } from "../../../../../scripts/ui.js";

// ==============================================
// Tree Manager
//  : ディレクトリツリーの管理
// ==============================================
export class TreeManager {
    constructor(parent) {
        this.parent = parent;

        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-explorer-tree");
        this.applyVisible();
    }

    // ------------------------------------------
    // ディレクトリツリー構築
    // ------------------------------------------
    buildTree(rootNode) {
        const rootUl = $el("ul");

        // ルート要素を作成
        const summary = this.createSummaryElement("📁 (root)", ".");
        summary.addEventListener("click", (e) => this.handleSummaryClick(e, rootNode));

        const details = $el("details.jupo-explorer-tree-details", { open: true }, [summary]);
        const rootLi = $el("li", [details]);
        rootUl.append(rootLi);

        // (root) の下に第一階層のツリーを構築
        const subDirs = this.getSubDirs(rootNode);
        if (subDirs.length > 0) {
            summary.classList.add("has-sub");
            const subTreeContainer = $el("div.jupo-explorer-subtree");
            this.buildSubTree(subDirs, subTreeContainer, ".");
            details.append(subTreeContainer);
        }
        this.element.replaceChildren(rootUl);
    }

    // 指定されたディレクトリリストからサブツリー(<ul>)を構築し、親要素に追加
    buildSubTree(dirs, parentElement, currentPath) {
        const ul = $el("ul");
        for (const dir of dirs) {
            const li = this.createDirectoryElement(dir, currentPath);
            ul.append(li);
        }
        parentElement.append(ul);
    }

    // 1つのディレクトリを表す要素(<li>)を作成
    createDirectoryElement(dirNode, parentPath) {
        const newPath = parentPath === "." ? dirNode.name : `${parentPath}/${dirNode.name}`;
        const subDirs = this.getSubDirs(dirNode);
        const hasSub = subDirs.length > 0;

        const summary = this.createSummaryElement(`📁 ${dirNode.name}`, newPath);
        summary.addEventListener("click", (e) => this.handleSummaryClick(e, dirNode));

        const details = $el("details.jupo-explorer-tree-details", [summary]);
        const li = $el("li", [details]);

        if (hasSub) {
            summary.classList.add("has-sub");
            const subTreeContainer = $el("div.jupo-explorer-subtree");
            this.buildSubTree(subDirs, subTreeContainer, newPath);
            details.append(subTreeContainer);
        }
        return li;
    }

    // <summary>要素を作成するヘルパー関数
    createSummaryElement(textContent, path) {
        const summary = $el("summary.jupo-explorer-tree-summary", [
            $el("span", { textContent: textContent })
        ]);
        summary.setAttribute("data-dir-path", path);
        return summary;
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    getSubDirs(node) {
        const subDirs = node.children
            .filter(c => c.type === "dir")
            .sort((a, b) => a.name.localeCompare(b.name));
        return subDirs;
    }

    setActiveDir(summary) {
        this.element.querySelectorAll(".active-dir")
            .forEach(el => el.classList.remove("active-dir"));
        summary.classList.add("active-dir");
    }


    // ------------------------------------------
    // ハンドラー
    // ------------------------------------------
    async handleSummaryClick(e, node) {
        e.preventDefault();
        e.stopPropagation();

        const summary = e.currentTarget;
        const details = summary.parentElement;
        const hasSub = summary.classList.contains("has-sub");

        // アイコン部分(トグルエリア)をクリックされたか判定
        const isToggleAreaClick = e.isTrusted && e.offsetX < 28;
        
        // トグルエリアがクリックされ、かつサブディレクトリを持つ場合のみ、開閉動作を行う
        if (hasSub && isToggleAreaClick) {
            details.open = !details.open;
        } else {
            details.open = true;
            await this.onTreeClicked(summary, node);
        }
    }

    async onTreeClicked(summary, node) {
        if (this.parent.searchManager.isSearching) return;

        this.setActiveDir(summary);
        this.parent.currentDir = node.path;

        this.parent.dirsManager.display(node);
        await this.parent.filesManager.display(node);
    }

    // ------------------------------------------
    // ツリーを開く
    // ------------------------------------------
    openDir(dirPath) {
        if (!dirPath) dirPath = ".";

        let currentPath;
        let lastSummary;
        const parts = dirPath.split("/");
        for (const part of parts) {
            const path = currentPath ? `${currentPath}/${part}` : part;
            const selector = `.jupo-explorer-tree-summary[data-dir-path="${path}"]`;
            const summary = this.element.querySelector(selector);

            if (summary) {
                const details = summary.parentElement;
                details.open = true;
                lastSummary = summary;
            } else {
                lastSummary = null;
                break;
            }
            currentPath = path;
        }
        if (lastSummary) {
            lastSummary.click();
        } else {
            // 指定されたパスが見つからなかった場合、ルートを開く
            const rootSummary = this.element.querySelector('.jupo-explorer-tree-summary[data-dir-path="."]');
            if (rootSummary) {
                rootSummary.click();
            }
        }
    }

    applyVisible() {
        const value = this.parent.getConfig("visibleTree");
        const display = value ? "block" : "none";
        this.element.style.display = display;
    }
    forceShow() {
        this.element.style.display = "block";
    }
    forceHide() {
        this.element.style.display = "none";
    }
    disable() {
        this.element.style.opacity = "0.5";
        this.element.style.pointerEvents = "none";
    }
    enable() {
        this.element.style.opacity = "1";
        this.element.style.pointerEvents = "auto";
    }
}