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

const ANIMA_BASE_SEARCH_KEYS = [
    "diffusion_model.t_embedder.",
    "diffusion_model.x_embedder.",
    "diffusion_model.final_layer.",
    "diffusion_model.t_embedding_norm.",
].join("\n");

export const BlockConfigs = {
    SD: {
        upper: [
            ["transformer.text_model.encoder.", "TE", "clip"]
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
        upper: [
            ["__anima_base__", "BASE", "model", ANIMA_BASE_SEARCH_KEYS],
            ["diffusion_model.llm_adapter", "LLM Adapter", "model"],
        ],
        left: createSliderInfo("diffusion_model.blocks", "BLOCK", 0, 13, "model"), 
        right: createSliderInfo("diffusion_model.blocks", "BLOCK", 14, 27, "model")
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
