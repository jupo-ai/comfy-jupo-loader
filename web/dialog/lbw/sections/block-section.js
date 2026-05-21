import { $el } from "../../../../../scripts/ui.js";
import { Slider } from "../../../dom/slider.js";

// ==============================================
// Block Section
// ==============================================
export class BlockSection {
    constructor(parent) {
        this.parent = parent;
        this.sliders = [];

        this.createUI();
    }

    // ------------------------------------------
    // UI作成
    // ------------------------------------------
    createUI() {
        this.element = $el("div.jupo-block-section");
    }

    // ------------------------------------------
    // ユーティリティ
    // ------------------------------------------
    createSliders() {
        this.clear();
        const config = this.parent.getCurrentBlockConfig();
        const isUnet = this.parent.modelTypeSection.getValue() === "SD";
        const options = { min: 0, max: 1, step: 0.01, value: 1 };

        this.element.classList.toggle("jupo-block-section--unet", isUnet);

        ["upper", "left", "right", "bottom"].forEach(position => {
            if (config[position]) {
                const container = $el("div.jupo-block-section-sliders");
                container.classList.add(`--${position}`);
                
                config[position].forEach(info => {
                    const slider = new Slider({
                        label: info[1], 
                        labelTitle: info[3] ?? info[0], 
                        value: options.value, 
                        min: options.min, 
                        max: options.max, 
                        step: options.step, 
                    });
                    slider.element.classList.add("jupo-block-section-slider");
                    container.append(slider.element);

                    const item = { info, slider };
                    this.sliders.push(item);
                });
                this.element.append(container);
            }
        });
    }


    // ------------------------------------------
    // クリア
    // ------------------------------------------
    clear() {
        this.sliders = [];
        this.element.replaceChildren();
    }

    // ------------------------------------------
    // スライダーに値を適用
    // ------------------------------------------
    applyValue(key, value) {
        // keyを持つsliderを取得
        const item = this.sliders.find(i => i.info[0] === key);
        if (!item) return;

        item.slider.value = value;
    }


    // ------------------------------------------
    // slidersから必要な値を取得
    // ------------------------------------------
    getValue() {
        const lbw = {};

        this.sliders.forEach(item => {
            const { info, slider } = item;
            const key = info[0];
            const blockType = info[2];
            const value = slider.value;

            if (!lbw[blockType]) {
                lbw[blockType] = {};
            }
            lbw[blockType][key] = value;
        });

        return lbw;
    }

    // ------------------------------------------
    // 値をslidersに適用
    // ------------------------------------------
    setValue(lbw) {
        if (!lbw) return;

        Object.keys(lbw).forEach(blockType => {
            const block = lbw[blockType];
            Object.keys(block).forEach(key => {
                const value = block[key];
                this.applyValue(key, value);
            });
        });
    }
}
