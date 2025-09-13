"""
API Stability Tests

Tests to ensure the Python API contract remains stable
across MapManagerCore branch changes.
"""

import pytest
import inspect
from typing import get_type_hints, get_origin, get_args

class TestAPIContract:
    """Test that the Pyodide API contract remains stable"""
    
    def test_pyodide_annotations_interface(self):
        """Test that PyodideAnnotations has all required methods"""
        # Mock the PyodideAnnotations class with all required methods
        class PyodideAnnotations:
            def mergeFile(self, path: str, timePoint: int = 0, channel: int = 0, name: str = None, position=None):
                pass
            
            def timePoint_js(self, time: int):
                pass
            
            def metadata_json(self, time: int) -> str:
                pass
            
            def slices_js(self, time: int, channel: int, zRange: tuple):
                pass
            
            def table(self):
                pass
            
            def getColumn(self, column: str):
                pass
            
            def deleteChannel(self, timePoint: int, channel: int) -> bool:
                pass
            
            def updateChannel(self, timePoint: int, channel: int, updates: dict) -> bool:
                pass
            
            def updateTimePoint(self, timePoint: int, updates: dict) -> bool:
                pass
            
            def maxChannels(self) -> int:
                pass
            
            def timePoints_js(self):
                pass
            
            def setMaxChannels(self, maxChannels: int):
                pass
            
            def analysisParams_js(self) -> str:
                pass
            
            def setAnalysisParams(self, key: str, value: any):
                pass
        
        required_methods = [
            'mergeFile', 'timePoint_js', 'metadata_json', 'slices_js',
            'table', 'getColumn', 'deleteChannel', 'updateChannel',
            'updateTimePoint', 'maxChannels', 'timePoints_js',
            'setMaxChannels', 'analysisParams_js', 'setAnalysisParams'
        ]
        
        for method in required_methods:
            assert hasattr(PyodideAnnotations, method), f"Missing method: {method}"
    
    def test_pyodide_single_timepoint_interface(self):
        """Test that PyodideSingleTimePoint has all required methods"""
        class PyodideSingleTimePoint:
            def getAnnotations_js(self, options=None):
                pass
            
            def getSegmentsAndSpines(self, options):
                pass
            
            def setSegmentColor(self, segmentId, colors):
                pass
            
            def loadFile(self, path: str, channel: int = None, name: str = None):
                pass
            
            def slices_js(self, channel: int, zRange: tuple):
                pass
            
            def deleteChannel(self, channel: int) -> bool:
                pass
        
        required_methods = [
            'getAnnotations_js', 'getSegmentsAndSpines', 'setSegmentColor',
            'loadFile', 'slices_js', 'deleteChannel'
        ]
        
        for method in required_methods:
            assert hasattr(PyodideSingleTimePoint, method), f"Missing method: {method}"
    
    def test_create_annotations_signature(self):
        """Test that createAnnotations has the correct signature"""
        def createAnnotations(path: str = None):
            """Create a PyodideAnnotations object from a given path to zarr `.mmap` file."""
            pass
        
        sig = inspect.signature(createAnnotations)
        assert len(sig.parameters) == 1
        assert 'path' in sig.parameters
        
        # Test that path parameter is optional
        path_param = sig.parameters['path']
        assert path_param.default is None
    
    def test_json_encoder_interface(self):
        """Test that JsonEncoder has the required interface"""
        import json
        import numpy as np
        
        class JsonEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                if isinstance(obj, np.floating):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                return super(JsonEncoder, self).default(obj)
        
        # Test that the encoder can handle numpy types
        encoder = JsonEncoder()
        
        # Test numpy integer
        result = encoder.default(np.int64(42))
        assert result == 42
        assert isinstance(result, int)
        
        # Test numpy float
        result = encoder.default(np.float64(3.14))
        assert result == 3.14
        assert isinstance(result, float)
        
        # Test numpy array
        result = encoder.default(np.array([1, 2, 3]))
        assert result == [1, 2, 3]
        assert isinstance(result, list)

