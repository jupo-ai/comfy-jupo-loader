import { IconToggle } from "./icon.js";
import { NumberInput } from "./number-input.js";
import { SelectorWidget } from "./selector-widget.js";
import { Path } from "../utils.js";
import { LoraExplorer } from "../dialog/explorer/lora-explorer.js";
import { LoraInfo } from "../dialog/model-info/lora-info.js";
import { LBWDialog } from "../dialog/lbw/lbw-dialog.js";
import { SCHEDULE_UI_ENABLED } from "../features.js";

// ==============================================
// Lora Widget
// ==============================================
export class LoraWidget extends SelectorWidget {
    constructor({ parentField, valueOptions = {} }) {
        super({ parentField, valueOptions });

        this.value = {
            enabled: true, 

            path: "", 
            displayName: "", 

            modelStrength: 1, 
            clipStrength: 1, 
            clipMode: false, 

            enabledTrigger: false, 
            trigger: "", 

            enabledLBW: false, 
            modelType: null, 
            lbw: null, 

            enabledSchedule: false, 
            start: 0, 
            end: 1, 
        };

        this.valueUpdate(valueOptions);
        this.disableScheduleWhenUnavailable();
        this.createAdditionalUI(); // valueの値を適用するため createUI とは別に実行
        this.updateDisplayName();
        this.updateClipMode();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createAdditionalUI() {
        // modelStrength
        this.modelStrength = new NumberInput({
            defaultValue: this.value.modelStrength, 
            step: 0.05, 
            width: 64, 
            height: 20, 
            dialogTitle: "Model", 
            onChange: (value) => {
                this.valueUpdate({ modelStrength: value });
            }
        });
        this.element.append(this.modelStrength.element);

        // clipStrength
        this.clipStrength = new NumberInput({
            defaultValue: this.value.clipStrength, 
            step: 0.05, 
            width: 64, 
            height: 20, 
            dialogTitle: "Clip", 
            onChange: (value) => {
                this.valueUpdate({ clipStrength: value });
            }
        });
        this.element.append(this.clipStrength.element);
        
        // トリガーアイコン
        this.triggerIcon = new IconToggle({
            icon: "tag-text", 
            title: "トリガーワード", 
            value: this.value.enabledTrigger, 
            size: 14, 
            padding: 1, 
            onChange: (newValue) => {
                this.valueUpdate({ enabledTrigger: newValue });
            }, 
        });
        this.iconContainer.append(this.triggerIcon.element);

        // LBWアイコン
        this.LBWIcon = new IconToggle({
            icon: "chart-box", 
            title: "LBW", 
            value: this.value.enabledLBW, 
            size: 14, 
            padding: 1, 
            onChange: (newValue) => {
                this.valueUpdate({ enabledLBW: newValue });
            }
        });
        this.iconContainer.append(this.LBWIcon.element);

        if (SCHEDULE_UI_ENABLED) {
            // Scheduleアイコン
            this.scheduleIcon = new IconToggle({
                icon: "clock", 
                title: "start-end", 
                value: this.value.enabledSchedule, 
                size: 14, 
                padding: 1, 
                onChange: (newValue) => {
                    this.valueUpdate({ enabledSchedule: newValue });
                }
            });
            this.iconContainer.append(this.scheduleIcon.element);
        }
    }


    // ------------------------------------------
    // ハンドラー
    // ------------------------------------------
    handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();

        const menuOptions = [
            {
                content: "ℹ️ 情報を開く", 
                callback: () => {
                    const dialog = new LoraInfo({
                        modelPath: this.value.path, 
                        onClosed: (infoData) => {
                            this.valueUpdate({
                                displayName: infoData?.user?.displayName ?? "", 
                                trigger: infoData?.user?.triggerWord ?? "", 
                            });
                            this.updateDisplayName();
                        }
                    });
                    dialog.show();
                }
            }, 
            {
                content: "📊 LBWを開く", 
                callback: () => {
                    const dialog = new LBWDialog(this);
                    dialog.show();
                }
            }, 
            null, 
            {
                content: `📝 表示切替: ${this.parentField.comfyNode.displayMode === "fullpath" ? "ファイル名" : "フルパス"}`, 
                callback: () => {
                    const currentValue = this.parentField.comfyNode.displayMode;
                    const newValue = currentValue === "filename" ? "fullpath" : "filename";
                    this.parentField.comfyNode.displayMode = newValue;
                    this.parentField.applyDisplayMode();
                }
            }, 
            null, 
            {
                content: `🔍 Clipを${this.parentField.comfyNode.clipMode ? "共通設定" : "個別設定"}`, 
                callback: () => {
                    const currentValue = this.parentField.comfyNode.clipMode;
                    const newValue = !currentValue;
                    this.parentField.comfyNode.clipMode = newValue;
                    this.parentField.applyClipMode();
                }
            }
        ];

        const filename = new Path(this.value.path).stem;
        new LiteGraph.ContextMenu(menuOptions, {
            event: e, 
            title: filename, 
            className: "custom-lora-menu", 
            node: this.parentField.comfyNode, 
            filter: false, 
        }, window);
    }

    handleNameClick() {
        const explorer = new LoraExplorer(file => {
            this.valueUpdate({
                path: file.path, 
                displayName: file.info.user?.displayName ?? "", 
                trigger: file.info.user?.triggerWord ?? "", 
            });
            this.updateDisplayName();
        });
        const dirPath = new Path(this.value.path).parent.toString();
        explorer.show(dirPath);
    }


    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    // 表示名の更新
    updateDisplayName() {
        let name = "";
        const displayName = this.value.displayName;
        const filename = new Path(this.value.path).stem;
        const fullpath = this.value.path;

        const displayMode = this.parentField.comfyNode.displayMode;
        if (displayMode === "filename") {
            name = displayName || filename;
        } else if (displayMode === "fullpath") {
            name = fullpath;
        }
        this.setDisplayName(name);
    }

    // ClipModeの更新
    updateClipMode() {
        const clipMode = this.parentField.comfyNode.clipMode;
        if (clipMode) {
            this.clipStrength.show();
        } else {
            this.clipStrength.hide();
        }
        this.valueUpdate({ clipMode: clipMode });
    }

    disableScheduleWhenUnavailable() {
        if (SCHEDULE_UI_ENABLED) return;

        this.value.enabledSchedule = false;
        this.value.start = 0;
        this.value.end = 1;
    }
}
