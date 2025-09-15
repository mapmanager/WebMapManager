#!/usr/bin/env python3
"""
Create a simple test TIFF file for migration testing
"""

import numpy as np
from PIL import Image
import os

def create_test_tiff():
    """Create a simple test TIFF file"""
    
    # Create a simple test image (100x100 pixels, grayscale)
    width, height = 100, 100
    
    # Create a gradient pattern for easy visual verification
    image_data = np.zeros((height, width), dtype=np.uint8)
    
    for y in range(height):
        for x in range(width):
            # Create a gradient from black to white
            image_data[y, x] = int((x + y) * 255 / (width + height))
    
    # Convert to PIL Image
    image = Image.fromarray(image_data, mode='L')
    
    # Save as TIFF
    output_path = os.path.join(os.path.dirname(__file__), 'test_channel.tif')
    image.save(output_path, format='TIFF')
    
    print(f"Created test TIFF file: {output_path}")
    print(f"Image size: {width}x{height}")
    print(f"Image mode: {image.mode}")
    
    return output_path

if __name__ == "__main__":
    create_test_tiff()