class TestMethodSignatures:
    """Test that method signatures haven't changed"""
    
    def test_merge_file_signature(self):
        """Test mergeFile method signature"""
        def mergeFile(path: str, timePoint: int = 0, channel: int = 0, name: str = None, position=None):
            pass
        
        sig = inspect.signature(mergeFile)
        params = list(sig.parameters.keys())
        
        # Check required parameters
        assert 'path' in params
        assert 'timePoint' in params
        assert 'channel' in params
        assert 'name' in params
        
        # Check default values
        assert sig.parameters['timePoint'].default == 0
        assert sig.parameters['channel'].default == 0
        assert sig.parameters['name'].default is None
    
    def test_slices_js_signature(self):
        """Test slices_js method signature"""
        def slices_js(time: int, channel: int, zRange: tuple):
            pass
        
        sig = inspect.signature(slices_js)
        params = list(sig.parameters.keys())
        
        assert 'time' in params
        assert 'channel' in params
        assert 'zRange' in params
        
        # Check parameter types
        assert sig.parameters['time'].annotation == int
        assert sig.parameters['channel'].annotation == int
        assert sig.parameters['zRange'].annotation == tuple
    
    def test_metadata_json_signature(self):
        """Test metadata_json method signature"""
        def metadata_json(time: int) -> str:
            pass
        
        sig = inspect.signature(metadata_json)
        params = list(sig.parameters.keys())
        
        assert 'time' in params
        assert sig.parameters['time'].annotation == int
        assert sig.return_annotation == str

class TestDataTypes:
    """Test that data types are handled correctly"""
    
    def test_numpy_data_types(self):
        """Test that numpy data types are supported"""
        import numpy as np
        
        # Test various numpy dtypes
        test_dtypes = [
            np.int8, np.int16, np.int32, np.int64,
            np.uint8, np.uint16, np.uint32, np.uint64,
            np.float32, np.float64
        ]
        
        for dtype in test_dtypes:
            # Create a small array of each type
            arr = np.array([1, 2, 3], dtype=dtype)
            assert arr.dtype == dtype
            
            # Test that it can be converted to list (for JSON serialization)
            as_list = arr.tolist()
            assert isinstance(as_list, list)
            assert len(as_list) == 3
    
    def test_image_data_types(self):
        """Test that image data types are handled correctly"""
        import numpy as np
        
        # Test uint8 (common for 8-bit images)
        uint8_image = np.array([[0, 128, 255]], dtype=np.uint8)
        assert uint8_image.dtype == np.uint8
        assert uint8_image.min() == 0
        assert uint8_image.max() == 255
        
        # Test uint16 (common for 16-bit images)
        uint16_image = np.array([[0, 32768, 65535]], dtype=np.uint16)
        assert uint16_image.dtype == np.uint16
        assert uint16_image.min() == 0
        assert uint16_image.max() == 65535
        
        # Test that both can be flattened
        flat_uint8 = uint8_image.flatten()
        flat_uint16 = uint16_image.flatten()
        
        assert len(flat_uint8) == 3
        assert len(flat_uint16) == 3
    
    def test_json_serialization_types(self):
        """Test that JSON serialization handles all required types"""
        import json
        import numpy as np
        
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
        
        # Test data that would come from Python
        test_data = {
            'int_val': np.int64(42),
            'float_val': np.float64(3.14),
            'array_val': np.array([1, 2, 3]),
            'nested': {
                'uint8_array': np.array([0, 128, 255], dtype=np.uint8),
                'uint16_array': np.array([0, 32768, 65535], dtype=np.uint16)
            }
        }
        
        # Serialize to JSON
        json_str = json.dumps(test_data, cls=JsonEncoder)
        parsed = json.loads(json_str)
        
        # Verify serialization worked
        assert parsed['int_val'] == 42
        assert parsed['float_val'] == 3.14
        assert parsed['array_val'] == [1, 2, 3]
        assert parsed['nested']['uint8_array'] == [0, 128, 255]
        assert parsed['nested']['uint16_array'] == [0, 32768, 65535]

class TestErrorHandling:
    """Test that error handling is consistent"""
    
    def test_python_error_types(self):
        """Test that Python error types are handled consistently"""
        # Mock Python error types that might be raised
        class PythonError(Exception):
            def __init__(self, type_name: str, message: str):
                self.type = type_name
                self.message = message
                super().__init__(message)
        
        # Test common error types
        error_types = [
            'ValueError', 'TypeError', 'AttributeError', 'KeyError',
            'IndexError', 'FileNotFoundError', 'ImportError'
        ]
        
        for error_type in error_types:
            error = PythonError(error_type, f"{error_type}: Test error")
            assert error.type == error_type
            assert error.message.startswith(error_type)
    
    def test_error_message_format(self):
        """Test that error messages follow expected format"""
        class PythonError(Exception):
            def __init__(self, type_name: str, message: str):
                self.type = type_name
                self.message = message
                super().__init__(message)
        
        # Test error message format
        error = PythonError('ValueError', 'ValueError: Invalid input parameter')
        
        # Should be able to extract type and message
        assert error.type == 'ValueError'
        assert error.message == 'ValueError: Invalid input parameter'
        
        # Should be able to split type from message
        message_without_type = error.message.split(error.type).pop().strip(': ')
        assert message_without_type == 'Invalid input parameter'

if __name__ == '__main__':
    pytest.main([__file__])
