import { $el } from "../../../../scripts/ui.js";
import { loadCss } from "../../utils.js";
import { BaseModal } from "../base/base-dialog.js";
import { BlockConfigs } from "./block-configs.js";
import { BlockSection } from "./sections/block-section.js";
import { ModelTypeSection } from "./sections/model-type-section.js";
import { BimoSection } from "./sections/bimo-section.js";
import { ScheduleSection } from "./sections/schedule-section.js";
import { SCHEDULE_UI_ENABLED } from "../../features.js";

loadCss("dialog/lbw/lbw-dialog.css");

// ==============================================
// LBW Dialog
// ==============================================
export class LBWDialog extends BaseModal {
    constructor(parentWidget) {
        super();

        this.parentWidget = parentWidget;
        this.setupSections();
        this.createUI();
    }

    // ------------------------------------------
    // セットアップ
    // ------------------------------------------
    setupSections() {
        this.blockSection = new BlockSection(this);
        this.modelTypeSection = new ModelTypeSection(this);
        this.bimoSection = new BimoSection(this);
        this.scheduleSection = SCHEDULE_UI_ENABLED ? new ScheduleSection(this) : null;
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element.classList.add("jupo-lbw-dialog");
        this.content.classList.add("jupo-lbw-content");

        // ヘッダー
        const header = $el("div.jupo-lbw-header");
        const modelPath = this.parentWidget.value.path;
        const title = $el("span", { textContent: modelPath });
        header.append(title);

        // ボディ
        const body = $el("div.jupo-lbw-body");
        if (!SCHEDULE_UI_ENABLED) {
            body.classList.add("jupo-lbw-body--schedule-disabled");
        }

        // blockArea
        const blockArea = $el("div.jupo-lbw-block-area");
        blockArea.append(this.blockSection.element);

        // modelTypeArea
        const modelTypeArea = $el("div.jupo-lbw-modeltype-area");
        modelTypeArea.append(this.modelTypeSection.element);

        // bimoArea
        const bimoArea = $el("div.jupo-lbw-bimo-area");
        bimoArea.append(this.bimoSection.element);

        body.append(blockArea, modelTypeArea, bimoArea);
        if (SCHEDULE_UI_ENABLED) {
            // scheduleArea
            const scheduleArea = $el("div.jupo-lbw-schedule-area");
            scheduleArea.append(this.scheduleSection.element);
            body.append(scheduleArea);
        }
        this.content.append(header, body);
    }


    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    getModelTypeOptions() {
        return Object.keys(BlockConfigs);
    }

    getCurrentBlockConfig() {
        const modelType = this.modelTypeSection.dropdown.value;
        return BlockConfigs[modelType] ?? {};
    }


    // ------------------------------------------
    // ウィジェットから初期値を適用
    // ------------------------------------------
    applyInitialValues() {
        const value = this.parentWidget.value;
        
        // modelType
        const modelType = value.modelType ?? this.getModelTypeOptions()[0];
        this.modelTypeSection.setValue(modelType);

        // slider values
        const lbw = value.lbw ?? {};
        this.blockSection.setValue(lbw);

        if (SCHEDULE_UI_ENABLED) {
            // start, end
            const start = value.start ?? 0;
            const end = value.end ?? 1;
            this.scheduleSection.setValue(start, end);
        }
    }


    // ------------------------------------------
    // 開く・閉じる
    // ------------------------------------------
    show() {
        this.applyInitialValues();
        super.show();
    }

    close() {
        // widgetに適用
        const modelType = this.modelTypeSection.getValue();
        const lbw = this.blockSection.getValue();
        const { start, end } = SCHEDULE_UI_ENABLED
            ? this.scheduleSection.getValue()
            : { start: 0, end: 1 };

        const nextValue = { modelType, lbw, start, end };
        if (!SCHEDULE_UI_ENABLED) {
            nextValue.enabledSchedule = false;
        }
        this.parentWidget.valueUpdate(nextValue);

        super.close();
    }

}
