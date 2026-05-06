function createSliderInfo(keyPrefix, namePrefix, start, end, type) {
    const result = [];

    const addInfo = (i) => {
        const key = `${keyPrefix}.${i}`;
        const name = `${namePrefix}.${String(i).padStart(2, "0")}`;
        result.push([key, name, type]);
    };

    if (start <= end) {
        for (let i = start; i <= end; i++) {
            addInfo(i);
        }
    } else {
        for (let i = start; i >= end; i--) {
            addInfo(i);
        }
    }
    return result;
}

export const BlockConfigs = {
    SD: {
        upper: [
            ["transformer.text_model.encoder.", "BASE", "clip"]
        ], 
        bottom: [
            ["middle_block.", "MIDDLE", "model"]
        ], 
        left: createSliderInfo("input_blocks", "INPUT", 0, 11, "model"), 
        right: createSliderInfo("output_blocks", "OUTPUT", 0, 11, "model")
    }, 

    WAN: {
        left: createSliderInfo("blocks", "BLOCK", 0, 19, "model"), 
        right: createSliderInfo("blocks", "BLOCK", 20, 39, "model")
    }, 

    Anima: {
        left: createSliderInfo("blocks", "BLOCK", 0, 13, "model"), 
        right: createSliderInfo("blocks", "BLOCK", 14, 27, "model")
    },

    ZImage: {
        upper: [
            ...createSliderInfo("context_refiner", "CTX", 0, 1, "model"),
            ...createSliderInfo("noise_refiner", "NOISE", 0, 1, "model"),
        ],
        left: createSliderInfo("layers", "LAYER", 0, 15, "model"),
        right: createSliderInfo("layers", "LAYER", 16, 31, "model")
    }, 
};
