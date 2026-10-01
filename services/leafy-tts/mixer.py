import numpy as np

def blend(a, b, ratio=0.5):
    if a is None:
        return b
    if b is None:
        return a
    n = min(len(a), len(b))
    mixed = a[:n] * (1 - ratio) + b[:n] * ratio
    peak = np.max(np.abs(mixed)) or 1
    return (mixed / peak * 0.9).astype(np.float32)
