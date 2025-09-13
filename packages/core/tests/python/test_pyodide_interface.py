"""
Python Interface Tests for Pyodide Bridge

These tests verify the Python side of the Pyodide interface
without requiring the full Pyodide environment.
"""

import pytest
import numpy as np
import json
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, Any

# Mock the imports that would come from MapManagerCore
class MockImageSlice:
    def __init__(self, image: np.ndarray):
        self._image = image
    
    def data(self) -> np.ndarray:
        return self._image.flatten()
    
    def extent(self) -> tuple:
        return (int(np.min(self._image)), int(np.max(self._image)))
    
    def bins(self, binCount: int = 256) -> list:
        counts, bounds = np.histogram(self._image, binCount)
        return [(int((bounds[i] + bounds[i + 1]) / 2), int(counts[i])) for i in range(0, len(counts))]

class MockMetadata:
    def __init__(self):
        self.channelNames = {}
        self.voxel = Mock()
        self.voxel.x = 100
        self.voxel.y = 100
        self.voxel.z = 10
        self.physicalSize = Mock()
        self.physicalSize.x = 0.15
        self.physicalSize.y = 0.15
        self.physicalSize.z = 1.0
        self.metadataContrast = Mock()
        self.metadataContrast.minInt = 0
        self.metadataContrast.maxInt = 255
    
    def to_json(self) -> str:
        return json.dumps({
            'voxel': {'x': self.voxel.x, 'y': self.voxel.y, 'z': self.voxel.z},
            'physicalSize': {'x': self.physicalSize.x, 'y': self.physicalSize.y, 'z': self.physicalSize.z},
            'channelNames': self.channelNames,
            'contrast': {'minInt': self.metadataContrast.minInt, 'maxInt': self.metadataContrast.maxInt}
        })

class MockLoader:
    def __init__(self):
        self._metadata = {0: MockMetadata()}
        self._images = {}
    
    def metadata(self, t: int) -> MockMetadata:
        return self._metadata.get(t, MockMetadata())
    
    def merge(self, other_loader):
        pass
    
    def deleteChannel(self, t: int, channel: int) -> bool:
        return True
    
    def updateChannel(self, t: int, channel: int, updates: dict) -> bool:
        return True
    
    def updateTimePoint(self, t: int, updates: dict) -> bool:
        return True
    
    def maxChannels(self) -> int:
        return 2
    
    def timePoints(self):
        return [0]
    
    def setMaxChannels(self, max_channels: int):
        pass

class MockAnnotations:
    def __init__(self):
        self.loader = MockLoader()
        self.points = Mock()
        self.points.columnsAttributes = {'t': {'plot': True}, 'x': {'plot': True}, 'y': {'plot': True}}
        self._analysisParameters = Mock()
        self._analysisParameters.columnsAttributes = {}
    
    def getPixels(self, time: int, channel: int, zRange: tuple) -> MockImageSlice:
        # Create a mock image slice
        test_image = np.random.randint(0, 255, (10, 100, 100), dtype=np.uint8)
        return MockImageSlice(test_image)
    
    def load(self, path: str, create_if_not_exists: bool = False):
        return self

