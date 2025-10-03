"""
Benchmark script to compare inference speed and accuracy
between original EdgeFace and EdgeFace-XS models
"""

import os
import time
import argparse
import logging
from pathlib import Path

import numpy as np
import cv2
import onnxruntime as ort
from collections import defaultdict

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EdgeFaceONNXInference:
    """ONNX inference wrapper for EdgeFace models"""
    
    def __init__(self, model_path: str, providers: list = None):
        self.model_path = model_path
        self.INPUT_MEAN = 127.5
        self.INPUT_STD = 127.5
        self.input_size = (112, 112)
        
        if providers is None:
            providers = ['CPUExecutionProvider']
        
        logger.info(f"Loading ONNX model: {model_path}")
        self.session = ort.InferenceSession(model_path, providers=providers)
        
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        
        # Get embedding dimension
        output_shape = self.session.get_outputs()[0].shape
        self.embedding_dim = output_shape[-1] if len(output_shape) > 1 else output_shape[0]
        
        logger.info(f"Model loaded: embedding_dim={self.embedding_dim}")
    
    def preprocess(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for inference"""
        # Resize
        if image.shape[:2] != self.input_size:
            image = cv2.resize(image, (self.input_size[1], self.input_size[0]))
        
        # Convert BGR to RGB
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Normalize
        image = image.astype(np.float32)
        image = (image - self.INPUT_MEAN) / self.INPUT_STD
        
        # Transpose to CHW
        image = np.transpose(image, (2, 0, 1))
        
        # Add batch dimension
        image = np.expand_dims(image, axis=0)
        
        return image
    
    def get_embedding(self, image: np.ndarray) -> np.ndarray:
        """Extract face embedding from image"""
        preprocessed = self.preprocess(image)
        embedding = self.session.run([self.output_name], {self.input_name: preprocessed})[0]
        
        # Normalize embedding (L2 normalization)
        embedding = embedding / np.linalg.norm(embedding)
        
        return embedding.flatten()
    
    def warmup(self, num_iterations: int = 10):
        """Warmup model with random inputs"""
        logger.info(f"Warming up model ({num_iterations} iterations)...")
        dummy_input = np.random.randn(1, 3, 112, 112).astype(np.float32)
        
        for _ in range(num_iterations):
            _ = self.session.run([self.output_name], {self.input_name: dummy_input})
        
        logger.info("✓ Warmup complete")


def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    """Calculate cosine similarity between two embeddings"""
    return np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))


def benchmark_inference_speed(
    model: EdgeFaceONNXInference,
    num_iterations: int = 100
) -> dict:
    """Benchmark inference speed with random inputs"""
    logger.info(f"Benchmarking inference speed ({num_iterations} iterations)...")
    
    # Generate random test images
    test_images = [
        np.random.randint(0, 256, (112, 112, 3), dtype=np.uint8)
        for _ in range(num_iterations)
    ]
    
    # Benchmark
    times = []
    for img in test_images:
        start = time.perf_counter()
        _ = model.get_embedding(img)
        end = time.perf_counter()
        times.append((end - start) * 1000)  # Convert to ms
    
    stats = {
        'mean': np.mean(times),
        'median': np.median(times),
        'std': np.std(times),
        'min': np.min(times),
        'max': np.max(times),
        'p95': np.percentile(times, 95),
        'p99': np.percentile(times, 99),
        'total': np.sum(times)
    }
    
    logger.info(f"✓ Inference speed: {stats['mean']:.2f} ms/image (median: {stats['median']:.2f} ms)")
    
    return stats


def compare_accuracy(
    model1: EdgeFaceONNXInference,
    model2: EdgeFaceONNXInference,
    test_images: list = None,
    num_random: int = 50
) -> dict:
    """Compare embedding accuracy between two models"""
    logger.info("Comparing embedding accuracy...")
    
    similarities = []
    max_diffs = []
    
    # Test with random images
    for i in range(num_random):
        img = np.random.randint(0, 256, (112, 112, 3), dtype=np.uint8)
        
        emb1 = model1.get_embedding(img)
        emb2 = model2.get_embedding(img)
        
        sim = cosine_similarity(emb1, emb2)
        diff = np.max(np.abs(emb1 - emb2))
        
        similarities.append(sim)
        max_diffs.append(diff)
    
    # Test with real images if provided
    if test_images:
        for img_path in test_images:
            if not os.path.exists(img_path):
                logger.warning(f"Test image not found: {img_path}")
                continue
            
            img = cv2.imread(img_path)
            if img is None:
                logger.warning(f"Failed to load: {img_path}")
                continue
            
            emb1 = model1.get_embedding(img)
            emb2 = model2.get_embedding(img)
            
            sim = cosine_similarity(emb1, emb2)
            diff = np.max(np.abs(emb1 - emb2))
            
            similarities.append(sim)
            max_diffs.append(diff)
    
    stats = {
        'mean_similarity': np.mean(similarities),
        'min_similarity': np.min(similarities),
        'max_diff': np.max(max_diffs),
        'mean_diff': np.mean(max_diffs),
        'num_tests': len(similarities)
    }
    
    logger.info(f"✓ Embedding similarity: {stats['mean_similarity']:.6f} (min: {stats['min_similarity']:.6f})")
    logger.info(f"✓ Max embedding diff: {stats['max_diff']:.6e} (mean: {stats['mean_diff']:.6e})")
    
    return stats


def main():
    parser = argparse.ArgumentParser(
        description='Benchmark EdgeFace model inference speed and accuracy'
    )
    parser.add_argument(
        '--original',
        type=str,
        required=True,
        help='Path to original EdgeFace ONNX model'
    )
    parser.add_argument(
        '--new',
        type=str,
        required=True,
        help='Path to new EdgeFace-XS ONNX model'
    )
    parser.add_argument(
        '--test-images',
        type=str,
        nargs='+',
        help='Paths to test images for accuracy comparison'
    )
    parser.add_argument(
        '--iterations',
        type=int,
        default=100,
        help='Number of iterations for speed benchmark'
    )
    parser.add_argument(
        '--warmup',
        type=int,
        default=10,
        help='Number of warmup iterations'
    )
    parser.add_argument(
        '--providers',
        type=str,
        nargs='+',
        default=['CPUExecutionProvider'],
        help='ONNX Runtime execution providers'
    )
    
    args = parser.parse_args()
    
    try:
        # Load models
        logger.info("\n" + "="*60)
        logger.info("LOADING MODELS")
        logger.info("="*60)
        
        original_model = EdgeFaceONNXInference(args.original, args.providers)
        new_model = EdgeFaceONNXInference(args.new, args.providers)
        
        # Warmup
        logger.info("\n" + "="*60)
        logger.info("WARMUP PHASE")
        logger.info("="*60)
        
        original_model.warmup(args.warmup)
        new_model.warmup(args.warmup)
        
        # Benchmark speed
        logger.info("\n" + "="*60)
        logger.info("SPEED BENCHMARK")
        logger.info("="*60)
        
        logger.info("\nOriginal EdgeFace:")
        original_stats = benchmark_inference_speed(original_model, args.iterations)
        
        logger.info("\nEdgeFace-XS:")
        new_stats = benchmark_inference_speed(new_model, args.iterations)
        
        # Calculate speedup
        speedup = (original_stats['mean'] / new_stats['mean']) * 100
        logger.info(f"\n✓ Speedup: {speedup:.1f}% faster ({original_stats['mean']:.2f} ms → {new_stats['mean']:.2f} ms)")
        
        # Compare accuracy
        logger.info("\n" + "="*60)
        logger.info("ACCURACY COMPARISON")
        logger.info("="*60)
        
        accuracy_stats = compare_accuracy(
            original_model,
            new_model,
            test_images=args.test_images
        )
        
        # Print summary
        logger.info("\n" + "="*60)
        logger.info("BENCHMARK SUMMARY")
        logger.info("="*60)
        
        logger.info("\nOriginal EdgeFace:")
        logger.info(f"  Mean: {original_stats['mean']:.2f} ms")
        logger.info(f"  Median: {original_stats['median']:.2f} ms")
        logger.info(f"  P95: {original_stats['p95']:.2f} ms")
        logger.info(f"  P99: {original_stats['p99']:.2f} ms")
        
        logger.info("\nEdgeFace-XS:")
        logger.info(f"  Mean: {new_stats['mean']:.2f} ms")
        logger.info(f"  Median: {new_stats['median']:.2f} ms")
        logger.info(f"  P95: {new_stats['p95']:.2f} ms")
        logger.info(f"  P99: {new_stats['p99']:.2f} ms")
        
        logger.info(f"\nSpeedup: {speedup:.1f}%")
        
        logger.info("\nAccuracy:")
        logger.info(f"  Embedding similarity: {accuracy_stats['mean_similarity']:.6f}")
        logger.info(f"  Max difference: {accuracy_stats['max_diff']:.6e}")
        logger.info(f"  Tests performed: {accuracy_stats['num_tests']}")
        
        # Verdict
        logger.info("\n" + "="*60)
        logger.info("VERDICT")
        logger.info("="*60)
        
        if accuracy_stats['mean_similarity'] > 0.99:
            logger.info("✓ ACCURACY: Excellent (>99% similarity)")
        elif accuracy_stats['mean_similarity'] > 0.95:
            logger.info("✓ ACCURACY: Good (>95% similarity)")
        else:
            logger.warning("⚠ ACCURACY: Low similarity - review conversion")
        
        if speedup > 120:
            logger.info(f"✓ SPEED: Excellent ({speedup:.0f}% faster)")
        elif speedup > 105:
            logger.info(f"✓ SPEED: Good ({speedup:.0f}% faster)")
        elif speedup > 100:
            logger.info(f"✓ SPEED: Marginal improvement ({speedup:.0f}% faster)")
        else:
            logger.warning(f"⚠ SPEED: Slower than original ({speedup:.0f}%)")
        
        logger.info("="*60)
        
        return 0
        
    except Exception as e:
        logger.error(f"Benchmark failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    import sys
    sys.exit(main())
