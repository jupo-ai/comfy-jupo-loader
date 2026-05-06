import { app } from "../../../scripts/app.js";
import { mkName } from "../utils.js";
import { LoraExplorer } from "../dialog/explorer/lora-explorer.js";
import { ImageExplorer } from "../dialog/explorer/image-explorer.js";
import { ResourceExplorer } from "../dialog/explorer/resource-explorer.js";

const PACKAGE_NAME = "CustomExplorer";
const EXPLORERS = [
    LoraExplorer, 
    ImageExplorer, 
    ResourceExplorer, 
];

const SETTINGS = {
    getList: function() {
        const arr = [];

        // Object.entries(this) で自身のプロパティを走査
        for (const [key, value] of Object.entries(this)) {

            // getList自身はスキップし、オブジェクトのみを対象にする
            if (key !== "getList" && value && typeof value === "object" && !Array.isArray(value)) {
                
                for (const explorer of EXPLORERS) {
                    // IDを作成
                    const newID = mkName(PACKAGE_NAME, explorer.name, key);
                    
                    // 元のオブジェクトを展開してコピーし、idを上書きする
                    const newItem = {
                        ...value, 
                        id: newID
                    };
                    arr.push(newItem);
                }
            }
        }
        return arr;
    }, 

    fileWidth: {
        id: null, 
        name: "ファイルアイテム幅", 
        type: "hidden", 
        defaultValue: 150, 
    }, 

    fileHeight: {
        id: null, 
        name: "ファイルアイテム高さ", 
        type: "hidden", 
        defaultValue: 200, 
    }, 

    visibleTree: {
        id: null, 
        name: "ディレクトリツリーを表示", 
        type: "hidden", 
        defaultValue: true, 
    }, 

    visibleDirs: {
        id: null, 
        name: "ディレクトリビューを表示", 
        type: "hidden", 
        defaultValue: false, 
    }, 
};


const extension = {
    name: mkName(PACKAGE_NAME, "Config"), 
    settings: SETTINGS.getList(), 
}

app.registerExtension(extension);