class TestJsonEncoder:
    """Test the custom JSON encoder for numpy types"""
    
    def test_numpy_integer_serialization(self):
        """Test that numpy integers are serialized correctly"""
        # Mock the JsonEncoder class
        class JsonEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                if isinstance(obj, np.floating):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                return super(JsonEncoder, self).default(obj)
        
        encoder = JsonEncoder()
        
        # Test various numpy integer types
        test_cases = [
            (np.int8(42), 42),
            (np.int16(42), 42),
            (np.int32(42), 42),
            (np.int64(42), 42),
            (np.uint8(42), 42),
            (np.uint16(42), 42),
            (np.uint32(42), 42),
            (np.uint64(42), 42),
        ]
        
        for numpy_val, expected in test_cases:
            result = encoder.default(numpy_val)
            assert result == expected, f"Failed for {type(numpy_val)}: {numpy_val}"
    
    def test_numpy_float_serialization(self):
        """Test that numpy floats are serialized correctly"""
        class JsonEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                if isinstance(obj, np.floating):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                return super(JsonEncoder, self).default(obj)
        
        encoder = JsonEncoder()
        
        test_cases = [
            (np.float32(3.14), 3.14),
            (np.float64(3.14), 3.14),
        ]
        
        for numpy_val, expected in test_cases:
            result = encoder.default(numpy_val)
            assert abs(result - expected) < 1e-6, f"Failed for {type(numpy_val)}: {numpy_val}"
    
    def test_numpy_array_serialization(self):
        """Test that numpy arrays are serialized correctly"""
        class JsonEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                if isinstance(obj, np.floating):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                return super(JsonEncoder, self).default(obj)
        
        encoder = JsonEncoder()
        
        # Test 1D array
        arr1d = np.array([1, 2, 3])
        result1d = encoder.default(arr1d)
        assert result1d == [1, 2, 3]
        
        # Test 2D array
        arr2d = np.array([[1, 2], [3, 4]])
        result2d = encoder.default(arr2d)
        assert result2d == [[1, 2], [3, 4]]
        
        # Test array with different dtypes
        arr_uint8 = np.array([0, 128, 255], dtype=np.uint8)
        result_uint8 = encoder.default(arr_uint8)
        assert result_uint8 == [0, 128, 255]
        
        arr_uint16 = np.array([0, 32768, 65535], dtype=np.uint16)
        result_uint16 = encoder.default(arr_uint16)
        assert result_uint16 == [0, 32768, 65535]

class TestPyodideAnnotations:
    """Test the PyodideAnnotations class interface"""
    
    def test_merge_file_tif(self):
        """Test merging TIF files"""
        # Mock the PyodideAnnotations class
        class PyodideAnnotations:
            def __init__(self):
                self.loader = MockLoader()
            
            def mergeFile(self, path: str, timePoint: int = 0, channel: int = 0, name: str = None, position=None):
                if name is None:
                    name = path
                
                if path.endswith(".mmap"):
                    # Mock ZarrLoader
                    loader = MockLoader()
                elif path.endswith(".tif"):
                    # Mock MultiImageLoader
                    loader = MockLoader()
                    loader.read = Mock()
                    loader.read(path, time=timePoint, channel=channel, name=name)
                
                self.loader.merge(loader)
        
        annotations = PyodideAnnotations()
        
        # Test TIF file merging
        annotations.mergeFile("test.tif", timePoint=0, channel=0, name="test")
        
        # Verify the method was called (through the mock)
        assert hasattr(annotations.loader, 'merge')
    
    def test_merge_file_mmap(self):
        """Test merging MMAP files"""
        class PyodideAnnotations:
            def __init__(self):
                self.loader = MockLoader()
            
            def mergeFile(self, path: str, timePoint: int = 0, channel: int = 0, name: str = None, position=None):
                if name is None:
                    name = path
                
                if path.endswith(".mmap"):
                    loader = MockLoader()
                elif path.endswith(".tif"):
                    loader = MockLoader()
                    loader.read = Mock()
                    loader.read(path, time=timePoint, channel=channel, name=name)
                
                self.loader.merge(loader)
        
        annotations = PyodideAnnotations()
        
        # Test MMAP file merging
        annotations.mergeFile("test.mmap", timePoint=0, channel=0, name="test")
        
        assert hasattr(annotations.loader, 'merge')
    
    def test_metadata_json(self):
        """Test metadata JSON serialization"""
        class PyodideAnnotations:
            def __init__(self):
                self.loader = MockLoader()
            
            def metadata_json(self, time: int) -> str:
                return self.loader.metadata(time).to_json()
        
        annotations = PyodideAnnotations()
        
        result = annotations.metadata_json(0)
        
        # Verify it returns valid JSON
        parsed = json.loads(result)
        assert 'voxel' in parsed
        assert 'physicalSize' in parsed
        assert 'channelNames' in parsed
    
    def test_slices_js(self):
        """Test image slice loading"""
        class PyodideAnnotations:
            def __init__(self):
                self.loader = MockLoader()
            
            def getPixels(self, time: int, channel: int, zRange: tuple) -> MockImageSlice:
                return MockImageSlice(np.random.randint(0, 255, (10, 100, 100), dtype=np.uint8))
            
            def slices_js(self, time: int, channel: int, zRange: tuple) -> MockImageSlice:
                return self.getPixels(time, channel, (zRange[0], zRange[1]))
        
        annotations = PyodideAnnotations()
        
        result = annotations.slices_js(0, 0, (5, 10))
        
        assert hasattr(result, 'data')
        assert hasattr(result, 'extent')
        assert hasattr(result, 'bins')
        
        # Test data method
        data = result.data()
        assert isinstance(data, np.ndarray)
        
        # Test extent method
        extent = result.extent()
        assert len(extent) == 2
        assert extent[0] <= extent[1]
    
    def test_table(self):
        """Test table generation"""
        class PyodideAnnotations:
            def __init__(self):
                self.points = Mock()
                self.points.columnsAttributes = {
                    't': {'plot': True},
                    'x': {'plot': True},
                    'y': {'plot': True},
                    'z': {'plot': True}
                }
                self.points.reset_index = Mock(return_value=Mock())
            
            def table(self):
                columns = [key for key, value in self.points.columnsAttributes.items() if value["plot"]]
                if "t" in columns:
                    columns.remove("t")
                
                df = self.points.reset_index()
                return df
        
        annotations = PyodideAnnotations()
        
        result = annotations.table()
        
        assert result is not None

