import { $el } from "../../../../../scripts/ui.js";
import { RangeSlider } from "../../../dom/range-slider.js";

// ==============================================
// Schedule Section
// ==============================================
export class ScheduleSection {
    constructor(parent) {
        this.parent = parent;

        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-schedule-section");

        // ヘッダー
        const header = $el("div.jupo-lbw-section-header");
        const title = $el("span", { textContent: "スケジュール" });
        header.append(title);

        // スライダー
        this.slider = new RangeSlider({
            min: 0, 
            max: 1, 
            start: 0, 
            end: 1, 
            step: 0.01, 
            restrict: true, 
        });
        // 緑に変える
        this.slider.element.style.setProperty("--rs-fill-color", "var(--accent-secondary)");

        this.element.append(header, this.slider.element);
    }


    getValue() {
        return { start: this.slider.start, end: this.slider.end };
    }

    setValue(start, end) {
        this.slider.start = start;
        this.slider.end = end;
    }
}