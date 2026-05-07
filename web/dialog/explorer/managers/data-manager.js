// ==============================================
// Data Manager
//  : データノード管理
// ==============================================
export class DataManager {
    constructor(parent) {
        this.parent = parent;
        this.data = null;
    }

    // ------------------------------------------
    // データノード作成
    // ------------------------------------------
    setupData(dataList) {
        const root = { name: ".", type: "dir", children: [], path: "" };

        for (const data of dataList) {
            if (!data.filename) continue;

            const parts = data.filename.replace(/\\/g, "/").split("/");
            let currentNode = root;

            // partsの最後の要素(ファイル名)を除いた、ディレクトリ部分だけを処理
            const dirParts = parts.slice(0, -1);

            for (const part of dirParts) {
                // 既存のディレクトリを探す
                let nextNode = currentNode.children.find(child => child.type === "dir" && child.name === part);

                // 存在しない場合は作成
                if (!nextNode) {
                    // 現在のノードのパスと現在のパート名を結合して新しいパスを作成
                    const newPath = currentNode.path ? `${currentNode.path}/${part}` : part;
                    nextNode = {
                        name: part, 
                        type: "dir", 
                        children: [], 
                        path: newPath
                    };
                    currentNode.children.push(nextNode);
                }

                // 次の階層へ移動
                currentNode = nextNode;
            }

            // 最後にファイルを追加する
            const filename = parts[parts.length - 1];
            currentNode.children.push({
                name: filename, 
                type: "file", 
                path: data.filename.replace(/\\/g, "/"), 
                info: data.info, 
            });
        }

        // ディレクトリとファイルでソート
        const sortChildren = (node) => {
            if (node.children) {
                node.children.sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type === "dir" ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                });
                node.children.forEach(sortChildren);
            }
        };
        sortChildren(root);
        
        this.data = root;
    }

    findDir(path) {
        if (!this.data) return null;
        if (!path || path === ".") return this.data;

        const parts = path.split("/").filter(Boolean);
        let currentNode = this.data;
        for (const part of parts) {
            currentNode = currentNode.children.find(
                child => child.type === "dir" && child.name === part
            );
            if (!currentNode) return null;
        }
        return currentNode;
    }

    findFile(path) {
        if (!this.data || !path) return null;

        const normalizedPath = path.replace(/\\/g, "/");
        const parts = normalizedPath.split("/");
        const filename = parts.pop();
        const dirPath = parts.join("/");
        const dirNode = this.findDir(dirPath);
        if (!dirNode) return null;

        return dirNode.children.find(
            child => child.type === "file" && child.name === filename
        ) ?? null;
    }

    updateFileInfo(path, info) {
        const fileNode = this.findFile(path);
        if (!fileNode) return false;

        fileNode.info = info ?? {};
        return true;
    }
}
