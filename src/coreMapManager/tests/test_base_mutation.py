import unittest
import geopandas as gp
from ..annotations.base.base_mutation import AnnotationsBaseMut
from ..store.image.base import ImageLoader


class NilLoader(ImageLoader):
    def __init__(self):
        pass


class TestAnnotationsBaseMut(unittest.TestCase):

    def new(self):
        return AnnotationsBaseMut(NilLoader(), gp.GeoDataFrame(columns=['segment']), gp.GeoDataFrame(columns=['point']))

    def test_undo_redo_simple_spine(self):
        annotations = self.new()
        annotations.updateSpine("spine_id", {"point": 0})
        self.assertEqual(annotations._points.loc["spine_id", "point"], 0)

        # Undo the update
        annotations.undo()
        self.assertNotIn("spine_id", annotations._points.index)

        # Redo the update
        annotations.redo()
        self.assertEqual(annotations._points.loc["spine_id", "point"], 0)

        # Redo again (should have no effect)
        annotations.redo()
        self.assertEqual(annotations._points.loc["spine_id", "point"], 0)

        annotations.updateSpine("spine_id", {"point": 1})
        self.assertEqual(annotations._points.loc["spine_id", "point"], 1)
        annotations.undo()
        self.assertEqual(annotations._points.loc["spine_id", "point"], 0)
        annotations.redo()
        self.assertEqual(annotations._points.loc["spine_id", "point"], 1)
        annotations.undo()
        self.assertEqual(annotations._points.loc["spine_id", "point"], 0)

        # Undo twice (should have no effect)
        annotations.undo()
        self.assertNotIn("spine_id", annotations._points.index)
        annotations.undo()
        self.assertNotIn("spine_id", annotations._points.index)

    def test_undo_redo_replace(self):
        annotations = self.new()
        # Test replaceLog
        annotations.updateSpine("spine_id", {"point": 2})
        self.assertEqual(len(annotations._log.operations), 1)
        self.assertEqual(annotations._points.loc["spine_id", "point"], 2)
        
        annotations.updateSpine("spine_id", {"point": 3})
        self.assertEqual(len(annotations._log.operations), 2)
        self.assertEqual(annotations._points.loc["spine_id", "point"], 3)

        annotations.updateSpine("spine_id", {"point": 4}, replaceLog=True)
        self.assertEqual(len(annotations._log.operations), 2)
        self.assertEqual(annotations._points.loc["spine_id", "point"], 4)
      
        annotations.undo()
        self.assertEqual(annotations._points.loc["spine_id", "point"], 2)

        annotations.undo()
        self.assertNotIn("spine_id", annotations._points.index)
        
        annotations.redo()
        self.assertEqual(annotations._points.loc["spine_id", "point"], 2)

        annotations.redo()
        self.assertEqual(annotations._points.loc["spine_id", "point"], 4)

    def test_undo_redo_simple_segment(self):
        annotations = self.new()
        annotations.updateSegment("segment_id", {"segment": 1})
        self.assertEqual(
            annotations._lineSegments.loc["segment_id", "segment"], 1)

        # Undo the update
        annotations.undo()
        self.assertNotIn("segment_id", annotations._lineSegments.index)

        # Redo the update
        annotations.redo()
        self.assertEqual(
            annotations._lineSegments.loc["segment_id", "segment"], 1)

    def test_delete_spine(self):
        annotations = self.new()
        annotations.updateSpine("spine_id", {"point": 0})
        self.assertIn("spine_id", annotations._points.index)

        # Delete the spine
        annotations.deleteSpine("spine_id")
        self.assertNotIn("spine_id", annotations._points.index)

        # Undo the deletion
        annotations.undo()
        self.assertIn("spine_id", annotations._points.index)

        # Redo the deletion
        annotations.redo()
        self.assertNotIn("spine_id", annotations._points.index)

    def test_delete_segment(self):
        annotations = self.new()
        annotations.updateSegment("segment_id", {"segment": 1})
        self.assertIn("segment_id", annotations._lineSegments.index)

        # Delete the segment
        annotations.deleteSegment("segment_id")
        self.assertNotIn("segment_id", annotations._lineSegments.index)

        # Undo the deletion
        annotations.undo()
        self.assertIn("segment_id", annotations._lineSegments.index)

        # Redo the deletion
        annotations.redo()
        self.assertNotIn("segment_id", annotations._lineSegments.index)


if __name__ == '__main__':
    unittest.main()
