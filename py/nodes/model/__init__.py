from . import lora_loader
from . import checkpoint_loader
from . import model_loader

nodes = [
    lora_loader.LoraStack, 
    lora_loader.ApplyLoraStack, 
    lora_loader.LoraLoader, 
    
    checkpoint_loader.CheckpointLoader, 
    checkpoint_loader.CheckpointSelector, 

    model_loader.DiffusionModelLoader,
    model_loader.DiffusionModelSelector,
    model_loader.VAELoader,
    model_loader.VAESelector,
    model_loader.CLIPLoader,
    model_loader.CLIPSelector,
    model_loader.DualCLIPLoader,
    model_loader.DualCLIPSelector,
    model_loader.TripleCLIPLoader,
    model_loader.TripleCLIPSelector,
    model_loader.QuadrupleCLIPLoader,
    model_loader.QuadrupleCLIPSelector,
]