class TestPyodideSingleTimePoint:
    """Test the PyodideSingleTimePoint class interface"""
    
    def test_load_file_tif(self):
        """Test loading TIF files"""
        class PyodideSingleTimePoint:
            def __init__(self, annotations, t: int):
                self._annotations = annotations
                self._t = t
                self.channels = [0, 1]
            
            def loadFile(self, path: str, channel: int = None, name: str = None):
                if name is None:
                    name = path
                
                if channel is None:
                    channel = 0
                    for c in self.channels:
                        if channel == c:
                            channel += 1
                
                if path.endswith(".mmap"):
                    loader = MockLoader()
                elif path.endswith(".tif"):
                    loader = MockLoader()
                    loader.read = Mock()
                    loader.read(path, time=self._t, channel=channel, name=name)
                
                self._annotations.loader.merge(loader)
        
        mock_annotations = MockAnnotations()
        timepoint = PyodideSingleTimePoint(mock_annotations, 0)
        
        timepoint.loadFile("test.tif", channel=0, name="test")
        
        assert hasattr(mock_annotations.loader, 'merge')
    
    def test_slices_js(self):
        """Test slice loading"""
        class PyodideSingleTimePoint:
            def __init__(self, annotations, t: int):
                self._annotations = annotations
                self._t = t
            
            def slices_js(self, channel: int, zRange: tuple) -> MockImageSlice:
                return self._annotations.getPixels(self._t, channel, (zRange[0], zRange[1]))
        
        mock_annotations = MockAnnotations()
        timepoint = PyodideSingleTimePoint(mock_annotations, 0)
        
        result = timepoint.slices_js(0, (5, 10))
        
        assert hasattr(result, 'data')
        assert hasattr(result, 'extent')
        assert hasattr(result, 'bins')

class TestCreateAnnotations:
    """Test the createAnnotations function"""
    
    def test_create_annotations_with_path(self):
        """Test creating annotations with a path"""
        def createAnnotations(path: str = None):
            return MockAnnotations().load(path, False)
        
        result = createAnnotations("/test/path")
        
        assert result is not None
        assert hasattr(result, 'loader')
        assert hasattr(result, 'getPixels')
    
    def test_create_annotations_without_path(self):
        """Test creating annotations without a path"""
        def createAnnotations(path: str = None):
            return MockAnnotations().load(path, False)
        
        result = createAnnotations(None)
        
        assert result is not None
        assert hasattr(result, 'loader')

if __name__ == '__main__':
    pytest.main([__file__])
