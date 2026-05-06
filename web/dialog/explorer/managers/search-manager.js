import { $el } from "../../../../../scripts/ui.js";

// ==============================================
// Search Manager
//  : ファイル検索機能とそのUIを管理
// ==============================================
export class SearchManager {
    constructor(parent) {
        this.parent = parent;

        // --- UI Elements ---
        this.element = null;
        this.searchInput = null;
        this.clearButton = null;
        this.resultsContainer = null;
        this.results = null;
        this.searchResultsLabel = null;
        
        // --- State Management ---
        this.searchTerm = "";
        this.searchResults = [];
        this.isSearching = false;
        
        // --- Async Control ---
        this.debounceTimer = null;
        this.abortController = null;
        this.searchId = 0; // 最新の検索リクエストを識別するためのID

        this.createSearchUI();
        this.createResultUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createSearchUI() {
        this.element = $el("div.jupo-explorer-search");

        this.searchInput = $el("input", {
            type: "text", 
            placeholder: "検索..."
        });
        this.searchInput.addEventListener("input", (e) => this.debounceSearch(e.target.value));
        this.searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") this.clearSearch();
        });

        this.clearButton = $el("button", {
            textContent: "クリア", 
            onclick: () => this.clearSearch()
        });

        this.element.append(this.searchInput, this.clearButton);
    }

    createResultUI() {
        this.results = $el("div.jupo-explorer-search-results");
        this.searchResultsLabel = $el("div.jupo-explorer-search-results-counter");
        this.resultsContainer = $el("div.jupo-explorer-search-results-container", [
            this.searchResultsLabel,
            this.results
        ]);
        this.resultsContainer.style.display = "none";
    }

    // ------------------------------------------
    // デバウンス処理
    // ------------------------------------------
    debounceSearch(searchTerm) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.handleSearch(searchTerm), 300);
    }

    // ------------------------------------------
    // 検索実行のメインロジック
    // ------------------------------------------
    async handleSearch(searchTerm) {
        // 既存の検索処理があれば中断シグナルを送る
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        // 新しい検索ごとにユニークなIDを発行
        const currentSearchId = ++this.searchId;

        this.searchTerm = searchTerm.trim().toLowerCase();
        if (this.searchTerm === "") {
            this.clearSearch();
            return;
        }

        this.isSearching = true;
        this.updateSearchUI();
        this.results.replaceChildren(); // 以前の結果をクリア
        this.updateResultsLabel("loading");

        try {
            // 1. 同期的にファイルリスト全体から一致するものを検索
            this.performSearch();
            
            // 処理中に新しい検索が開始された場合は、この後のUI更新をスキップ
            if (this.searchId !== currentSearchId || signal.aborted) return;
            this.updateResultsLabel("count", this.searchResults.length);

            // 2. 検索結果を非同期でDOMに変換し、逐次描画
            await this.createResultItems(signal, currentSearchId);

        } catch (error) {
            // ユーザー操作による中断は正常な動作なのでエラー表示しない
            if (error.name !== 'AbortError') {
                console.error('Search failed:', error);
                // 最新の検索処理でのみエラーメッセージを表示
                if (this.searchId === currentSearchId) {
                    this.updateResultsLabel("error");
                }
            }
        }
    }

    // ------------------------------------------
    // データツリーから検索語に一致するファイルを収集
    // ------------------------------------------
    performSearch() {
        this.searchResults = [];
        const traverse = (node) => {
            if (node.type === "file") {
                const path = (node.path || "").toLowerCase();
                const displayName = (node.info?.displayName || node.info?.user?.displayName || "").toLowerCase();

                if (path.includes(this.searchTerm) || displayName.includes(this.searchTerm)) {
                    this.searchResults.push(node);
                }
            }

            if (node.type === "dir" && node.children) {
                node.children.forEach(traverse);
            }
        };

        if (this.parent.dataManager.data.children) {
            this.parent.dataManager.data.children.forEach(traverse);
        }
    }

    // ------------------------------------------
    // 検索結果のDOM要素を作成し、逐次描画
    // ------------------------------------------
    async createResultItems(signal, searchId) {
        const groupedResults = this.groupResultsByDirectory();
        
        for (const [dirPath, files] of Object.entries(groupedResults)) {
            // 処理中に新しい検索が開始されたり、中断された場合はループを抜ける
            if (this.searchId !== searchId || signal.aborted) return;

            const dirHeader = $el("div.jupo-explorer-search-result-dir-header", {
                textContent: `📁 ${dirPath === "." ? "(root)" : dirPath}`
            });
            const container = $el("div.jupo-explorer-search-result-items");
            
            for (const file of files) {
                if (this.searchId !== searchId || signal.aborted) return;

                const item = this.parent.filesManager.createItem(file);
                
                // メディア読み込み（時間のかかる可能性のある非同期処理）
                await this.parent.filesManager.loadMedia(file, item);
                
                // 非同期処理の完了後、DOMに追加する直前に再度チェック（最重要）
                if (this.searchId !== searchId || signal.aborted) return;

                container.append(item);
            }

            // ディレクトリ内のファイルが1つでも処理され、DOMに追加された場合
            if (container.children.length > 0) {
                this.results.append(dirHeader, container);
            }
        }
    }

    // ------------------------------------------
    // 補助メソッド
    // ------------------------------------------
    groupResultsByDirectory() {
        const grouped = {};
        this.searchResults.forEach(node => {
            const dirPath = this.getDirPath(node.path);
            if (!grouped[dirPath]) {
                grouped[dirPath] = [];
            }
            grouped[dirPath].push(node);
        });

        // ディレクトリパスでソート（rootを最優先）
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            if (a === ".") return -1;
            if (b === ".") return 1;
            return a.localeCompare(b);
        });

        // 各ディレクトリ内のファイルを名前でソート
        const sortedGrouped = {};
        sortedKeys.forEach(key => {
            sortedGrouped[key] = grouped[key].sort((a, b) => a.name.localeCompare(b.name));
        });
        return sortedGrouped;
    }

    getDirPath(path) {
        if (!path || !path.includes('/')) return ".";
        return path.substring(0, path.lastIndexOf("/"));
    }

    // ------------------------------------------
    // UI表示更新
    // ------------------------------------------
    updateSearchUI() {
        if (this.isSearching) {
            this.parent.treeManager.disable();
            this.parent.dirsManager.forceHide();
            this.parent.filesManager.forceHide();
            this.resultsContainer.style.display = "block";
        } else {
            this.parent.treeManager.enable();
            this.parent.dirsManager.applyVisible();
            this.parent.filesManager.forceShow();
            this.resultsContainer.style.display = "none";
        }
    }

    // ------------------------------------------
    // 検索クリア
    // ------------------------------------------
    clearSearch() {
        if (this.abortController) {
            this.abortController.abort();
        }
        // 進行中の非同期描画処理を無効化するためにIDをインクリメント
        this.searchId++; 

        this.searchTerm = "";
        this.searchResults = [];
        this.isSearching = false;
        this.searchInput.value = "";
        this.updateResultsLabel("default");

        this.updateSearchUI();
    }

    // ------------------------------------------
    // 外部からの更新要求
    // ------------------------------------------
    async refresh() {
        // 現在の検索語で再検索を実行
        if (this.isSearching && this.searchTerm) {
            await this.handleSearch(this.searchTerm);
        }
    }

    updateResultsLabel(state, count = 0) {
        let label = "";
        switch(state) {
            case "loading":
                label = `🔎 「${this.searchTerm}」を検索中…`;
                break;
            case "count":
                label = count === 0
                    ? "🔎 該当する結果はありません"
                    : `🔎 ${count}件が見つかりました`;
                break;
            case "error":
                label = "⚠️ 検索中にエラーが発生しました";
                break;
            default:
                label = "🔎 検索語を入力してください";
        }
        this.searchResultsLabel.textContent = label;
    }
}