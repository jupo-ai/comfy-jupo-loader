function createSliderInfo(keyPrefix, namePrefix, start, end, type) {
    const result = [];

    const addInfo = (i) => {
        const key = `${keyPrefix}.${i}.`;
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
];

export const BlockConfigs = {
    SD: {
        upper: [
            [
                [
                    "transformer.text_model.encoder.",
                    "clip_l.transformer.text_model.encoder.",
                    "clip_h.transformer.text_model.encoder.",
                ],
                "TE",
                "clip",
            ],
        ], 
        bottom: [
            ["diffusion_model.middle_block.", "MIDDLE", "model"]
        ], 
        left: createSliderInfo("diffusion_model.input_blocks", "INPUT", 0, 11, "model"), 
        right: createSliderInfo("diffusion_model.output_blocks", "OUTPUT", 0, 11, "model")
    }, 

    WAN: {
        left: createSliderInfo("diffusion_model.blocks", "BLOCK", 0, 19, "model"), 
        right: createSliderInfo("diffusion_model.blocks", "BLOCK", 20, 39, "model")
    }, 

    Anima: {
        upper: [
            [ANIMA_BASE_SEARCH_KEYS, "BASE", "model"],
            ["diffusion_model.llm_adapter.", "LLM Adapter", "model"],
        ],
        left: createSliderInfo("diffusion_model.blocks", "BLOCK", 0, 13, "model"), 
        right: createSliderInfo("diffusion_model.blocks", "BLOCK", 14, 27, "model")
    },

    ZImage: {
        upper: [
            ...createSliderInfo("diffusion_model.context_refiner", "CTX", 0, 1, "model"),
            ...createSliderInfo("diffusion_model.noise_refiner", "NOISE", 0, 1, "model"),
        ],
        left: createSliderInfo("diffusion_model.layers", "LAYER", 0, 15, "model"),
        right: createSliderInfo("diffusion_model.layers", "LAYER", 16, 31, "model")
    }, 
};
